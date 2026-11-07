// The book is 61 chapter files. A section id is chapter.place, as in 10.01.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadBook(root) {
  const dir = join(root, "text/chapters");
  const chapters = readdirSync(dir)
    .filter((name) => /^\d\d\.json$/.test(name))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")));
  const mapping = JSON.parse(readFileSync(join(root, "text/chapter-map.json"), "utf8"));
  const sectionAliases = Object.fromEntries(mapping.joinedHeadings.map((item) => [item.heading, item.section]));
  return { chapters, sectionAliases, mapping };
}

/** Verse text in book order. Section ids are not part of the hash. */
export function coupletDigest(chapters) {
  const payload = chapters.flatMap((chapter) => chapter.sections.map((section) => [section.title, section.pdfPage, section.couplets]));
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
