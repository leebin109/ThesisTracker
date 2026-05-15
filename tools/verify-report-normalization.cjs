const fs = require('node:fs');

const source = fs.readFileSync('src/terminal-app.jsx', 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`${name} not found`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} parse failed`);
}

const fnSource = [
  extractFunction('normalizeTextBlock'),
  extractFunction('textBlockLines'),
].join('\n');

const verify = new Function(`${fnSource}; return { normalizeTextBlock, textBlockLines };`)();

const cases = [
  { name: 'string', value: 'text', expected: 'text' },
  { name: 'array', value: ['a', 'b'], expected: 'a\nb' },
  { name: 'object', value: { thesis: 'a', catalyst: 'b' }, expected: 'a\nb' },
  { name: 'null', value: null, expected: '' },
  { name: 'undefined', value: undefined, expected: '' },
];

for (const testCase of cases) {
  const actual = verify.normalizeTextBlock(testCase.value);
  if (actual !== testCase.expected) {
    throw new Error(`${testCase.name} failed: expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(actual)}`);
  }
  verify.textBlockLines(testCase.value);
}

console.log('[PASS] report text normalization handles string/array/object/null/undefined');
