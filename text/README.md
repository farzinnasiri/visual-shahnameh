# Shahnameh text

The text is `chapters/`. The PDF is the reference that extraction was checked against.
The [PDF preface](shahnameh-ferdowsi.pdf#page=4), on physical page 4, credits
Pejman Pourhossein (پژمان پورحسین), dated Shahrivar 1391 SH. It describes a
compilation consulting Fereydoun Joneydi's first edition of 1387 SH,
Mohammad Ramazani's second edition of 1354 SH, and data from RiRa and Ganjoor.
The PDF carries takbook.com branding. It is not a facsimile of a single
Joneydi edition; our earlier attribution to "Joneydi's 1354 edition" was wrong.

| File | Use it for |
| --- | --- |
| [chapters/NN.json](chapters) | The text. One file per chapter, `01.json` through `61.json`. A section id is `chapter.place`: `10.01` is the first section of chapter 10. Couplets are `[first, second]`. |
| `shahnameh.md` | The same text for reading and grepping. `#` = chapter, `##` = section, one numbered couplet per line: `first hemistich / second hemistich`. |
| [shahnameh-ferdowsi.pdf](shahnameh-ferdowsi.pdf) | Reference only, for checking a doubtful line against the page it was extracted from. `pdfPage` is that physical page, starting at 1. It is not a section id. |
| [chapter-map.json](chapter-map.json) | Used only when rebuilding the chapter files from the PDF. Its `legacyFirstSection` values are the PDF's own heading numbers, not the published section ids. |
| `anomalies.txt` | The 10 rows where a hemistich had no partner in the PDF. Check these by eye against the PDF before using those passages. |

The book is 61 chapters, 645 sections, 49,615 verse rows.
Ten rows lack one hemistich, so this is not a fully proofread couplet count.
The chapter files follow the 61-chapter list used by Ganjoor. The finer
subsection divisions and the PDF's verse pairings have not been replaced
with Ganjoor's text. Builders read `chapters/NN.json` and do not need the PDF.

The first sub-chapter, آغاز کتاب → آغاز کتاب, is section `01.01` (15 couplets).

On physical PDF page 106, one heading wraps onto a second line ending in
«فریدون». Those lines originally created an empty `07.13` and put all 128
couplets under `07.14`. They are now joined into one full title on `07.14`.
The retired `07.13` URL redirects to `07.14`, preserving existing reading
positions and artwork. No verses changed; the contents no longer includes
an empty stop between `07.12` and `07.14`.

## How it was made

```sh
python3 -m venv .venv && .venv/bin/pip install pymupdf
.venv/bin/python -I scripts/build_text.py text/shahnameh-ferdowsi.pdf text/
python3 -I scripts/build_toc.py text/chapters src/content/toc.json
node scripts/update_readme_contents.mjs
pnpm check:chapters

# Optional independent extraction check:
mkdir -p work/text-crosscheck
.venv/bin/pip install pypdf && .venv/bin/python -I scripts/extract_pdf.py text/shahnameh-ferdowsi.pdf work/text-crosscheck/raw.txt   # optional check:
python3 -I scripts/crosscheck.py text/shahnameh.md work/text-crosscheck/raw.txt
```

After installing PyMuPDF in `.venv`, `pnpm text:build` runs the first four
generation and validation commands together. Rebuilding retains the 61-chapter
organization and heading correction. Recorded checksums reject unexpected
changes to either the raw extraction or corrected sections; any future source
correction must be reviewed before updating them.

The PDF prints the verse in two columns. The script uses PyMuPDF glyph
positions to pair them and to place section headings between rows. See the
docstring in `scripts/build_text.py` for the layout rules and fixes, which are:

- The لا ligature is decoded backwards by PyMuPDF. Those pairs are detected by
  their zero-width glyph box and swapped back.
- Arabic ي and ك are normalised to Persian ی and ک.
- ZWNJ (نیم‌فاصله) from the PDF is kept, for example `نگارنده‌ی`.

The original extraction check found every word except 4 in pypdf's independent
extraction. That word-presence check does not establish correct verse order,
pairing, boundaries, or equivalence to another edition.

The spelling follows the source edition (for example `برترست`, `بی‌کار`).
Don't modernise it silently. Section checks compare content with this source;
correct extraction errors through an explicit, reviewed source correction.

Some opening hemistichs land in the preceding local section. For example,
`37.21` ends with Ganjoor's first hemistich for Yazdgerd II, and `40.01` ends
with its first hemistich for Qobad, paired with different second hemistichs.
Physical PDF page 1480 itself prints a pairing that differs from Ganjoor.
Review the PDF's pairings as well as extraction boundaries and the ten
hemistich anomalies before building the affected passages. Regrouping preserves
the existing text and section boundaries; these editorial issues still need a
separate source review.
