// Select section checks from Git's NUL-delimited filenames, never shell input.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

// A painting's bytes never change. Moving a section's directory keeps the same
// blob at the new path; editing or deleting a blob without that move does not.
function changedPaintings(base, head) {
  const raw = git('diff', '--no-renames', '--raw', '-z', base, head, '--', 'public/art/');
  const parts = raw.split('\0').filter(Boolean);
  const bad = [];
  const removed = [];
  const added = [];
  for (let i = 0; i < parts.length;) {
    const header = parts[i++].slice(1).split(' ');
    const path = parts[i++];
    const [oldBlob, newBlob, status] = [header[2], header[3], header[4]];
    if (status.startsWith('M') || status.startsWith('T')) bad.push(path);
    else if (status.startsWith('D')) removed.push(oldBlob);
    else if (status.startsWith('A') || status.startsWith('C')) added.push(newBlob);
  }
  const pool = new Map();
  for (const blob of added) pool.set(blob, (pool.get(blob) ?? 0) + 1);
  for (const blob of removed) {
    const count = pool.get(blob) ?? 0;
    if (!count) bad.push(blob);
    else pool.set(blob, count - 1);
  }
  return bad;
}
const head = process.env.HEAD_SHA || 'HEAD';
let base = process.env.BASE_SHA;
if (!base || /^0+$/.test(base)) {
  try { base = git('rev-parse', `${head}^`).trim(); }
  catch { base = git('hash-object', '-t', 'tree', '--stdin').trim(); }
}
const files = git('diff', '--name-only', '-z', base, head).split('\0').filter(Boolean);
const immutable = changedPaintings(base, head);
if (immutable.length) throw new Error(`Existing paintings are immutable; use new filenames: ${immutable.join(', ')}`);

const ids = new Set();
for (const file of files) {
  const match = /^(?:src\/content\/sections\/|public\/art\/|art\/prompts\/|art\/manifest-|reports\/)(\d{2})-(\d{2})(?:[./]|$)/.exec(file);
  if (match && existsSync(`src/content/sections/${match[1]}-${match[2]}.ts`)) ids.add(`${match[1]}.${match[2]}`);
}
const full = [...ids].sort();
const shared = files.some(file => /^(?:src\/(?:engine|styles)\/|src\/content\/(?:types|sound)\.ts$)/.test(file));
const sample = shared
  ? readdirSync('src/content/sections').filter(file => /^\d{2}-\d{2}\.ts$/.test(file)).map(file => file.slice(0, 5).replace('-', '.')).filter(id => !ids.has(id)).sort()
  : full.length ? [] : ['01.01'];
console.log(JSON.stringify({ full, sample }));
for (const [sections, quick] of [[full, false], [sample, true]]) {
  if (sections.length) execFileSync(process.execPath, ['scripts/check_section.mjs', ...sections, ...(quick ? ['--quick'] : [])], { stdio: 'inherit' });
}
