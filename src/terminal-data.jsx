/* global React */

// ═══════════════════════════════════════════════════════════════
// Storage key
// ═══════════════════════════════════════════════════════════════
const TT_KEY = 'tt-terminal-v1';
const AV_DELAY = 1250; // Alpha Vantage free tier rate limit

// ═══════════════════════════════════════════════════════════════
// Market profiles
// ═══════════════════════════════════════════════════════════════
const MARKET_PROFILES = [
  { key: 'KRX',           country: '대한민국', market: 'KRX',           currency: 'KRW' },
  { key: 'NASDAQ',        country: '미국',     market: 'NASDAQ',        currency: 'USD' },
  { key: 'NYSE',          country: '미국',     market: 'NYSE',          currency: 'USD' },
  { key: 'TSE',           country: '일본',     market: 'TSE',           currency: 'JPY' },
  { key: 'LSE',           country: '영국',     market: 'LSE',           currency: 'GBP' },
  { key: 'XETRA',         country: '독일',     market: 'XETRA',         currency: 'EUR' },
  { key: 'EURONEXT_PARIS',country: '프랑스',   market: 'Euronext Paris',currency: 'EUR' },
  { key: 'TSX',           country: '캐나다',   market: 'TSX',           currency: 'CAD' },
  { key: 'HKEX',          country: '홍콩',     market: 'HKEX',          currency: 'HKD' },
  { key: 'NSE',           country: '인도',     market: 'NSE',           currency: 'INR' },
  { key: 'ASX',           country: '호주',     market: 'ASX',           currency: 'AUD' },
  { key: 'CUSTOM',        country: '기타',     market: 'CUSTOM',        currency: 'LOCAL' },
];

const COUNTRY_FLAGS = {
  '대한민국': '🇰🇷', '미국': '🇺🇸', '일본': '🇯🇵', '영국': '🇬🇧',
  '독일': '🇩🇪', '프랑스': '🇫🇷', '캐나다': '🇨🇦', '홍콩': '🇭🇰',
  '인도': '🇮🇳', '호주': '🇦🇺', '기타': '🏷️',
};

// ═══════════════════════════════════════════════════════════════
// Default API settings
// ═══════════════════════════════════════════════════════════════
const DEFAULT_API_SETTINGS = {
  globalProvider: 'yahooExperimental',
  alphaVantageKey: '',
  fmpKey: '',
  openDartKey: '',

  dartFiscalYear: new Date().getFullYear() - 1,
  dartReportCode: '11011',
  dartFsDiv: 'CFS',
  dataGoKrKey: '',
  cacheDays: 3,
  // 'personal' = may use Yahoo + experimental endpoints
  // 'commercialSafe' = blocks personal-only/unclear sources before network calls
  dataMode: 'personal',
};

// Cache schema version — bump when cache payload shape changes significantly
const CACHE_SCHEMA_VERSION = 6;

const DEFAULT_DART_CORP_MAP = {
  '005930': { corpCode: '00126380', corpName: '삼성전자' },
};

const DEFAULT_ALERT_SETTINGS = {
  enabled: false,
  sources: { dart: true, sec: true, yahooNews: true, googleNews: false },
  googleNewsProxy: '',
  daysBack: 7,
  autoPolling: false,
  pollIntervalMin: 15,
};

const ALERT_RETENTION_DAYS = 30;

const DATA_SOURCE_REGISTRY = {
  openDart: {
    label: 'OpenDART',
    cost: 'free',
    commercialStatus: 'official-public-api',
    licenseUrl: 'https://opendart.fss.or.kr/intro/main.do',
    rateLimit: 'OpenDART account limits apply',
    confidence: 'A',
    usedInScore: true,
    blockedInCommercialSafe: false,
  },
  secEdgar: {
    label: 'SEC EDGAR',
    cost: 'free',
    commercialStatus: 'official-public-data',
    licenseUrl: 'https://www.sec.gov/os/accessing-edgar-data',
    rateLimit: '10 requests/second fair access guidance',
    confidence: 'A',
    usedInScore: true,
    blockedInCommercialSafe: false,
  },
  dataGoKrStockPrice: {
    label: 'data.go.kr stock price',
    cost: 'free',
    commercialStatus: 'public-data',
    licenseUrl: 'https://www.data.go.kr/odmc/intro/index.do',
    rateLimit: 'API-key quota applies',
    confidence: 'B',
    usedInScore: false,
    blockedInCommercialSafe: false,
  },
  yahooFinance: {
    label: 'Yahoo Finance',
    cost: 'free',
    commercialStatus: 'personal-only',
    licenseUrl: 'https://legal.yahoo.com/us/en/yahoo/terms/product-atos/apiforydn/index.html',
    rateLimit: 'unofficial endpoint; unstable',
    confidence: 'B',
    usedInScore: true,
    blockedInCommercialSafe: true,
  },
  yahooNews: {
    label: 'Yahoo News',
    cost: 'free',
    commercialStatus: 'personal-only',
    licenseUrl: 'https://legal.yahoo.com/us/en/yahoo/terms/product-atos/apiforydn/index.html',
    rateLimit: 'unofficial endpoint; unstable',
    confidence: 'C',
    usedInScore: false,
    blockedInCommercialSafe: true,
  },
  googleNews: {
    label: 'Google News RSS',
    cost: 'free',
    commercialStatus: 'unclear',
    licenseUrl: 'https://news.google.com/',
    rateLimit: 'RSS/proxy dependent',
    confidence: 'C',
    usedInScore: false,
    blockedInCommercialSafe: true,
  },
  alphaVantage: {
    label: 'Alpha Vantage',
    cost: 'free-key',
    commercialStatus: 'requires-plan-review',
    licenseUrl: 'https://www.alphavantage.co/terms_of_service/',
    rateLimit: 'free tier quota applies',
    confidence: 'B',
    usedInScore: true,
    blockedInCommercialSafe: true,
  },
  fmp: {
    label: 'Financial Modeling Prep',
    cost: 'free-key',
    commercialStatus: 'requires-plan-review',
    licenseUrl: 'https://site.financialmodelingprep.com/terms-of-service',
    rateLimit: 'free tier quota applies',
    confidence: 'B',
    usedInScore: true,
    blockedInCommercialSafe: true,
  },
  userImport: {
    label: 'User import/manual',
    cost: 'free',
    commercialStatus: 'user-responsibility',
    licenseUrl: '',
    rateLimit: 'none',
    confidence: 'C',
    usedInScore: true,
    blockedInCommercialSafe: false,
  },
};

const DATA_ENDPOINT_REGISTRY = {
  'opendart.fnlttSinglAcntAll': {
    sourceId: 'openDart',
    label: 'OpenDART financial statements all',
    service: 'opendart',
    path: 'fnlttSinglAcntAll',
    hosts: ['opendart.fss.or.kr'],
    blockedInCommercialSafe: false,
  },
  'opendart.fnlttSinglAcnt': {
    sourceId: 'openDart',
    label: 'OpenDART financial statements single',
    service: 'opendart',
    path: 'fnlttSinglAcnt',
    hosts: ['opendart.fss.or.kr'],
    blockedInCommercialSafe: false,
  },
  'opendart.stockInfo': {
    sourceId: 'openDart',
    label: 'OpenDART stock info',
    service: 'opendart',
    path: 'stockInfo',
    hosts: ['opendart.fss.or.kr'],
    blockedInCommercialSafe: false,
  },
  'opendart.list': {
    sourceId: 'openDart',
    label: 'OpenDART disclosures',
    service: 'opendart',
    path: 'list',
    hosts: ['opendart.fss.or.kr'],
    blockedInCommercialSafe: false,
  },
  'sec.companyfacts': {
    sourceId: 'secEdgar',
    label: 'SEC companyfacts',
    service: 'sec',
    pathPrefix: 'companyfacts/',
    hosts: ['data.sec.gov'],
    blockedInCommercialSafe: false,
  },
  'sec.submissions': {
    sourceId: 'secEdgar',
    label: 'SEC submissions',
    service: 'sec',
    pathPrefix: 'submissions/',
    hosts: ['data.sec.gov'],
    blockedInCommercialSafe: false,
  },
  'sec.companyTickers': {
    sourceId: 'secEdgar',
    label: 'SEC company ticker map',
    service: 'sec',
    path: 'files/company_tickers.json',
    hosts: ['www.sec.gov'],
    blockedInCommercialSafe: false,
  },
  'sec.archives': {
    sourceId: 'secEdgar',
    label: 'SEC archives',
    service: 'sec',
    pathPrefix: 'archives/',
    hosts: ['www.sec.gov'],
    blockedInCommercialSafe: false,
  },
  'dataGoKr.stockPrice': {
    sourceId: 'dataGoKrStockPrice',
    label: 'data.go.kr stock price',
    hosts: ['apis.data.go.kr'],
    blockedInCommercialSafe: false,
  },
  'yahoo.search': {
    sourceId: 'yahooFinance',
    label: 'Yahoo search',
    service: 'yahoo',
    path: 'search',
    hosts: ['query1.finance.yahoo.com'],
    blockedInCommercialSafe: true,
  },
  'yahoo.quote': {
    sourceId: 'yahooFinance',
    label: 'Yahoo quote',
    service: 'yahoo',
    path: 'quote',
    hosts: ['query1.finance.yahoo.com'],
    blockedInCommercialSafe: true,
  },
  'yahoo.chart': {
    sourceId: 'yahooFinance',
    label: 'Yahoo chart',
    service: 'yahoo',
    path: 'chart',
    hosts: ['query1.finance.yahoo.com'],
    blockedInCommercialSafe: true,
  },
  'yahoo.quoteSummary': {
    sourceId: 'yahooFinance',
    label: 'Yahoo quoteSummary',
    service: 'yahoo',
    path: 'quoteSummary',
    hosts: ['query2.finance.yahoo.com'],
    blockedInCommercialSafe: true,
  },
  'yahoo.timeseries': {
    sourceId: 'yahooFinance',
    label: 'Yahoo timeseries',
    service: 'yahoo',
    path: 'timeseries',
    hosts: ['query1.finance.yahoo.com'],
    blockedInCommercialSafe: true,
  },
  'yahoo.news': {
    sourceId: 'yahooNews',
    label: 'Yahoo news',
    service: 'yahoo',
    path: 'search',
    hosts: ['query1.finance.yahoo.com'],
    blockedInCommercialSafe: true,
  },
  'googleNews.rss': {
    sourceId: 'googleNews',
    label: 'Google News RSS',
    hosts: ['news.google.com'],
    blockedInCommercialSafe: true,
  },
  'alphaVantage.query': {
    sourceId: 'alphaVantage',
    label: 'Alpha Vantage query',
    hosts: ['www.alphavantage.co'],
    blockedInCommercialSafe: true,
  },
  'fmp.stable': {
    sourceId: 'fmp',
    label: 'FMP stable API',
    hosts: ['financialmodelingprep.com'],
    blockedInCommercialSafe: true,
  },
};

const BLOCKED_COMMERCIAL_SAFE_HOSTS = new Set(
  Object.values(DATA_ENDPOINT_REGISTRY)
    .filter(e => e.blockedInCommercialSafe)
    .flatMap(e => e.hosts || [])
);

function isCommercialSafeMode(apiSettings) {
  return apiSettings?.dataMode === 'commercialSafe';
}

function getDataSourceMeta(sourceId) {
  return DATA_SOURCE_REGISTRY[sourceId] || null;
}

function getEndpointMeta(endpointId) {
  return DATA_ENDPOINT_REGISTRY[endpointId] || null;
}

function normalizeEndpointPath(path) {
  return String(path || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.json$/i, '');
}

function endpointMatchesPath(endpoint, path) {
  const clean = normalizeEndpointPath(path);
  if (endpoint.path) return clean === normalizeEndpointPath(endpoint.path);
  if (endpoint.pathPrefix) return clean.startsWith(normalizeEndpointPath(endpoint.pathPrefix));
  return true;
}

function findEndpointByProxy(service, path) {
  const cleanService = String(service || '').trim().toLowerCase();
  const cleanPath = normalizeEndpointPath(path);
  return Object.entries(DATA_ENDPOINT_REGISTRY).find(([, endpoint]) => (
    endpoint.service === cleanService && endpointMatchesPath(endpoint, cleanPath)
  )) || null;
}

