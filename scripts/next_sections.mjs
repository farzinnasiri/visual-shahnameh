// What to build next, and claiming it so parallel agents never collide.
//
//   node scripts/next_sections.mjs                     # status: built / claimed / next up
//   node scripts/next_sections.mjs --count 50          # the next 50 unbuilt, unclaimed sections (JSON)
//   node scripts/next_sections.mjs --chapters 3        # every unbuilt section of the next 3 chapters
//   node scripts/next_sections.mjs --count 50 --agents 10   # ...split into 10 balanced, contiguous bundles
//   node scripts/next_sections.mjs --claim 02.01 --by "agent-7"   # claim (exit 1 if taken or built)
//   node scripts/next_sections.mjs --release 02.01      # drop a claim (e.g. after giving up)
//
// "Built" = src/content/sections/<id>.ts exists. "Claimed" = work/claims/<id>/
// exists (made with mkdir, which is atomic, so two agents can't both win).
// Claims older than CLAIM_TTL_HOURS are treated as abandoned.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBook } from "./book.mjs";

const CLAIM_TTL_HOURS = 8;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const book = loadBook(root);
const claimsDir = join(root, "work/claims");
const file = (id) => join(root, "src/content/sections", `${id.replace(".", "-")}.ts`);

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

const all = book.chapters.flatMap((ch) =>
  ch.sections.map((s) => ({ id: s.id, chapter: ch.id, chapterTitle: ch.title, title: s.title, couplets: s.couplets.length, pdfPage: s.pdfPage })),
);
const built = (id) => existsSync(file(id));
const claim = (id) => {
  const dir = join(claimsDir, id);
  if (!existsSync(dir)) return null;
  const age = (Date.now() - statSync(dir).mtimeMs) / 3.6e6;
  if (age > CLAIM_TTL_HOURS) return null;
  try {
    return JSON.parse(readFileSync(join(dir, "claim.json"), "utf8"));
  } catch {
    return { by: "?" };
  }
};

if (opt("claim")) {
  const id = opt("claim");
  if (!all.some((s) => s.id === id)) fail(`no section ${id}`);
  if (built(id)) fail(`${id} is already built`);
  mkdirSync(claimsDir, { recursive: true });
  const dir = join(claimsDir, id);
  if (existsSync(dir) && !claim(id)) rmSync(dir, { recursive: true, force: true }); // stale
  try {
    mkdirSync(dir); // atomic: fails if someone else got there first
  } catch {
    fail(`${id} is already claimed by ${claim(id)?.by ?? "someone"}`);
  }
  writeFileSync(join(dir, "claim.json"), JSON.stringify({ by: opt("by") ?? "unknown", at: new Date().toISOString() }) + "\n");
  console.log(`claimed ${id}`);
  process.exit(0);
}

if (opt("release")) {
  rmSync(join(claimsDir, opt("release")), { recursive: true, force: true });
  console.log(`released ${opt("release")}`);
  process.exit(0);
}

const todo = all.filter((s) => !built(s.id) && !claim(s.id));
let pick = todo;
if (opt("chapters")) {
  const chapters = [...new Set(todo.map((s) => s.chapter))].slice(0, Number(opt("chapters")));
  pick = todo.filter((s) => chapters.includes(s.chapter));
} else if (opt("count")) {
  pick = todo.slice(0, Number(opt("count")));
}

if (opt("count") || opt("chapters")) {
  const agents = Number(opt("agents") ?? 0);
  console.log(JSON.stringify(agents ? bundle(pick, agents) : pick, null, 1));
} else {
  const done = all.filter((s) => built(s.id));
  const claimed = all.filter((s) => !built(s.id) && claim(s.id));
  const complete = book.chapters.filter((ch) => ch.sections.every((s) => built(s.id)));
  console.log(`chapters ${complete.length}/${book.chapters.length} complete`);
  console.log(`built    ${done.length}/${all.length} sections, ${done.reduce((n, s) => n + s.couplets, 0)}/${all.reduce((n, s) => n + s.couplets, 0)} couplets`);
  console.log(`claimed  ${claimed.map((s) => `chapter ${s.chapter} · ${s.id} (${claim(s.id).by})`).join(", ") || "none"}`);
  console.log(`next up  ${todo.slice(0, 10).map((s) => `chapter ${s.chapter} ${s.chapterTitle} · ${s.id} ${s.title} (${s.couplets})`).join("\n         ")}`);
}

/** Split sections into n contiguous bundles of roughly equal couplet counts. */
function bundle(list, n) {
  const total = list.reduce((a, s) => a + s.couplets, 0);
  const target = total / Math.min(n, list.length);
  const out = [];
  let cur = [];
  let sum = 0;
  for (const s of list) {
    if (cur.length && sum + s.couplets / 2 > target && out.length < n - 1) {
      out.push(cur);
      cur = [];
      sum = 0;
    }
    cur.push(s);
    sum += s.couplets;
  }
  if (cur.length) out.push(cur);
  return out.map((sections, i) => ({ agent: i + 1, couplets: sections.reduce((a, s) => a + s.couplets, 0), sections }));
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
