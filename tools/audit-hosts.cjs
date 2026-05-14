#!/usr/bin/env node
// Informational audit: report every src/server/api location that mentions a
// host string we keep on the Commercial-Safe blocklist (Yahoo Finance, FMP,
// Alpha Vantage, Google News, Google web search).
//
// A non-zero match count is NOT a failure on its own. Personal-mode code paths
// and the proxy allowlists are *expected* to mention these hosts as identifier
// strings. The authoritative pass/fail signal for Commercial-Safe mode is
// `node tools/verify-commercial-policy.cjs` (blocked host fetch calls = 0).

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const targetDirs = ['src', 'server', 'api'];
const skipNames = new Set(['node_modules', 'dist', '.git']);
const allowedExt = new Set(['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.json']);

const patterns = [
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'finance.yahoo.com',
  'financialmodelingprep',
  'alphavantage',
  'news.google.com',
  'google.com/search',
];

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (skipNames.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (allowedExt.has(ext)) yield full;
    }
  }
}

const hitsByPattern = Object.fromEntries(patterns.map(p => [p, []]));
let totalHits = 0;

for (const dir of targetDirs) {
  const abs = path.join(repoRoot, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      for (const pat of patterns) {
        if (line.includes(pat)) {
          hitsByPattern[pat].push({
            file: path.relative(repoRoot, file).replace(/\\/g, '/'),
            line: idx + 1,
            text: line.trim().slice(0, 160),
          });
          totalHits += 1;
        }
      }
    });
  }
}

console.log(`[audit:hosts] scanning ${targetDirs.join(', ')} for blocked host strings`);
console.log(`[audit:hosts] informational only — pass/fail signal lives in verify-commercial-policy.cjs\n`);

for (const pat of patterns) {
  const hits = hitsByPattern[pat];
  console.log(`  ${pat}: ${hits.length} hit(s)`);
  for (const h of hits) {
    console.log(`    ${h.file}:${h.line}  ${h.text}`);
  }
}

console.log(`\n[audit:hosts] total: ${totalHits} match line(s) across ${patterns.length} pattern(s)`);
console.log('[audit:hosts] Personal mode + proxy allowlist mentions are expected; verify Commercial-Safe with `npm run verify:policy`.');

// Always exit 0 — this is reporting, not gating.
process.exit(0);