function findEndpointByUrl(url) {
  let parsed;
  try {
    parsed = new URL(String(url), 'https://local.invalid');
  } catch {
    return null;
  }
  if (parsed.pathname === '/api/proxy') {
    const service = parsed.searchParams.get('service');
    const path = parsed.searchParams.get('path');
    return findEndpointByProxy(service, path);
  }
  const host = parsed.hostname.toLowerCase();
  const pathname = normalizeEndpointPath(parsed.pathname);
  return Object.entries(DATA_ENDPOINT_REGISTRY).find(([, endpoint]) => {
    if (!(endpoint.hosts || []).some(h => h.toLowerCase() === host)) return false;
    if (host === 'opendart.fss.or.kr') return endpointMatchesPath(endpoint, pathname.replace(/^api\//, ''));
    if (host === 'data.sec.gov') return endpointMatchesPath(endpoint, pathname.replace(/^api\/xbrl\//, ''));
    if (host === 'www.sec.gov') {
      const lowerPath = pathname.toLowerCase();
      if (pathname === 'files/company_tickers.json') return endpoint.path === 'files/company_tickers.json';
      if (lowerPath.startsWith('archives/edgar/data')) return endpoint.pathPrefix === 'archives/';
    }
    if (host.includes('finance.yahoo.com')) {
      if (pathname.includes('/finance/search')) return endpoint.path === 'search';
      if (pathname.includes('/finance/quote') && endpoint.path === 'quote') return true;
      if (pathname.includes('/finance/chart/') && endpoint.path === 'chart') return true;
      if (pathname.includes('/finance/quoteSummary/') && endpoint.path === 'quoteSummary') return true;
      if (pathname.includes('/finance/timeseries/') && endpoint.path === 'timeseries') return true;
    }
    return !endpoint.path && !endpoint.pathPrefix;
  }) || null;
}

function inferSourceIdFromProvider(provider) {
  const p = String(provider || '').toLowerCase();
  if (p.includes('opendart') || p.includes('dart')) return 'openDart';
  if (p.includes('sec')) return 'secEdgar';
  if (p.includes('data.go.kr') || p.includes('datagokr')) return 'dataGoKrStockPrice';
  if (p.includes('yahoo')) return 'yahooFinance';
  if (p.includes('alpha')) return 'alphaVantage';
  if (p.includes('fmp') || p.includes('financial modeling')) return 'fmp';
  return null;
}

function makeSourcePolicyError(sourceId, context = '', endpointId = null) {
  const meta = getEndpointMeta(endpointId) || getDataSourceMeta(sourceId);
  const label = meta?.label || endpointId || sourceId || 'source';
  const detail = context ? ` (${context})` : '';
  const err = new Error(`${label}${detail}: Personal mode only - blocked in Commercial-Safe mode`);
  err.code = 'SOURCE_POLICY_BLOCKED';
  err.sourceId = sourceId;
  err.endpointId = endpointId;
  err.personalOnly = true;
  return err;
}

function makeUnknownPolicyError(context = '', endpointId = null) {
  const detail = context ? ` (${context})` : '';
  const err = new Error(`${endpointId || 'unknown endpoint'}${detail}: blocked in Commercial-Safe mode until registered`);
  err.code = 'SOURCE_POLICY_UNKNOWN';
  err.endpointId = endpointId;
  err.personalOnly = true;
  return err;
}

function assertSourceAllowed(sourceId, apiSettings, context = '', endpointId = null) {
  if (isCommercialSafeMode(apiSettings) && endpointId) {
    const endpoint = getEndpointMeta(endpointId);
    if (!endpoint) throw makeUnknownPolicyError(context, endpointId);
    if (endpoint.blockedInCommercialSafe) {
      throw makeSourcePolicyError(endpoint.sourceId || sourceId, context, endpointId);
    }
  }
  const meta = getDataSourceMeta(sourceId);
  if (isCommercialSafeMode(apiSettings) && !meta) {
    throw makeUnknownPolicyError(context, endpointId || sourceId);
  }
  if (isCommercialSafeMode(apiSettings) && meta?.blockedInCommercialSafe) {
    throw makeSourcePolicyError(sourceId, context, endpointId);
  }
  return true;
}

function assertEndpointAllowed(endpointId, apiSettings, context = '') {
  const endpoint = getEndpointMeta(endpointId);
  if (isCommercialSafeMode(apiSettings) && !endpoint) throw makeUnknownPolicyError(context, endpointId);
  return assertSourceAllowed(endpoint?.sourceId, apiSettings, context, endpointId);
}

function assertUrlAllowed(url, apiSettings, context = '') {
  if (!isCommercialSafeMode(apiSettings)) return true;
  const pair = findEndpointByUrl(url);
  if (!pair) throw makeUnknownPolicyError(context, String(url).slice(0, 120));
  const [endpointId] = pair;
  return assertEndpointAllowed(endpointId, apiSettings, context);
}

function isPersonalOnlyError(err) {
  return err?.code === 'SOURCE_POLICY_BLOCKED' || err?.code === 'SOURCE_POLICY_UNKNOWN' || err?.personalOnly === true;
}

function getSourcePolicyRows(apiSettings) {
  const rows = Object.entries(DATA_SOURCE_REGISTRY).map(([id, meta]) => ({
    id,
    ...meta,
    allowed: !(isCommercialSafeMode(apiSettings) && meta.blockedInCommercialSafe),
  }));
  return rows;
}

function getEndpointPolicyRows(apiSettings) {
  return Object.entries(DATA_ENDPOINT_REGISTRY).map(([id, endpoint]) => {
    const source = getDataSourceMeta(endpoint.sourceId) || {};
    const blocked = endpoint.blockedInCommercialSafe || source.blockedInCommercialSafe || !source.label;
    return {
      id,
      ...source,
      ...endpoint,
      allowed: !(isCommercialSafeMode(apiSettings) && blocked),
    };
  });
}

function makeCacheSourceMeta({ provider, sourceId, endpointIds = [], mode, confidence, completeness } = {}) {
  const sourceInfo = getDataSourceMeta(sourceId) || inferSourceIdFromProvider(provider) && getDataSourceMeta(inferSourceIdFromProvider(provider)) || {};
  const endpointList = endpointIds.map(id => ({ id, ...(getEndpointMeta(id) || {}) }));
  const blocked = endpointList.some(e => e.blockedInCommercialSafe) || sourceInfo.blockedInCommercialSafe || false;
  return {
    provider: provider || sourceInfo.label || 'unknown',
    sourceId: sourceId || inferSourceIdFromProvider(provider) || null,
    endpointIds,
    mode: mode || 'personal',
    cost: sourceInfo.cost || 'unknown',
    commercialStatus: sourceInfo.commercialStatus || 'unknown',
    licenseUrl: sourceInfo.licenseUrl || '',
    rateLimit: sourceInfo.rateLimit || '',
    confidence: confidence || sourceInfo.confidence || 'D',
    completeness: completeness || null,
    commercialSafe: !blocked,
    blockedInCommercialSafe: Boolean(blocked),
    capturedAt: new Date().toISOString(),
  };
}

function attachDataViews(payload, sourceMeta, opts = {}) {
  const metrics = { ...(payload?.metrics || {}) };
  const metricsMeta = { ...(payload?.metricsMeta || {}) };
  const scoringMetrics = opts.scoringMetrics ? { ...opts.scoringMetrics } : metrics;
  const scoringMetricsMeta = opts.scoringMetricsMeta ? { ...opts.scoringMetricsMeta } : metricsMeta;
  return {
    ...payload,
    sourceMeta,
    displayData: {
      metrics,
      metricsMeta,
      sourceMeta,
      updatedAt: new Date().toISOString(),
    },
    scoringData: {
      metrics: scoringMetrics,
      metricsMeta: scoringMetricsMeta,
      sourceMeta,
      updatedAt: new Date().toISOString(),
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// Default market tickers (static headline display)
// ═══════════════════════════════════════════════════════════════
const DEFAULT_MARKET_TICKERS = [
  { symbol: 'KOSPI',  val: '–', change: null },
  { symbol: 'S&P',    val: '–', change: null },
  { symbol: 'NDX',    val: '–', change: null },
  { symbol: 'N225',   val: '–', change: null },
  { symbol: 'USDKRW', val: '–', change: null },
  { symbol: 'WTI',    val: '–', change: null },
  { symbol: 'BTC',    val: '–', change: null },
  { symbol: 'US10Y',  val: '–', change: null },
];

// ═══════════════════════════════════════════════════════════════
// Default stocks (seed data matching terminal metric naming)
// ═══════════════════════════════════════════════════════════════
const DEFAULT_STOCKS = {
  TSLA: {
    id: 'TSLA', symbol: 'TSLA', name: 'Tesla, Inc.', market: 'NASDAQ',
    currency: 'USD', flag: '🇺🇸', country: '미국',
    recommendation: 'Watch',
    oneLine: '전기차 마진보다 자율주행과 에너지 사업의 실제 확인이 핵심이다.',
    keyQuestion: 'FSD와 에너지 저장장치가 자동차 마진 둔화를 상쇄할 수 있는가?',
    thesis: ['에너지 저장장치 매출이 성장 축으로 부상하고 있다.', 'FSD 기대가 밸류에이션을 지지하지만 실적 기여는 아직 확인이 필요하다.', '자동차 마진 안정화가 먼저 확인되어야 한다.'],
    catalysts: ['FSD 지표 공개', '에너지 부문 마진 개선', '신차 출시 일정'],
    risks: ['가격 인하 경쟁', '높은 밸류에이션', '규제 및 안전성 이슈'],
    variantView: '시장은 FSD를 크게 반영하지만 에너지 부문의 안정적 이익 기여는 덜 반영할 수 있다.',
    numbersToWatch: ['자동차 gross margin', '에너지 매출 성장률', 'FCF 마진', '인도량 성장률'],
    changeMind: 'FCF 마진이 회복되지 않거나 인도량 성장률이 둔화되면 Watch 의견을 낮춘다.',
    price: 253.40, prevClose: 250.36, target: 280,
    metrics: { per: 72.6, pbr: 9.8, roe: 12.1, opMargin: 7.4, debtRatio: 17, revGrowth: 8.7, epsGrowth: -22.4, currentRatio: 173, fcfMargin: 4.8 },
    asOf: '2025-12-31', priceSrc: 'SEC EDGAR',
    scores: { overall: 44, profitability: 41, stability: 88, growth: 24, valuation: 0, risk: 78, weights: { profitability: 25, stability: 25, growth: 20, valuation: 20, risk: 10 } },
    scoreHistory: [52, 51, 49, 50, 48, 47, 46, 48, 47, 45, 46, 44],
    priceHistory: [214, 226, 221, 238, 245, 232, 251, 263, 256, 272, 267, 280, 275, 268, 253],
    valuation: {
      bear: { driver: 3, multiple: 45, mos: 10, price: 121.5 },
      base: { driver: 4, multiple: 70, mos: 0,  price: 280 },
      bull: { driver: 5, multiple: 85, mos: 0,  price: 425 },
      note: '높은 멀티플은 FSD와 에너지 성장 가정이 확인될 때 정당화된다.',
    },
    review: { next: '2026-08-31', cadence: 30 },
    notes: [
      { date: '2026-04-18', kind: '실적', text: '마진 회복 전까지는 밸류에이션 부담을 별도로 추적.', source: '' },
      { date: '2026-03-22', kind: '공시', text: 'Q1 인도량 발표 — 컨센서스 부합.', source: 'https://ir.tesla.com' },
    ],
    preMortem: [
      { metric: '자동차 gross margin', current: 16.3, threshold: 18, target: '≥ 18%', status: 'warn', delta: -1.7 },
      { metric: 'FCF 마진', current: 4.8, threshold: 7, target: '≥ 7%', status: 'warn', delta: -2.2 },
      { metric: '인도량 성장률 (YoY)', current: 6.2, threshold: 10, target: '≥ 10%', status: 'breach', delta: -3.8 },
    ],
  },
  AAPL: {
    id: 'AAPL', symbol: 'AAPL', name: 'Apple Inc.', market: 'NASDAQ',
    currency: 'USD', flag: '🇺🇸', country: '미국',
    recommendation: 'Hold',
    oneLine: '서비스 매출과 자사주 매입이 받쳐주지만, 신규 성장 동력이 약하다.',
    keyQuestion: 'AI 기능과 Vision Pro가 iPhone 매출 정체를 보완할 수 있는가?',
    thesis: ['서비스 매출 마진이 전체 수익성을 견인하고 있다.', '하드웨어 매출은 성숙기 진입, 교체 사이클 길어지는 중.', 'AI 통합과 자사주 매입이 EPS를 방어한다.'],
    catalysts: ['Apple Intelligence 확대', '서비스 매출 두 자릿수 성장', '인도/신흥국 점유율'],
    risks: ['중국 규제 및 매출 둔화', 'iPhone 교체 사이클 장기화', '반독점 소송'],
    variantView: '시장은 AI 효과를 빠르게 반영하지만, 실제 매출 기여는 2027년 이후일 수 있다.',
    numbersToWatch: ['서비스 매출 성장률', 'iPhone ASP', '중국 매출', '자사주 매입 규모'],
    changeMind: '서비스 매출 성장률이 한 자릿수로 떨어지면 의견 하향.',
    price: 212.05, prevClose: 212.94, target: 235,
    metrics: { per: 29.4, pbr: 36.2, roe: 156, opMargin: 31.5, debtRatio: 145, revGrowth: 5.2, epsGrowth: 9.4, currentRatio: 95, fcfMargin: 26.1 },
    asOf: '2025-09-30', priceSrc: 'SEC EDGAR',
    scores: { overall: 68, profitability: 92, stability: 70, growth: 38, valuation: 45, risk: 82, weights: { profitability: 25, stability: 25, growth: 20, valuation: 20, risk: 10 } },
    scoreHistory: [70, 71, 70, 69, 68, 67, 68, 69, 70, 69, 68, 68],
    priceHistory: [188, 192, 198, 205, 201, 208, 215, 218, 212, 220, 224, 218, 215, 211, 212],
    valuation: {
      bear: { driver: 6.2, multiple: 22, mos: 10, price: 122.8 },
      base: { driver: 7.0, multiple: 28, mos: 0,  price: 196 },
      bull: { driver: 7.8, multiple: 32, mos: 0,  price: 250 },
      note: '서비스 매출 비중이 30%를 넘으면 멀티플 재평가 가능.',
    },
    review: { next: '2026-09-15', cadence: 60 },
    notes: [
      { date: '2026-04-30', kind: '실적', text: 'Q2 서비스 매출 +14% YoY, 시장 예상 부합.', source: 'https://www.apple.com/newsroom' },
    ],
    preMortem: [
      { metric: '서비스 매출 성장률', current: 14.1, threshold: 10, target: '≥ 10%', status: 'ok', delta: 4.1 },
      { metric: '중국 매출 (YoY)', current: -8.2, threshold: 0, target: '≥ 0%', status: 'breach', delta: -8.2 },
    ],
  },
  NVDA: {
    id: 'NVDA', symbol: 'NVDA', name: 'NVIDIA Corporation', market: 'NASDAQ',
    currency: 'USD', flag: '🇺🇸', country: '미국',
    recommendation: 'Buy',
    oneLine: 'AI 인프라 투자 사이클의 정점, 그러나 경쟁사 대안 등장이 가까워졌다.',
    keyQuestion: 'CUDA moat가 ASIC/맞춤형 칩 등장 후에도 유지되는가?',
    thesis: ['데이터센터 GPU 수요가 향후 2년간 공급을 초과한다.', 'CUDA 생태계가 진입 장벽을 형성한다.', '하이퍼스케일러 자체 칩은 위협이지만 단기 영향은 제한적.'],
    catalysts: ['Blackwell 출하 확대', '엔터프라이즈 AI 도입', 'Sovereign AI 수주'],
    risks: ['고객사 자체 칩 (Trainium, TPU)', '중국 수출 규제', '높은 멀티플'],
    variantView: '시장은 향후 4년의 성장을 가격에 반영했다. 둔화 신호 한 분기면 큰 조정 가능.',
    numbersToWatch: ['데이터센터 매출 QoQ', '게임 매출', 'Capex 가이던스 (고객사)', '재고 일수'],
    changeMind: '데이터센터 매출이 QoQ 감소하면 즉시 비중 축소 검토.',
    price: 142.18, prevClose: 139.23, target: 165,
    metrics: { per: 65.2, pbr: 24.1, roe: 91.0, opMargin: 62.4, debtRatio: 12, revGrowth: 78.4, epsGrowth: 124.5, currentRatio: 412, fcfMargin: 49.8 },
    asOf: '2026-01-31', priceSrc: 'SEC EDGAR',
    scores: { overall: 82, profitability: 96, stability: 85, growth: 98, valuation: 35, risk: 65, weights: { profitability: 25, stability: 25, growth: 20, valuation: 20, risk: 10 } },
    scoreHistory: [78, 79, 80, 81, 82, 83, 84, 83, 82, 82, 82, 82],
    priceHistory: [98, 105, 112, 118, 124, 132, 138, 145, 142, 148, 152, 146, 144, 140, 142],
    valuation: {
      bear: { driver: 2.8, multiple: 35, mos: 15, price: 83.3 },
      base: { driver: 3.6, multiple: 50, mos: 0,  price: 180 },
      bull: { driver: 4.5, multiple: 60, mos: 0,  price: 270 },
      note: 'PER 50x는 데이터센터 매출 +40% YoY 가정.',
    },
    review: { next: '2026-08-22', cadence: 30 },
    notes: [
      { date: '2026-04-25', kind: '뉴스', text: 'Blackwell B200 양산 정상화, 공급 부족 완화.', source: '' },
    ],
    preMortem: [
      { metric: '데이터센터 매출 QoQ', current: 12.4, threshold: 5, target: '≥ 5%', status: 'ok', delta: 7.4 },
      { metric: '재고 일수', current: 92, threshold: 80, target: '≤ 80일', status: 'warn', delta: 12 },
    ],
  },
  '005930': {
    id: '005930', symbol: '005930', name: '삼성전자', market: 'KRX',
    currency: 'KRW', flag: '🇰🇷', country: '대한민국',
    recommendation: 'Buy',
    oneLine: 'HBM 사이클과 비메모리 마진 회복이 동시에 일어나는 변곡점이다.',
    keyQuestion: 'HBM3E 양산 수율과 파운드리 고객사 확보가 동시에 진행되는가?',
    thesis: ['메모리 가격 사이클 상승 국면 진입.', 'HBM에서는 SK하이닉스 대비 후발주자, 따라잡기 진행 중.', '파운드리 적자 축소가 밸류에이션 재평가의 핵심.'],
    catalysts: ['HBM3E 엔비디아 퀄 통과', '메모리 ASP 상승', '파운드리 신규 수주'],
    risks: ['중국 메모리 추격 (CXMT)', '환율 변동성', '파운드리 적자 지속'],
    variantView: '시장은 HBM 점유율 회복을 의심하지만, 양산 수율 정상화 시 가파른 재평가 가능.',
    numbersToWatch: ['HBM 매출', '메모리 OP 마진', '파운드리 가동률', '재고 일수'],
    changeMind: 'HBM3E 양산 차질 시 비중 축소.',
    price: 76400, prevClose: 75800, target: 92000,
    metrics: { per: 18.4, pbr: 1.3, roe: 7.6, opMargin: 12.8, debtRatio: 27, revGrowth: 14.2, epsGrowth: 41.2, currentRatio: 220, fcfMargin: 8.4 },
    asOf: '2025-12-31', priceSrc: 'DART',
    scores: { overall: 71, profitability: 65, stability: 82, growth: 72, valuation: 78, risk: 70, weights: { profitability: 25, stability: 25, growth: 20, valuation: 20, risk: 10 } },
    scoreHistory: [62, 64, 65, 66, 68, 69, 70, 71, 72, 71, 71, 71],
    priceHistory: [62000, 64500, 67000, 69500, 71000, 73000, 75500, 78000, 76000, 79000, 81000, 78500, 77200, 76800, 76400],
    valuation: {
      bear: { driver: 3500, multiple: 12, mos: 10, price: 37800 },
      base: { driver: 4500, multiple: 18, mos: 0,  price: 81000 },
      bull: { driver: 5800, multiple: 22, mos: 0,  price: 127600 },
      note: 'HBM 매출 비중 15% 도달 시 멀티플 재평가.',
    },
    review: { next: '2026-08-30', cadence: 45 },
    notes: [
      { date: '2026-04-28', kind: '실적', text: 'Q1 OP 6.6조원, 컨센서스 부합. 메모리 견인.', source: 'https://www.samsung.com' },
    ],
    preMortem: [
      { metric: 'HBM 매출 (Q, ₩조)', current: 4.2, threshold: 5.5, target: '≥ 5.5조', status: 'warn', delta: -1.3 },
      { metric: '파운드리 가동률', current: 64, threshold: 75, target: '≥ 75%', status: 'breach', delta: -11 },
    ],
  },
};

const DEFAULT_WATCHLIST_IDS = ['TSLA', 'AAPL', '005930', 'NVDA'];

// ═══════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════
function loadAppState() {
  try {
    const raw = localStorage.getItem(TT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveAppState(state) {
  try {
    localStorage.setItem(TT_KEY, JSON.stringify(state));
  } catch (e) {
    const isQuota = e?.name === 'QuotaExceededError' || e?.code === 22 || e?.code === 1014;
    if (isQuota) {
      try { localStorage.setItem(TT_KEY, JSON.stringify({ ...state, dataCache: {} })); } catch {}
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════
function clamp(v, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, v)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function toNumber(v) {
  if (v === null || v === undefined || v === '' || v === 'None') return NaN;
  const n = Number(String(v).replaceAll(',', ''));
  return Number.isFinite(n) ? n : NaN;
}

function firstFinite(...vals) {
  for (const v of vals) { const n = toNumber(v); if (Number.isFinite(n)) return n; }
  return NaN;
}

function ratioPercent(num, den) {
  const t = toNumber(num), b = toNumber(den);
  return b ? (t / b) * 100 : NaN;
}

function decimalToPercent(v) {
  const n = toNumber(v);
  if (!Number.isFinite(n)) return NaN;
  return Math.abs(n) <= 3 ? n * 100 : n;
}

function compactMetrics(m) {
  return Object.fromEntries(
    Object.entries(m)
      .filter(([, v]) => Number.isFinite(v))
      .map(([k, v]) => [k, Math.round(v * 10) / 10])
  );
}

function normalizeKrxStockCode(symbol) {
  const raw = String(symbol || '').trim().toUpperCase();
  const match = raw.match(/\d{5,6}/);
  return match ? match[0].padStart(6, '0') : raw.padStart(6, '0');
}

function getDartCorpEntry(dartCorpMap, stockOrSymbol) {
  const symbol = typeof stockOrSymbol === 'string'
    ? stockOrSymbol
    : (stockOrSymbol?.symbol || stockOrSymbol?.id || '');
  const code = normalizeKrxStockCode(symbol);
  return dartCorpMap?.[code] || dartCorpMap?.[symbol] || dartCorpMap?.[String(symbol).toUpperCase()] || null;
}

async function fetchLocalDartCorpMap(path = 'data/dart-corp-codes.json') {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (res.status === 404) {
      return { status: 'missing', map: {}, count: 0, message: `${path} not found` };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSON object expected');
    const map = {};
    for (const [key, value] of Object.entries(data)) {
      const code = normalizeKrxStockCode(key);
      if (!value?.corpCode) continue;
      map[code] = {
        corpCode: String(value.corpCode).trim(),
        corpName: String(value.corpName || value.name || key).trim(),
      };
    }
    return { status: 'loaded', map, count: Object.keys(map).length, message: `${Object.keys(map).length} entries loaded` };
  } catch (e) {
    return { status: 'error', map: {}, count: 0, message: e?.message || String(e) };
  }
}

function firstRecord(d) {
  if (Array.isArray(d)) return d[0] ?? {};
  if (Array.isArray(d?.data)) return d.data[0] ?? {};
  if (Array.isArray(d?.historical)) return d.historical[0] ?? {};
  return d ?? {};
}

function getFmpHistoricalRows(d) {
  if (Array.isArray(d?.historical)) return d.historical;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
}

function getDaysLeft(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function getReportEndDate(year, reportCode) {
  const endings = { 11011: '12-31', 11012: '06-30', 11013: '03-31', 11014: '09-30' };
  return `${year}-${endings[reportCode] ?? '12-31'}`;
}

// ═══════════════════════════════════════════════════════════════
// Score computation (uses terminal metric naming: opMargin, revGrowth)
// ═══════════════════════════════════════════════════════════════
const DEFAULT_SCORE = {
  t:  { roe:{poor:0,ideal:20}, opMargin:{poor:0,ideal:25}, fcfMargin:{poor:-5,ideal:15}, debtRatio:{ideal:40,poor:180}, currentRatio:{poor:70,ideal:220}, revGrowth:{poor:-8,ideal:22}, epsGrowth:{poor:-15,ideal:25}, per:{ideal:10,poor:55}, pbr:{ideal:1,poor:8} },
  w:  { profitability:25, stability:25, growth:20, valuation:20, risk:10 },
  mw: { roe:0.5, opMargin:0.3, fcfMargin:0.2, debtRatio:0.55, currentRatio:0.45, revGrowth:0.48, epsGrowth:0.52, per:0.6, pbr:0.4 },
  rr: { epsGrowthBelow:0, fcfMarginBelow:0, debtRatioAbove:150, perAbove:70, penalty:22 },
};

const INDUSTRY_CFG = {
  SEMI: {
    t:  { roe:{poor:8,ideal:25}, opMargin:{poor:15,ideal:40}, fcfMargin:{poor:5,ideal:25}, debtRatio:{ideal:50,poor:180}, currentRatio:{poor:120,ideal:300}, revGrowth:{poor:0,ideal:35}, epsGrowth:{poor:-20,ideal:45}, per:{ideal:8,poor:30}, pbr:{ideal:0.8,poor:4} },
    w:  { profitability:25, stability:20, growth:30, valuation:15, risk:10 },
    rr: { epsGrowthBelow:-15, fcfMarginBelow:0, debtRatioAbove:200, perAbove:35, penalty:22 },
  },
  SW_AI: {
    t:  { roe:{poor:12,ideal:30}, opMargin:{poor:15,ideal:35}, fcfMargin:{poor:10,ideal:30}, debtRatio:{ideal:30,poor:120}, currentRatio:{poor:150,ideal:400}, revGrowth:{poor:15,ideal:40}, epsGrowth:{poor:10,ideal:40}, per:{ideal:15,poor:45}, pbr:{ideal:2,poor:12} },
    w:  { profitability:20, stability:10, growth:40, valuation:20, risk:10 },
    rr: { epsGrowthBelow:5, fcfMarginBelow:5, debtRatioAbove:120, perAbove:60, penalty:22 },
  },
  TECH_HW: {
    t:  { roe:{poor:8,ideal:22}, opMargin:{poor:8,ideal:22}, fcfMargin:{poor:3,ideal:15}, debtRatio:{ideal:60,poor:200}, currentRatio:{poor:100,ideal:250}, revGrowth:{poor:5,ideal:25}, epsGrowth:{poor:0,ideal:25}, per:{ideal:10,poor:30}, pbr:{ideal:1,poor:5} },
    w:  { profitability:22, stability:18, growth:30, valuation:20, risk:10 },
    rr: { epsGrowthBelow:0, fcfMarginBelow:0, debtRatioAbove:200, perAbove:40, penalty:22 },
  },
  PLATFORM: {
    t:  { roe:{poor:8,ideal:25}, opMargin:{poor:5,ideal:25}, fcfMargin:{poor:0,ideal:20}, debtRatio:{ideal:40,poor:150}, currentRatio:{poor:100,ideal:250}, revGrowth:{poor:10,ideal:30}, epsGrowth:{poor:5,ideal:30}, per:{ideal:15,poor:50}, pbr:{ideal:2,poor:10} },
    w:  { profitability:18, stability:15, growth:35, valuation:22, risk:10 },
    rr: { epsGrowthBelow:0, fcfMarginBelow:-5, debtRatioAbove:150, perAbove:60, penalty:22 },
  },
  HEALTHCARE: {
    t:  { roe:{poor:10,ideal:22}, opMargin:{poor:18,ideal:35}, fcfMargin:{poor:10,ideal:25}, debtRatio:{ideal:40,poor:150}, currentRatio:{poor:130,ideal:300}, revGrowth:{poor:5,ideal:20}, epsGrowth:{poor:5,ideal:20}, per:{ideal:12,poor:35}, pbr:{ideal:1.5,poor:6} },
    w:  { profitability:25, stability:20, growth:25, valuation:20, risk:10 },
    rr: { epsGrowthBelow:0, fcfMarginBelow:5, debtRatioAbove:150, perAbove:50, penalty:22 },
  },
  BIOTECH: {
    t:  { roe:{poor:-50,ideal:5}, opMargin:{poor:-80,ideal:-5}, fcfMargin:{poor:-80,ideal:-5}, debtRatio:{ideal:30,poor:100}, currentRatio:{poor:200,ideal:600}, revGrowth:{poor:-20,ideal:50}, epsGrowth:{poor:-50,ideal:30}, per:{ideal:10,poor:50}, pbr:{ideal:1,poor:8} },
    w:  { profitability:5, stability:30, growth:45, valuation:10, risk:10 },
    mw: { roe:1, opMargin:0, fcfMargin:0, debtRatio:0.4, currentRatio:0.6 },
    rr: { epsGrowthBelow:-30, fcfMarginBelow:-50, debtRatioAbove:100, perAbove:100, penalty:15 },
  },
  CONSUMER: {
    t:  { roe:{poor:10,ideal:20}, opMargin:{poor:8,ideal:18}, fcfMargin:{poor:5,ideal:15}, debtRatio:{ideal:60,poor:200}, currentRatio:{poor:90,ideal:200}, revGrowth:{poor:0,ideal:12}, epsGrowth:{poor:0,ideal:15}, per:{ideal:8,poor:22}, pbr:{ideal:0.8,poor:4} },
    w:  { profitability:30, stability:20, growth:20, valuation:20, risk:10 },
    rr: { epsGrowthBelow:0, fcfMarginBelow:0, debtRatioAbove:200, perAbove:30, penalty:22 },
  },
  CYCLICAL: {
    t:  { roe:{poor:6,ideal:18}, opMargin:{poor:5,ideal:18}, fcfMargin:{poor:0,ideal:12}, debtRatio:{ideal:80,poor:250}, currentRatio:{poor:90,ideal:200}, revGrowth:{poor:-5,ideal:18}, epsGrowth:{poor:-15,ideal:25}, per:{ideal:6,poor:18}, pbr:{ideal:0.5,poor:2.5} },
    w:  { profitability:22, stability:30, growth:18, valuation:20, risk:10 },
    rr: { epsGrowthBelow:-10, fcfMarginBelow:-5, debtRatioAbove:250, perAbove:25, penalty:22 },
  },
  FINANCIAL: {
    t:  { roe:{poor:6,ideal:15}, opMargin:{poor:0,ideal:30}, fcfMargin:{poor:-10,ideal:10}, debtRatio:{ideal:500,poor:2000}, currentRatio:{poor:50,ideal:120}, revGrowth:{poor:0,ideal:12}, epsGrowth:{poor:0,ideal:12}, per:{ideal:5,poor:15}, pbr:{ideal:0.5,poor:1.8} },
    w:  { profitability:25, stability:10, growth:20, valuation:25, risk:20 },
    mw: { roe:1, opMargin:0, fcfMargin:0, debtRatio:0, currentRatio:0 },
    rr: { epsGrowthBelow:0, fcfMarginBelow:-20, debtRatioAbove:2000, perAbove:20, penalty:20 },
  },
  DEFENSIVE: {
    t:  { roe:{poor:6,ideal:12}, opMargin:{poor:12,ideal:30}, fcfMargin:{poor:8,ideal:20}, debtRatio:{ideal:100,poor:350}, currentRatio:{poor:80,ideal:180}, revGrowth:{poor:-2,ideal:8}, epsGrowth:{poor:-2,ideal:8}, per:{ideal:8,poor:20}, pbr:{ideal:0.7,poor:2.5} },
    w:  { profitability:25, stability:35, growth:10, valuation:20, risk:10 },
    rr: { epsGrowthBelow:-5, fcfMarginBelow:0, debtRatioAbove:350, perAbove:25, penalty:22 },
  },
};

function getIndustryCfg(industryGroup) {
  const cfg = INDUSTRY_CFG[industryGroup];
  if (!cfg) return { t: DEFAULT_SCORE.t, w: DEFAULT_SCORE.w, mw: DEFAULT_SCORE.mw, rr: DEFAULT_SCORE.rr };
  return {
    t:  { ...DEFAULT_SCORE.t,  ...cfg.t  },
    w:  { ...DEFAULT_SCORE.w,  ...cfg.w  },
    mw: { ...DEFAULT_SCORE.mw, ...(cfg.mw || {}) },
    rr: { ...DEFAULT_SCORE.rr, ...cfg.rr },
  };
}

function detectIndustry(sector, industry) {
  const si = (String(sector || '') + ' ' + String(industry || '')).toLowerCase();
  if (/semiconductor|반도체/.test(si)) return 'SEMI';
  if (/software|saas|소프트웨어|인터넷 정보서비스|artificial intelligence/.test(si)) return 'SW_AI';
  if (/internet retail|internet content|e-commerce|플랫폼|이커머스/.test(si)) return 'PLATFORM';
  if (/(electronic|hardware|robot|전자부품|로봇|display|배터리|battery|photonics|optical)/.test(si)) return 'TECH_HW';
  if (/biotechnology|생물/.test(si)) return 'BIOTECH';
  if (/health|pharma|drug|medical|의약품|의료/.test(si)) return 'HEALTHCARE';
  if (/financial|bank|insurance|금융|은행|보험|증권|asset management/.test(si)) return 'FINANCIAL';
  if (/utilities|telecom|communication services|reit|real estate|통신|전력|부동산/.test(si)) return 'DEFENSIVE';
  if (/industrial|material|energy|chemical|steel|mining|산업|소재|화학|철강|에너지|광업/.test(si)) return 'CYCLICAL';
  if (/consumer|retail|food|beverage|apparel|automobile|auto|소비재|음식료|자동차|의류/.test(si)) return 'CONSUMER';
  return null;
}

function scoreHi(v, poor, ideal) {
  if (v >= ideal) return 100;
  if (v <= poor) return 0;
  return clamp(((v - poor) / (ideal - poor)) * 100);
}

function scoreLo(v, ideal, poor) {
  if (v <= ideal) return 100;
  if (v >= poor) return 0;
  return clamp(100 - ((v - ideal) / (poor - ideal)) * 100);
}

function computeScores(metrics, industryGroup) {
  const { t, w, mw, rr } = getIndustryCfg(industryGroup);

  const safeHi = (v, poor, ideal) => Number.isFinite(Number(v)) ? scoreHi(Number(v), poor, ideal) : null;
  const safeLo = (v, ideal, poor) => Number.isFinite(Number(v)) ? scoreLo(Number(v), ideal, poor) : null;
  const safeLoPos = (v, ideal, poor) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? scoreLo(n, ideal, poor) : null;
  };

  const wavg = (parts) => {
    const valid = parts.filter(p => p.value !== null && Number.isFinite(p.value) && p.weight > 0);
    if (!valid.length) return null;
    const tw = valid.reduce((s, p) => s + p.weight, 0);
    if (!tw) return null;
    return Math.round(valid.reduce((s, p) => s + p.value * p.weight, 0) / tw);
  };

  const profitability = wavg([
    { value: safeHi(metrics.roe, t.roe.poor, t.roe.ideal),           weight: mw.roe },
    { value: safeHi(metrics.opMargin, t.opMargin.poor, t.opMargin.ideal), weight: mw.opMargin },
    { value: safeHi(metrics.fcfMargin, t.fcfMargin.poor, t.fcfMargin.ideal), weight: mw.fcfMargin },
  ]);

  const stability = wavg([
    { value: safeLo(metrics.debtRatio, t.debtRatio.ideal, t.debtRatio.poor), weight: mw.debtRatio },
    { value: safeHi(metrics.currentRatio, t.currentRatio.poor, t.currentRatio.ideal), weight: mw.currentRatio },
  ]);

  const growth = wavg([
    { value: safeHi(metrics.revGrowth, t.revGrowth.poor, t.revGrowth.ideal), weight: mw.revGrowth },
    { value: safeHi(metrics.epsGrowth, t.epsGrowth.poor, t.epsGrowth.ideal), weight: mw.epsGrowth },
  ]);

  const valuation = wavg([
    { value: safeLoPos(metrics.per, t.per.ideal, t.per.poor), weight: mw.per },
    { value: safeLoPos(metrics.pbr, t.pbr.ideal, t.pbr.poor), weight: mw.pbr },
  ]);

  const per = Number(metrics.per);
  const riskFlags = [
    Number.isFinite(Number(metrics.epsGrowth)) && Number(metrics.epsGrowth) < rr.epsGrowthBelow,
    Number.isFinite(Number(metrics.fcfMargin)) && Number(metrics.fcfMargin) < rr.fcfMarginBelow,
    Number.isFinite(Number(metrics.debtRatio)) && Number(metrics.debtRatio) > rr.debtRatioAbove,
    Number.isFinite(per) && per > rr.perAbove,
    Number.isFinite(per) && per <= 0,
  ];
  const risk = clamp(100 - riskFlags.filter(Boolean).length * rr.penalty);

  const primaryHasAny = [profitability, stability, growth, valuation].some(v => v !== null && Number.isFinite(v));
  let overall = null;
  if (primaryHasAny) {
    const parts = [
      { value: profitability, weight: w.profitability },
      { value: stability,     weight: w.stability },
      { value: growth,        weight: w.growth },
      { value: valuation,     weight: w.valuation },
      { value: risk,          weight: w.risk },
    ].filter(p => p.value !== null && Number.isFinite(p.value));
    const tw = parts.reduce((s, p) => s + p.weight, 0);
    if (tw > 0) overall = Math.round(parts.reduce((s, p) => s + p.value * p.weight, 0) / tw);
  }

  return { overall, profitability, stability, growth, valuation, risk, riskFlagCount: riskFlags.filter(Boolean).length, weights: w, industryGroup: industryGroup || null };
}

// ═══════════════════════════════════════════════════════════════
// Quant Scoring Engine (Market Baseline-Anchored Z-Scores)
// ═══════════════════════════════════════════════════════════════
const statMean = a => a.length ? a.reduce((s,x)=>s+x,0) / a.length : 0;
const statStdev = a => { const m=statMean(a); return Math.sqrt(statMean(a.map(x=>(x-m)**2))); };

// Static sector baselines — S&P 500 / KOSPI long-run averages (source: Capital IQ / FactSet, as of 2024-Q4)
const MARKET_BASELINES = {
  ALL:        { per: { m: 18, s: 8 }, pbr: { m: 2.5, s: 1.5 }, evEbitda: { m: 12, s: 6 }, roe: { m: 12, s: 10 }, roic: { m: 10, s: 8 }, opMargin: { m: 12, s: 10 }, gpa: { m: 25, s: 15 }, debtRatio: { m: 100, s: 60 }, currentRatio: { m: 150, s: 80 }, revGrowth: { m: 8, s: 10 }, epsGrowth: { m: 10, s: 15 } },
  SEMI:       { per: { m: 22, s: 10 }, pbr: { m: 4.0, s: 2.0 }, evEbitda: { m: 15, s: 8 }, roe: { m: 18, s: 15 }, roic: { m: 15, s: 12 }, opMargin: { m: 22, s: 15 }, gpa: { m: 35, s: 20 }, debtRatio: { m: 50, s: 40 }, currentRatio: { m: 200, s: 100 }, revGrowth: { m: 12, s: 20 }, epsGrowth: { m: 15, s: 25 } },
  SW_AI:      { per: { m: 35, s: 20 }, pbr: { m: 6.0, s: 4.0 }, evEbitda: { m: 25, s: 15 }, roe: { m: 15, s: 25 }, roic: { m: 12, s: 20 }, opMargin: { m: 15, s: 25 }, gpa: { m: 45, s: 25 }, debtRatio: { m: 40, s: 30 }, currentRatio: { m: 220, s: 120 }, revGrowth: { m: 20, s: 25 }, epsGrowth: { m: 20, s: 30 } },
  PLATFORM:   { per: { m: 30, s: 15 }, pbr: { m: 5.0, s: 3.0 }, evEbitda: { m: 20, s: 10 }, roe: { m: 15, s: 15 }, roic: { m: 12, s: 12 }, opMargin: { m: 18, s: 15 }, gpa: { m: 40, s: 20 }, debtRatio: { m: 60, s: 40 }, currentRatio: { m: 180, s: 90 }, revGrowth: { m: 15, s: 15 }, epsGrowth: { m: 15, s: 20 } },
  TECH_HW:    { per: { m: 16, s: 6 }, pbr: { m: 2.5, s: 1.2 }, evEbitda: { m: 10, s: 5 }, roe: { m: 12, s: 8 }, roic: { m: 10, s: 8 }, opMargin: { m: 10, s: 6 }, gpa: { m: 25, s: 15 }, debtRatio: { m: 80, s: 50 }, currentRatio: { m: 160, s: 70 }, revGrowth: { m: 6, s: 8 }, epsGrowth: { m: 8, s: 12 } },
  BIOTECH:    { per: { m: 30, s: 20 }, pbr: { m: 4.0, s: 3.0 }, evEbitda: { m: 20, s: 15 }, roe: { m: -5, s: 30 }, roic: { m: -5, s: 30 }, opMargin: { m: -10, s: 40 }, gpa: { m: 10, s: 20 }, debtRatio: { m: 40, s: 50 }, currentRatio: { m: 300, s: 200 }, revGrowth: { m: 15, s: 30 }, epsGrowth: { m: 10, s: 30 } },
  HEALTHCARE: { per: { m: 20, s: 8 }, pbr: { m: 3.5, s: 1.5 }, evEbitda: { m: 14, s: 5 }, roe: { m: 16, s: 10 }, roic: { m: 12, s: 8 }, opMargin: { m: 18, s: 10 }, gpa: { m: 35, s: 15 }, debtRatio: { m: 90, s: 60 }, currentRatio: { m: 150, s: 70 }, revGrowth: { m: 7, s: 6 }, epsGrowth: { m: 9, s: 8 } },
  FINANCIAL:  { per: { m: 11, s: 4 }, pbr: { m: 1.1, s: 0.6 }, evEbitda: { m: 8, s: 4 }, roe: { m: 11, s: 5 }, roic: { m: 8, s: 4 }, opMargin: { m: 30, s: 15 }, gpa: { m: 15, s: 10 }, debtRatio: { m: 500, s: 400 }, currentRatio: { m: 110, s: 30 }, revGrowth: { m: 5, s: 5 }, epsGrowth: { m: 6, s: 8 } },
  DEFENSIVE:  { per: { m: 16, s: 5 }, pbr: { m: 1.8, s: 0.8 }, evEbitda: { m: 10, s: 3 }, roe: { m: 10, s: 4 }, roic: { m: 7, s: 3 }, opMargin: { m: 15, s: 8 }, gpa: { m: 20, s: 10 }, debtRatio: { m: 120, s: 70 }, currentRatio: { m: 120, s: 50 }, revGrowth: { m: 4, s: 4 }, epsGrowth: { m: 5, s: 5 } },
  CYCLICAL:   { per: { m: 14, s: 6 }, pbr: { m: 1.5, s: 0.8 }, evEbitda: { m: 8, s: 4 }, roe: { m: 12, s: 12 }, roic: { m: 9, s: 10 }, opMargin: { m: 10, s: 8 }, gpa: { m: 20, s: 15 }, debtRatio: { m: 100, s: 60 }, currentRatio: { m: 150, s: 60 }, revGrowth: { m: 6, s: 15 }, epsGrowth: { m: 8, s: 20 } },
  CONSUMER:   { per: { m: 18, s: 8 }, pbr: { m: 3.0, s: 1.5 }, evEbitda: { m: 12, s: 5 }, roe: { m: 15, s: 10 }, roic: { m: 12, s: 8 }, opMargin: { m: 12, s: 8 }, gpa: { m: 30, s: 15 }, debtRatio: { m: 110, s: 70 }, currentRatio: { m: 140, s: 60 }, revGrowth: { m: 6, s: 8 }, epsGrowth: { m: 8, s: 12 } },
};

function zScoreMarket(value, metricKey, industryGroup, higherIsBetter = true) {
  if (value == null || !Number.isFinite(value)) return null;
  const cfg = MARKET_BASELINES[industryGroup] || MARKET_BASELINES.ALL;
  const stat = cfg[metricKey] || MARKET_BASELINES.ALL[metricKey];
  if (!stat || !stat.s) return null;
  
  let z = (value - stat.m) / stat.s;
  const clipped = Math.max(-3, Math.min(3, z));
  return higherIsBetter ? clipped : -clipped;
}

function zToScore(z) {
  const erf = x => {
    const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
    const sign = x<0 ? -1 : 1; x = Math.abs(x);
    const t = 1/(1+p*x);
    const y = 1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
    return sign*y;
  };
  return Math.round(50*(1+erf((z||0)/Math.SQRT2)));
}

function computePiotroski(metrics, ind) {
  const cfg = MARKET_BASELINES[ind] || MARKET_BASELINES.ALL;
  const get = key => toNumber(metrics?.[key]);
  let score = 0;
  const signals = [];
  // Profitability
  if (Number.isFinite(get('roe'))         && get('roe') > 0)                        { score++; signals.push('ROE+'); }
  if (Number.isFinite(get('fcfMargin'))   && get('fcfMargin') > 0)                  { score++; signals.push('FCF+'); }
  if (Number.isFinite(get('opMargin'))    && get('opMargin') > cfg.opMargin.m)      { score++; signals.push('OP>avg'); }
  // Leverage & Liquidity
  if (Number.isFinite(get('debtRatio'))   && get('debtRatio') < cfg.debtRatio.m)    { score++; signals.push('D/E↓'); }
  if (Number.isFinite(get('currentRatio'))&& get('currentRatio') > 100)              { score++; signals.push('CR>1'); }
  // Growth
  if (Number.isFinite(get('revGrowth'))   && get('revGrowth') > 0)                  { score++; signals.push('Rev+'); }
  if (Number.isFinite(get('epsGrowth'))   && get('epsGrowth') > 0)                  { score++; signals.push('EPS+'); }
  return { score, signals };
}

function computeQuantScores(universe) {
  const N = universe.length;
  const metricBag = s => s.scoringData?.metrics || s.metrics || {};
  const getMetric = (s, key) => toNumber(metricBag(s)?.[key]);
  const nonNullArray = a => a.filter(v => v != null);

  const updates = {};
  for (let i = 0; i < N; i++) {
    const stock = universe[i];
    const ind = stock.industryGroup || 'ALL';

    const rawPer = getMetric(stock, 'per');
    const rawPbr = getMetric(stock, 'pbr');
    const rawEvEbitda = getMetric(stock, 'evEbitda');

    const zPer = zScoreMarket(rawPer > 0 ? rawPer : null, 'per', ind, false);
    const zPbr = zScoreMarket(rawPbr > 0 ? rawPbr : null, 'pbr', ind, false);
    const zEv = zScoreMarket(rawEvEbitda > 0 ? rawEvEbitda : null, 'evEbitda', ind, false);
    const valueParts = nonNullArray([zPer, zPbr, zEv]);
    const valueNeut = valueParts.length ? statMean(valueParts) : 0;

    const zRoe = zScoreMarket(getMetric(stock, 'roe'), 'roe', ind, true);
    const zRoic = zScoreMarket(getMetric(stock, 'roic'), 'roic', ind, true);
    const zOpM = zScoreMarket(getMetric(stock, 'opMargin'), 'opMargin', ind, true);
    const zGpa = zScoreMarket(getMetric(stock, 'gpa'), 'gpa', ind, true);
    const qualityParts = nonNullArray([zRoe, zRoic, zOpM, zGpa]);
    const qualityNeut = qualityParts.length ? statMean(qualityParts) : 0;

    const zDebt = zScoreMarket(getMetric(stock, 'debtRatio'), 'debtRatio', ind, false);
    const zCur = zScoreMarket(getMetric(stock, 'currentRatio'), 'currentRatio', ind, true);
    const safetyParts = nonNullArray([zDebt, zCur]);
    const safetyNeut = safetyParts.length ? statMean(safetyParts) : 0;

    const zRevG = zScoreMarket(getMetric(stock, 'revGrowth'), 'revGrowth', ind, true);
    const zEpsG = zScoreMarket(getMetric(stock, 'epsGrowth'), 'epsGrowth', ind, true);
    const growthParts = nonNullArray([zRevG, zEpsG]);
    const growthNeut = growthParts.length ? statMean(growthParts) : 0;

    const riskFlags = [
      getMetric(stock, 'epsGrowth') < -15,
      getMetric(stock, 'fcfMargin') < -5,
      getMetric(stock, 'debtRatio') > 250,
      rawPer > 60,
      rawPer <= 0 && getMetric(stock, 'roe') < 0,
      getMetric(stock, 'currentRatio') < 100 && getMetric(stock, 'debtRatio') > 150,
      getMetric(stock, 'revGrowth') < -15,
      getMetric(stock, 'opMargin') < 0,
    ].filter(Boolean).length;
    const riskPenalty = riskFlags * 0.4;
    const zComp = 0.3 * valueNeut + 0.3 * qualityNeut + 0.2 * safetyNeut + 0.2 * growthNeut - riskPenalty;

    const pio = computePiotroski(metricBag(stock), ind);

    updates[stock.id] = {
      overall: zToScore(zComp),
      profitability: zToScore(qualityNeut),
      stability: zToScore(safetyNeut),
      growth: zToScore(growthNeut),
      valuation: zToScore(valueNeut),
      risk: clamp(100 - riskFlags * 13),
      riskFlagCount: riskFlags,
      riskFlagMax: 8,
      piotroskiScore: pio.score,
      piotroskiSignals: pio.signals,
      weights: { profitability: 30, stability: 20, growth: 20, valuation: 30, risk: 10 },
      industryGroup: stock.industryGroup || null,
      isRelative: true
    };
  }
  return updates;
}

function applyQuantScores(stocksMap, watchlistIds) {
  const universe = (watchlistIds || []).map(id => stocksMap[id]).filter(Boolean);
  const scoreUpdates = computeQuantScores(universe);
  let changed = false;
  const next = { ...stocksMap };
  for (const [id, newScores] of Object.entries(scoreUpdates)) {
    const old = next[id];
    if (old) {
      next[id] = { ...old, scores: newScores };
      changed = true;
    }
  }
  return changed ? next : stocksMap;
}

function computeDynamicQuality(stock) {
  const items = [];
  const today = new Date();

  // Data freshness
  if (stock.asOf) {
    const d = new Date(stock.asOf);
    const days = Math.floor((today - d) / 86400000);
    const age = days < 30 ? `${days}일` : `${Math.floor(days/30)}개월`;
    items.push({ kind: days > 180 ? 'warn' : 'ok', text: `재무 기준일 ${stock.asOf} (${age} 경과)` });
  } else {
    items.push({ kind: 'warn', text: '재무 기준일 미입력 — 데이터 신뢰도 낮음' });
  }

  // EPS growth
  const eps = Number(stock.metrics?.epsGrowth);
  if (Number.isFinite(eps)) {
    const s = eps >= 0 ? '+' : '';
    items.push({ kind: eps < 0 ? 'warn' : 'info', text: `EPS 성장 전기 대비 ${s}${eps.toFixed(1)}%${eps < 0 ? ' — 추적 필요' : ' — 안정적'}` });
  }

  // Price source
  if (stock.priceSrc) {
    items.push({ kind: 'ok', text: `가격 출처 ${stock.priceSrc}` });
  }

  // PER warning
  const per = Number(stock.metrics?.per);
  if (Number.isFinite(per)) {
    if (per <= 0) items.push({ kind: 'warn', text: `PER ${per.toFixed(1)}x — 적자 종목 해석 주의` });
    else if (per > 55) items.push({ kind: 'warn', text: `PER ${per.toFixed(1)}x — 멀티플 압축 위험` });
  }

  // Review
  if (stock.review?.next) {
    const dl = getDaysLeft(stock.review.next);
    if (dl !== null) {
      const kind = dl < 0 ? 'warn' : dl <= 14 ? 'warn' : 'info';
      const text = dl < 0 ? `리뷰 ${Math.abs(dl)}일 지연 — ${stock.review.next}` : `다음 리뷰 D-${dl} (${stock.review.next})`;
      items.push({ kind, text });
    }
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════
// Market inference helpers
// ═══════════════════════════════════════════════════════════════
function getMarketProfile(key) {
  return MARKET_PROFILES.find(p => p.key === key) ?? MARKET_PROFILES.find(p => p.key === 'CUSTOM');
}

function inferMarketFromExchange(symbol, exchangeText = '') {
  const us = String(symbol).toUpperCase();
  const ue = String(exchangeText).toUpperCase();
  const suffixMap = [['.KS','KRX'],['.KQ','KRX'],['.T','TSE'],['.L','LSE'],['.DE','XETRA'],['.PA','EURONEXT_PARIS'],['.TO','TSX'],['.HK','HKEX'],['.NS','NSE'],['.AX','ASX']];
  const sm = suffixMap.find(([s]) => us.endsWith(s));
  if (sm) return getMarketProfile(sm[1]);
  if (ue.includes('NASDAQ')) return getMarketProfile('NASDAQ');
  if (ue.includes('NYSE')) return getMarketProfile('NYSE');
  if (ue.includes('TOKYO') || ue.includes('TSE')) return getMarketProfile('TSE');
  if (ue.includes('LONDON') || ue.includes('LSE')) return getMarketProfile('LSE');
  if (ue.includes('XETRA') || ue.includes('FRANKFURT')) return getMarketProfile('XETRA');
  if (ue.includes('PARIS') || ue.includes('EURONEXT')) return getMarketProfile('EURONEXT_PARIS');
  if (ue.includes('TORONTO') || ue.includes('TSX')) return getMarketProfile('TSX');
  if (ue.includes('HONG KONG') || ue.includes('HKEX')) return getMarketProfile('HKEX');
  if (ue.includes('NSE') || ue.includes('INDIA')) return getMarketProfile('NSE');
  if (ue.includes('ASX') || ue.includes('AUSTRAL')) return getMarketProfile('ASX');
  return getMarketProfile('CUSTOM');
}

function normalizeSymbolForMarket(symbol, marketKey) {
  const v = String(symbol).toUpperCase().trim();
  const suffixes = { KRX:['.KS','.KQ'], TSE:['.T'], LSE:['.L'], XETRA:['.DE'], EURONEXT_PARIS:['.PA'], TSX:['.TO'], HKEX:['.HK'], NSE:['.NS'], ASX:['.AX'] };
  return (suffixes[marketKey] ?? []).reduce((cur, sfx) => cur.endsWith(sfx) ? cur.slice(0, -sfx.length) : cur, v);
}

// ═══════════════════════════════════════════════════════════════
// Symbol helpers
// ═══════════════════════════════════════════════════════════════
function toYahooSymbol(stock) {
  const sym = stock.symbol;
  const marketSuffixes = { KRX:'.KS', TSE:'.T', 'Euronext Paris':'.PA', XETRA:'.DE', TSX:'.TO', HKEX:'.HK', NSE:'.NS', ASX:'.AX' };
  if (['NASDAQ','NYSE','AMEX'].includes(stock.market)) return sym;
  if (stock.market === 'LSE') return sym.includes('.') ? sym : `${sym}.L`;
  if (stock.market === 'HKEX') return sym.padStart(4, '0') + '.HK';
  return marketSuffixes[stock.market] ? `${sym}${marketSuffixes[stock.market]}` : sym;
}

function toFmpSymbol(stock) {
  if (['NASDAQ','NYSE','AMEX'].includes(stock.market)) return stock.symbol;
  return toYahooSymbol(stock);
}

// ═══════════════════════════════════════════════════════════════
// Cache helpers
// ═══════════════════════════════════════════════════════════════
function buildCacheKey(stock, apiSettings, mode = 'all') {
  const provider = stock.market === 'KRX'
    ? 'openDart'
    : isCommercialSafeMode(apiSettings)
      ? 'commercialSafe'
      : (apiSettings.globalProvider || 'yahooExperimental');
  const reportPart = stock.market === 'KRX'
    ? `:${apiSettings.dartFiscalYear}:${apiSettings.dartReportCode}:${apiSettings.dartFsDiv}`
    : '';
  return `${provider}:${stock.market}:${stock.symbol}${reportPart}:${mode}`;
}

function buildKrPriceCacheKey(stock) {
  return `dataGoKrStockPrice:${stock.market}:${stock.symbol.padStart(6, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// metricsMeta helpers
// ═══════════════════════════════════════════════════════════════

// Core metrics used in scoring (for computeDataConfidence)
const CORE_METRIC_KEYS = ['per', 'pbr', 'roe', 'opMargin', 'fcfMargin', 'debtRatio', 'currentRatio', 'revGrowth', 'epsGrowth', 'evEbitda'];

/**
 * makeMetricMeta — create a metricsMeta entry for a single metric.
 * @param {object} opts
 * @param {string} opts.provider   e.g. 'Yahoo Finance', 'SEC EDGAR', 'OpenDART', 'Alpha Vantage', 'FMP'
 * @param {string} opts.source     human-readable source description
 * @param {string} opts.method     e.g. 'direct', 'calculated', 'fallback', 'timeseries'
 * @param {string} opts.confidence 'A'|'B'|'C'|'D'
 * @param {boolean} opts.commercialSafe
 * @param {string=} opts.periodEnd  ISO date string
 * @param {number=} opts.fiscalYear
 * @param {boolean=} opts.usedInScore
 */
function makeMetricMeta({ provider, source, sourceId, method, confidence, commercialSafe, periodEnd, fiscalYear, usedInScore } = {}) {
  const resolvedSourceId = sourceId || inferSourceIdFromProvider(provider);
  const sourceInfo = getDataSourceMeta(resolvedSourceId);
  const resolvedCommercialSafe = commercialSafe != null
    ? Boolean(commercialSafe)
    : sourceInfo
      ? !sourceInfo.blockedInCommercialSafe
      : false;
  return {
    source:         source         || provider || 'unknown',
    provider:       provider       || 'unknown',
    sourceId:       resolvedSourceId || null,
    method:         method         || 'direct',
    periodEnd:      periodEnd      || null,
    fiscalYear:     fiscalYear     || null,
    fetchedAt:      new Date().toISOString(),
    confidence:     confidence     || sourceInfo?.confidence || 'D',
    commercialSafe: resolvedCommercialSafe,
    usedInScore:    usedInScore    != null ? Boolean(usedInScore) : sourceInfo?.usedInScore ?? true,
    cost:           sourceInfo?.cost || 'unknown',
    commercialStatus: sourceInfo?.commercialStatus || 'unknown',
    licenseUrl:     sourceInfo?.licenseUrl || '',
    rateLimit:      sourceInfo?.rateLimit || '',
  };
}

/**
 * setMetricWithMeta — attach a metric value and its meta in one call.
 * Returns { metrics: {...}, metricsMeta: {...} } patches to spread into stock.
 */
function setMetricWithMeta(existingMetrics, existingMeta, key, value, metaOpts) {
  if (!Number.isFinite(toNumber(value))) return { metrics: existingMetrics, metricsMeta: existingMeta };
  return {
    metrics:     { ...(existingMetrics || {}), [key]: value },
    metricsMeta: { ...(existingMeta    || {}), [key]: makeMetricMeta(metaOpts) },
  };
}

/**
 * computeDataConfidence — summarise metricsMeta for a set of core metrics.
 * Returns { grade, usedCount, totalCoreCount, commercialSafeCount, missingCoreMetrics, lowConfidenceMetrics }
 */
function computeDataConfidence(metrics, metricsMeta) {
  const total = CORE_METRIC_KEYS.length;
  const missing = [];
  const lowConf  = [];
  let usedCount  = 0;
  let safeCount  = 0;
  const gradeOrder = { A: 0, B: 1, C: 2, D: 3 };
  let worstGrade = 'A';

  for (const key of CORE_METRIC_KEYS) {
    const val  = metrics?.[key];
    const meta = metricsMeta?.[key];
    if (val == null || !Number.isFinite(toNumber(val))) {
      missing.push(key);
      if ((gradeOrder['D'] || 3) > (gradeOrder[worstGrade] || 0)) worstGrade = 'D';
      continue;
    }
    usedCount++;
    const grade = meta?.confidence || 'D';
    if ((gradeOrder[grade] || 3) > (gradeOrder[worstGrade] || 0)) worstGrade = grade;
    if (grade === 'C' || grade === 'D') lowConf.push(key);
    if (meta?.commercialSafe) safeCount++;
  }

  // Overall grade: worst of all populated metrics, or D if majority missing
  const presentGrade = usedCount === 0 ? 'D'
    : missing.length > total / 2 ? 'D'
    : worstGrade;

  return {
    grade: presentGrade,
    usedCount,
    totalCoreCount: total,
    commercialSafeCount: safeCount,
    missingCoreMetrics: missing,
    lowConfidenceMetrics: lowConf,
  };
}

// ═══════════════════════════════════════════════════════════════
// Cache helpers (with smart TTL)
// ═══════════════════════════════════════════════════════════════

// TTL overrides for partial/empty/error cache entries (ms)
const CACHE_TTL_PARTIAL_MS  = 12 * 3600000;  // 12 h — some metrics fetched but incomplete
const CACHE_TTL_EMPTY_MS    = 30 * 60000;    // 30 min — all metrics empty
const CACHE_TTL_ERROR_MS    = 10 * 60000;    // 10 min — fetch returned an error

function getCachedEntry(cache, cacheKey, cacheDays) {
  const entry = cache[cacheKey];
  if (!entry) return null;
  const age = Date.now() - new Date(entry.fetchedAt).getTime();
  if (!Number.isFinite(age)) return null;

  // Error cache: very short TTL
  if (entry.errorState) {
    return age < CACHE_TTL_ERROR_MS ? entry : null;
  }

  // Empty-metrics cache: short TTL
  const payloadMetrics = entry.payload?.metrics;
  const metricCount = payloadMetrics ? Object.keys(payloadMetrics).length : 0;
  if (metricCount === 0) {
    return age < CACHE_TTL_EMPTY_MS ? entry : null;
  }

  // Partial-metrics cache: medium TTL (half the core metrics missing)
  const corePresent = CORE_METRIC_KEYS.filter(k => payloadMetrics?.[k] != null).length;
  if (corePresent < CORE_METRIC_KEYS.length / 2) {
    return age < CACHE_TTL_PARTIAL_MS ? entry : null;
  }

  // Full cache: use configured cacheDays
  return age <= cacheDays * 86400000 ? entry : null;
}

function getAnyCachedEntry(cache, cacheKey) {
  const entry = cache[cacheKey];
  if (!entry) return null;
  const age = Date.now() - new Date(entry.fetchedAt).getTime();
  return { ...entry, ageDays: Number.isFinite(age) ? age / 86400000 : null };
}

// ═══════════════════════════════════════════════════════════════
// API response validators
// ═══════════════════════════════════════════════════════════════
function assertAVResponse(data, fn) {
  const msg = data.Note || data.Information || data['Error Message'];
  if (msg) throw new Error(`${fn}: ${msg}`);
}

function assertOpenDartResponse(data, fn) {
  if (data.status && data.status !== '000') throw new Error(`${fn}: ${data.message || data.status}`);
}

function assertFmpResponse(data, ep, opts = {}) {
  const msg = data?.['Error Message'] || data?.error || data?.message;
  if (msg) throw new Error(`${ep}: ${msg}`);
  if (Array.isArray(data) && !data.length && !opts.allowEmpty) throw new Error(`${ep}: 데이터 없음`);
}

// ═══════════════════════════════════════════════════════════════
// Fetch functions
// ═══════════════════════════════════════════════════════════════
async function fetchYahooChart(symbol, apiSettings = null) {
  assertEndpointAllowed('yahoo.chart', apiSettings, 'chart');
  const params = new URLSearchParams({ range: '3mo', interval: '1d', includePrePost: 'false', events: 'div,splits' });
  const data = await fetchJsonWithDiagnostics('Yahoo chart', buildYahooChartUrl(symbol, params), { apiSettings });
  const err = data?.chart?.error;
  if (err) throw new Error(err.description || err.code || 'chart error');
  return data;
}

function isCleanCompanyName(s) {
  if (!s || typeof s !== 'string') return false;
  if (s.includes(',')) return false;
  if (/^\d/.test(s)) return false;
  if (/\.(KS|KQ|HK|T|L)$/i.test(s)) return false;
  if (/^0P[0-9A-Z]{6,}/i.test(s)) return false;
  return true;
}

async function fetchKrxYahooPrice(stock, apiSettings = null) {
  assertEndpointAllowed('yahoo.chart', apiSettings, 'KRX price fallback');
  const baseSym = String(stock.symbol || '').replace(/\D/g, '').padStart(6, '0');
  if (baseSym.length !== 6) throw new Error(`KRX 심볼 파싱 실패: ${stock.symbol}`);
  const candidates = [`${baseSym}.KS`, `${baseSym}.KQ`];
  let lastErr = null;
  for (const sym of candidates) {
    try {
      const data = await fetchYahooChart(sym, apiSettings);
      const result = data?.chart?.result?.[0];
      if (!result) continue;
      const meta = result.meta || {};
      const closes = (result.indicators?.quote?.[0]?.close || []).map(toNumber).filter(v => Number.isFinite(v) && v > 0);
      const price = firstFinite(closes.at(-1), meta.regularMarketPrice);
      if (!Number.isFinite(price) || price <= 0) continue;
      const prevClose = firstFinite(meta.chartPreviousClose, meta.previousClose, closes.length > 1 ? closes.at(-2) : NaN);
      const yahooName = isCleanCompanyName(meta.longName) ? meta.longName
                      : isCleanCompanyName(meta.shortName) ? meta.shortName : null;
      return {
        ...(yahooName ? { name: yahooName } : {}),
        currency: 'KRW',
        price: Math.round(price),
        prevClose: Number.isFinite(prevClose) ? Math.round(prevClose) : undefined,
        priceHistory: closes.slice(-15).map(v => Math.round(v)),
        metrics: {},
        asOf: new Date().toISOString().slice(0, 10),
        priceSrc: `Yahoo (${sym})`,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Yahoo KRX 가격 조회 실패: ${lastErr?.message || 'no data'}`);
}

async function fetchYahooQuote(symbol, apiSettings = null) {
  assertEndpointAllowed('yahoo.quote', apiSettings, 'quote');
  const fields = 'symbol,shortName,longName,currency,regularMarketPrice,regularMarketTime,trailingPE,forwardPE,priceToBook,bookValue,epsTrailingTwelveMonths,epsForward,marketCap,sector,industry';
  const data = await fetchJsonWithDiagnostics('Yahoo quote', buildYahooQuoteUrl([symbol], { fields }), { apiSettings });
  const quote = data?.quoteResponse?.result?.[0];
  if (!quote) throw new Error('Yahoo quote result 없음');
  return quote;
}

async function fetchYahooQuoteSummary(symbol, apiSettings = null) {
  assertEndpointAllowed('yahoo.quoteSummary', apiSettings, 'quoteSummary');
  const modules = 'financialData,defaultKeyStatistics,summaryDetail';
  const params = new URLSearchParams({ modules });
  const url = isProxiedOrigin()
    ? `/api/proxy?service=yahoo&path=quoteSummary&symbol=${encodeURIComponent(symbol)}&${params}`
    : `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?${params}`;
  const data = await fetchJsonWithDiagnostics('Yahoo quoteSummary', url, { apiSettings });
  const result = data?.quoteSummary?.result?.[0];
  if (!result) throw new Error('Yahoo quoteSummary result 없음');
  return result;
}

async function fetchYahooTimeSeries(symbol, apiSettings = null) {
  assertEndpointAllowed('yahoo.timeseries', apiSettings, 'timeseries');
  const types = [
    'annualTotalRevenue', 'annualOperatingIncome', 'annualNetIncome', 'annualDilutedEPS',
    'annualStockholdersEquity', 'annualCurrentAssets', 'annualCurrentLiabilities',
    'annualLongTermDebt', 'annualTotalDebt',
    'annualOperatingCashFlow', 'annualCapitalExpenditure', 'annualFreeCashFlow',
  ].join(',');
  const period2 = Math.floor(Date.now() / 1000);
  // Use manual query string to keep commas literal (not %2C) for Yahoo compatibility
  const qs = `type=${types}&period1=0&period2=${period2}`;
  const url = isProxiedOrigin()
    ? `/api/proxy?service=yahoo&path=timeseries&symbol=${encodeURIComponent(symbol)}&${qs}`
    : `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?${qs}`;
  const data = await fetchJsonWithDiagnostics('Yahoo timeseries', url, { apiSettings });
  const result = data?.timeseries?.result;
  if (!result) throw new Error('timeseries 응답 구조 오류');
  return result; // may be [] if no data
}

function parseTimeSeriesStatements(results) {
  if (!results?.length) return null;

  const typeMap = {
    annualTotalRevenue:       'totalRevenue',
    annualOperatingIncome:    'operatingIncome',
    annualNetIncome:          'netIncome',
    annualDilutedEPS:         'dilutedEps',
    annualStockholdersEquity: 'totalShareholderEquity',
    annualCurrentAssets:      'totalCurrentAssets',
    annualCurrentLiabilities: 'totalCurrentLiabilities',
    annualLongTermDebt:       'longTermDebt',
    annualTotalDebt:          'shortLongTermDebt',
    annualOperatingCashFlow:  'totalCashFromOperatingActivities',
    annualCapitalExpenditure: 'capitalExpenditures',
    annualFreeCashFlow:       'freeCashFlow',
  };

  // Build map: asOfDate → { field: rawValue, ... }
  // Yahoo timeseries items may use item.type OR item.meta.type[0] for the type name
  const byDate = {};
  for (const item of results) {
    const typeName = item.type ?? item.meta?.type?.[0];
    const fieldName = typeMap[typeName];
    if (!typeName || !fieldName) continue;
    const entries = item[typeName];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const dateKey = entry.asOfDate;
      const val = entry.reportedValue?.raw ?? entry.reportedValue;
      if (!dateKey || val == null) continue;
      if (!byDate[dateKey]) byDate[dateKey] = {};
      byDate[dateKey][fieldName] = val;
    }
  }

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
  if (!dates.length) return null;

  const makeStmt = (dateKey, fields) => {
    const d = byDate[dateKey];
    const endDate = Math.floor(new Date(dateKey).getTime() / 1000);
    const stmt = { endDate };
    for (const f of fields) { if (d[f] != null) stmt[f] = { raw: d[f] }; }
    return stmt;
  };

  const incF = ['totalRevenue', 'operatingIncome', 'netIncome', 'dilutedEps'];
  const balF = ['totalShareholderEquity', 'totalCurrentAssets', 'totalCurrentLiabilities', 'longTermDebt', 'shortLongTermDebt'];
  const cfF  = ['totalCashFromOperatingActivities', 'capitalExpenditures', 'freeCashFlow'];

  return {
    incomeStatementHistory:   { incomeStatementHistory: dates.map(d => makeStmt(d, incF)) },
    balanceSheetHistory:      { balanceSheetStatements: dates.map(d => makeStmt(d, balF)) },
    cashflowStatementHistory: { cashflowStatements:     dates.map(d => makeStmt(d, cfF)) },
  };
}

async function fetchYahooStatements(symbol, apiSettings = null) {
  assertEndpointAllowed('yahoo.quoteSummary', apiSettings, 'statements');
  // Progressive fallback: try all 3 modules, then 2, then income-only
  const combos = [
    'incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory',
    'incomeStatementHistory,balanceSheetHistory',
    'incomeStatementHistory',
  ];
  for (const modules of combos) {
    const params = new URLSearchParams({ modules });
    const url = isProxiedOrigin()
      ? `/api/proxy?service=yahoo&path=quoteSummary&symbol=${encodeURIComponent(symbol)}&${params}`
      : `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?${params}`;
    try {
      const data = await fetchJsonWithDiagnostics('Yahoo statements', url, { apiSettings });
      const result = data?.quoteSummary?.result?.[0];
      if (result) return result;
    } catch {}
  }
  // quoteSummary v10 does not support statement modules for non-US markets (TSE, LSE, etc.)
  // Fall back to the fundamentals-timeseries endpoint which Yahoo Finance website uses internally
  let tsReason = '알 수 없음';
  try {
    const tsResults = await fetchYahooTimeSeries(symbol, apiSettings);
    const parsed = parseTimeSeriesStatements(tsResults);
    if (parsed) return parsed;
    tsReason = `데이터 없음 (${tsResults.length}개 타입 수신)`;
  } catch (e) {
    tsReason = e.message;
  }
  throw new Error(`Yahoo statements 모두 실패 (${tsReason})`);
}

async function fetchYahooEarnings(symbol, apiSettings = null) {
  assertEndpointAllowed('yahoo.quoteSummary', apiSettings, 'earnings');
  const params = new URLSearchParams({ modules: 'earnings' });
  const url = isProxiedOrigin()
    ? `/api/proxy?service=yahoo&path=quoteSummary&symbol=${encodeURIComponent(symbol)}&${params}`
    : `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?${params}`;
  let data;
  try { data = await fetchJsonWithDiagnostics('Yahoo earnings', url, { apiSettings }); }
  catch { return null; }
  return data?.quoteSummary?.result?.[0] || null;
}

async function fetchLivePriceForSymbol(stock, yahooSym, apiSettings = null) {
  assertEndpointAllowed('yahoo.chart', apiSettings, 'live price');
  const params = new URLSearchParams({ range: '1d', interval: '1m', includePrePost: 'false' });
  let data = await fetchJsonWithDiagnostics('Yahoo live', buildYahooChartUrl(yahooSym, params), { apiSettings });
  let result = data?.chart?.result?.[0];
  let closes = (result?.indicators?.quote?.[0]?.close || []).map(toNumber).filter(v => Number.isFinite(v) && v > 0);

  if (!result || !closes.length) {
    const fallback = new URLSearchParams({ range: '5d', interval: '1d', includePrePost: 'false' });
    data = await fetchJsonWithDiagnostics('Yahoo live fallback', buildYahooChartUrl(yahooSym, fallback), { apiSettings });
    result = data?.chart?.result?.[0];
    closes = (result?.indicators?.quote?.[0]?.close || []).map(toNumber).filter(v => Number.isFinite(v) && v > 0);
  }

  if (!result) throw new Error('Yahoo live result 없음');
  const meta = result.meta || {};
  // meta.regularMarketPrice = Yahoo's real-time price (primary)
  // closes.at(-1) = last completed candle close (fallback when meta price missing)
  const price = firstFinite(toNumber(meta.regularMarketPrice), closes.at(-1));
  // regularMarketPreviousClose is always the actual previous session's close
  const prevClose = firstFinite(
    toNumber(meta.regularMarketPreviousClose),
    toNumber(meta.previousClose),
    toNumber(meta.chartPreviousClose),
    closes.length > 1 ? closes.at(-2) : NaN,
    stock.prevClose,
  );
  if (!Number.isFinite(price) || price <= 0) throw new Error('Yahoo live 가격 없음');
  const ts = firstFinite(meta.regularMarketTime, result.timestamp?.at(-1));
  const asOf = ts ? new Date(Number(ts) * 1000).toISOString() : new Date().toISOString();
  const oldHistory = Array.isArray(stock.priceHistory) ? stock.priceHistory : [];
  const historyBase = closes.length >= 3 ? closes.slice(-60) : oldHistory.slice(-59);
  const priceHistory = historyBase.length && Math.abs((historyBase.at(-1) || 0) - price) < 0.000001
    ? historyBase
    : [...historyBase.slice(-59), price];
  return {
    price: Math.round(price * 100) / 100,
    prevClose: Number.isFinite(prevClose) ? Math.round(prevClose * 100) / 100 : undefined,
    priceHistory,
    priceSrc: `Yahoo live (${yahooSym})`,
    priceAsOf: asOf,
  };
}

async function fetchLivePrice(stock, apiSettings = null) {
  assertEndpointAllowed('yahoo.chart', apiSettings, 'live price');
  // KRX: try .KS then .KQ (KOSPI vs KOSDAQ are not encoded in our market field)
  if (stock.market === 'KRX') {
    const baseSym = String(stock.symbol || '').replace(/\D/g, '').padStart(6, '0');
    let lastErr = null;
    for (const suffix of ['.KS', '.KQ']) {
      try { return await fetchLivePriceForSymbol(stock, `${baseSym}${suffix}`, apiSettings); }
      catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Yahoo live KRX 실패');
  }
  return fetchLivePriceForSymbol(stock, toYahooSymbol(stock), apiSettings);
}

async function fetchAlphaVantage(fn, symbol, key, apiSettings = null) {
  assertEndpointAllowed('alphaVantage.query', apiSettings, fn);
  const params = new URLSearchParams({ function: fn, symbol, apikey: key });
  const res = await fetchWithPolicy(`https://www.alphavantage.co/query?${params}`, { apiSettings, label: `Alpha Vantage ${fn}` });
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
  const data = await res.json();
  assertAVResponse(data, fn);
  return data;
}

async function fetchFmp(ep, params, key, opts = {}) {
  assertEndpointAllowed('fmp.stable', opts.apiSettings, ep);
  const query = new URLSearchParams({ ...params, apikey: key });
  const res = await fetchWithPolicy(`https://financialmodelingprep.com/stable/${ep}?${query}`, { apiSettings: opts.apiSettings, label: `FMP ${ep}` });
  if (!res.ok) throw new Error(`FMP ${ep} HTTP ${res.status}`);
  const data = await res.json();
  assertFmpResponse(data, ep, opts);
  return data;
}

function buildPublicDataUrl(base, serviceKey, params) {
  const ek = String(serviceKey).includes('%') ? String(serviceKey).trim() : encodeURIComponent(String(serviceKey).trim());
  const q = new URLSearchParams(params);
  return `${base}?serviceKey=${ek}&${q}`;
}

function isProxiedOrigin() {
  if (typeof window === 'undefined' || !window.location) return false;
  // Use relative /api/* proxy paths for any http/https origin:
  //   localhost → local-http-server.cjs handles the proxy
  //   Netlify deploy → netlify/functions/* handle the proxy
  // file:// opens the HTML directly without any proxy — direct upstream URLs are used instead.
  return window.location.protocol === 'http:' || window.location.protocol === 'https:';
}

function buildOpenDartApiUrl(endpoint, params) {
  const q = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
  // Proxied path omits .json — Vercel treats trailing extensions as static-file requests
  // and skips the rewrite, so the proxy server appends .json when forwarding upstream.
  return isProxiedOrigin()
    ? `/api/proxy?service=opendart&path=${encodeURIComponent(endpoint)}${q ? `&${q}` : ''}`
    : `https://opendart.fss.or.kr/api/${endpoint}.json?${q}`;
}

function summarizeApiPayloadText(text) {
  const clean = String(text || '').trim();
  if (!clean) return '';
  try {
    const data = JSON.parse(clean);
    const yahooError = data?.chart?.error || data?.quoteSummary?.error || data?.finance?.error;
    const parts = [
      data.status ? `status ${data.status}` : '',
      data.message || data.error || data.msg || yahooError?.description || yahooError?.code || '',
    ].filter(Boolean);
    if (parts.length) return parts.join(' · ');
  } catch {}
  if (clean.startsWith('<')) return `HTML response "${clean.slice(0, 80).replace(/\s+/g, ' ')}"`;
  return clean.replace(/\s+/g, ' ').slice(0, 160);
}

const summarizeOpenDartPayloadText = summarizeApiPayloadText;

async function describeOpenDartHttpError(res) {
  let detail = '';
  try { detail = summarizeOpenDartPayloadText(await res.text()); } catch {}
  return `HTTP ${res.status}${detail ? ` · ${detail}` : ''}`;
}

async function fetchJsonWithDiagnostics(label, url, opts = {}) {
  let res;
  try {
    assertUrlAllowed(url, opts.apiSettings, label);
    res = await fetch(url, opts.fetchOptions);
  } catch (e) {
    throw new Error(`${label} network failed${e?.message ? ` · ${e.message}` : ''}`);
  }
  const text = await res.text();
  const detail = summarizeApiPayloadText(text);
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}${detail ? ` · ${detail}` : ''}`);
  if (text.trimStart().startsWith('<')) throw new Error(`${label}: ${detail || 'HTML response'}`);
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label}: JSON parse failed${detail ? ` · ${detail}` : ''}`);
  }
  const okStatuses = opts.openDartOkStatuses;
  if (Array.isArray(okStatuses) && data?.status && !okStatuses.includes(data.status)) {
    throw new Error(`${label}: ${summarizeApiPayloadText(text) || data.status}`);
  }
  const yahooError = data?.chart?.error || data?.quoteSummary?.error || data?.finance?.error;
  if (yahooError && !opts.allowYahooError) {
    throw new Error(`${label}: ${yahooError.description || yahooError.code || 'Yahoo error'}`);
  }
  return data;
}

function buildSecApiUrl(path) {
  const clean = String(path || '').replace(/^\/+/, '');
  if (isProxiedOrigin()) return `/api/proxy?service=sec&path=${encodeURIComponent(clean)}`;
  if (clean.startsWith('files/')) return `https://www.sec.gov/${clean}`;
  if (clean.startsWith('archives/')) return `https://www.sec.gov/Archives/edgar/data/${clean.slice('archives/'.length)}`;
  if (clean.startsWith('companyfacts/')) return `https://data.sec.gov/api/xbrl/${clean}`;
  return `https://data.sec.gov/${clean}`;
}

function buildYahooChartUrl(symbol, params) {
  const q = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
  const encoded = encodeURIComponent(symbol);
  return isProxiedOrigin()
    ? `/api/proxy?service=yahoo&path=chart&symbol=${encoded}${q ? `&${q}` : ''}`
    : `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?${q}`;
}

function buildYahooSearchUrl(params) {
  const q = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
  return isProxiedOrigin()
    ? `/api/proxy?service=yahoo&path=search${q ? `&${q}` : ''}`
    : `https://query1.finance.yahoo.com/v1/finance/search?${q}`;
}

function buildYahooQuoteUrl(symbols, extra = {}) {
  const q = new URLSearchParams({ symbols: symbols.join(','), ...extra }).toString();
  return isProxiedOrigin()
    ? `/api/proxy?service=yahoo&path=quote&${q}`
    : `https://query1.finance.yahoo.com/v7/finance/quote?${q}`;
}

async function fetchKoreanStockPrice(symbol, key, apiSettings = null) {
  const stockCode = symbol.padStart(6, '0');
  const url = buildPublicDataUrl(
    'https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo',
    key,
    { numOfRows: '10', pageNo: '1', resultType: 'json', likeSrtnCd: stockCode }
  );
  const res = await fetchWithPolicy(url, { apiSettings, label: 'data.go.kr stock price' });
  if (!res.ok) throw new Error(`공공데이터 주가 HTTP ${res.status}`);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('JSON 응답 아님 (data.go.kr key 확인)'); }
  const header = data?.response?.header ?? {};
  if (header.resultCode && header.resultCode !== '00') throw new Error(header.resultMsg || `공공데이터 오류 ${header.resultCode}`);
  const rawItems = data?.response?.body?.items?.item ?? [];
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).filter(Boolean);
  const exact = items.filter(it => String(it.srtnCd ?? '').padStart(6, '0') === stockCode);
  const selected = [...(exact.length ? exact : items)].sort((a, b) => String(b.basDt ?? '').localeCompare(String(a.basDt ?? ''))).at(0);
  if (!selected) throw new Error(`${stockCode} 주가 데이터 없음`);
  return selected;
}

async function fetchOpenDartStatements(corpCode, apiSettings) {
  const { openDartKey: key, dartFiscalYear: year, dartReportCode: reportCode, dartFsDiv } = apiSettings;
  if (!key) throw new Error('OpenDART API 키 미설정 — F12 Settings → OPEN DART API KEY 입력 필요');
  const fsDivs = [...new Set([dartFsDiv, dartFsDiv === 'CFS' ? 'OFS' : 'CFS'])];
  const years = [...new Set([Number(year), Number(year) - 1, Number(year) - 2].filter(Number.isFinite))];
  const errors = [];

  for (const y of years) {
  for (const fsDiv of fsDivs) {
    for (const endpoint of ['fnlttSinglAcntAll', 'fnlttSinglAcnt']) {
      try {
        const params = new URLSearchParams({ crtfc_key: key, corp_code: corpCode, bsns_year: String(y), reprt_code: reportCode, fs_div: fsDiv });
        const data = await fetchJsonWithDiagnostics(`OpenDART ${endpoint}/${fsDiv}/${y}`, buildOpenDartApiUrl(endpoint, params), { openDartOkStatuses: ['000'], apiSettings });
        if (Array.isArray(data.list) && data.list.length) {
          return { ...data, context: { year: y, reportCode, fsDiv, sourceType: endpoint === 'fnlttSinglAcntAll' ? 'all' : 'single' } };
        }
        errors.push(`${y}/${endpoint}/${fsDiv}: empty list`);
      } catch (e) {
        errors.push(`${y}/${endpoint}/${fsDiv}: ${e.message}`);
      }
    }
  }
  }
  throw new Error(`OpenDART 재무제표 없음 · ${errors.join(' / ')}`);
}

async function fetchDartStockInfo(corpCode, apiKey, apiSettings = null) {
  const params = new URLSearchParams({ crtfc_key: apiKey, corp_code: corpCode });
  const data = await fetchJsonWithDiagnostics('OpenDART stockInfo', buildOpenDartApiUrl('stockInfo', params), { openDartOkStatuses: ['000'], apiSettings });
  if (!Array.isArray(data.list)) throw new Error(`stockInfo status ${data.status}`);
  // Sum common shares (보통주) across all rows — field names vary by DART version
  const commonRows = data.list.filter(r => String(r.stock_knd || r.bsis_se || '').includes('보통'));
  const rows = commonRows.length ? commonRows : data.list;
  let shares = 0;
  for (const r of rows) {
    const v = toNumber(r.istc_totqy ?? r.vntl_stock_co ?? r.issue_stock_co ?? r.stck_co ?? 0);
    if (Number.isFinite(v) && v > 0) { shares += v; break; }
  }
  return shares > 0 ? shares : null;
}

// ═══════════════════════════════════════════════════════════════
// Data mapping (outputs opMargin, revGrowth for terminal naming)
// ═══════════════════════════════════════════════════════════════
function mapYahooPayload(stock, chart, yahooSym, quote, summary) {
  const result = chart?.chart?.result?.[0];
  if (!result) throw new Error('chart result 없음');
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const priceHistory = closes.map(v => toNumber(v)).filter(v => Number.isFinite(v) && v > 0).slice(-15);
  const currentPrice = toNumber(quote?.regularMarketPrice) || toNumber(result.meta?.regularMarketPrice) || priceHistory.at(-1);
  const ts = quote?.regularMarketTime ?? result.timestamp?.at(-1);
  const asOf = ts ? new Date(Number(ts) * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  if (!priceHistory.length && !currentPrice) throw new Error('가격 데이터 없음');

  // quoteSummary modules
  const fin  = summary?.financialData   || {};
  const kst  = summary?.defaultKeyStatistics || {};
  const det  = summary?.summaryDetail   || {};

  const raw = (obj, key) => toNumber(obj?.[key]?.raw ?? obj?.[key]);
  const pct = (obj, key) => { const v = raw(obj, key); return Number.isFinite(v) ? v * 100 : NaN; };

  // Fallback: compute metrics from historical statements when financialData is empty
  // (Yahoo Finance omits financialData for many non-US stocks)
  const incomeStmts  = summary?.incomeStatementHistory?.incomeStatementHistory || [];
  const balanceShts  = summary?.balanceSheetHistory?.balanceSheetStatements    || [];
  const cashflows    = summary?.cashflowStatementHistory?.cashflowStatements   || [];
  const inc0 = incomeStmts[0] || {};
  const inc1 = incomeStmts[1] || {};
  const bal0 = balanceShts[0] || {};
  const cf0  = cashflows[0]  || {};
  const hr = (obj, key) => toNumber(obj?.[key]?.raw ?? obj?.[key]);
  const hRev   = hr(inc0, 'totalRevenue');
  const hOp    = hr(inc0, 'operatingIncome') || hr(inc0, 'ebit');
  const hNet   = hr(inc0, 'netIncome');
  const hEps0  = hr(inc0, 'dilutedEps');
  const hEps1  = hr(inc1, 'dilutedEps');
  const hOp1   = hr(inc1, 'operatingIncome') || hr(inc1, 'ebit');
  const hOCF   = hr(cf0,  'totalCashFromOperatingActivities');
  const hCapex = Math.abs(hr(cf0, 'capitalExpenditures') || 0);
  const hFCF   = hr(cf0,  'freeCashFlow');
  const hEq    = hr(bal0, 'totalShareholderEquity');
  const hCA    = hr(bal0, 'totalCurrentAssets');
  const hCL    = hr(bal0, 'totalCurrentLiabilities');
  const hDebt  = (hr(bal0, 'shortLongTermDebt') || 0) + (hr(bal0, 'longTermDebt') || 0);
  const hPrevRev = hr(inc1, 'totalRevenue');
  const valid = v => Number.isFinite(v) && v !== 0;
  const fb = (primary, fallback) => Number.isFinite(primary) ? primary : fallback;

  const fbRoe        = valid(hEq) ? (hNet / hEq) * 100 : NaN;
  const fbOpMargin   = valid(hRev) ? (hOp  / hRev) * 100 : NaN;
  // FCF Margin: prefer pre-computed freeCashFlow, else OCF − CapEx
  const fbFcfMargin  = valid(hRev)
    ? (Number.isFinite(hFCF) ? (hFCF / hRev) * 100 : (Number.isFinite(hOCF) ? ((hOCF - hCapex) / hRev) * 100 : NaN))
    : NaN;
  const fbDebtRatio  = valid(hEq) ? (hDebt / hEq) * 100 : NaN;
  const fbCurRatio   = valid(hCL) ? (hCA   / hCL) * 100 : NaN;
  const fbRevGrowth  = valid(hPrevRev) ? ((hRev - hPrevRev) / hPrevRev) * 100 : NaN;
  // EPS Growth from timeseries dilutedEps (two most recent years)
  const fbEpsGrowth      = valid(hEps1) ? ((hEps0 - hEps1) / Math.abs(hEps1)) * 100 : NaN;
  const fbNetMargin      = valid(hRev)  ? (hNet / hRev) * 100 : NaN;
  const fbOpIncomeGrowth = (valid(hOp) && valid(hOp1)) ? ((hOp - hOp1) / Math.abs(hOp1)) * 100 : NaN;

  // earnings module fallback (revenue/earnings yearly chart — available for non-US when statements fail)
  const earningsYearly = summary?.earnings?.financialsChart?.yearly || [];
  const ey0 = earningsYearly[earningsYearly.length - 1] || {};
  const ey1 = earningsYearly[earningsYearly.length - 2] || {};
  const eyRev0 = hr(ey0, 'revenue');
  const eyRev1 = hr(ey1, 'revenue');
  const eyEar0 = hr(ey0, 'earnings');
  const eyEar1 = hr(ey1, 'earnings');
  const fbRevGrowthEy = valid(eyRev1) ? ((eyRev0 - eyRev1) / eyRev1) * 100 : NaN;
  const fbEpsGrowthEy = valid(eyEar1) ? ((eyEar0 - eyEar1) / eyEar1) * 100 : NaN;
  const fbOpMarginEy  = valid(eyRev0) ? (eyEar0 / eyRev0) * 100 : NaN;

  const finCr = raw(fin, 'currentRatio');

  // Determine which tier each metric came from, for metricsMeta
  // Tier B = from financialData (reputable field, not official filing)
  // Tier C = from statements calc or earnings fallback
  const hasFin = Object.keys(fin).length > 0;
  const hasStmts = incomeStmts.length > 0;
  const makeYMeta = (method) => makeMetricMeta({
    provider: 'Yahoo Finance',
    sourceId: 'yahooFinance',
    source: `Yahoo Finance quoteSummary (${yahooSym})`,
    method,
    confidence: method === 'financialData' ? 'B' : 'C',
    commercialSafe: false,
  });

  const perRaw  = firstFinite(raw(det,'trailingPE'), toNumber(quote?.trailingPE), raw(det,'forwardPE'), toNumber(quote?.forwardPE));
  const pbrRaw  = firstFinite(raw(kst,'priceToBook'), toNumber(quote?.priceToBook));
  const roeRaw  = fb(pct(fin, 'returnOnEquity'), fbRoe);
  const opMRaw  = fb(pct(fin, 'operatingMargins'), fb(fbOpMargin, fbOpMarginEy));
  const fcfCalc = (() => {
    const fcf = raw(fin, 'freeCashflow');
    const rev = raw(fin, 'totalRevenue');
    return (Number.isFinite(fcf) && Number.isFinite(rev) && rev > 0) ? (fcf / rev) * 100 : NaN;
  })();
  const fcfRaw  = fb(fcfCalc, fbFcfMargin);
  const debtRaw = fb(raw(fin, 'debtToEquity'), fbDebtRatio);
  const crRaw   = fb(Number.isFinite(finCr) ? finCr * 100 : NaN, fbCurRatio);
  const revGRaw = fb(pct(fin, 'revenueGrowth'), fb(fbRevGrowth, fbRevGrowthEy));
  const epsGRaw = fb(pct(fin, 'earningsGrowth'), fb(fbEpsGrowth, fbEpsGrowthEy));
  const nmRaw   = fb(pct(fin, 'profitMargins'), fbNetMargin);
  const evRaw   = raw(kst, 'enterpriseToEbitda');

  const metrics = compactMetrics({
    per:            perRaw,
    pbr:            pbrRaw,
    roe:            roeRaw,
    opMargin:       opMRaw,
    fcfMargin:      fcfRaw,
    debtRatio:      debtRaw,
    currentRatio:   crRaw,
    revGrowth:      revGRaw,
    epsGrowth:      epsGRaw,
    netMargin:      nmRaw,
    opIncomeGrowth: fbOpIncomeGrowth,
    evEbitda:       evRaw,
  });

  // Build metricsMeta — determine tier per metric
  const metricsMeta = {};
  const perMethod  = Number.isFinite(raw(det,'trailingPE')) || Number.isFinite(toNumber(quote?.trailingPE)) ? 'quote/detail' : 'forwardPE';
  const pbrMethod  = Number.isFinite(raw(kst,'priceToBook')) ? 'defaultKeyStatistics' : 'quote';
  const roeMethod  = Number.isFinite(pct(fin,'returnOnEquity'))   ? 'financialData'   : hasStmts ? 'calculated-stmts' : 'earnings-fallback';
  const opMMethod  = Number.isFinite(pct(fin,'operatingMargins')) ? 'financialData'   : hasStmts ? 'calculated-stmts' : 'earnings-fallback';
  const fcfMethod  = Number.isFinite(fcfCalc)                     ? 'financialData'   : hasStmts ? 'calculated-stmts' : 'unavailable';
  const debtMethod = Number.isFinite(raw(fin,'debtToEquity'))     ? 'financialData'   : hasStmts ? 'calculated-stmts' : 'unavailable';
  const crMethod   = Number.isFinite(finCr)                       ? 'financialData'   : hasStmts ? 'calculated-stmts' : 'unavailable';
  const revGMethod = Number.isFinite(pct(fin,'revenueGrowth'))    ? 'financialData'   : hasStmts ? 'calculated-stmts' : 'earnings-fallback';
  const epsGMethod = Number.isFinite(pct(fin,'earningsGrowth'))   ? 'financialData'   : 'earnings-fallback';
  const evMethod   = Number.isFinite(raw(kst,'enterpriseToEbitda')) ? 'defaultKeyStatistics' : 'unavailable';
  const nmMethod   = Number.isFinite(pct(fin,'profitMargins'))    ? 'financialData'   : hasStmts ? 'calculated-stmts' : 'unavailable';

  for (const [k, method] of [
    ['per', perMethod], ['pbr', pbrMethod], ['roe', roeMethod], ['opMargin', opMMethod],
    ['fcfMargin', fcfMethod], ['debtRatio', debtMethod], ['currentRatio', crMethod],
    ['revGrowth', revGMethod], ['epsGrowth', epsGMethod], ['evEbitda', evMethod],
    ['netMargin', nmMethod],
    ['opIncomeGrowth', hasStmts ? 'calculated-stmts' : 'unavailable'],
  ]) {
    if (metrics[k] != null && Number.isFinite(toNumber(metrics[k]))) {
      metricsMeta[k] = makeYMeta(
        ['financialData','defaultKeyStatistics','quote/detail','quote','forwardPE'].includes(method) ? 'financialData' : 'fallback'
      );
      // Refine confidence: pure financialData fields are B, calculated/fallback are C
      metricsMeta[k].method = method;
      metricsMeta[k].confidence = (['financialData','defaultKeyStatistics','quote/detail','quote'].includes(method)) ? 'B' : 'C';
    }
  }

  const industryGroup = detectIndustry(quote?.sector, quote?.industry);
  return {
    name: quote?.longName || quote?.shortName || result.meta?.longName || stock.name,
    currency: quote?.currency || result.meta?.currency || stock.currency,
    price: Number.isFinite(currentPrice) ? Math.round(currentPrice * 100) / 100 : undefined,
    prevClose: firstFinite(
      toNumber(result.meta?.regularMarketPreviousClose),
      toNumber(result.meta?.previousClose),
    ) || undefined,
    priceHistory: priceHistory.length ? priceHistory : undefined,
    metrics,
    metricsMeta,
    asOf,
    priceSrc: `Yahoo Finance (${yahooSym})`,
    ...(industryGroup ? { industryGroup } : {}),
  };
}

function mapAlphaPayload(stock, raw) {
  const overview = raw.overview ?? {};
  const dailyRows = Object.entries(raw.daily?.['Time Series (Daily)'] ?? {})
    .sort(([a], [b]) => a.localeCompare(b)).slice(-15);
  const priceHistory = dailyRows.map(([, r]) => toNumber(r['4. close'])).filter(v => Number.isFinite(v) && v > 0);
  const latestPrice = priceHistory.at(-1);
  const balanceReport = getLatestReport(raw.balanceSheet);
  const cashFlowReport = getLatestReport(raw.cashFlow);
  const incomeReport = getLatestReport(raw.incomeStatement);
  const debtRatio = ratioPercent(balanceReport.totalLiabilities, balanceReport.totalShareholderEquity);
  const currentRatio = ratioPercent(balanceReport.totalCurrentAssets, balanceReport.totalCurrentLiabilities);
  const opCF = toNumber(cashFlowReport.operatingCashflow);
  const capex = Math.abs(toNumber(cashFlowReport.capitalExpenditures));
  const revenue = toNumber(incomeReport.totalRevenue);
  const fcfMargin = revenue ? ((opCF - capex) / revenue) * 100 : NaN;
  const totalAssets = toNumber(balanceReport.totalAssets);
  const grossProfit = toNumber(overview.GrossProfitTTM) || toNumber(incomeReport.grossProfit);
  const gpa = (grossProfit && totalAssets) ? (grossProfit / totalAssets) * 100 : NaN;
  const evEbitda = toNumber(overview.EVToEBITDA);
  const roa = decimalToPercent(overview.ReturnOnAssetsTTM); // Alpha Vantage OVERVIEW has no ROIC field

  const latestQuarter = overview.LatestQuarter || '';
  const metrics = compactMetrics({
    per: toNumber(overview.PERatio),
    pbr: toNumber(overview.PriceToBookRatio),
    roe: decimalToPercent(overview.ReturnOnEquityTTM),
    opMargin: decimalToPercent(overview.OperatingMarginTTM),
    debtRatio,
    revGrowth: decimalToPercent(overview.QuarterlyRevenueGrowthYOY),
    epsGrowth: decimalToPercent(overview.QuarterlyEarningsGrowthYOY),
    currentRatio,
    fcfMargin,
    evEbitda,
    gpa,
    roa, // stored for display; ROIC omitted — AV OVERVIEW lacks invested-capital data
  });
  const metricsMeta = Object.fromEntries(Object.keys(metrics).map(k => [k, makeMetricMeta({
    provider: 'Alpha Vantage',
    sourceId: 'alphaVantage',
    source: 'Alpha Vantage API',
    method: 'api',
    confidence: 'B',
    commercialSafe: false,
  })]));
  const industryGroup = detectIndustry(overview.Sector, overview.Industry);
  return {
    name: overview.Name || stock.name,
    currency: stock.currency,
    price: latestPrice,
    priceHistory: priceHistory.length ? priceHistory : undefined,
    metrics,
    asOf: latestQuarter || new Date().toISOString().slice(0, 10),
    priceSrc: 'Alpha Vantage',
    ...(industryGroup ? { industryGroup } : {}),
  };
}

function getLatestReport(data) {
  return data?.quarterlyReports?.[0] ?? data?.annualReports?.[0] ?? {};
}

function mapFmpPayload(stock, raw, fmpSym) {
  const quote = firstRecord(raw.quote);
  const profile = firstRecord(raw.profile);
  const ratios = firstRecord(raw.ratiosTtm);
  const keyMetrics = firstRecord(raw.keyMetricsTtm);
  const historicalRows = getFmpHistoricalRows(raw.historical);
  const priceHistory = historicalRows
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))
    .slice(-15)
    .map(r => firstFinite(r.close, r.price, r.adjClose))
    .filter(v => Number.isFinite(v) && v > 0);
  const currentPrice = firstFinite(quote.price, quote.regularMarketPrice, profile.price, priceHistory.at(-1));
  const asOf = quote.timestamp
    ? new Date(Number(quote.timestamp) * 1000).toISOString().slice(0, 10)
    : (quote.date || new Date().toISOString().slice(0, 10));
  const metrics = compactMetrics({
    per: firstFinite(ratios.priceEarningsRatioTTM, ratios.peRatioTTM, ratios.peRatio, keyMetrics.peRatioTTM, quote.pe),
    pbr: firstFinite(ratios.priceToBookRatioTTM, ratios.pbRatioTTM, keyMetrics.pbRatioTTM),
    roe: decimalToPercent(firstFinite(ratios.returnOnEquityTTM, ratios.roeTTM)),
    opMargin: decimalToPercent(firstFinite(ratios.operatingProfitMarginTTM, ratios.operatingMarginTTM)),
    debtRatio: decimalToPercent(firstFinite(ratios.debtEquityRatioTTM, ratios.debtToEquityRatioTTM)),
    revGrowth: decimalToPercent(firstFinite(ratios.revenueGrowthTTM, keyMetrics.revenueGrowthTTM)),
    currentRatio: decimalToPercent(firstFinite(ratios.currentRatioTTM, ratios.currentRatio)),
    evEbitda: firstFinite(ratios.enterpriseValueMultipleTTM, keyMetrics.enterpriseValueOverEBITDATTM),
    roic: decimalToPercent(firstFinite(ratios.returnOnCapitalEmployedTTM, ratios.returnOnInvestedCapitalTTM)),
  });
  const metricsMeta = Object.fromEntries(Object.keys(metrics).map(k => [k, makeMetricMeta({
    provider: 'FMP',
    sourceId: 'fmp',
    source: `FMP (${fmpSym})`,
    method: 'api',
    confidence: 'B',
    commercialSafe: false,
  })]));
  const industryGroup = detectIndustry(profile.sector, profile.industry);
  return {
    name: profile.companyName || quote.name || stock.name,
    currency: quote.currency || profile.currency || stock.currency,
    price: Number.isFinite(currentPrice) ? Math.round(currentPrice * 100) / 100 : undefined,
    priceHistory: priceHistory.length ? priceHistory : undefined,
    metrics,
    asOf,
    priceSrc: `FMP (${fmpSym})`,
    ...(industryGroup ? { industryGroup } : {}),
  };
}

function mapKrPricePayload(stock, item) {
  const close = toNumber(item.clpr);
  if (!Number.isFinite(close) || close <= 0) throw new Error('종가 데이터 없음');
  const rawDate = String(item.basDt ?? '');
  const asOf = rawDate.length === 8 ? `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6)}` : rawDate;
  return {
    name: item.itmsNm || stock.name,
    currency: 'KRW',
    price: close,
    prevClose: toNumber(item.vs) ? close - toNumber(item.vs) : undefined,
    priceHistory: [...(stock.priceHistory ?? []).slice(-14), close],
    metrics: {},
    asOf,
    priceSrc: '공공데이터포털 주식시세',
  };
}

function findDartRow(rows, ids, names) {
  return rows.find(r => ids.includes(r.account_id)) ?? rows.find(r => names.some(n => String(r.account_nm ?? '').includes(n)));
}

function getDartAmt(row) { if (!row) return NaN; const a = toNumber(row.thstrm_amount); return Number.isFinite(a) ? a : toNumber(row.thstrm_add_amount); }
function getPrevDartAmt(row) { if (!row) return NaN; const a = toNumber(row.frmtrm_amount); return Number.isFinite(a) ? a : toNumber(row.frmtrm_add_amount); }

function mapOpenDartPayload(stock, raw, corp, currentPrice, shares) {
  const rows = raw.list ?? [];
  const ctx = raw.context;
  const dartLabels = { 11011: '사업보고서', 11012: '반기보고서', 11013: '1분기보고서', 11014: '3분기보고서' };
  const asOf = getReportEndDate(ctx.year, ctx.reportCode);
  const srcName = `OpenDART ${ctx.year} ${dartLabels[ctx.reportCode] || ''} ${ctx.fsDiv}`;

  const totalLiab = getDartAmt(findDartRow(rows, ['ifrs-full_Liabilities'], ['부채총계', 'Total liabilities']));
  const totalEquity = getDartAmt(findDartRow(rows, ['ifrs-full_Equity','ifrs-full_EquityAttributableToOwnersOfParent'], ['자본총계', 'Total equity']));
  const totalAssets = getDartAmt(findDartRow(rows, ['ifrs-full_Assets'], ['자산총계', 'Total assets']));
  const currAssets = getDartAmt(findDartRow(rows, ['ifrs-full_CurrentAssets'], ['유동자산', 'Current assets']));
  const currLiab = getDartAmt(findDartRow(rows, ['ifrs-full_CurrentLiabilities'], ['유동부채', 'Current liabilities']));
  const revenueRow = findDartRow(rows, ['ifrs-full_Revenue','ifrs-full_SalesRevenue'], ['매출액', '수익(매출액)', 'Revenue']);
  const grossProfitRow = findDartRow(rows, ['ifrs-full_GrossProfit'], ['매출총이익', 'Gross profit']);
  const opIncomeRow = findDartRow(rows, ['dart_OperatingIncomeLoss','ifrs-full_ProfitLossFromOperatingActivities'], ['영업이익', 'Operating income']);
  const netIncomeRow = findDartRow(rows, ['ifrs-full_ProfitLoss'], ['당기순이익', 'Profit']);
  const epsRow = findDartRow(rows, ['ifrs-full_BasicEarningsLossPerShare','ifrs-full_BasicAndDilutedEarningsLossPerShare'], ['기본주당이익', '주당순이익', 'Basic earnings']);
  const opCFRow = findDartRow(rows,
    ['ifrs-full_CashFlowsFromUsedInOperatingActivities','dart_CashFlowsFromOperatingActivities'],
    ['영업활동현금흐름', '영업활동으로 인한 현금흐름', 'Operating cash']);
  const capexRow = findDartRow(rows,
    ['ifrs-full_PurchaseOfPropertyPlantAndEquipment','dart_PurchaseOfPropertyPlantAndEquipment'],
    ['유형자산의 취득', '유형자산취득', 'Property, plant']);

  const revenue = getDartAmt(revenueRow);
  const prevRevenue = getPrevDartAmt(revenueRow);
  const grossProfit = getDartAmt(grossProfitRow);
  const opIncome = getDartAmt(opIncomeRow);
  const netIncome = getDartAmt(netIncomeRow);
  const eps = getDartAmt(epsRow);
  const prevEps = getPrevDartAmt(epsRow);
  const opCF = getDartAmt(opCFRow);
  const capex = Math.abs(getDartAmt(capexRow));
  const fcf = (Number.isFinite(opCF) && Number.isFinite(capex)) ? opCF - capex : NaN;

  // PBR: prefer actual issued shares from stockInfo API; fall back to implied shares via EPS
  let pbr = NaN;
  if (currentPrice && totalEquity > 0) {
    const sharesActual = Number.isFinite(shares) && shares > 0 ? shares : null;
    const sharesImplied = (Number.isFinite(eps) && Math.abs(eps) > 0.01 && Number.isFinite(netIncome) && netIncome !== 0)
      ? netIncome / eps : null;
    const sharesUsed = sharesActual ?? sharesImplied;
    if (sharesUsed > 0) {
      const bps = totalEquity / sharesUsed;
      if (bps > 0) pbr = currentPrice / bps;
    }
  }

  const metrics = compactMetrics({
    per: (currentPrice && eps) ? currentPrice / eps : NaN,
    pbr,
    roe: totalEquity ? (netIncome / totalEquity) * 100 : NaN,
    opMargin: revenue ? (opIncome / revenue) * 100 : NaN,
    fcfMargin: (revenue && Number.isFinite(fcf)) ? (fcf / revenue) * 100 : NaN,
    debtRatio: totalEquity ? (totalLiab / totalEquity) * 100 : NaN,
    revGrowth: prevRevenue ? ((revenue - prevRevenue) / Math.abs(prevRevenue)) * 100 : NaN,
    epsGrowth: prevEps ? ((eps - prevEps) / Math.abs(prevEps)) * 100 : NaN,
    currentRatio: currLiab ? (currAssets / currLiab) * 100 : NaN,
    gpa: (grossProfit && totalAssets) ? (grossProfit / totalAssets) * 100 : NaN,
    roic: (totalEquity && totalLiab) ? (opIncome / (totalEquity + totalLiab - currLiab)) * 100 : NaN,
  });

  // metricsMeta: OpenDART = official filing → confidence A, commercialSafe true
  const dartMetaBase = makeMetricMeta({
    provider: 'OpenDART',
    sourceId: 'openDart',
    source: srcName,
    method: 'official-filing',
    confidence: 'A',
    commercialSafe: true,
    fiscalYear: ctx.year,
    periodEnd: asOf,
  });
  const metricsMeta = {};
  for (const k of Object.keys(metrics)) {
    if (metrics[k] != null && Number.isFinite(toNumber(metrics[k]))) {
      metricsMeta[k] = { ...dartMetaBase, fetchedAt: new Date().toISOString() };
    }
  }

  return {
    name: corp.corpName || stock.name,
    currency: stock.currency,
    metrics,
    metricsMeta,
    asOf,
    priceSrc: srcName,
  };
}

// ═══════════════════════════════════════════════════════════════
// Main fetch orchestrator — returns payload + cache updates
// ═══════════════════════════════════════════════════════════════
async function fetchStockData(stock, apiSettings, cache, dartCorpMap, onStatus = () => {}) {
  const mode = 'all';
  const commercialSafe = isCommercialSafeMode(apiSettings);

  // Korean stocks: data.go.kr + OpenDART
  if (stock.market === 'KRX') {
    const results = {};

    if (apiSettings.dataGoKrKey) {
      try {
        const priceKey = buildKrPriceCacheKey(stock);
        const priceCache = getCachedEntry(cache, priceKey, apiSettings.cacheDays);
        if (priceCache) {
          results.price = priceCache.payload;
        } else {
          onStatus('공공데이터 주가 조회 중...');
          const item = await fetchKoreanStockPrice(stock.symbol, apiSettings.dataGoKrKey, apiSettings);
          results.price = mapKrPricePayload(stock, item);
          results.priceKey = priceKey;
          const priceSourceMeta = makeCacheSourceMeta({ provider: 'dataGoKrStockPrice', sourceId: 'dataGoKrStockPrice', endpointIds: ['dataGoKr.stockPrice'], mode: apiSettings.dataMode, confidence: 'B' });
          results.price = attachDataViews(results.price, priceSourceMeta);
          results.priceCacheEntry = {
            fetchedAt: new Date().toISOString(),
            provider: 'dataGoKrStockPrice',
            schemaVersion: CACHE_SCHEMA_VERSION,
            sourceMeta: priceSourceMeta,
            payload: results.price,
          };
        }
      } catch (e) {
        onStatus(commercialSafe
          ? `data.go.kr failed - commercial-safe mode will not use Yahoo (${e.message?.slice(0, 50)})`
          : `data.go.kr 실패 — Yahoo로 폴백 (${e.message?.slice(0, 50)})`);
      }
    }

    // Fallback: Yahoo Finance for KRX price if data.go.kr unavailable/failed
    if (!results.price && !commercialSafe) {
      try {
        onStatus('Yahoo 한국주식 가격 조회 중...');
        results.price = await fetchKrxYahooPrice(stock, apiSettings);
      } catch (e) {
        onStatus(`Yahoo 폴백 실패 (${e.message?.slice(0, 50)})`);
      }
    } else if (!results.price && commercialSafe) {
      onStatus('Commercial-Safe mode: Yahoo KRX price fallback blocked');
    }

    if (apiSettings.openDartKey) {
      const dartKey = buildCacheKey(stock, apiSettings, mode);
      const dartCache = getCachedEntry(cache, dartKey, apiSettings.cacheDays);
      if (dartCache && (dartCache.schemaVersion ?? 1) >= CACHE_SCHEMA_VERSION) {
        results.dart = dartCache.payload;
      } else {
        const stockCode = normalizeKrxStockCode(stock.symbol);
        const corp = getDartCorpEntry(dartCorpMap, stock);
        if (!corp?.corpCode) throw new Error(`${stockCode} corp_code 매핑 없음 — API 설정의 Corp 매핑에서 추가해 주세요.`);
        onStatus('OpenDART 재무제표 조회 중...');
        const [rawRes, sharesRes] = await Promise.allSettled([
          fetchOpenDartStatements(corp.corpCode, apiSettings),
          fetchDartStockInfo(corp.corpCode, apiSettings.openDartKey, apiSettings),
        ]);
        if (rawRes.status === 'rejected') throw rawRes.reason;
        const raw = rawRes.value;
        const shares = sharesRes.status === 'fulfilled' ? sharesRes.value : null;
        const currentPrice = results.price?.price ?? Number(stock.price);
        const dartSourceMeta = makeCacheSourceMeta({ provider: 'openDart', sourceId: 'openDart', endpointIds: ['opendart.fnlttSinglAcntAll', 'opendart.fnlttSinglAcnt', 'opendart.stockInfo'], mode: apiSettings.dataMode, confidence: 'A' });
        results.dart = attachDataViews(mapOpenDartPayload(stock, raw, corp, currentPrice, shares), dartSourceMeta);
        results.dartKey = dartKey;
        results.dartCacheEntry = {
          fetchedAt: new Date().toISOString(),
          provider: 'openDart',
          schemaVersion: CACHE_SCHEMA_VERSION,
          sourceMeta: dartSourceMeta,
          payload: results.dart,
        };
      }
    }

    if (!results.price && !results.dart) throw new Error('한국 종목: data.go.kr key 또는 OpenDART key를 저장해 주세요.');

    const merged = {
      cacheUpdates: {},
      replaceMetrics: commercialSafe,
      ...results.price,
      ...(results.dart ? {
        metrics: { ...(results.price?.metrics ?? {}), ...results.dart.metrics },
        asOf: results.dart.asOf,
        priceSrc: results.dart.priceSrc,
        ...(results.dart.name ? { name: results.dart.name } : {}),  // prefer DART corpName for KRX
      } : {}),
    };
    const mergedSourceMeta = results.dart?.sourceMeta || results.price?.sourceMeta || null;
    const viewMerged = attachDataViews(merged, mergedSourceMeta);
    if (results.priceKey) merged.cacheUpdates[results.priceKey] = results.priceCacheEntry;
    if (results.dartKey) merged.cacheUpdates[results.dartKey] = results.dartCacheEntry;
    viewMerged.cacheUpdates = merged.cacheUpdates;
    return viewMerged;
  }

  if (commercialSafe) {
    const cacheKey = buildCacheKey(stock, apiSettings, mode);
    const cached = getCachedEntry(cache, cacheKey, apiSettings.cacheDays);
    if (cached && (cached.schemaVersion ?? 1) >= CACHE_SCHEMA_VERSION) {
      return { ...cached.payload, cacheUpdates: {}, fromCache: true, replaceMetrics: true };
    }
    if (!isSecEligibleStock(stock)) {
      throw new Error(`${stock.symbol}: Commercial-Safe mode needs an official filing source or user import for this market`);
    }
    onStatus('SEC EDGAR financials (commercial-safe) loading...');
    const history = await fetchSecFinancialHistory(stock);
    const payload = { ...mapSecHistoryPayload(stock, history), replaceMetrics: true };
    const conf = computeDataConfidence(payload.metrics, payload.metricsMeta);
    const sourceMeta = makeCacheSourceMeta({ provider: 'secEdgar', sourceId: 'secEdgar', endpointIds: ['sec.companyfacts', 'sec.companyTickers'], mode: apiSettings.dataMode, confidence: conf.grade, completeness: { usedCount: conf.usedCount, totalCoreCount: conf.totalCoreCount } });
    const viewPayload = attachDataViews(payload, sourceMeta);
    const entry = {
      fetchedAt: new Date().toISOString(),
      provider: 'secEdgar',
      schemaVersion: CACHE_SCHEMA_VERSION,
      confidence: conf.grade,
      completeness: { usedCount: conf.usedCount, totalCoreCount: conf.totalCoreCount },
      sourceMeta,
      payload: viewPayload,
    };
    return { ...viewPayload, cacheUpdates: { [cacheKey]: entry } };
  }

  // Yahoo (price + basic metrics)
  if (apiSettings.globalProvider === 'yahooExperimental') {
    const cacheKey = buildCacheKey(stock, apiSettings, mode);
    const cached = getCachedEntry(cache, cacheKey, apiSettings.cacheDays);
    // schemaVersion 3 = metricsMeta included; 2 = timeseries fallback included; older entries lack non-US metrics
    if (cached && (cached.schemaVersion ?? 1) >= CACHE_SCHEMA_VERSION) return { ...cached.payload, cacheUpdates: {}, fromCache: true };
    onStatus('Yahoo Finance 가격/재무 조회 중...');
    const yahooSym = toYahooSymbol(stock);
    try {
      const [chartRes, quoteRes, summaryRes, stmtRes, earningsRes] = await Promise.allSettled([
        fetchYahooChart(yahooSym, apiSettings),
        fetchYahooQuote(yahooSym, apiSettings),
        fetchYahooQuoteSummary(yahooSym, apiSettings),
        fetchYahooStatements(yahooSym, apiSettings),
        fetchYahooEarnings(yahooSym, apiSettings),
      ]);
      if (chartRes.status === 'rejected') throw new Error(`Yahoo chart 실패: ${chartRes.reason?.message}`);
      const quote    = quoteRes.status   === 'fulfilled' ? quoteRes.value   : null;
      const coreSumm = summaryRes.status === 'fulfilled' ? summaryRes.value : null;
      const stmts    = stmtRes.status    === 'fulfilled' ? stmtRes.value    : null;
      const earnData = earningsRes.status === 'fulfilled' ? earningsRes.value : null;
      const summary  = (coreSumm || stmts) ? { ...coreSumm, ...stmts, ...(earnData || {}) } : null;
      const payload = mapYahooPayload(stock, chartRes.value, yahooSym, quote, summary);
      // Compute completeness for smart cache TTL decisions
      const conf = computeDataConfidence(payload.metrics, payload.metricsMeta);
      const sourceMeta = makeCacheSourceMeta({ provider: 'yahooExperimental', sourceId: 'yahooFinance', endpointIds: ['yahoo.chart', 'yahoo.quote', 'yahoo.quoteSummary', 'yahoo.timeseries'], mode: apiSettings.dataMode, confidence: conf.grade, completeness: { usedCount: conf.usedCount, totalCoreCount: conf.totalCoreCount } });
      const viewPayload = attachDataViews(payload, sourceMeta);
      const entry = {
        fetchedAt: new Date().toISOString(),
        provider: 'yahooExperimental',
        schemaVersion: CACHE_SCHEMA_VERSION,
        confidence: conf.grade,
        completeness: { usedCount: conf.usedCount, totalCoreCount: conf.totalCoreCount },
        sourceMeta,
        payload: viewPayload,
      };
      return { ...viewPayload, cacheUpdates: { [cacheKey]: entry } };
    } catch (e) {
      const stale = getAnyCachedEntry(cache, cacheKey);
      if (stale) return { ...stale.payload, cacheUpdates: {}, fromCache: true, fromStaleCache: true, staleAgeDays: stale.ageDays, fetchError: e.message };
      throw e;
    }
  }

  // Alpha Vantage
  if (apiSettings.globalProvider === 'alphaVantage') {
    assertSourceAllowed('alphaVantage', apiSettings, 'stock refresh');
    if (!apiSettings.alphaVantageKey) throw new Error('Alpha Vantage API key를 먼저 저장해 주세요.');
    const cacheKey = buildCacheKey(stock, apiSettings, mode);
    const cached = getCachedEntry(cache, cacheKey, apiSettings.cacheDays);
    if (cached) return { ...cached.payload, cacheUpdates: {}, fromCache: true };
    const requests = [
      { key: 'overview',        fn: 'OVERVIEW',          label: '재무비율' },
      { key: 'daily',           fn: 'TIME_SERIES_DAILY', label: '가격' },
      { key: 'balanceSheet',    fn: 'BALANCE_SHEET',     label: '재무상태표' },
      { key: 'cashFlow',        fn: 'CASH_FLOW',         label: '현금흐름표' },
      { key: 'incomeStatement', fn: 'INCOME_STATEMENT',  label: '손익계산서' },
    ];
    try {
      const raw = {};
      for (const [i, req] of requests.entries()) {
        onStatus(`Alpha Vantage ${i+1}/${requests.length} · ${req.label} 요청 중`);
        raw[req.key] = await fetchAlphaVantage(req.fn, stock.symbol, apiSettings.alphaVantageKey, apiSettings);
        if (i < requests.length - 1) await sleep(AV_DELAY);
      }
      const sourceMeta = makeCacheSourceMeta({ provider: 'alphaVantage', sourceId: 'alphaVantage', endpointIds: ['alphaVantage.query'], mode: apiSettings.dataMode, confidence: 'B' });
      const payload = attachDataViews(mapAlphaPayload(stock, raw), sourceMeta);
      const entry = {
        fetchedAt: new Date().toISOString(),
        provider: 'alphaVantage',
        schemaVersion: CACHE_SCHEMA_VERSION,
        sourceMeta,
        payload,
      };
      return { ...payload, cacheUpdates: { [cacheKey]: entry } };
    } catch (e) {
      const stale = getAnyCachedEntry(cache, cacheKey);
      if (stale) return { ...stale.payload, cacheUpdates: {}, fromCache: true, fromStaleCache: true, staleAgeDays: stale.ageDays, fetchError: e.message };
      throw e;
    }
  }

  // FMP
  if (apiSettings.globalProvider === 'fmp') {
    assertSourceAllowed('fmp', apiSettings, 'stock refresh');
    if (!apiSettings.fmpKey) throw new Error('FMP API key를 먼저 저장해 주세요.');
    const cacheKey = buildCacheKey(stock, apiSettings, mode);
    const cached = getCachedEntry(cache, cacheKey, apiSettings.cacheDays);
    if (cached) return { ...cached.payload, cacheUpdates: {}, fromCache: true };
    const fmpSym = toFmpSymbol(stock);
    const endpoints = [
      { key: 'quote',        ep: 'quote',                    label: 'quote' },
      { key: 'profile',      ep: 'profile',                  label: 'profile' },
      { key: 'ratiosTtm',    ep: 'ratios-ttm',               label: 'ratios TTM' },
      { key: 'keyMetricsTtm',ep: 'key-metrics-ttm',          label: 'key metrics TTM' },
      { key: 'historical',   ep: 'historical-price-eod/light',label: 'price history' },
    ];
    try {
      const raw = {};
      for (const [i, req] of endpoints.entries()) {
        onStatus(`FMP ${i+1}/${endpoints.length} · ${req.label} 요청 중`);
        try {
          raw[req.key] = await fetchFmp(req.ep, { symbol: fmpSym }, apiSettings.fmpKey, { allowEmpty: req.key !== 'quote', apiSettings });
        } catch (e) {
          if (req.key === 'quote') throw e;
          raw[req.key] = [];
        }
        if (i < endpoints.length - 1) await sleep(250);
      }
      const sourceMeta = makeCacheSourceMeta({ provider: 'fmp', sourceId: 'fmp', endpointIds: ['fmp.stable'], mode: apiSettings.dataMode, confidence: 'B' });
      const payload = attachDataViews(mapFmpPayload(stock, raw, fmpSym), sourceMeta);
      const entry = {
        fetchedAt: new Date().toISOString(),
        provider: 'fmp',
        schemaVersion: CACHE_SCHEMA_VERSION,
        sourceMeta,
        payload,
      };
      return { ...payload, cacheUpdates: { [cacheKey]: entry } };
    } catch (e) {
      const stale = getAnyCachedEntry(cache, cacheKey);
      if (stale) return { ...stale.payload, cacheUpdates: {}, fromCache: true, fromStaleCache: true, staleAgeDays: stale.ageDays, fetchError: e.message };
      throw e;
    }
  }

  throw new Error('지원하지 않는 데이터 소스입니다. Yahoo, Alpha Vantage, FMP 중 하나를 선택해 주세요.');
}

// ═══════════════════════════════════════════════════════════════
// Search
// ═══════════════════════════════════════════════════════════════
function uniqueSearchResults(results) {
  const seen = new Set();
  return results.filter(r => { const k = `${r.market}:${r.symbol}`.toUpperCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

function mapYahooSearchResult(row) {
  const sym = String(row.symbol ?? '').trim();
  if (!sym) return null;
  const prof = inferMarketFromExchange(sym, row.exchDisp ?? row.exchange ?? '');
  return { symbol: normalizeSymbolForMarket(sym, prof.key), name: row.longname ?? row.shortname ?? sym, marketKey: prof.key, market: prof.market, country: prof.country, currency: prof.currency, flag: COUNTRY_FLAGS[prof.country] ?? '🏷️', source: 'Yahoo' };
}

function mapFmpSearchResult(row) {
  const sym = String(row.symbol ?? '').trim();
  if (!sym) return null;
  const prof = inferMarketFromExchange(sym, row.exchangeShortName ?? row.exchange ?? '');
  return { symbol: normalizeSymbolForMarket(sym, prof.key), name: row.name ?? row.companyName ?? sym, marketKey: prof.key, market: prof.market, country: prof.country, currency: row.currency ?? prof.currency, flag: COUNTRY_FLAGS[prof.country] ?? '🏷️', source: 'FMP' };
}

async function searchWithYahoo(query, apiSettings = null) {
  assertEndpointAllowed('yahoo.search', apiSettings, 'search');
  const params = new URLSearchParams({ q: query, quotesCount: '10', newsCount: '0' });
  const data = await fetchJsonWithDiagnostics('Yahoo search', buildYahooSearchUrl(params), { apiSettings });
  const rows = (data.quotes ?? []).filter(q => ['EQUITY','ETF'].includes(String(q.quoteType ?? '').toUpperCase()));
  return uniqueSearchResults(rows.map(mapYahooSearchResult).filter(Boolean));
}

async function searchWithFmp(query, key, apiSettings = null) {
  assertEndpointAllowed('fmp.stable', apiSettings, 'search');
  if (!key) throw new Error('FMP key 없음');
  const [r1, r2] = await Promise.allSettled([
    fetchFmp('search-symbol', { query, limit: '8' }, key, { allowEmpty: true }),
    fetchFmp('search-name',   { query, limit: '8' }, key, { allowEmpty: true }),
  ]);
  const rows = [
    ...(r1.status === 'fulfilled' && Array.isArray(r1.value) ? r1.value : []),
    ...(r2.status === 'fulfilled' && Array.isArray(r2.value) ? r2.value : []),
  ];
  return uniqueSearchResults(rows.map(mapFmpSearchResult).filter(Boolean));
}

// ═══════════════════════════════════════════════════════════════
// Alert fetchers (Phase 2 — F6 Alerts)
// All fetchers return a normalized array of { source, kind, title, url,
// publishedAt (ISO), nativeId, raw }. Errors propagate; orchestration is in
// fetchAlertsForStock which wraps each source in try/catch.
// ═══════════════════════════════════════════════════════════════

function makeAlertId({ source, stockId, publishedAt, nativeId }) {
  const dateKey = (publishedAt || '').slice(0, 19);
  const tail = String(nativeId || '').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
  return `${source}:${stockId}:${dateKey}:${tail}`;
}

function formatDartDate(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

const SEC_FILING_FORMS = new Set(['10-K', '10-Q', '8-K', '20-F', '40-F', '6-K', 'S-1', 'S-3', 'DEF 14A']);

// ═══════════════════════════════════════════════════════════════
// 5-Year Financial History
// ═══════════════════════════════════════════════════════════════

const SEC_CONCEPTS = {
  revenue:   ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax'],
  opIncome:  ['OperatingIncomeLoss'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  ocf:       ['NetCashProvidedByUsedInOperatingActivities'],
  capex:     ['PaymentsToAcquirePropertyPlantAndEquipment', 'CapitalExpenditures'],
  eps:       ['EarningsPerShareDiluted', 'EarningsPerShareBasic'],
};

function pickAnnualFY(gaap, concepts) {
  for (const concept of concepts) {
    const entries = gaap[concept]?.units?.USD || [];
    const byFY = {};
    for (const e of entries) {
      if (e.form !== '10-K' && e.form !== '20-F') continue;
      const fy = Number(e.end?.slice(0, 4));
      if (!Number.isFinite(fy)) continue;
      if (!byFY[fy] || e.filed > byFY[fy].filed) byFY[fy] = e;
    }
    const sorted = Object.values(byFY).sort((a, b) => b.end.localeCompare(a.end)).slice(0, 5);
    if (sorted.length > 0) return sorted;
  }
  return [];
}

async function fetchSecFinancialHistory(stock) {
  if (!isSecEligibleStock(stock)) throw new Error('미국 상장 종목만 지원');
  const company = await resolveSecCompany(stock);
  const url = buildSecApiUrl(`companyfacts/CIK${company.cik}.json`);
  const data = await fetchJsonWithDiagnostics('SEC companyfacts', url, {
    fetchOptions: { headers: { 'User-Agent': 'ThesisTrack research@example.com', 'Accept': 'application/json' } },
  });
  const gaap = data?.facts?.['us-gaap'] || {};

  const revArr   = pickAnnualFY(gaap, SEC_CONCEPTS.revenue);
  const opArr    = pickAnnualFY(gaap, SEC_CONCEPTS.opIncome);
  const netArr   = pickAnnualFY(gaap, SEC_CONCEPTS.netIncome);
  const ocfArr   = pickAnnualFY(gaap, SEC_CONCEPTS.ocf);
  const capexArr = pickAnnualFY(gaap, SEC_CONCEPTS.capex);
  const epsArr   = pickAnnualFY(gaap, SEC_CONCEPTS.eps);

  const years = [...new Set(revArr.map(e => Number(e.end?.slice(0, 4))))].sort((a, b) => b - a).slice(0, 5);
  if (!years.length) throw new Error('연간 재무 데이터 없음');

  const getVal = (arr, fy) => arr.find(e => Number(e.end?.slice(0, 4)) === fy)?.val ?? null;
  const toM = v => v != null ? Math.round(v / 1e6) : null;

  return years.map(fy => {
    const rev  = getVal(revArr, fy);
    const op   = getVal(opArr, fy);
    const net  = getVal(netArr, fy);
    const ocf  = getVal(ocfArr, fy);
    const cpx  = getVal(capexArr, fy);
    const fcf  = (ocf != null && cpx != null) ? ocf - Math.abs(cpx) : null;
    const eps  = getVal(epsArr, fy);
    return {
      fy, source: 'SEC',
      revenue:  toM(rev),
      opIncome: toM(op),
      netIncome: toM(net),
      ocf: toM(ocf),
      capex: cpx != null ? Math.round(Math.abs(cpx) / 1e6) : null,
      fcf: toM(fcf),
      eps: eps != null ? Math.round(eps * 100) / 100 : null,
      opMargin: (rev && op) ? Math.round(op / rev * 1000) / 10 : null,
      unit: 'M', currency: 'USD',
    };
  });
}

async function fetchWithPolicy(url, opts = {}) {
  assertUrlAllowed(url, opts.apiSettings, opts.label || 'fetch');
  return fetch(url, opts.fetchOptions);
}

function mapSecHistoryPayload(stock, history) {
  const rows = Array.isArray(history) ? history : [];
  const latest = rows[0] || {};
  const prev = rows[1] || {};
  const safeDiv = (a, b) => (Number.isFinite(toNumber(a)) && Number.isFinite(toNumber(b)) && toNumber(b) !== 0)
    ? toNumber(a) / toNumber(b)
    : NaN;
  const fcfMargin = safeDiv(latest.fcf, latest.revenue) * 100;
  const netMargin = safeDiv(latest.netIncome, latest.revenue) * 100;
  const revGrowth = (Number.isFinite(toNumber(latest.revenue)) && Number.isFinite(toNumber(prev.revenue)) && toNumber(prev.revenue) !== 0)
    ? ((toNumber(latest.revenue) - toNumber(prev.revenue)) / Math.abs(toNumber(prev.revenue))) * 100
    : NaN;
  const epsGrowth = (Number.isFinite(toNumber(latest.eps)) && Number.isFinite(toNumber(prev.eps)) && toNumber(prev.eps) !== 0)
    ? ((toNumber(latest.eps) - toNumber(prev.eps)) / Math.abs(toNumber(prev.eps))) * 100
    : NaN;
  const metrics = compactMetrics({
    opMargin: latest.opMargin,
    fcfMargin,
    revGrowth,
    epsGrowth,
    netMargin,
  });
  const metricsMeta = {};
  for (const key of Object.keys(metrics)) {
    metricsMeta[key] = makeMetricMeta({
      provider: 'SEC EDGAR',
      sourceId: 'secEdgar',
      source: 'SEC EDGAR companyfacts',
      method: 'official-filing',
      confidence: 'A',
      commercialSafe: true,
      fiscalYear: latest.fy || null,
      periodEnd: latest.fy ? `${latest.fy}-12-31` : null,
    });
  }
  return {
    name: stock.name,
    currency: stock.currency || 'USD',
    metrics,
    metricsMeta,
    metricsMeta,
    metricsMeta,
    financialHistory: rows,
    asOf: latest.fy ? `${latest.fy}-12-31` : new Date().toISOString().slice(0, 10),
    priceSrc: stock.priceSrc || 'User/static price',
  };
}

async function fetchDartFinancialHistory(stock, apiSettings, dartCorpMap) {
  const key = apiSettings?.openDartKey;
  if (!key) throw new Error('DART API 키 없음 (Settings에서 입력)');
  const entry = getDartCorpEntry(dartCorpMap, stock);
  if (!entry?.corpCode) throw new Error('DART 기업코드 없음');
  const corpCode = entry.corpCode;

  const currentYear = new Date().getFullYear();
  const errors = [];
  const fetchYear = async (year) => {
    for (const fsDiv of ['CFS', 'OFS']) {
      for (const endpoint of ['fnlttSinglAcntAll', 'fnlttSinglAcnt']) {
        try {
          const params = new URLSearchParams({ crtfc_key: key, corp_code: corpCode, bsns_year: String(year), reprt_code: '11011', fs_div: fsDiv });
          const res = await fetch(buildOpenDartApiUrl(endpoint, params));
          if (!res.ok) { errors.push(`${year}/${endpoint}/${fsDiv} ${await describeOpenDartHttpError(res)}`); continue; }
          const text = await res.text();
          if (text.trimStart().startsWith('<')) { errors.push(`${year}/${endpoint}/${fsDiv}: ${summarizeOpenDartPayloadText(text)}`); continue; }
          const data = JSON.parse(text);
          if (data.status && data.status !== '000') {
            errors.push(`${year}/${endpoint}/${fsDiv}: ${summarizeOpenDartPayloadText(text)}`);
            continue;
          }
          if (data.status === '000' && Array.isArray(data.list) && data.list.length) return { rows: data.list, year };
          errors.push(`${year}/${endpoint}/${fsDiv}: empty list`);
        } catch (e) {
          errors.push(`${year}/${endpoint}/${fsDiv}: ${e.message}`);
        }
      }
    }
    return null;
  };

  const [r1, r2] = await Promise.all([fetchYear(currentYear - 1), fetchYear(currentYear - 3)]);

  const extractFromResult = (result) => {
    if (!result) return [];
    const { rows, year } = result;
    const revRow  = findDartRow(rows, ['ifrs-full_Revenue','ifrs-full_SalesRevenue'], ['매출액','수익(매출액)']);
    const opRow   = findDartRow(rows, ['dart_OperatingIncomeLoss','ifrs-full_ProfitLossFromOperatingActivities'], ['영업이익']);
    const netRow  = findDartRow(rows, ['ifrs-full_ProfitLoss'], ['당기순이익']);
    const ocfRow  = findDartRow(rows, ['ifrs-full_CashFlowsFromUsedInOperatingActivities','dart_CashFlowsFromOperatingActivities'], ['영업활동현금흐름']);
    const cpxRow  = findDartRow(rows, ['ifrs-full_PurchaseOfPropertyPlantAndEquipment'], ['유형자산의 취득','유형자산취득']);
    const epsRow  = findDartRow(rows, ['ifrs-full_BasicEarningsLossPerShare'], ['기본주당이익','주당순이익']);

    const getAmts = (row) => [
      getDartAmt(row),
      getPrevDartAmt(row),
      row ? toNumber(row.bfefrmtrm_amount) : NaN,
    ];
    const [rev0,rev1,rev2]   = getAmts(revRow);
    const [op0,op1,op2]      = getAmts(opRow);
    const [net0,net1,net2]   = getAmts(netRow);
    const [ocf0,ocf1,ocf2]   = getAmts(ocfRow);
    const [cpx0,cpx1,cpx2]   = getAmts(cpxRow);
    const [eps0,eps1,eps2]   = getAmts(epsRow);

    const toH = v => Number.isFinite(v) ? Math.round(v / 1e8) : null;
    const mkFCF = (ocf, cpx) => (Number.isFinite(ocf) && Number.isFinite(cpx)) ? toH(ocf + cpx) : null;

    return [
      { fy: year,   rev: rev0, op: op0, net: net0, ocf: ocf0, cpx: cpx0, eps: eps0 },
      { fy: year-1, rev: rev1, op: op1, net: net1, ocf: ocf1, cpx: cpx1, eps: eps1 },
      { fy: year-2, rev: rev2, op: op2, net: net2, ocf: ocf2, cpx: cpx2, eps: eps2 },
    ].filter(r => Number.isFinite(r.rev)).map(r => ({
      fy: r.fy, source: 'DART',
      revenue:  toH(r.rev),
      opIncome: toH(r.op),
      netIncome: toH(r.net),
      ocf: toH(r.ocf),
      capex: Number.isFinite(r.cpx) ? Math.round(Math.abs(r.cpx) / 1e8) : null,
      fcf: mkFCF(r.ocf, r.cpx),
      eps: Number.isFinite(r.eps) ? Math.round(r.eps) : null,
      opMargin: (Number.isFinite(r.rev) && Number.isFinite(r.op) && r.rev !== 0) ? Math.round(r.op / r.rev * 1000) / 10 : null,
      unit: '억원', currency: 'KRW',
    }));
  };

  const seen = new Set();
  const records = [...extractFromResult(r1), ...extractFromResult(r2)]
    .filter(r => { if (seen.has(r.fy)) return false; seen.add(r.fy); return true; })
    .sort((a, b) => b.fy - a.fy)
    .slice(0, 5);
  if (!records.length && errors.length) {
    throw new Error(`DART financial history fetch failed · ${errors.slice(0, 6).join(' / ')}`);
  }
  return records;
}
let secTickerMapPromise = null;

function normalizeSecTicker(symbol) {
  return String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/\.(US|O|N)$/i, '')
    .replace('.', '-');
}

function isSecEligibleStock(stock) {
  return ['NASDAQ', 'NYSE', 'AMEX'].includes(stock?.market) || stock?.country === '미국';
}

async function fetchSecTickerMap() {
  if (!secTickerMapPromise) {
    secTickerMapPromise = (async () => {
      const data = await fetchJsonWithDiagnostics('SEC ticker map', buildSecApiUrl('files/company_tickers.json'));
      const map = {};
      for (const row of Object.values(data || {})) {
        const ticker = normalizeSecTicker(row?.ticker);
        if (!ticker || !row?.cik_str) continue;
        map[ticker] = {
          cik: String(row.cik_str).padStart(10, '0'),
          title: String(row.title || ticker).trim(),
        };
      }
      return map;
    })().catch((e) => {
      secTickerMapPromise = null;
      throw e;
    });
  }
  return secTickerMapPromise;
}

async function resolveSecCompany(stock) {
  if (stock?.secCik) {
    return {
      cik: String(stock.secCik).replace(/\D/g, '').padStart(10, '0'),
      title: stock.name || stock.symbol,
    };
  }
  const map = await fetchSecTickerMap();
  const key = normalizeSecTicker(stock?.symbol);
  const hit = map[key];
  if (!hit) throw new Error(`${stock?.symbol || 'symbol'} SEC CIK 매핑 없음`);
  return hit;
}

async function fetchOpenDartDisclosures(corpCode, openDartKey, sinceISO) {
  if (!openDartKey || !corpCode) return [];
  const since = new Date(sinceISO);
  if (!Number.isFinite(since.getTime())) throw new Error('잘못된 since 값');
  const params = new URLSearchParams({
    crtfc_key: openDartKey,
    corp_code: corpCode,
    bgn_de: formatDartDate(since),
    end_de: formatDartDate(new Date()),
    page_count: '50',
  });
  const data = await fetchJsonWithDiagnostics('OpenDART list', buildOpenDartApiUrl('list', params), { openDartOkStatuses: ['000', '013'] });
  // 000 = ok, 013 = no data
  if (data.status && data.status !== '000' && data.status !== '013') {
    throw new Error(`OpenDART status ${data.status} · ${data.message ?? ''}`);
  }
  const list = Array.isArray(data.list) ? data.list : [];
  return list.map(item => {
    const rcptNo = String(item.rcept_no ?? '').trim();
    const dt = String(item.rcept_dt ?? '').trim();
    const isoDate = dt.length === 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : '';
    return {
      source: 'OpenDART',
      kind: '공시',
      title: String(item.report_nm ?? '').trim(),
      url: rcptNo ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcptNo}` : '',
      publishedAt: isoDate ? `${isoDate}T00:00:00+09:00` : new Date().toISOString(),
      nativeId: rcptNo,
      raw: { reporter: item.flr_nm, corpName: item.corp_name },
    };
  });
}

async function fetchSecFilings(stock, sinceISO) {
  if (!isSecEligibleStock(stock)) return [];
  const since = new Date(sinceISO);
  if (!Number.isFinite(since.getTime())) throw new Error('잘못된 since 값');
  const company = await resolveSecCompany(stock);
  const data = await fetchJsonWithDiagnostics('SEC submissions', buildSecApiUrl(`submissions/CIK${company.cik}.json`));
  const recent = data?.filings?.recent || {};
  const accession = recent.accessionNumber || [];
  const forms = recent.form || [];
  const filingDates = recent.filingDate || [];
  const reportDates = recent.reportDate || [];
  const docs = recent.primaryDocument || [];
  const descs = recent.primaryDocDescription || [];
  const cikNoZeros = String(Number(company.cik));
  const rows = [];

  for (let i = 0; i < accession.length; i++) {
    const form = String(forms[i] || '').trim();
    if (!SEC_FILING_FORMS.has(form)) continue;
    const filingDate = String(filingDates[i] || '').trim();
    const time = filingDate ? Date.parse(`${filingDate}T00:00:00-04:00`) : NaN;
    if (Number.isFinite(time) && time < since.getTime()) continue;
    const acc = String(accession[i] || '').trim();
    const accNoDash = acc.replace(/-/g, '');
    const doc = String(docs[i] || '').trim();
    const url = accNoDash
      ? `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accNoDash}/${doc || ''}`
      : `https://www.sec.gov/edgar/browse/?CIK=${company.cik}`;
    const desc = String(descs[i] || '').trim();
    rows.push({
      source: 'SEC',
      kind: '공시',
      title: `${form}${desc ? ` · ${desc}` : ''}`,
      url,
      publishedAt: Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString(),
      nativeId: acc,
      raw: {
        cik: company.cik,
        company: data.name || company.title,
        form,
        filingDate,
        reportDate: reportDates[i] || '',
      },
    });
  }
  return rows;
}

async function fetchInsiderTrades(stock) {
  if (!isSecEligibleStock(stock)) {
    throw new Error('내부자 거래 데이터는 미국 상장 종목(NYSE/NASDAQ/AMEX)만 지원합니다.');
  }
  const company = await resolveSecCompany(stock);
  const cikNoZeros = String(Number(company.cik));

  const data = await fetchJsonWithDiagnostics('SEC submissions', buildSecApiUrl(`submissions/CIK${company.cik}.json`));
  const recent = data?.filings?.recent || {};
  const accessions  = recent.accessionNumber || [];
  const forms       = recent.form || [];
  const filingDates = recent.filingDate || [];
  const primaryDocs = recent.primaryDocument || [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const form4Indices = [];
  for (let i = 0; i < forms.length; i++) {
    if (String(forms[i]).trim() !== '4') continue;
    const fd = new Date(String(filingDates[i] || '').trim());
    if (!Number.isFinite(fd.getTime()) || fd < cutoff) continue;
    form4Indices.push(i);
    if (form4Indices.length >= 15) break;
  }

  const trades = [];
  await Promise.allSettled(form4Indices.map(async (idx) => {
    const accNo = String(accessions[idx] || '').replace(/-/g, '');
    const doc   = String(primaryDocs[idx] || '').trim();
    if (!accNo || !doc) return;

    const xmlRes = await fetch(buildSecApiUrl(`archives/${cikNoZeros}/${accNo}/${doc}`));
    if (!xmlRes.ok) return;
    const xmlText = await xmlRes.text();

    const xmlDoc = new DOMParser().parseFromString(xmlText, 'text/xml');
    if (xmlDoc.querySelector('parsererror')) return;

    const ownerName  = xmlDoc.querySelector('rptOwnerName')?.textContent?.trim() || '–';
    const ownerTitle = xmlDoc.querySelector('officerTitle')?.textContent?.trim() || '';
    const isDirector = xmlDoc.querySelector('isDirector')?.textContent?.trim() === '1';
    const isOfficer  = xmlDoc.querySelector('isOfficer')?.textContent?.trim() === '1';

    for (const row of xmlDoc.querySelectorAll('nonDerivativeTransaction')) {
      const code = row.querySelector('transactionCode')?.textContent?.trim();
      if (!['P', 'S'].includes(code)) continue;
      const shares = parseFloat(row.querySelector('transactionShares value')?.textContent);
      const price  = parseFloat(row.querySelector('transactionPricePerShare value')?.textContent);
      const txDate = row.querySelector('transactionDate value')?.textContent?.trim()
                  || String(filingDates[idx] || '').trim();
      if (!Number.isFinite(shares) || shares <= 0) continue;
      trades.push({
        date: txDate,
        ownerName,
        ownerTitle,
        isOfficer,
        isDirector,
        type:   code === 'P' ? 'BUY' : 'SELL',
        shares,
        price:  Number.isFinite(price) && price > 0 ? price : null,
        value:  Number.isFinite(price) && price > 0 ? shares * price : null,
      });
    }
  }));

  return trades.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function fetchYahooNewsExperimental(symbol, nameQuery, apiSettings = null) {
  assertEndpointAllowed('yahoo.news', apiSettings, 'news');
  if (!symbol) return [];
  const q = nameQuery || symbol;
  const params = new URLSearchParams({ q, newsCount: '20', quotesCount: '0' });
  const data = await fetchJsonWithDiagnostics('Yahoo news', buildYahooSearchUrl(params), { apiSettings });
  const news = Array.isArray(data?.news) ? data.news : [];
  return news.map(n => ({
    source: 'Yahoo',
    kind: '뉴스',
    title: String(n.title ?? '').trim(),
    url: String(n.link ?? '').trim(),
    publishedAt: n.providerPublishTime
      ? new Date(Number(n.providerPublishTime) * 1000).toISOString()
      : new Date().toISOString(),
    nativeId: String(n.uuid ?? n.link ?? ''),
    raw: { publisher: n.publisher },
  }));
}

function isNewsRelevant(title, stock) {
  if (!title) return true;
  const t = title.toLowerCase();
  const name = (stock.name || '').toLowerCase();
  if (!name) return true;
  const symBase = (stock.symbol || '').replace(/\.[A-Z]+$/i, '').toLowerCase();
  const stopWords = new Set(['co', 'ltd', 'inc', 'corp', 'group', 'holdings', 'the', 'and', 'of']);
  const keywords = name.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
  if (keywords.length === 0) return true;
  return keywords.some(w => t.includes(w)) || (symBase.length >= 3 && t.includes(symBase));
}

async function fetchGoogleNewsRss(query, proxyPrefix = '', apiSettings = null) {
  assertEndpointAllowed('googleNews.rss', apiSettings, 'news');
  if (!query) return [];
  // Korean locale by default; user can switch via stock-level hint later.
  const target = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  const url = proxyPrefix ? `${proxyPrefix}${encodeURIComponent(target)}` : target;
  const res = await fetchWithPolicy(url, { apiSettings, label: 'Google News RSS' });
  if (!res.ok) throw new Error(`Google News HTTP ${res.status}`);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Google News XML 파싱 실패');
  const items = Array.from(doc.querySelectorAll('item'));
  return items.map(item => {
    const guid = item.querySelector('guid')?.textContent?.trim() ?? '';
    const link = item.querySelector('link')?.textContent?.trim() ?? '';
    const title = item.querySelector('title')?.textContent?.trim() ?? '';
    const pubDate = item.querySelector('pubDate')?.textContent?.trim() ?? '';
    const t = pubDate ? Date.parse(pubDate) : NaN;
    return {
      source: 'GoogleNews',
      kind: '뉴스',
      title,
      url: link,
      publishedAt: Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString(),
      nativeId: guid || link,
      raw: {},
    };
  });
}

async function fetchAlertsForStock(stock, dartCorpMap, apiSettings, alertSettings) {
  const stockId = stock.id ?? stock.symbol;
  const sinceDays = Math.max(1, Math.min(30, alertSettings?.daysBack || 7));
  const since = new Date(Date.now() - sinceDays * 86400000);
  const sinceISO = since.toISOString();
  const sources = alertSettings?.sources ?? {};
  const tasks = [];
  const errors = [];

  if (sources.dart && stock.market === 'KRX') {
    const corp = getDartCorpEntry(dartCorpMap, stock)?.corpCode;
    if (!apiSettings.openDartKey) {
      errors.push({ source: 'OpenDART', message: 'OpenDART key missing (F12 Settings/Data)' });
    } else if (!corp) {
      errors.push({ source: 'OpenDART', message: `${normalizeKrxStockCode(stock.symbol)} corp_code mapping missing` });
    } else {
      tasks.push({
        label: 'OpenDART',
        run: () => fetchOpenDartDisclosures(corp, apiSettings.openDartKey, sinceISO),
      });
    }
  }
  if (sources.sec && isSecEligibleStock(stock)) {
    tasks.push({ label: 'SEC', run: () => fetchSecFilings(stock, sinceISO) });
  }
  if (sources.yahooNews) {
    const sym = toYahooSymbol(stock);
    const nameQuery = stock.name || sym;
    try {
      assertEndpointAllowed('yahoo.news', apiSettings, 'alerts');
      tasks.push({
        label: 'Yahoo',
        run: async () => {
          const rows = await fetchYahooNewsExperimental(sym, nameQuery, apiSettings);
          return rows.filter(r => isNewsRelevant(r.title, stock));
        },
      });
    } catch (e) {
      errors.push({ source: 'Yahoo', message: e?.message || String(e), personalOnly: isPersonalOnlyError(e) });
    }
  }
  if (sources.googleNews) {
    const q = stock.name || stock.symbol;
    try {
      assertEndpointAllowed('googleNews.rss', apiSettings, 'alerts');
      tasks.push({
        label: 'GoogleNews',
        run: () => fetchGoogleNewsRss(q, alertSettings.googleNewsProxy || '', apiSettings),
      });
    } catch (e) {
      errors.push({ source: 'GoogleNews', message: e?.message || String(e), personalOnly: isPersonalOnlyError(e) });
    }
  }

  const items = [];
  await Promise.all(tasks.map(async t => {
    try {
      const rows = await t.run();
      for (const row of rows) {
        items.push({
          ...row,
          stockId,
          symbol: stock.symbol,
          id: makeAlertId({ source: row.source, stockId, publishedAt: row.publishedAt, nativeId: row.nativeId }),
        });
      }
    } catch (e) {
      errors.push({ source: t.label, message: e?.message || String(e) });
    }
  }));

  // Defensive: filter by since window
  const sinceMs = since.getTime();
  const filtered = items.filter(it => {
    const t = Date.parse(it.publishedAt || '');
    return Number.isFinite(t) ? t >= sinceMs : true;
  });
  return { items: filtered, errors };
}

function pruneAlerts(alerts, retentionDays = ALERT_RETENTION_DAYS) {
  const cutoff = Date.now() - retentionDays * 86400000;
  return (alerts || []).filter(a => {
    const t = Date.parse(a.publishedAt || '');
    return Number.isFinite(t) ? t >= cutoff : true;
  });
}


async function fetchYahooChartOhlc(symbol, range, interval, apiSettings = null) {
  assertEndpointAllowed('yahoo.chart', apiSettings, 'chart OHLC');
  const params = new URLSearchParams({ range, interval, includePrePost: 'false', events: 'div,splits' });
  const data = await fetchJsonWithDiagnostics('Yahoo chart', buildYahooChartUrl(symbol, params), { apiSettings });
  const err = data?.chart?.error;
  if (err) throw new Error(err.description || err.code || 'chart error');
  const result = data?.chart?.result?.[0];
  if (!result) return [];
  const timestamps = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  return timestamps.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    open:  toNumber(q.open?.[i]),
    high:  toNumber(q.high?.[i]),
    low:   toNumber(q.low?.[i]),
    close: toNumber(q.close?.[i]),
  })).filter(c => Number.isFinite(c.close) && c.close > 0);
}

async function fetchMacroIndicators(apiSettings = null) {
  try {
    assertEndpointAllowed('yahoo.quote', apiSettings, 'macro ticker');
  } catch (e) {
    if (isPersonalOnlyError(e)) return [];
    throw e;
  }
  try {
    const symbols = ['^GSPC', 'KRW=X', '^TNX', '^VIX'];
    const data = await fetchJsonWithDiagnostics('Yahoo macro quote', buildYahooQuoteUrl(symbols), { apiSettings });
    const resList = data?.quoteResponse?.result || [];
    return resList.map(r => ({
      symbol: r.symbol,
      name: r.shortName || r.symbol,
      price: r.regularMarketPrice,
      change: r.regularMarketChange,
      changePercent: r.regularMarketChangePercent
    }));
  } catch(e) {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// Expose to window
async function fetchYahooFinancialHistory(stock, apiSettings = null) {
  assertEndpointAllowed('yahoo.quoteSummary', apiSettings, 'financial history');
  const yahooSym = toYahooSymbol(stock);
  const summary = await fetchYahooStatements(yahooSym, apiSettings);

  const incStmts = summary?.incomeStatementHistory?.incomeStatementHistory || [];
  const balShts  = summary?.balanceSheetHistory?.balanceSheetStatements    || [];
  const cfStmts  = summary?.cashflowStatementHistory?.cashflowStatements   || [];
  if (!incStmts.length) throw new Error('Yahoo 연간 재무제표 없음');

  const hr = (obj, key) => {
    const v = obj?.[key];
    return v != null ? toNumber(typeof v === 'object' ? v.raw : v) : NaN;
  };
  const isJPY = stock.currency === 'JPY';
  const isKRW = stock.currency === 'KRW';
  const divisor = isKRW ? 1e8 : isJPY ? 1e6 : 1e6;
  const unit    = isKRW ? '억원' : isJPY ? 'M JPY' : 'M';

  const records = incStmts.map((inc, i) => {
    const bal = balShts[i]  || {};
    const cf  = cfStmts[i]  || {};
    const endTs = hr(inc, 'endDate');
    const fy = Number.isFinite(endTs) ? new Date(endTs * 1000).getFullYear() : null;
    if (!fy) return null;

    const rev       = hr(inc, 'totalRevenue');
    const opIncome  = firstFinite(hr(inc, 'operatingIncome'), hr(inc, 'ebit'));
    const netIncome = hr(inc, 'netIncome');
    const ocf       = hr(cf,  'totalCashFromOperatingActivities');
    const capexRaw  = hr(cf,  'capitalExpenditures');
    const capex     = Number.isFinite(capexRaw) ? Math.abs(capexRaw) : 0;
    const fcf       = Number.isFinite(ocf) ? ocf - capex : null;
    const opMargin  = (Number.isFinite(opIncome) && Number.isFinite(rev) && rev !== 0)
      ? Math.round((opIncome / rev) * 1000) / 10 : null;
    const toM = v => Number.isFinite(v) ? Math.round(v / divisor) : null;

    return {
      fy, source: 'Yahoo',
      revenue: toM(rev), opIncome: toM(opIncome), netIncome: toM(netIncome),
      ocf: toM(ocf), capex: toM(capex) || null,
      fcf: fcf != null ? toM(fcf) : null,
      eps: null,
      opMargin, unit, currency: stock.currency || 'USD',
    };
  }).filter(Boolean);

  if (!records.length) throw new Error('연간 재무 데이터 없음');
  return records.sort((a, b) => b.fy - a.fy);
}

// ═══════════════════════════════════════════════════════════════
Object.assign(window, {
  TT_KEY, MARKET_PROFILES, COUNTRY_FLAGS,
  DEFAULT_STOCKS, DEFAULT_WATCHLIST_IDS, DEFAULT_API_SETTINGS,
  DEFAULT_DART_CORP_MAP, DEFAULT_MARKET_TICKERS, DEFAULT_ALERT_SETTINGS,
  ALERT_RETENTION_DAYS,
  CACHE_SCHEMA_VERSION, CORE_METRIC_KEYS, DATA_SOURCE_REGISTRY, DATA_ENDPOINT_REGISTRY, BLOCKED_COMMERCIAL_SAFE_HOSTS,
  isCommercialSafeMode, assertSourceAllowed, assertEndpointAllowed, assertUrlAllowed, isPersonalOnlyError, getSourcePolicyRows, getEndpointPolicyRows,
  makeMetricMeta, setMetricWithMeta, computeDataConfidence, makeCacheSourceMeta, attachDataViews,
  loadAppState, saveAppState,
  computeScores, computeQuantScores, applyQuantScores, computeDynamicQuality,
  getDaysLeft, fetchStockData, fetchLivePrice, searchWithYahoo, searchWithFmp,
  normalizeKrxStockCode, getDartCorpEntry, fetchLocalDartCorpMap,
  inferMarketFromExchange, normalizeSymbolForMarket, getMarketProfile, buildYahooChartUrl, buildYahooSearchUrl,
  DEFAULT_SCORE, INDUSTRY_CFG,
  fetchOpenDartDisclosures, fetchSecFilings, fetchYahooNewsExperimental, fetchGoogleNewsRss,
  fetchAlertsForStock, makeAlertId, pruneAlerts,
  fetchYahooChartOhlc, toYahooSymbol, fetchMacroIndicators,
  fetchSecFinancialHistory, fetchDartFinancialHistory, fetchYahooFinancialHistory,
});
