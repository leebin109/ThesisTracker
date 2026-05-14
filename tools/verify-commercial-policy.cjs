const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'terminal-data.jsx'), 'utf8');

const fetchCalls = [];
const sandbox = {
  console,
  URL,
  URLSearchParams,
  Date,
  Math,
  Number,
  String,
  Boolean,
  Array,
  Object,
  Set,
  Map,
  Promise,
  RegExp,
  Error,
  NaN,
  isNaN,
  parseInt,
  parseFloat,
  setTimeout,
  clearTimeout,
  window: {},
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
  fetch: async (url) => {
    fetchCalls.push(String(url));
    throw new Error(`unexpected fetch: ${url}`);
  },
};
sandbox.window = sandbox.window || {};
sandbox.window.location = { protocol: 'https:', hostname: 'example.vercel.app' };

vm.runInNewContext(source, sandbox, { filename: 'terminal-data.jsx' });

const apiSettings = { dataMode: 'commercialSafe' };
const w = sandbox.window;

async function assertBlocked(label, fn) {
  const before = fetchCalls.length;
  let blocked = false;
  try {
    await fn();
  } catch (err) {
    blocked = err?.code === 'SOURCE_POLICY_BLOCKED' || err?.code === 'SOURCE_POLICY_UNKNOWN' || err?.personalOnly === true;
  }
  assert.equal(blocked, true, `${label} should be blocked by policy`);
  assert.equal(fetchCalls.length, before, `${label} should not call fetch`);
}

(async () => {
  assert.equal(w.BLOCKED_COMMERCIAL_SAFE_HOSTS.has('query1.finance.yahoo.com'), true);
  assert.equal(w.BLOCKED_COMMERCIAL_SAFE_HOSTS.has('query2.finance.yahoo.com'), true);
  assert.equal(w.BLOCKED_COMMERCIAL_SAFE_HOSTS.has('financialmodelingprep.com'), true);
  assert.equal(w.BLOCKED_COMMERCIAL_SAFE_HOSTS.has('www.alphavantage.co'), true);

  await assertBlocked('Yahoo search', () => w.searchWithYahoo('AAPL', apiSettings));
  await assertBlocked('Yahoo chart', () => w.fetchYahooChartOhlc('AAPL', '1d', '1m', apiSettings));
  await assertBlocked('Yahoo live', () => w.fetchLivePrice({ symbol: 'AAPL', market: 'NASDAQ' }, apiSettings));
  await assertBlocked('Yahoo financial history', () => w.fetchYahooFinancialHistory({ symbol: 'AAPL', market: 'NASDAQ' }, apiSettings));
  await assertBlocked('Yahoo news', () => w.fetchYahooNewsExperimental('AAPL', 'Apple', apiSettings));
  await assertBlocked('FMP search', () => w.searchWithFmp('AAPL', 'demo', apiSettings));

  const macro = await w.fetchMacroIndicators(apiSettings);
  assert.equal(Array.isArray(macro), true, 'Commercial-Safe macro should return an array');
  assert.equal(macro.length, 0, 'Commercial-Safe macro should degrade to empty data without fetch');

  assert.throws(
    () => w.assertUrlAllowed('https://unknown.example.com/data.json', apiSettings, 'unknown'),
    /blocked in Commercial-Safe mode until registered/,
    'unknown endpoint should default-block'
  );
  assert.throws(
    () => w.assertUrlAllowed('/api/proxy?service=yahoo&path=chart&symbol=AAPL', apiSettings, 'proxy yahoo'),
    /blocked in Commercial-Safe mode/,
    'registered blocked proxy endpoint should block'
  );
  assert.doesNotThrow(
    () => w.assertUrlAllowed('/api/proxy?service=sec&path=companyfacts%2FCIK0000320193.json', apiSettings, 'sec'),
    'registered SEC endpoint should be allowed'
  );

  const cacheMeta = w.makeCacheSourceMeta({
    provider: 'secEdgar',
    sourceId: 'secEdgar',
    endpointIds: ['sec.companyfacts'],
    mode: 'commercialSafe',
    confidence: 'A',
  });
  assert.equal(cacheMeta.commercialSafe, true, 'SEC cache source metadata should be commercial-safe');
  assert.equal(cacheMeta.licenseUrl.includes('sec.gov'), true, 'cache source metadata should include license URL');

  const payload = w.attachDataViews({
    metrics: { roe: 10, per: 20 },
    metricsMeta: { roe: { commercialSafe: true } },
  }, cacheMeta, { scoringMetrics: { roe: 10 } });
  assert.equal(payload.displayData.metrics.per, 20, 'displayData should retain display metrics');
  assert.equal(payload.scoringData.metrics.per, undefined, 'scoringData should be separable from displayData');

  assert.equal(fetchCalls.length, 0, `blocked hosts should have 0 fetch calls, saw ${fetchCalls.length}`);
  console.log('Commercial-Safe policy verified: blocked host fetch calls = 0');
})();
