"""Build clean, structured Shahnameh text from the source PDF.

Usage (from the project root):
    .venv/bin/python -I scripts/build_text.py text/shahnameh-ferdowsi.pdf text/

PDF layout facts this relies on (checked by hand on several pages):
  * 15pt BNazaninBold = verse. Right column (x > page centre) holds the first
    hemistich (مصراع اول), the left column holds the second. Rows align on y.
    Justified rows are split into one text line per word, so words are
    re-joined right-to-left by x.
  * 30pt = chapter (book/king) title, alone on its own page.
  * 21pt = section (sub-chapter) heading, placed between verse rows.
  * BZarBold 14pt = page number at the bottom; Times "www.takbook.com" = footer.
  * The لا ligature glyph is decoded by PyMuPDF in reverse order ("ال"), e.g.
    پولاد -> "پوالد". The alef that comes from the ligature has a zero-width
    glyph box, while a real alef does not, so only those pairs are swapped back.
  * Some pages use Arabic yeh/kaf (ي ك); they are normalised to Persian ی ک.

The PDF is a reference for rebuilding the text. Extraction follows its
headings, then text/chapter-map.json gathers those sections into 61 chapters.
Published section ids are the chapter number plus the section's place in that
chapter. Chapter 07 keeps its ids because an empty heading was joined into
07.14. The written text is text/chapters/NN.json.
"""

import hashlib
import json
import os
import sys
from pathlib import Path

import pymupdf

VERSE_SIZE = 15
CHAPTER_MIN = 25
SECTION_MIN = 18
ROW_TOLERANCE = 4  # points: words on the same row within one column
PERSIAN_LETTERS = str.maketrans({"ي": "ی", "ك": "ک", "ى": "ی"})
PAIR_TOLERANCE = 10  # points: first vs second hemistich; columns drift up to ~6pt, rows are 25pt apart


def section_digest(sections):
    payload = [[s["id"], s["title"], s["pdfPage"], s["couplets"]] for s in sections]
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def join_wrapped_headings(chapters, mapping):
    """Join reviewed heading continuations without guessing or renumbering."""
    sections = [s for ch in chapters for s in ch["sections"]]
    if section_digest(sections) != mapping["pdfSectionContentSha256"]:
        raise ValueError("PDF extraction changed; review it before updating the source checksum")
    aliases = {}
    for join in mapping["joinedHeadings"]:
        group = next(ch["sections"] for ch in chapters if any(s["id"] == join["heading"] for s in ch["sections"]))
        at = next(i for i, s in enumerate(group) if s["id"] == join["heading"])
        heading = group[at]
        if at + 1 >= len(group):
            raise ValueError("A wrapped heading must have an adjacent continuation")
        section = group[at + 1]
        if heading["couplets"] or section["id"] != join["section"] or not section["couplets"]:
            raise ValueError("Only an empty heading followed by its text section can be joined")
        if heading["pdfPage"] != join["pdfPage"] or section["pdfPage"] != join["pdfPage"]:
            raise ValueError("Wrapped heading lines must be on the reviewed PDF page")
        section["title"] = f"{heading['title']} {section['title']}"
        del group[at]
        aliases[heading["id"]] = section["id"]
    return aliases


def regroup_chapters(chapters, mapping):
    """Apply a complete, contiguous partition of the existing section order."""
    sections = [s for ch in chapters for s in ch["sections"]]
    if section_digest(sections) != mapping["sectionContentSha256"]:
        raise ValueError("Extracted section content changed; review it before updating the chapter map checksum")
    positions = {s["id"]: i for i, s in enumerate(sections)}
    if len(positions) != len(sections):
        raise ValueError("Duplicate source section IDs")
    entries = mapping["chapters"]
    if [ch["id"] for ch in entries] != [f"{i:02d}" for i in range(1, 62)]:
        raise ValueError("Chapter map must contain chapters 01 through 61 in order")
    result = []
    cursor = 0
    for ch in entries:
        start = positions[ch["legacyFirstSection"]]
        end = positions[ch["legacyLastSection"]] + 1
        if start != cursor or end <= start:
            raise ValueError(f"Chapter {ch['id']} skips, duplicates or reorders sections")
        result.append({
            "title": ch["title"],
            "pdfPage": ch["pdfPage"],
            "sections": sections[start:end],
            "id": ch["id"],
            "era": ch["era"],
            "reference": ch["reference"],
        })
        cursor = end
    if cursor != len(sections):
        raise ValueError("Chapter map leaves sections unassigned")
    return result


