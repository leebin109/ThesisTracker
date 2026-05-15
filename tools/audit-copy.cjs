#!/usr/bin/env node
// Gate: scan user-facing copy for prohibited investment-solicitation language.
// Korean 자본시장법 treats certain phrasings as investment recommendations
// (투자권유); ThesisTrack must position as analysis tool, not signal service.
//
// This is a hard gate — any match exits 1. Intentional uses (typically inside
// disclaimer paragraphs that negate the phrase) must be marked with the inline
// marker `audit-copy-ignore` on the same line.

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const targetDirs = ['src'];
const extraFiles = ['index.html'];
const skipNames = new Set(['node_modules', 'dist', '.git', '.vercel']);
const allowedExt = new Set(['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.html', '.css', '.md']);

const IGNORE_MARKER = 'audit-copy-ignore';

// Compound phrases only — single tokens like "매수" alone would flag legitimate
// user-action labels (decision journal BUY/SELL categories). Each entry has a
// category, a regex, and a suggested replacement to surface in the failure log.
const bannedPhrases = [
  // 1. direct buy/sell signals
  { category: 'signal', pattern: /매수\s*신호/, suggest: '"매수 신호" → "Watch" 또는 "Thesis Status"' },
  { category: 'signal', pattern: /매도\s*신호/, suggest: '"매도 신호" → "Risk elevated" 또는 "Watch"' },
  { category: 'signal', pattern: /매수\s*시그널/, suggest: '"매수 시그널" → "Watch"' },
  { category: 'signal', pattern: /매도\s*시그널/, suggest: '"매도 시그널" → "Watch" / "Risk elevated"' },
  { category: 'signal', pattern: /매수\s*시점/, suggest: '"매수 시점" → "관찰 시점" / "Review"' },
  { category: 'signal', pattern: /매도\s*시점/, suggest: '"매도 시점" → "Risk elevated" / "Re-evaluate"' },
  { category: 'signal', pattern: /지금\s*사(라|세요|십시오|면\s*된다)/, suggest: '직접 매수 권유 표현 — "검토해볼 수 있습니다" 권장' },
  { category: 'signal', pattern: /지금\s*파(라|세요|십시오)/, suggest: '직접 매도 권유 표현 — "Risk elevated" 권장' },
  { category: 'signal', pattern: /매수하세요/, suggest: '매수 권유 — "검토해보세요" 권장' },
  { category: 'signal', pattern: /매도하세요/, suggest: '매도 권유 — "재평가해보세요" 권장' },
  { category: 'signal', pattern: /\bStrong\s*Buy\b/i, suggest: 'Strong Buy → "Thesis confirmed" or "Watch"' },
  { category: 'signal', pattern: /\bStrong\s*Sell\b/i, suggest: 'Strong Sell → "Thesis broken" or "Risk elevated"' },
  { category: 'signal', pattern: /\bBuy\s*Now\b/i, suggest: 'Buy Now → "Review" or "Check assumptions"' },
  { category: 'signal', pattern: /\bSell\s*Now\b/i, suggest: 'Sell Now → "Re-evaluate"' },

  // 2. recommendation language
  { category: 'recommend', pattern: /매수\s*추천/, suggest: '"매수 추천" → "분석 자료" 또는 제거' },
  { category: 'recommend', pattern: /매도\s*추천/, suggest: '"매도 추천" → "분석 자료" 또는 제거' },
  { category: 'recommend', pattern: /종목\s*추천/, suggest: '"종목 추천" → "분석 대상" / "Watchlist"' },
  { category: 'recommend', pattern: /추천\s*종목/, suggest: '"추천 종목" → "관심 종목" / "Watchlist"' },
  { category: 'recommend', pattern: /오늘의\s*추천/, suggest: '"오늘의 추천" → "오늘의 관심" / "Today\'s focus"' },
  { category: 'recommend', pattern: /이번\s*주\s*추천/, suggest: '"이번 주 추천" → "이번 주 관심"' },

  // 3. outcome guarantees
  { category: 'guarantee', pattern: /수익\s*보장/, suggest: '"수익 보장" 금지 — 자본시장법 위반 소지' },
  { category: 'guarantee', pattern: /수익률\s*보장/, suggest: '"수익률 보장" 금지' },
  { category: 'guarantee', pattern: /원금\s*보장/, suggest: '"원금 보장" 금지' },
  { category: 'guarantee', pattern: /손실\s*보장/, suggest: '"손실 보장" 금지' },
  { category: 'guarantee', pattern: /무조건\s*(수익|오른|상승|이익|성공)/, suggest: '"무조건 …" 표현 금지' },
  { category: 'guarantee', pattern: /100\s*%\s*(수익|성공|보장)/, suggest: '"100% …" 보장 표현 금지' },
  { category: 'guarantee', pattern: /\bGuaranteed\s*(Return|Profit|Gain)/i, suggest: 'Guaranteed Return/Profit 금지' },

  // 4. hype / urgency / fomo
  { category: 'hype', pattern: /급등주/, suggest: '"급등주" → "변동성 확대 종목"' },
  { category: 'hype', pattern: /급등\s*임박/, suggest: '"급등 임박" 금지' },
  { category: 'hype', pattern: /급락\s*임박/, suggest: '"급락 임박" 금지' },
  { category: 'hype', pattern: /핫\s*종목/, suggest: '"핫 종목" → "주목 받는 종목" / "Trending"' },
  { category: 'hype', pattern: /\bHot\s*Stock\b/i, suggest: 'Hot Stock → "Trending" or "Watchlist"' },
  { category: 'hype', pattern: /놓치지\s*마세요/, suggest: '"놓치지 마세요" 금지 — 행동 유도' },
  { category: 'hype', pattern: /절호의\s*기회/, suggest: '"절호의 기회" 금지' },
  { category: 'hype', pattern: /마지막\s*기회/, suggest: '"마지막 기회" 금지' },
  { category: 'hype', pattern: /대박\s*종목/, suggest: '"대박 종목" 금지' },
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

const files = [];
for (const dir of targetDirs) {
  const abs = path.join(repoRoot, dir);
  if (fs.existsSync(abs)) {
    for (const file of walk(abs)) files.push(file);
  }
}
for (const rel of extraFiles) {
  const abs = path.join(repoRoot, rel);
  if (fs.existsSync(abs)) files.push(abs);
}

const violations = [];
let scannedLines = 0;

for (const file of files) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    scannedLines += 1;
    if (line.includes(IGNORE_MARKER)) return;
    for (const rule of bannedPhrases) {
      const m = line.match(rule.pattern);
      if (m) {
        violations.push({
          file: path.relative(repoRoot, file).replace(/\\/g, '/'),
          line: idx + 1,
          matched: m[0],
          category: rule.category,
          suggest: rule.suggest,
          context: line.trim().slice(0, 160),
        });
      }
    }
  });
}

console.log(`[audit:copy] scanning user-facing copy for prohibited terms`);
console.log(`[audit:copy] sources: ${targetDirs.join(', ')}, ${extraFiles.join(', ')}`);
console.log(`[audit:copy] scanned ${files.length} file(s) / ${scannedLines} line(s)\n`);

if (violations.length === 0) {
  console.log(`[audit:copy] 0 violations — copy gate clear`);
  process.exit(0);
}

const byCategory = {};
for (const v of violations) {
  (byCategory[v.category] ||= []).push(v);
}

for (const cat of Object.keys(byCategory)) {
  console.log(`  [${cat}] ${byCategory[cat].length} hit(s)`);
  for (const v of byCategory[cat]) {
    console.log(`    ${v.file}:${v.line}  "${v.matched}"`);
    console.log(`      context: ${v.context}`);
    console.log(`      suggest: ${v.suggest}`);
  }
  console.log('');
}

console.log(`[audit:copy] ${violations.length} violation(s) across ${new Set(violations.map(v => v.file)).size} file(s)`);
console.log(`[audit:copy] mark intentional disclaimer use with inline comment containing "${IGNORE_MARKER}"`);
process.exit(1);
