// Check that chapter regrouping preserves the source and all its consumers.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { coupletDigest, loadBook } from "./book.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const { chapters, sectionAliases, mapping } = loadBook(fileURLToPath(root));
const book = { chapters, sectionAliases };
const toc = JSON.parse(read("src/content/toc.json"));
const sections = book.chapters.flatMap(c => c.sections);
const ids = sections.map(s => s.id);
const chapter07 = [...Array(12).keys()].map(i => `07.${String(i + 1).padStart(2, "0")}`).concat(["07.14", "07.15", "07.16", "07.17", "07.18"]);
assert.equal(sections.find(s => s.id === "07.14")?.title,
  "آگاه شدن سلم و تور از پادشاهی منوچهر فرستادن پیام به نزد فریدون",
  "The two-line heading on PDF page 106 must be one section title");
assert(!ids.includes("07.13"), "The first heading line must not create an empty section");
assert.equal(new Set(ids).size, ids.length, "Section IDs must be unique");
assert.equal(book.chapters.length, 61, "Expected the 61-chapter organization");
assert.equal(mapping.chapters.length, 61);
assert.equal(coupletDigest(book.chapters), mapping.coupletTextSha256, "Verse text changed");

for (const [i, chapter] of book.chapters.entries()) {
  const expected = mapping.chapters[i];
  assert.equal(chapter.id, String(i + 1).padStart(2, "0"));
  assert.equal(chapter.id, expected.id);
  for (const key of ["title", "era", "pdfPage", "reference"]) assert.equal(chapter[key], expected[key]);
  chapter.sections.forEach((section, index) => {
    assert(section.id.startsWith(`${chapter.id}.`), `${section.id} is not in chapter ${chapter.id}`);
    if (chapter.id !== "07") assert.equal(section.id, `${chapter.id}.${String(index + 1).padStart(2, "0")}`);
  });
  assert(toc.eras.some(era => era.id === chapter.era), `Unknown era ${chapter.era}`);
}
assert.deepEqual(book.chapters.find(c => c.id === "07").sections.map(s => s.id), chapter07, "Chapter 07 keeps its published ids, with no 07.13");
assert.deepEqual(toc.chapters, book.chapters.map(c => ({
  id: c.id, title: c.title, era: c.era,
  sections: c.sections.map(s => [s.id, s.title, s.couplets.length]),
})), "Reader contents are out of date");
const aliases = Object.fromEntries(mapping.joinedHeadings.map(join => [join.heading, join.section]));
assert.deepEqual(book.sectionAliases, aliases, "Source redirects differ from the reviewed heading joins");
assert.deepEqual(toc.sectionAliases, aliases, "Reader redirects are out of date");
for (const [retired, canonical] of Object.entries(aliases)) {
  assert(!ids.includes(retired), "Retired heading IDs must not appear as sections");
  assert(ids.includes(canonical), "Aliases must point directly to canonical sections");
  assert(!existsSync(new URL(`src/content/sections/${retired.replace(".", "-")}.ts`, root)), "Retired section modules must not load a separate reading page");
}

const markdown = read("text/shahnameh.md");
const mdChapters = [];
for (const line of markdown.split("\n")) {
  const chapter = /^# (.+)  \[(\d{2}) · pdf p(\d+)\]$/.exec(line);
  const section = /^## (.+)  \[(\d{2}\.\d{2}) · pdf p(\d+)\]$/.exec(line);
  if (chapter) mdChapters.push({ id: chapter[2], title: chapter[1], pdfPage: Number(chapter[3]), sections: [] });
  if (section) {
    assert(mdChapters.length, "Markdown section appears before its chapter");
    mdChapters.at(-1).sections.push({ id: section[2], title: section[1], pdfPage: Number(section[3]) });
  }
}
assert.deepEqual(mdChapters, book.chapters.map(c => ({
  id: c.id, title: c.title, pdfPage: c.pdfPage,
  sections: c.sections.map(s => ({ id: s.id, title: s.title, pdfPage: s.pdfPage })),
})), "Markdown chapter membership differs from JSON");
assert.deepEqual(markdown.split("\n").filter(line => /^\d+\. /.test(line)), sections.flatMap(s => s.couplets.map(([a, b], i) => `${i + 1}. ${a} / ${b}`)), "Markdown verses differ from JSON");

const details = [...read("README.md").matchAll(/<details>\n<summary>(.*?)<\/summary>([\s\S]*?)<\/details>/g)];
assert.equal(details.length, 61, "README chapter inventory is out of date");
for (const [i, [, summary, body]] of details.entries()) {
  const chapter = book.chapters[i];
  const built = s => existsSync(new URL(`src/content/sections/${s.id.replace(".", "-")}.ts`, root));
  const count = chapter.sections.filter(built).length;
  assert(summary.includes(`${chapter.id} · ${chapter.title} (${count}/${chapter.sections.length} sections)`));
  const entries = [...body.matchAll(/^- \[([x ])\] \[?(\d{2}\.\d{2}) ·/gm)];
  assert.deepEqual(entries.map(m => m[2]), chapter.sections.map(s => s.id));
  for (const [j, match] of entries.entries()) assert.equal(match[1] === "x", built(chapter.sections[j]));
}
for (const section of sections) {
  const file = `src/content/sections/${section.id.replace(".", "-")}.ts`;
  if (existsSync(new URL(file, root))) assert(read(file).includes(`"${section.id}"`), `${file} must use its chapter section id`);
}

console.log(`✓ ${book.chapters.length} chapters, ${sections.length} sections, ${sections.reduce((n, s) => n + s.couplets.length, 0)} verse rows; Markdown, contents, redirects and README agree`);
