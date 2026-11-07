// Refresh the expandable chapter inventory from the source and section files.
// Run after rebuilding the source: node scripts/update_readme_contents.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadBook } from "./book.mjs";

const root = new URL("../", import.meta.url);
const book = loadBook(fileURLToPath(root));
const built = (id) => existsSync(new URL(`src/content/sections/${id.replace(".", "-")}.ts`, root));
const blocks = book.chapters.map((chapter) => {
  const count = chapter.sections.filter((s) => built(s.id)).length;
  const lines = chapter.sections.map((section) => {
    const done = built(section.id);
    const title = `${section.id} · ${section.title}`;
    const link = `src/content/sections/${section.id.replace(".", "-")}.ts`;
    return `- [${done ? "x" : " "}] ${done ? `[${title}](${link})` : title}`;
  });
  return `<details>\n<summary>${count === chapter.sections.length ? "✓" : "○"} ${chapter.id} · ${chapter.title} (${count}/${chapter.sections.length} sections)</summary>\n\n${lines.join("\n")}\n\n</details>`;
});
const path = new URL("README.md", root);
const start = "<!-- chapter-checklist:start -->";
const end = "<!-- chapter-checklist:end -->";
const readme = readFileSync(path, "utf8");
const a = readme.indexOf(start);
const b = readme.indexOf(end);
if (a < 0 || b < a || readme.indexOf(start, a + 1) >= 0 || readme.indexOf(end, b + 1) >= 0) {
  throw new Error("README must contain one ordered pair of chapter checklist markers");
}
writeFileSync(path, `${readme.slice(0, a)}${start}\n${blocks.join("\n\n")}\n${end}${readme.slice(b + end.length)}`);
console.log(`${fileURLToPath(path)}: ${book.chapters.length} chapters, ${book.chapters.flatMap(c => c.sections).length} sections`);
