const fs = require('fs');
const vm = require('vm');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function approx(actual, expected, label, tolerance = 0.11) {
  assert(Number.isFinite(actual), `${label}: expected finite value, got ${actual}`);
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

function annual(val, fy, tag, unit = 'USD') {
  return { val, fy, fp: 'FY', form: '10-K', filed: `${fy + 1}-02-01`, end: `${fy}-12-31`, unit, accn: `${fy}-${tag}` };
}

function concept(tag, entries, unit = 'USD') {
  return { [tag]: { units: { [unit]: entries.map(e => ({ ...e, unit })) } } };
}

function buildGaap(overrides = {}) {
  return {
    ...concept('Revenues', [annual(1000, 2024, 'rev'), annual(800, 2023, 'rev')]),
    ...concept('OperatingIncomeLoss', [annual(200, 2024, 'op')]),
    ...concept('NetIncomeLoss', [annual(120, 2024, 'net')]),
    ...concept('EarningsPerShareDiluted', [annual(5, 2024, 'eps', 'USD/shares'), annual(4, 2023, 'eps', 'USD/shares')], 'USD/shares'),
    ...concept('Assets', [annual(2000, 2024, 'assets')]),
    ...concept('Liabilities', [annual(800, 2024, 'liabilities')]),
    ...concept('StockholdersEquity', [annual(1200, 2024, 'equity'), annual(1000, 2023, 'equity')]),
    ...concept('AssetsCurrent', [annual(900, 2024, 'ca')]),
    ...concept('LiabilitiesCurrent', [annual(300, 2024, 'cl')]),
    ...concept('NetCashProvidedByUsedInOperatingActivities', [annual(180, 2024, 'ocf')]),
    ...concept('PaymentsToAcquirePropertyPlantAndEquipment', [annual(-50, 2024, 'capex')]),
    ...overrides,
  };
}

const sandbox = {
  console,
  URL,
  URLSearchParams,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  Set,
  Map,
  RegExp,
  JSON,
  window: {},
  document: { currentScript: null },
  location: { origin: 'https://example.vercel.app', protocol: 'https:', hostname: 'example.vercel.app' },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  fetch: async () => { throw new Error('verify-sec-metrics must not call network'); },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/terminal-data.jsx', 'utf8'), sandbox, { filename: 'terminal-data.jsx' });

const {
  calculateSecMetrics,
  calculateSecMetricCoverage,
  makeMetricMeta,
} = sandbox.window;

assert(typeof calculateSecMetrics === 'function', 'calculateSecMetrics export missing');

const full = calculateSecMetrics(buildGaap());
approx(full.metrics.revGrowth, 25, 'revGrowth');
approx(full.metrics.opMargin, 20, 'opMargin');
approx(full.metrics.fcfMargin, 13, 'fcfMargin');
approx(full.metrics.epsGrowth, 25, 'epsGrowth');
approx(full.metrics.roe, 10.9, 'roe');
approx(full.metrics.debtRatio, 40, 'debtRatio');
approx(full.metrics.currentRatio, 300, 'currentRatio');

for (const key of ['revGrowth', 'opMargin', 'fcfMargin', 'epsGrowth', 'roe', 'debtRatio', 'currentRatio']) {
  assert(full.metricStatus[key]?.calculated === true, `${key}: expected calculated status`);
  assert(full.metricStatus[key]?.sourceId === 'secEdgar', `${key}: expected SEC sourceId`);
  assert(full.metricStatus[key]?.sourceTags?.length > 0, `${key}: expected sourceTags`);
}
assert(full.metricStatus.fcfMargin.capexTreatment === 'abs_cash_outflow', 'fcfMargin must record abs capex treatment');

const missingOp = calculateSecMetrics(buildGaap({ OperatingIncomeLoss: { units: { USD: [] } } }));
assert(missingOp.metrics.opMargin == null, 'missing opMargin must not be calculated');
assert(missingOp.metricStatus.opMargin.reason === 'missing_source_tag', 'missing opMargin reason');

const zeroRevenue = calculateSecMetrics(buildGaap({ Revenues: { units: { USD: [annual(0, 2024, 'rev0'), annual(800, 2023, 'rev')] } } }));
assert(zeroRevenue.metrics.opMargin == null, 'zero revenue opMargin must be excluded');
assert(zeroRevenue.metricStatus.opMargin.reason === 'invalid_denominator', 'zero revenue opMargin reason');
assert(zeroRevenue.metrics.fcfMargin == null, 'zero revenue fcfMargin must be excluded');

const noPrevEps = calculateSecMetrics(buildGaap({
  EarningsPerShareDiluted: { units: { 'USD/shares': [annual(5, 2024, 'eps', 'USD/shares')] } },
}));
assert(noPrevEps.metrics.epsGrowth == null, 'epsGrowth without previous EPS must be excluded');
assert(noPrevEps.metricStatus.epsGrowth.reason === 'insufficient_history', 'epsGrowth insufficient history reason');

const meta = Object.fromEntries(Object.keys(full.metrics).map(key => [key, makeMetricMeta({
  provider: 'SEC EDGAR',
  sourceId: 'secEdgar',
  source: 'SEC EDGAR companyfacts',
  commercialSafe: true,
  confidence: 'A',
})]));
const coverage = calculateSecMetricCoverage(full.metrics, meta, full.metricStatus, {
  provider: 'SEC EDGAR',
  sourceId: 'secEdgar',
  requiresPrice: true,
});
assert(coverage.usedCount >= 4, 'coverage should count calculated SEC metrics');
assert(!coverage.presentScoringMetrics.some(key => meta[key]?.sourceId !== 'secEdgar'), 'unknown source must not enter scoring metrics');
assert(coverage.priceRequiredMetrics.includes('per'), 'price-required PER should remain marked');

console.log('SEC metrics verified:', {
  metrics: full.metrics,
  missingOp: missingOp.metricStatus.opMargin.reason,
  zeroRevenue: zeroRevenue.metricStatus.opMargin.reason,
  noPrevEps: noPrevEps.metricStatus.epsGrowth.reason,
  usedCount: coverage.usedCount,
});