def publish_section_ids(chapters):
    """Number each section as chapter.place. Chapter 07 already uses its chapter number."""
    for chapter in chapters:
        if chapter["id"] == "07":
            continue
        for index, section in enumerate(chapter["sections"], 1):
            section["id"] = f"{chapter['id']}.{index:02d}"


def span_text(span):
    chars = span["chars"]
    out = []
    i = 0
    while i < len(chars):
        c = chars[i]
        nxt = chars[i + 1] if i + 1 < len(chars) else None
        if c["c"] == "ا" and nxt and nxt["c"] == "ل" and c["bbox"][2] - c["bbox"][0] < 0.01:
            out.append("لا")
            i += 2
            continue
        out.append(c["c"])
        i += 1
    # The الله ligature is decoded as "اهلل"; it occurs once (الله اکبر).
    return "".join(out).translate(PERSIAN_LETTERS).replace("اهلل", "الله")


def page_events(page, page_index):
    mid = page.rect.width / 2
    headings = []
    words = []  # (column, y, x, text)
    for block in page.get_text("rawdict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span_text(s) for s in line["spans"]).strip()
            if not text:
                continue
            span = line["spans"][0]
            size = round(span["size"])
            font = span["font"]
            x0, y0, x1, _ = line["bbox"]
            if "Times" in font or font.startswith("BZar"):
                continue  # footer url / page number
            if size >= CHAPTER_MIN:
                headings.append(("chapter", y0, text))
            elif size >= SECTION_MIN:
                headings.append(("section", y0, text))
            elif size == VERSE_SIZE:
                column = "first" if (x0 + x1) / 2 > mid else "second"
                words.append((column, y0, x1, text))
            else:
                headings.append(("other", y0, f"{size}pt {font}: {text}"))

    rows = {"first": [], "second": []}
    for column, y, x, text in sorted(words, key=lambda w: (w[0], w[1], -w[2])):
        col_rows = rows[column]
        if col_rows and abs(col_rows[-1]["y"] - y) <= ROW_TOLERANCE:
            col_rows[-1]["words"].append(text)
        else:
            col_rows.append({"y": y, "words": [text]})

    events = []
    anomalies = []
    seconds = list(rows["second"])
    for first in rows["first"]:
        match = next((s for s in seconds if abs(s["y"] - first["y"]) <= PAIR_TOLERANCE), None)
        if match is None:
            anomalies.append((page_index + 1, "unpaired first", " ".join(first["words"])))
            events.append(("couplet", first["y"], [" ".join(first["words"]), ""]))
            continue
        seconds.remove(match)
        events.append(("couplet", first["y"], [" ".join(first["words"]), " ".join(match["words"])]))
    for s in seconds:
        anomalies.append((page_index + 1, "unpaired second", " ".join(s["words"])))
        events.append(("couplet", s["y"], ["", " ".join(s["words"])]))

    events.extend(headings)
    events.sort(key=lambda e: e[1])
    return events, anomalies


def main():
    src, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    doc = pymupdf.open(src)

    chapters = []
    all_anomalies = []
    started = False
    for i, page in enumerate(doc):
        events, anomalies = page_events(page, i)
        if not started:
            if any(e[0] == "chapter" for e in events):
                started = True
            else:
                continue  # front matter and table of contents
        all_anomalies.extend(anomalies)
        for kind, _, payload in events:
            if kind == "other":
                all_anomalies.append((i + 1, "unexpected text", payload))
            elif kind == "chapter":
                chapters.append({"title": payload, "pdfPage": i + 1, "sections": []})
            elif kind == "section":
                chapters[-1]["sections"].append({"title": payload, "pdfPage": i + 1, "couplets": []})
            else:
                sections = chapters[-1]["sections"]
                if not sections:  # verse before any section heading
                    sections.append({"title": chapters[-1]["title"], "pdfPage": i + 1, "couplets": []})
                sections[-1]["couplets"].append(payload)

    # Number chapters, sections and couplets so other files can cite them.
    for ci, chapter in enumerate(chapters, 1):
        chapter["id"] = f"{ci:02d}"
        for si, section in enumerate(chapter["sections"], 1):
            section["id"] = f"{ci:02d}.{si:02d}"

    map_path = Path(__file__).resolve().parent.parent / "text/chapter-map.json"
    with map_path.open(encoding="utf-8") as f:
        mapping = json.load(f)
    aliases = join_wrapped_headings(chapters, mapping)
    chapters = regroup_chapters(chapters, mapping)
    publish_section_ids(chapters)
    known = {section["id"] for chapter in chapters for section in chapter["sections"]}
    missing = [target for target in aliases.values() if target not in known]
    if missing:
        raise ValueError(f"Heading aliases do not survive section numbering: {missing}")

    chapters_dir = os.path.join(out_dir, "chapters")
    os.makedirs(chapters_dir, exist_ok=True)
    for chapter in chapters:
        with open(os.path.join(chapters_dir, f"{chapter['id']}.json"), "w", encoding="utf-8") as f:
            json.dump({
                "id": chapter["id"],
                "title": chapter["title"],
                "era": chapter["era"],
                "reference": chapter["reference"],
                "pdfPage": chapter["pdfPage"],
                "sections": [
                    {"id": section["id"], "title": section["title"], "pdfPage": section["pdfPage"], "couplets": section["couplets"]}
                    for section in chapter["sections"]
                ],
            }, f, ensure_ascii=False, indent=1)
            f.write("\n")
    monolith = os.path.join(out_dir, "shahnameh.json")
    if os.path.exists(monolith):
        os.remove(monolith)

    with open(os.path.join(out_dir, "shahnameh.md"), "w", encoding="utf-8") as f:
        f.write("# شاهنامه فردوسی\n\n")
        f.write("<!-- Generated by scripts/build_text.py. Each verse line is one couplet (بیت):\n")
        f.write("     first hemistich, then ' / ', then second hemistich. Numbers in [] are\n")
        f.write("     the chapter, the section (chapter.section), and the PDF page for reference.\n")
        f.write("     The chapter files in text/chapters are the text. Verse text is unchanged. -->\n\n")
        for chapter in chapters:
            f.write(f"\n# {chapter['title']}  [{chapter['id']} · pdf p{chapter['pdfPage']}]\n")
            for section in chapter["sections"]:
                f.write(f"\n## {section['title']}  [{section['id']} · pdf p{section['pdfPage']}]\n\n")
                for n, (a, b) in enumerate(section["couplets"], 1):
                    f.write(f"{n}. {a} / {b}\n")

    with open(os.path.join(out_dir, "anomalies.txt"), "w", encoding="utf-8") as f:
        for page_no, kind, text in all_anomalies:
            f.write(f"pdf p{page_no}\t{kind}\t{text}\n")

    couplets = sum(len(s["couplets"]) for c in chapters for s in c["sections"])
    sections = sum(len(c["sections"]) for c in chapters)
    print(f"chapters={len(chapters)} sections={sections} couplets={couplets} anomalies={len(all_anomalies)}")


if __name__ == "__main__":
    main()
