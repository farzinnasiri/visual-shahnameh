"""Build the reader's Persian contents from the 61 chapter files.

Usage: python3 -I scripts/build_toc.py text/chapters src/content/toc.json
Each file in text/chapters is one chapter. A section id is chapter.place.
"""

import json
import os
import sys

ERAS = [
    {"id": "prologue", "title": "دیباچه"},
    {"id": "myth", "title": "روزگار اسطوره"},
    {"id": "heroes", "title": "روزگار پهلوانان"},
    {"id": "history", "title": "روزگار تاریخ"},
]


def load_book(src: str) -> dict:
    files = sorted(name for name in os.listdir(src) if len(name) == 7 and name.endswith(".json") and name[:2].isdigit())
    chapters = []
    for name in files:
        with open(os.path.join(src, name), encoding="utf-8") as f:
            chapters.append(json.load(f))
    map_path = os.path.join(os.path.dirname(src), "chapter-map.json")
    with open(map_path, encoding="utf-8") as f:
        mapping = json.load(f)
    aliases = {item["heading"]: item["section"] for item in mapping["joinedHeadings"]}
    return {"chapters": chapters, "sectionAliases": aliases}


def main(src: str, out: str) -> None:
    book = load_book(src)
    chapters = [
        {
            "id": ch["id"],
            "title": ch["title"],
            "era": ch["era"],
            "sections": [[s["id"], s["title"], len(s["couplets"])] for s in ch["sections"]],
        }
        for ch in book["chapters"]
    ]
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"eras": ERAS, "sectionAliases": book["sectionAliases"], "chapters": chapters}, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"{out}: {len(chapters)} chapters, {sum(len(c['sections']) for c in chapters)} sections")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
