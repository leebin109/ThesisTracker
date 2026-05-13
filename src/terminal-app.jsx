/* global React, ReactDOM */
/* global T, Cell, Stat, ScoreRing, ScoreBar, Spark, PriceChart, CommandBar, TickerRail, HeroStrip, PitchHeadline */
/* global fmtNum, fmtPx, sign, colorForChange, safeFixed, kbdStyle */
/* global TT_KEY, DEFAULT_STOCKS, DEFAULT_WATCHLIST_IDS, DEFAULT_API_SETTINGS, DEFAULT_DART_CORP_MAP, DEFAULT_MARKET_TICKERS */
/* global DEFAULT_ALERT_SETTINGS, ALERT_RETENTION_DAYS */
/* global loadAppState, saveAppState, computeScores, computeQuantScores, applyQuantScores, computeDynamicQuality, getDaysLeft */
/* global fetchStockData, fetchLivePrice, searchWithYahoo, searchWithFmp */
/* global fetchYahooChartOhlc, toYahooSymbol */
/* global fetchAlertsForStock, pruneAlerts */
/* global fetchSecFinancialHistory, fetchDartFinancialHistory, fetchYahooFinancialHistory */
/* global normalizeKrxStockCode, getDartCorpEntry, fetchLocalDartCorpMap */
/* global inferMarketFromExchange, normalizeSymbolForMarket, getMarketProfile, buildYahooChartUrl, MARKET_PROFILES, COUNTRY_FLAGS, SCORE_CFG */
/* global useTweaks, TweaksPanel */
/* global supabase */
/* global makeMetricMeta, computeDataConfidence, CORE_METRIC_KEYS */

// ─── Supabase config ──────────────────────────────────────────────────────────
// After creating a Supabase project, replace both placeholder values below.
// Dashboard → Settings → API → Project URL / anon public key
const SUPABASE_URL     = 'https://iymfticgbjrbldokhrgl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bWZ0aWNnYmpyYmxkb2tocmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDIxNTAsImV4cCI6MjA5MzkxODE1MH0.MzKWT5asNn1z0G2UZfBThnppILeltYweGwkaNQbPBq0';

function isSupabaseConfigured() {
  return typeof SUPABASE_URL === 'string' && !SUPABASE_URL.startsWith('YOUR_')
    && typeof SUPABASE_ANON_KEY === 'string' && !SUPABASE_ANON_KEY.startsWith('YOUR_');
}

let _sbClient = null;
function getSb() {
  if (!_sbClient && isSupabaseConfigured()) {
    _sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _sbClient;
}

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── helpers ────────────────────────────────────────────────────────────────
window.getDaysLeft = window.getDaysLeft || ((dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
});

function recLabel(r) {
  if (!r) return { text: 'Watch', color: T.inkDim };
  const m = { Buy: T.green, Hold: T.amber, Watch: T.cyan, Sell: T.red, Trim: T.yellow };
  return { text: r, color: m[r] || T.inkDim };
}

const PANEL_DEFS = [
  { k: 'F1', label: 'OVERVIEW', short: 'OVR' },
  { k: 'F2', label: 'PITCH', short: 'PITCH' },
  { k: 'F3', label: 'VALUATION', short: 'VAL' },
  { k: 'F4', label: 'HISTORY', short: 'HX' },
  { k: 'F5', label: 'CHART', short: 'CHART' },
  { k: 'F6', label: 'ALERTS', short: 'ALRT' },
  { k: 'F7', label: 'PEERS', short: 'PEER' },
  { k: 'F8', label: 'JOURNAL', short: 'JRN' },
  { k: 'F9', label: 'SCRIPT', short: 'SCR' },
  { k: 'F10', label: 'TRADE', short: 'TRD' },
  { k: 'F11', label: 'TOOLS', short: 'TOOL' },
  { k: 'F12', label: 'SETTINGS', short: 'SET' },
];

const BACKUP_SCHEMA_VERSION = 2;

const CHECKLIST_TEMPLATE = [
  { category: 'DATA', text: '최신 실적과 가이던스 확인' },
  { category: 'DATA', text: '최근 공시/뉴스 확인' },
  { category: 'THESIS', text: '핵심 thesis가 여전히 유효한지 점검' },
  { category: 'RISK', text: '주요 리스크와 pre-mortem breach 여부 업데이트' },
  { category: 'VALUATION', text: 'target price와 bull/base/bear 가정 재검토' },
  { category: 'REVIEW', text: '다음 리뷰일 설정' },
];

const DEFAULT_SCORE_WEIGHTS = { profitability: 25, stability: 25, growth: 20, valuation: 20, risk: 10 };

function makeBlankStock(patch = {}) {
  const id = String(patch.id || patch.symbol || '').trim().toUpperCase();
  return {
    id,
    symbol: id,
    name: id || 'New Stock',
    market: 'CUSTOM',
    currency: 'USD',
    flag: '🏷️',
    country: '기타',
    recommendation: 'Watch',
    oneLine: '',
    keyQuestion: '',
    thesis: [],
    catalysts: [],
    risks: [],
    variantView: '',
    numbersToWatch: [],
    changeMind: '',
    price: 0,
    prevClose: 0,
    target: 0,
    metrics: {},
    metricsMeta: {},
    asOf: '',
    priceSrc: '',
    scores: { overall: null, profitability: null, stability: null, growth: null, valuation: null, risk: null, weights: DEFAULT_SCORE_WEIGHTS },
    scoreHistory: [],
    priceHistory: [],
    valuation: { bear: {}, base: {}, bull: {}, note: '' },
    review: { next: '', cadence: 30 },
    notes: [],
    preMortem: [],
    checklist: [],
    calendarEvents: [],
    journal: [],
    peers: [],
    metricsHistory: [],
    insiderTrades: [],
    ...patch,
  };
}

function normalizeStockRecord(stock, fallbackId = '') {
  const id = String(stock?.id || stock?.symbol || fallbackId || '').trim().toUpperCase();
  const base = makeBlankStock({ id, symbol: id });
  const next = { ...base, ...(stock || {}) };
  next.id = String(next.id || id || next.symbol || '').trim().toUpperCase();
  next.symbol = String(next.symbol || next.id).trim().toUpperCase();
  next.name = String(next.name || next.symbol || next.id || 'New Stock');
  next.market = next.market || 'CUSTOM';
  next.currency = next.currency || 'USD';
  next.flag = next.flag || '🏷️';
  next.country = next.country || '기타';
  next.metrics = { ...(stock?.metrics || {}) };
  // Preserve metricsMeta; old records without it get an empty object (safe)
  next.metricsMeta = (stock?.metricsMeta && typeof stock.metricsMeta === 'object' && !Array.isArray(stock.metricsMeta))
    ? { ...stock.metricsMeta }
    : {};
  next.scores = {
    ...base.scores,
    ...(stock?.scores || {}),
    weights: { ...DEFAULT_SCORE_WEIGHTS, ...(stock?.scores?.weights || {}) },
  };
  next.valuation = {
    bear: { ...(stock?.valuation?.bear || {}) },
    base: { ...(stock?.valuation?.base || {}) },
    bull: { ...(stock?.valuation?.bull || {}) },
    note: stock?.valuation?.note || '',
  };
  next.review = { ...base.review, ...(stock?.review || {}) };
  for (const key of ['thesis', 'catalysts', 'risks', 'numbersToWatch', 'scoreHistory', 'priceHistory', 'notes', 'preMortem', 'checklist', 'calendarEvents', 'journal', 'peers', 'metricsHistory', 'insiderTrades']) {
    next[key] = Array.isArray(stock?.[key]) ? stock[key] : [];
  }
  return next;
}

function normalizeStocksMap(stocks) {
  const rows = Object.entries(stocks || {}).map(([id, stock]) => normalizeStockRecord(stock, id));
  return Object.fromEntries(rows.filter(s => s.id).map(s => [s.id, s]));
}

function normalizeStockId(id) {
  return String(id || '').trim().toUpperCase();
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeIdList(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return [...new Set(source.map(normalizeStockId).filter(Boolean))];
}

function normalizeStockSource(value) {
  if (isPlainObject(value)) return value;
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .map((stock, i) => normalizeStockRecord(stock, stock?.id || stock?.symbol || `STOCK_${i}`))
        .filter(stock => stock.id)
        .map(stock => [stock.id, stock])
    );
  }
  return DEFAULT_STOCKS;
}

async function buildInitialAppState() {
  const savedRaw = await loadAppState();
  const saved = isPlainObject(savedRaw) ? savedRaw : {};
  let stocks = normalizeStocksMap(normalizeStockSource(saved.stocks));
  if (!Object.keys(stocks).length) stocks = normalizeStocksMap(DEFAULT_STOCKS);

  // Multi-watchlist: migrate legacy single list or load saved groups
  let watchlists, activeWatchlistId;
  if (Array.isArray(saved.watchlists) && saved.watchlists.length) {
    watchlists = saved.watchlists.map(w => ({
      id: String(w.id || `wl-${Math.random().toString(36).slice(2)}`),
      name: String(w.name || 'Unnamed'),
      stockIds: normalizeIdList(w.stockIds || [], []).filter(id => stocks[id]),
    }));
    activeWatchlistId = saved.activeWatchlistId && watchlists.find(w => w.id === saved.activeWatchlistId)
      ? saved.activeWatchlistId : watchlists[0].id;
  } else {
    const legacyIds = normalizeIdList(saved.watchlistIds, DEFAULT_WATCHLIST_IDS).filter(id => stocks[id]);
    const defaultIds = legacyIds.length ? legacyIds : Object.keys(stocks);
    watchlists = [{ id: 'wl-0', name: 'Default', stockIds: defaultIds }];
    activeWatchlistId = 'wl-0';
  }

  const activeWl = watchlists.find(w => w.id === activeWatchlistId) || watchlists[0];
  let watchlistIds = [...activeWl.stockIds];
  if (!watchlistIds.length) watchlistIds = Object.keys(stocks).slice(0, 5);

  let activeId = normalizeStockId(saved.activeId);
  if (!activeId || !stocks[activeId]) {
    activeId = watchlistIds.find(id => stocks[id]) || Object.keys(stocks)[0] || '';
  }

  const savedApiSettings = isPlainObject(saved.apiSettings) ? saved.apiSettings : {};
  const savedAlertSettings = isPlainObject(saved.alertSettings) ? saved.alertSettings : {};

  stocks = applyQuantScores(stocks, watchlistIds);

  return {
    stocks,
    watchlistIds,
    watchlists,
    activeWatchlistId,
    activeId,
    apiSettings: { ...DEFAULT_API_SETTINGS, ...savedApiSettings },
    dataCache: isPlainObject(saved.dataCache) ? saved.dataCache : {},
    dartCorpMap: isPlainObject(saved.dartCorpMap) ? saved.dartCorpMap : DEFAULT_DART_CORP_MAP,
    alerts: Array.isArray(saved.alerts) ? saved.alerts : [],
    alertSettings: {
      ...DEFAULT_ALERT_SETTINGS,
      ...savedAlertSettings,
      sources: { ...DEFAULT_ALERT_SETTINGS.sources, ...(isPlainObject(savedAlertSettings.sources) ? savedAlertSettings.sources : {}) },
    },
    trades: Array.isArray(saved.trades) ? saved.trades : [],
  };
}

async function repairSavedActiveStock() {
  const savedRaw = await loadAppState();
  const saved = isPlainObject(savedRaw) ? savedRaw : {};
  const next = await buildInitialAppState();
  saveAppState({
    ...saved,
    stocks: next.stocks,
    watchlistIds: next.watchlistIds,
    activeId: next.activeId,
  });
  window.location.reload();
}

function resetSavedAppState() {
  try { localStorage.removeItem(TT_KEY); } catch {}
  window.location.reload();
}

const APP_UI_SCALE = 1.0;

const providerLabels = {
  yahooExperimental: 'YAHOO',
  alphaVantage: 'ALPHA',
  fmp: 'FMP',
};

const tickerYahooMap = {
  KOSPI: '^KS11',
  SPX: '^GSPC',
  NASDAQ: '^IXIC',
  USDKRW: 'KRW=X',
  WTI: 'CL=F',
  BTC: 'BTC-USD',
  US10Y: '^TNX',
};

function median(vals) {
  const nums = vals.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function ToastContainer({ toasts }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '10px 16px', fontSize: 12, fontFamily: T.font,
          background: t.kind === 'error' ? '#1a0a0a' : T.surface,
          border: `1px solid ${t.kind === 'error' ? T.red : t.kind === 'ok' ? T.green : T.border}`,
          color: t.kind === 'error' ? T.red : t.kind === 'ok' ? T.green : T.ink,
          maxWidth: 380, lineHeight: 1.5,
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Watchlist panel ─────────────────────────────────────────────────────────
function WatchlistPanel({ stocks, watchlistIds, activeId, watchlists, activeWatchlistId,
  onSelect, onAdd, onRemove, onSwitchWatchlist, onCreateWatchlist, onRenameWatchlist, onDeleteWatchlist }) {
  const tabSt = (active) => ({
    background: active ? `${T.amber}20` : 'transparent',
    border: 'none', borderRight: `1px solid ${T.borderSoft}`,
    borderBottom: `2px solid ${active ? T.amber : 'transparent'}`,
    color: active ? T.amber : T.inkDim,
    fontFamily: T.font, fontSize: 10.5, padding: '3px 7px', cursor: 'pointer',
    whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
  });
  return (
    <Cell label="WATCHLIST" accent={T.amber} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Group tabs */}
      {watchlists && watchlists.length > 0 && (
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, flexShrink: 0, overflowX: 'auto', background: T.bg }}>
          {watchlists.map(wl => (
            <button key={wl.id} style={tabSt(wl.id === activeWatchlistId)}
              onClick={() => onSwitchWatchlist(wl.id)}
              onDoubleClick={() => onRenameWatchlist(wl.id)}>
              {wl.name}
              {watchlists.length > 1 && (
                <button onClick={e => { e.stopPropagation(); if (window.confirm(`"${wl.name}" 워치리스트를 삭제하시겠습니까?`)) onDeleteWatchlist(wl.id); }}
                  style={{ opacity: 0.6, fontSize: 11, lineHeight: 1, marginLeft: 2, background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 2px' }}>×</button>
              )}
            </button>
          ))}
          <button onClick={onCreateWatchlist}
            style={{ background: 'transparent', border: 'none', color: T.inkFaint, fontFamily: T.font, fontSize: 11, padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}>
            +
          </button>
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {watchlistIds.map(id => {
          const s = stocks[id];
          if (!s) return null;
          const change = s.price - s.prevClose;
          const pct = s.prevClose ? (change / s.prevClose) * 100 : 0;
          const active = id === activeId;
          const rec = recLabel(s.recommendation);
          return (
            <div key={id} onClick={() => onSelect(id)}
              style={{
                padding: '9px 12px', cursor: 'pointer', borderBottom: `1px solid ${T.borderSoft}`,
                background: active ? `${T.amber}12` : 'transparent',
                borderLeft: `2px solid ${active ? T.amber : 'transparent'}`,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2, gap: 4 }}>
                <span style={{
                  fontWeight: 700, fontSize: 12, color: active ? T.amber : T.ink,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  minWidth: 0, flex: 1,
                }} title={s.name || s.symbol}>
                  {s.name || s.symbol}
                </span>
                <span style={{ fontSize: 10, color: rec.color, fontWeight: 600, flex: '0 0 auto' }}>{rec.text}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 10.5, color: T.inkFaint, letterSpacing: '0.06em', flex: '0 0 auto' }}>{s.symbol}</span>
                  <span style={{ fontSize: 10.5, color: T.inkDim, fontVariantNumeric: 'tabular-nums' }}>
                    {s.currency === 'KRW' ? `₩${fmtPx(s.price, 'KRW')}` : `$${fmtPx(s.price, s.currency)}`}
                  </span>
                </span>
                <span style={{ fontSize: 10, color: colorForChange(change), fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>
                  {sign(pct)}{safeFixed(pct, 2)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Spark data={s.priceHistory || []} width={80} height={16} color={colorForChange(change)} fill={false}/>
                <span style={{ fontSize: 9.5, color: T.inkFaint }}>
                  {Number.isFinite(s.scores?.overall) ? `${s.scores.overall}pt` : '–'}
                </span>
              </div>
            </div>
          );
        })}
        {onAdd && (
          <div style={{ padding: '8px 12px' }}>
            <button onClick={onAdd} style={{
              width: '100%', padding: '6px', background: 'transparent',
              border: `1px dashed ${T.border}`, color: T.inkFaint,
              fontFamily: T.font, fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em',
            }}>+ ADD SYMBOL</button>
          </div>
        )}
      </div>
    </Cell>
  );
}

// ─── Score breakdown ──────────────────────────────────────────────────────────
const SCORE_TOOLTIPS = {
  profitability: 'QUALITY 팩터 (Cross-sectional Z-Score)\nROE, ROIC, GP/A, OP Margin 종합\n워치리스트/섹터 내 상대 평가',
  stability:     'SAFETY 팩터 (Cross-sectional Z-Score)\n부채비율(Debt/Eq), 유동비율(Cur Ratio) 종합\n워치리스트/섹터 내 상대 평가',
  growth:        'GROWTH 팩터 (Cross-sectional Z-Score)\n매출 성장률, EPS 성장률 종합\n워치리스트/섹터 내 상대 평가',
  valuation:     'VALUE 팩터 (Cross-sectional Z-Score)\nPER, PBR, EV/EBITDA 종합 (낮을수록 고득점)\n워치리스트/섹터 내 상대 평가',
  risk:          'RISK 플래그 (8개 체크)\n· EPS 성장률 < -15%\n· FCF 마진 < -5%\n· 부채비율 > 250%\n· PER > 60\n· 적자 (PER<=0 & ROE<0)\n· 유동성 위기 (CR<1 & D/E>150%)\n· 매출 급감 < -15%\n· 영업손실 (OP<0)',
  piotroski:     'Piotroski F-Score (7점)\n수익성·레버리지·성장 7개 바이너리 신호\n6~7: STRONG · 4~5: NEUTRAL · 0~3: WEAK\n(ROE+, FCF+, OP>avg, D/E↓, CR>1, Rev+, EPS+)',
};

function ScoreBreakdown({ scores, activeDim, onDimClick }) {
  const [tip, setTip] = React.useState(null);
  if (!scores) return null;
  const dims = [
    { key: 'profitability', label: 'PROFITABILITY', color: T.amber },
    { key: 'stability',     label: 'STABILITY',     color: T.cyan },
    { key: 'growth',        label: 'GROWTH',        color: T.green },
    { key: 'valuation',     label: 'VALUATION',     color: T.yellow },
    { key: 'risk',          label: 'RISK GUARD',    color: T.red },
  ];
  return (
    <Cell label="SCORE BREAKDOWN" accent={T.amber} style={{ height: '100%' }}>
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {dims.map(d => {
          const v = scores[d.key];
          const w = scores.weights?.[d.key] ?? 20;
          const isRisk = d.key === 'risk';
          const flagMax = scores.riskFlagMax ?? 5;
          const flagCount = isRisk ? (scores.riskFlagCount ?? Math.round((100 - (v || 0)) / 13)) : null;
          const isActive = activeDim === d.key;
          const isDimmed = activeDim && !isActive;
          return (
            <div key={d.key} style={{ position: 'relative', opacity: isDimmed ? 0.4 : 1, cursor: 'pointer', transition: 'opacity 0.15s' }}
              onClick={() => onDimClick?.(isActive ? null : d.key)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 9.5, color: isActive ? d.color : T.inkFaint, letterSpacing: '0.1em', fontWeight: isActive ? 700 : 400 }}>{d.label}</span>
                  <span
                    onMouseEnter={(e) => { e.stopPropagation(); setTip(d.key); }}
                    onMouseLeave={() => setTip(null)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 8.5, color: T.inkFaint, border: `1px solid ${T.border}`, borderRadius: '50%', width: 13, height: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', flexShrink: 0, lineHeight: 1 }}
                  >?</span>
                  {tip === d.key && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 99, background: T.surface, border: `1px solid ${T.border}`, padding: '8px 10px', fontSize: 9.5, color: T.inkDim, lineHeight: 1.7, whiteSpace: 'pre', minWidth: 220, marginTop: 4, pointerEvents: 'none' }}>
                      {SCORE_TOOLTIPS[d.key]}
                    </div>
                  )}
                </div>
                {isRisk ? (
                  <span style={{ fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontWeight: 700, color: flagCount === 0 ? T.green : flagCount <= 2 ? T.yellow : T.red }}>{flagCount}</span>
                    <span style={{ color: T.inkFaint, fontWeight: 400 }}>/{flagMax} flags</span>
                    <span style={{ color: T.inkFaint, fontWeight: 400, fontSize: 10.5, marginLeft: 6 }}>{w}%</span>
                  </span>
                ) : (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: d.color, fontVariantNumeric: 'tabular-nums' }}>
                    {Number.isFinite(v) ? v : '–'} <span style={{ color: T.inkFaint, fontWeight: 400 }}>/ 100</span>
                    <span style={{ color: T.inkFaint, fontWeight: 400, fontSize: 10.5, marginLeft: 6 }}>{w}%</span>
                  </span>
                )}
              </div>
              <ScoreBar pct={Number.isFinite(v) ? v : 0} color={d.color} height={5}/>
            </div>
          );
        })}
        {Number.isFinite(scores.piotroskiScore) && (() => {
          const pio = scores.piotroskiScore;
          const pioColor = pio >= 6 ? T.green : pio >= 4 ? T.yellow : T.red;
          return (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8, marginTop: 2, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 9.5, color: T.inkFaint, letterSpacing: '0.1em' }}>PIOTROSKI F</span>
                  <span
                    onMouseEnter={(e) => { e.stopPropagation(); setTip('piotroski'); }}
                    onMouseLeave={() => setTip(null)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 8.5, color: T.inkFaint, border: `1px solid ${T.border}`, borderRadius: '50%', width: 13, height: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', flexShrink: 0, lineHeight: 1 }}
                  >?</span>
                  {tip === 'piotroski' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 99, background: T.surface, border: `1px solid ${T.border}`, padding: '8px 10px', fontSize: 9.5, color: T.inkDim, lineHeight: 1.7, whiteSpace: 'pre', minWidth: 220, marginTop: 4, pointerEvents: 'none' }}>
                      {SCORE_TOOLTIPS.piotroski}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: pioColor }}>
                  {pio}<span style={{ color: T.inkFaint, fontWeight: 400 }}>/7 · {pio >= 6 ? 'STRONG' : pio >= 4 ? 'NEUTRAL' : 'WEAK'}</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(scores.piotroskiSignals || []).map(sig => (
                  <span key={sig} style={{ fontSize: 8, color: T.green, border: `1px solid ${T.green}40`, padding: '1px 5px', letterSpacing: '0.04em' }}>{sig}</span>
                ))}
              </div>
            </div>
          );
        })()}
        {activeDim && (
          <div style={{ fontSize: 10, color: T.inkFaint, textAlign: 'center', marginTop: 2 }}>클릭하면 필터 해제</div>
        )}
      </div>
    </Cell>
  );
}

// ─── Phase 13: Quant Script Engine (AST, eval-free) ──────────────────────────
function qsTokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }
    if (/\d/.test(src[i]) || (src[i] === '-' && /\d/.test(src[i+1] || '') &&
        (!tokens.length || ['OP','AND','OR','NOT','LPAREN'].includes(tokens[tokens.length-1].t)))) {
      let n = src[i] === '-' ? (i++, '-') : '';
      while (i < src.length && /[\d.]/.test(src[i])) n += src[i++];
      tokens.push({ t: 'NUM', v: parseFloat(n) }); continue;
    }
    if (/[a-zA-Z_]/.test(src[i])) {
      let w = '';
      while (i < src.length && /[a-zA-Z_0-9]/.test(src[i])) w += src[i++];
      const kw = { and: 'AND', or: 'OR', not: 'NOT', AND: 'AND', OR: 'OR', NOT: 'NOT' }[w];
      tokens.push(kw ? { t: kw } : { t: 'ID', v: w }); continue;
    }
    if (src.startsWith('<=', i)) { tokens.push({ t: 'OP', v: '<=' }); i += 2; continue; }
    if (src.startsWith('>=', i)) { tokens.push({ t: 'OP', v: '>=' }); i += 2; continue; }
    if (src.startsWith('!=', i)) { tokens.push({ t: 'OP', v: '!=' }); i += 2; continue; }
    if (src.startsWith('==', i)) { tokens.push({ t: 'OP', v: '==' }); i += 2; continue; }
    if (src.startsWith('&&', i)) { tokens.push({ t: 'AND' }); i += 2; continue; }
    if (src.startsWith('||', i)) { tokens.push({ t: 'OR' }); i += 2; continue; }
    const m = { '<': 'OP', '>': 'OP', '(': 'LPAREN', ')': 'RPAREN', '!': 'NOT' }[src[i]];
    if (m) tokens.push(m === 'OP' ? { t: 'OP', v: src[i] } : { t: m });
    i++;
  }
  return tokens;
}

function qsParse(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const eat  = () => tokens[p++];
  const parseOr  = () => { let l = parseAnd(); while (peek()?.t === 'OR')  { eat(); l = { t: 'OR',  l, r: parseAnd() }; } return l; };
  const parseAnd = () => { let l = parseNot(); while (peek()?.t === 'AND') { eat(); l = { t: 'AND', l, r: parseNot() }; } return l; };
  const parseNot = () => { if (peek()?.t === 'NOT') { eat(); return { t: 'NOT', e: parseCmp() }; } return parseCmp(); };
  const parseCmp = () => { const l = parseAtom(); if (peek()?.t === 'OP') { const op = eat().v; return { t: 'CMP', op, l, r: parseAtom() }; } return l; };
  const parseAtom = () => {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of input');
    if (tok.t === 'NUM')   { eat(); return { t: 'NUM', v: tok.v }; }
    if (tok.t === 'ID')    { eat(); return { t: 'ID',  v: tok.v }; }
    if (tok.t === 'LPAREN') { eat(); const e = parseOr(); if (peek()?.t !== 'RPAREN') throw new Error('Missing )'); eat(); return e; }
    throw new Error(`Unexpected token: ${tok.t}`);
  };
  return parseOr();
}

const QS_FIELDS = {
  per: s => s.metrics?.per, pbr: s => s.metrics?.pbr, roe: s => s.metrics?.roe,
  opMargin: s => s.metrics?.opMargin, fcfMargin: s => s.metrics?.fcfMargin,
  debtRatio: s => s.metrics?.debtRatio, currentRatio: s => s.metrics?.currentRatio,
  revGrowth: s => s.metrics?.revGrowth, epsGrowth: s => s.metrics?.epsGrowth,
  netMargin: s => s.metrics?.netMargin, opIncomeGrowth: s => s.metrics?.opIncomeGrowth,
  evEbitda: s => s.metrics?.evEbitda,
  score: s => s.scores?.overall, piotroski: s => s.scores?.piotroski, price: s => s.price,
};

function qsEval(node, stock) {
  switch (node.t) {
    case 'NUM': return node.v;
    case 'ID': { const fn = QS_FIELDS[node.v]; if (!fn) throw new Error(`Unknown field: ${node.v}`); const v = fn(stock); return (v != null && Number.isFinite(Number(v))) ? Number(v) : null; }
    case 'CMP': { const l = qsEval(node.l, stock), r = qsEval(node.r, stock); if (l == null || r == null) return false; return node.op==='<'?l<r:node.op==='>'?l>r:node.op==='<='?l<=r:node.op==='>='?l>=r:node.op==='=='?l===r:l!==r; }
    case 'AND': return !!qsEval(node.l, stock) && !!qsEval(node.r, stock);
    case 'OR':  return !!qsEval(node.l, stock) || !!qsEval(node.r, stock);
    case 'NOT': return !qsEval(node.e, stock);
    default: return false;
  }
}
function qsRun(src, stock) { try { return qsEval(qsParse(qsTokenize(src.trim())), stock) === true; } catch { return false; } }

function ScriptPanel({ stocks, watchlistIds }) {
  const EXAMPLES = [
    { label: 'Quality Value',    code: 'per < 15 and roe > 20 and debtRatio < 100' },
    { label: 'Growth',          code: 'revGrowth > 15 and epsGrowth > 10 and opMargin > 10' },
    { label: 'Safe Compounder', code: 'score > 60 and debtRatio < 80 and fcfMargin > 5' },
    { label: 'Deep Value',      code: 'per < 10 and pbr < 1 and currentRatio > 150' },
  ];
  const [code, setCode]       = useState(EXAMPLES[0].code);
  const [error, setError]     = useState('');
  const [results, setResults] = useState(null);

  const run = () => {
    if (!code.trim()) { setResults(null); return; }
    try { qsParse(qsTokenize(code.trim())); setError(''); } catch (e) { setError(e.message); return; }
    const matched = watchlistIds.map(id => stocks[id]).filter(Boolean).filter(s => qsRun(code, s));
    setResults(matched);
  };

  const thSt = { padding: '5px 8px', color: T.inkFaint, fontSize: 10.5, letterSpacing: '0.08em', textAlign: 'left', borderBottom: `1px solid ${T.border}`, fontWeight: 600 };
  const tdSt = { padding: '5px 8px', fontSize: 11, borderBottom: `1px solid ${T.borderSoft}` };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
      <Cell label="SCRIPT FILTER — 조건식으로 워치리스트 종목 필터링 (eval 없는 AST 인터프리터)" accent={T.cyan}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {EXAMPLES.map(ex => (
            <button key={ex.label} onClick={() => { setCode(ex.code); setError(''); setResults(null); }}
              style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkDim, fontFamily: T.font, fontSize: 9, padding: '3px 8px', borderRadius: 3, cursor: 'pointer' }}>
              {ex.label}
            </button>
          ))}
        </div>
        <textarea value={code} onChange={e => { setCode(e.target.value); setError(''); setResults(null); }}
          spellCheck={false}
          style={{ width: '100%', minHeight: 72, background: '#060d1a', border: `1px solid ${error ? T.red : T.border}`, color: '#4ade80', fontFamily: 'monospace', fontSize: 13, padding: '10px 12px', borderRadius: 4, resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5 }}/>
        {error && <div style={{ color: T.red, fontSize: 10, marginTop: 4 }}>구문 오류: {error}</div>}
        <div style={{ fontSize: 10, color: T.inkFaint, marginTop: 6, lineHeight: 1.9 }}>
          <span style={{ color: T.amber }}>필드</span>: per · pbr · roe · opMargin · fcfMargin · debtRatio · currentRatio · revGrowth · epsGrowth · netMargin · evEbitda · score · piotroski · price
          {'  '}
          <span style={{ color: T.amber }}>연산자</span>: {'<  >  <=  >=  ==  !=  and (&&)  or (||)  not (!)  ( )'}
        </div>
        <button onClick={run}
          style={{ marginTop: 8, background: 'transparent', border: `1px solid ${T.cyan}`, color: T.cyan, fontFamily: T.font, fontSize: 10, padding: '5px 18px', borderRadius: 3, cursor: 'pointer', letterSpacing: '0.08em' }}>
          ▶ RUN
        </button>
      </Cell>

      {results !== null && (
        <Cell label={`RESULTS — ${results.length} / ${watchlistIds.length}개 매칭`} accent={T.amber}>
          {results.length === 0 ? (
            <div style={{ color: T.inkFaint, fontSize: 11, padding: 8 }}>조건에 맞는 종목 없음</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['SYMBOL','NAME','PER','PBR','ROE %','FCF Mgn %','D/E %','Rev G %','SCORE'].map(h => <th key={h} style={thSt}>{h}</th>)}
              </tr></thead>
              <tbody>
                {results.map(s => {
                  const m = s.metrics || {};
                  const f = v => (v != null && Number.isFinite(Number(v))) ? Number(v).toFixed(1) : '–';
                  return (
                    <tr key={s.id}>
                      <td style={{ ...tdSt, color: T.amber, fontWeight: 700 }}>{s.symbol}</td>
                      <td style={{ ...tdSt, color: T.ink, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</td>
                      <td style={{ ...tdSt, color: T.inkDim }}>{f(m.per)}</td>
                      <td style={{ ...tdSt, color: T.inkDim }}>{f(m.pbr)}</td>
                      <td style={{ ...tdSt, color: Number(m.roe) > 15 ? T.green : T.inkDim }}>{f(m.roe)}</td>
                      <td style={{ ...tdSt, color: Number(m.fcfMargin) > 5 ? T.green : T.inkDim }}>{f(m.fcfMargin)}</td>
                      <td style={{ ...tdSt, color: Number(m.debtRatio) > 200 ? T.red : T.inkDim }}>{f(m.debtRatio)}</td>
                      <td style={{ ...tdSt, color: Number(m.revGrowth) > 0 ? T.green : T.red }}>{f(m.revGrowth)}</td>
                      <td style={{ ...tdSt, color: T.amber, fontWeight: 600 }}>{Number.isFinite(s.scores?.overall) ? `${Math.round(s.scores.overall)}pt` : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Cell>
      )}
    </div>
  );
}

// ─── Phase 9: Local AI — Ollama + WebLLM ─────────────────────────────────────
const LLM_MODELS = [
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B (1.8GB, 빠름)' },
  { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',  label: 'Qwen 2.5 7B (4GB, 정확도↑)' },
];
const OLLAMA_MODELS = [
  { id: 'llama3.1:8b',  label: 'Llama 3.1 8B (권장, ~5GB VRAM)' },
  { id: 'mistral',      label: 'Mistral 7B (~4.5GB VRAM)' },
  { id: 'phi4-mini',    label: 'Phi-4 Mini (~3GB VRAM, 코딩 강점)' },
  { id: 'gemma2:9b',    label: 'Gemma 2 9B (~5.5GB VRAM)' },
  { id: 'qwen2.5:7b',   label: 'Qwen 2.5 7B (~4.5GB VRAM)' },
];

function AIPanel({ stock }) {
  const [backend, setBackend]       = useState('ollama');

  // WebLLM state
  const [engine, setEngine]         = useState(null);
  const [webllmLoading, setWebllmLoading] = useState(false);
  const [progress, setProgress]     = useState('');
  const [modelId, setModelId]       = useState(LLM_MODELS[0].id);

  // Ollama state
  const [ollamaUrl, setOllamaUrl]   = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3.1:8b');
  const [ollamaReady, setOllamaReady] = useState(false);
  const [ollamaError, setOllamaError] = useState('');
  const [ollamaTesting, setOllamaTesting] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);

  // Shared state
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [generating, setGenerating] = useState(false);

  const gpuSupported = typeof navigator !== 'undefined' && !!navigator.gpu;
  const isReady = backend === 'webllm' ? !!engine : ollamaReady;

  const sysPrompt = () => {
    const m = stock.metrics || {};
    const f = (v, u = '') => (v != null && Number.isFinite(Number(v))) ? `${Number(v).toFixed(2)}${u}` : 'N/A';
    return `당신은 주식 투자 분석 AI입니다. 로컬에서 실행됩니다.
현재 종목: ${stock.symbol} (${stock.name}, ${stock.currency}, 가격: ${f(stock.price)})
PER ${f(m.per,'x')} | PBR ${f(m.pbr,'x')} | ROE ${f(m.roe,'%')} | FCF마진 ${f(m.fcfMargin,'%')} | 부채비율 ${f(m.debtRatio,'%')} | 매출성장 ${f(m.revGrowth,'%')} | 퀀트스코어 ${stock.scores?.overall != null ? Math.round(stock.scores.overall)+'pt' : 'N/A'}
투자논거: ${stock.thesis || stock.oneLine || '없음'}
한국어로 간결하고 정확하게 답변하세요.`;
  };

  // localhost:* → 로컬 프록시 경유 (CORS 우회), 그 외 → 직접 접근
  const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const ollamaPath = (p) => isLocal ? `/api/ollama${p}` : `${ollamaUrl.replace(/\/$/, '')}${p}`;

  // ── Ollama: 연결 테스트 ──────────────────────────────────────────────────
  const testOllama = async () => {
    setOllamaTesting(true); setOllamaError(''); setOllamaReady(false);
    try {
      const res = await fetch(ollamaPath('/api/tags'), { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const names = (data.models || []).map(m => m.name);
      setAvailableModels(names);
      const exact = names.find(n => n === ollamaModel || n.startsWith(ollamaModel.split(':')[0] + ':'));
      if (!exact && names.length > 0) {
        setOllamaError(`"${ollamaModel}" 없음. 설치됨: ${names.slice(0,4).join(', ')}${names.length > 4 ? ` 외 ${names.length - 4}개` : ''}`);
      } else {
        setOllamaReady(true);
        setMessages([{ role: 'assistant', content: `Ollama (${ollamaModel}) 연결 완료.\n현재 종목: ${stock.symbol} (${stock.name})에 대해 질문하세요.` }]);
      }
    } catch (e) {
      const isOffline = e.message === 'Failed to fetch' || e.name === 'AbortError' || e.message.includes('fetch');
      setOllamaError(isOffline ? 'offline' : `오류: ${e.message}`);
    }
    setOllamaTesting(false);
  };

  // ── WebLLM: 모델 로드 ────────────────────────────────────────────────────
  const loadWebLLM = async () => {
    if (!gpuSupported) return;
    setWebllmLoading(true); setProgress('WebLLM ESM 모듈 로딩 중...');
    try {
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm');
      setProgress('모델 다운로드 중... (최초 1회, 이후 IndexedDB 캐시됨)');
      const eng = await CreateMLCEngine(modelId, {
        initProgressCallback: p => setProgress(typeof p === 'string' ? p : (p?.text || JSON.stringify(p))),
      });
      setEngine(eng); setProgress('');
      setMessages([{ role: 'assistant', content: `${LLM_MODELS.find(m => m.id === modelId)?.label} 준비 완료.\n${stock.symbol} (${stock.name})에 대해 질문하세요.` }]);
    } catch (e) { setProgress(`오류: ${e.message}`); }
    setWebllmLoading(false);
  };

  // ── 공통 전송 ────────────────────────────────────────────────────────────
  const send = async (userMsg) => {
    const msg = (userMsg || input).trim();
    if (!msg || generating || !isReady) return;
    setInput('');
    const history = [...messages, { role: 'user', content: msg }];
    setMessages(history);
    setGenerating(true);
    try {
      let content;
      const sys = { role: 'system', content: sysPrompt() };
      if (backend === 'webllm' && engine) {
        const res = await engine.chat.completions.create({
          messages: [sys, ...history], temperature: 0.7, max_tokens: 512,
        });
        content = res.choices?.[0]?.message?.content || '응답 없음';
      } else {
        const res = await fetch(ollamaPath('/v1/chat/completions'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            messages: [sys, ...history],
            stream: false,
            options: { temperature: 0.7, num_predict: 512 },
          }),
        });
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
        const data = await res.json();
        content = data.choices?.[0]?.message?.content || '응답 없음';
      }
      setMessages(prev => [...prev, { role: 'assistant', content }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `오류: ${e.message}` }]);
    }
    setGenerating(false);
  };

  const QUICK = [
    { label: '리스크 분석',        msg: `${stock.symbol}의 투자 리스크 3가지를 분석해줘.` },
    { label: 'Pre-mortem 반대논거', msg: `${stock.symbol} 투자 thesis가 틀릴 수 있는 시나리오를 제시해줘.` },
    { label: '지표 종합 해석',     msg: `${stock.symbol}의 재무지표를 종합적으로 해석하고 투자 매력도를 평가해줘.` },
    { label: '한줄 요약',          msg: `${stock.symbol}을 투자자 관점에서 한 문장으로 요약해줘.` },
  ];

  const inSt = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink, fontFamily: T.font, fontSize: 11, padding: '7px 10px', borderRadius: 3, flex: 1, outline: 'none' };
  const tabBtn = (active) => ({
    background: active ? `${T.cyan}18` : 'transparent',
    border: 'none', borderBottom: `2px solid ${active ? T.cyan : 'transparent'}`,
    color: active ? T.cyan : T.inkFaint, fontFamily: T.font, fontSize: 11,
    fontWeight: active ? 700 : 400, padding: '5px 14px', cursor: 'pointer', letterSpacing: '0.08em',
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Backend selector */}
      <Cell label="LOCAL AI — 데이터 외부 전송 없음 · 완전 무료" accent={T.cyan}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, marginBottom: 10 }}>
          <button style={tabBtn(backend === 'ollama')} onClick={() => setBackend('ollama')}>Ollama (권장)</button>
          <button style={tabBtn(backend === 'webllm')} onClick={() => setBackend('webllm')}>WebLLM (브라우저)</button>
        </div>

        {/* ── Ollama setup ── */}
        {backend === 'ollama' && !ollamaReady && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10, color: T.inkFaint, lineHeight: 1.7 }}>
              Ollama 설치 후 <span style={{ color: T.cyan, fontFamily: 'monospace' }}>ollama serve</span> 를 실행하세요.
              그 다음 원하는 모델을 다운로드: <span style={{ color: T.amber, fontFamily: 'monospace' }}>ollama pull llama3.1:8b</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                style={{ ...inSt, flex: '0 0 200px', fontSize: 11 }}/>
              <select value={ollamaModel} onChange={e => setOllamaModel(e.target.value)}
                style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink, fontFamily: T.font, fontSize: 11, padding: '7px 8px', borderRadius: 3 }}>
                {OLLAMA_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                {availableModels.filter(n => !OLLAMA_MODELS.find(m => n.startsWith(m.id.split(':')[0]))).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <button onClick={testOllama} disabled={ollamaTesting}
                style={{ background: 'transparent', border: `1px solid ${T.cyan}`, color: T.cyan, fontFamily: T.font, fontSize: 11, padding: '6px 16px', borderRadius: 3, cursor: 'pointer', letterSpacing: '0.08em' }}>
                {ollamaTesting ? '연결 중...' : '연결 테스트'}
              </button>
            </div>
            {ollamaError && (
              ollamaError === 'offline' ? (
                <div style={{ background: `${T.yellow}15`, border: `1px solid ${T.yellow}44`, borderRadius: 3, padding: '8px 12px', lineHeight: 1.8 }}>
                  <div style={{ fontSize: 11, color: T.yellow, fontWeight: 700, marginBottom: 4 }}>⚠ Ollama가 꺼져 있습니다</div>
                  <div style={{ fontSize: 10, color: T.inkDim }}>
                    시작 메뉴에서 <span style={{ color: T.amber, fontFamily: 'monospace' }}>Ollama</span> 를 검색해 실행하세요.
                  </div>
                  <div style={{ fontSize: 10, color: T.inkFaint, marginTop: 4 }}>
                    또는 터미널에서: <span style={{ fontFamily: 'monospace', color: T.cyan }}>ollama serve</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 10, color: T.red, whiteSpace: 'pre-line', lineHeight: 1.6 }}>{ollamaError}</div>
              )
            )}
            <div style={{ fontSize: 10, color: T.inkFaint, lineHeight: 1.7, borderTop: `1px solid ${T.border}`, paddingTop: 6 }}>
              <span style={{ color: T.inkDim }}>설치 방법</span> → <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" style={{ color: T.cyan }}>ollama.com/download</a>
              {'  '}|{'  '}
              <span style={{ fontFamily: 'monospace', color: T.amber }}>ollama run llama3.1:8b</span> (자동 다운로드+실행)
            </div>
          </div>
        )}
        {backend === 'ollama' && ollamaReady && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: T.green, fontSize: 11 }}>● Ollama ({ollamaModel}) 연결됨</span>
            <button onClick={() => { setOllamaReady(false); setMessages([]); }}
              style={{ background: 'transparent', border: `1px solid ${T.border}`, color: T.inkFaint, fontFamily: T.font, fontSize: 10, padding: '3px 10px', borderRadius: 3, cursor: 'pointer' }}>
              재설정
            </button>
          </div>
        )}

        {/* ── WebLLM setup ── */}
        {backend === 'webllm' && !engine && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!gpuSupported && (
              <div style={{ color: T.red, fontSize: 11 }}>WebGPU 미지원 브라우저. Chrome 113+ 사용 필요.</div>
            )}
            <div style={{ fontSize: 10, color: T.inkFaint, lineHeight: 1.7 }}>
              브라우저 내 WebGPU로 실행. 최초 1회 모델 다운로드 후 IndexedDB 캐시. Ollama보다 느림.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={modelId} onChange={e => setModelId(e.target.value)}
                style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink, fontFamily: T.font, fontSize: 11, padding: '5px 8px', borderRadius: 3 }}>
                {LLM_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <button onClick={loadWebLLM} disabled={webllmLoading || !gpuSupported}
                style={{ background: 'transparent', border: `1px solid ${T.cyan}`, color: T.cyan, fontFamily: T.font, fontSize: 11, padding: '6px 16px', borderRadius: 3, cursor: 'pointer', letterSpacing: '0.08em' }}>
                {webllmLoading ? 'LOADING...' : '↻ 모델 로드'}
              </button>
            </div>
            {progress && <div style={{ fontSize: 10, color: T.inkFaint, wordBreak: 'break-all' }}>{progress}</div>}
          </div>
        )}
        {backend === 'webllm' && engine && (
          <div style={{ color: T.green, fontSize: 11 }}>● {LLM_MODELS.find(m => m.id === modelId)?.label} 준비 완료</div>
        )}
      </Cell>

      {/* ── Chat area (공통) ── */}
      {isReady && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
            {QUICK.map(q => (
              <button key={q.label} onClick={() => send(q.msg)} disabled={generating}
                style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkDim, fontFamily: T.font, fontSize: 10, padding: '4px 10px', borderRadius: 3, cursor: 'pointer', letterSpacing: '0.06em' }}>
                {q.label}
              </button>
            ))}
          </div>
          <Cell label={`AI CHAT · ${stock.symbol}`} accent={T.amber} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8, minHeight: 0 }}>
              {messages.map((m, i) => (
                <div key={i} style={{
                  background: m.role === 'user' ? `${T.amber}14` : T.surface,
                  border: `1px solid ${m.role === 'user' ? T.amber + '50' : T.border}`,
                  borderRadius: 4, padding: '8px 12px', fontSize: 11, color: T.ink, lineHeight: 1.65,
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%',
                  whiteSpace: 'pre-wrap',
                }}>
                  <span style={{ fontSize: 10, color: m.role === 'user' ? T.amber : T.cyan, fontWeight: 700, marginRight: 6 }}>
                    {m.role === 'user' ? 'YOU' : 'AI'}
                  </span>
                  {m.content}
                </div>
              ))}
              {generating && <div style={{ color: T.inkFaint, fontSize: 10, padding: '4px 0' }}>생성 중...</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="질문을 입력하세요 (Enter로 전송)"
                style={inSt}/>
              <button onClick={() => send()} disabled={generating || !input.trim()}
                style={{ background: 'transparent', border: `1px solid ${T.amber}`, color: T.amber, fontFamily: T.font, fontSize: 11, padding: '0 14px', borderRadius: 3, cursor: 'pointer', letterSpacing: '0.08em' }}>
                SEND
              </button>
            </div>
          </Cell>
        </>
      )}
    </div>
  );
}

// ─── Phase 15: Share & Export helpers ────────────────────────────────────────
function generateShareUrl(stock) {
  const payload = {
    symbol: stock.symbol, name: stock.name, currency: stock.currency, flag: stock.flag,
    oneLine: stock.oneLine, recommendation: stock.recommendation,
    thesis: stock.thesis, catalysts: stock.catalysts, risks: stock.risks,
    preMortem: stock.preMortem, valuation: stock.valuation,
    metrics: stock.metrics, scores: stock.scores, price: stock.price,
  };
  try { return `${location.origin}${location.pathname}?share=${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}`; }
  catch { return null; }
}

function downloadTextReport(stock) {
  const m = stock.metrics || {};
  const f = (v, d = 1, u = '') => (v != null && Number.isFinite(Number(v))) ? `${Number(v).toFixed(d)}${u}` : 'N/A';
  const line = s => s;
  const section = t => [``, `[${t}]`];
  const listItems = arr => Array.isArray(arr) && arr.length
    ? arr.map((x, i) => `  ${i+1}. ${typeof x === 'string' ? x : x.text || ''}`)
    : ['  (없음)'];
  const lines = [
    `INVESTMENT THESIS REPORT — ${stock.symbol}`,
    `Generated: ${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR')}`,
    '='.repeat(60),
    ...section('OVERVIEW'),
    `  Symbol   : ${stock.symbol}`,
    `  Name     : ${stock.name}`,
    `  Currency : ${stock.currency}  Price: ${f(stock.price,2)}`,
    `  Rating   : ${stock.recommendation || '–'}`,
    `  One-liner: ${stock.oneLine || '–'}`,
    ...section('KEY METRICS'),
    `  PER ${f(m.per,1,'x')}  PBR ${f(m.pbr,1,'x')}  ROE ${f(m.roe,1,'%')}  OP Margin ${f(m.opMargin,1,'%')}`,
    `  FCF Margin ${f(m.fcfMargin,1,'%')}  Debt/Eq ${f(m.debtRatio,1,'%')}  Cur Ratio ${f(m.currentRatio,1,'%')}`,
    `  Rev Growth ${f(m.revGrowth,1,'%')}  EPS Growth ${f(m.epsGrowth,1,'%')}  EV/EBITDA ${f(m.evEbitda,1,'x')}`,
    `  Quant Score: ${stock.scores?.overall != null ? Math.round(stock.scores.overall)+'pt' : 'N/A'}`,
    ...section('THESIS'),
    ...(stock.thesis ? stock.thesis.split('\n').map(l => `  ${l}`) : ['  (없음)']),
    ...section('CATALYSTS'),
    ...listItems(stock.catalysts),
    ...section('RISKS'),
    ...listItems(stock.risks),
    ...section('VALUATION'),
    `  Bear: ${stock.valuation?.bear?.price || '–'} / Base: ${stock.valuation?.base?.price || '–'} / Bull: ${stock.valuation?.bull?.price || '–'}`,
    ``, '='.repeat(60), `ThesisTrack Terminal — https://github.com/leebin109/ThesisTracker`,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${stock.symbol}_thesis_${new Date().toISOString().slice(0,10)}.txt` });
  a.click(); URL.revokeObjectURL(a.href);
}

function ShareViewer({ data, onClose }) {
  const m = data.metrics || {};
  const f = (v, d = 1, u = '') => (v != null && Number.isFinite(Number(v))) ? `${Number(v).toFixed(d)}${u}` : '–';
  const { recLabel } = window;
  const rec = { text: data.recommendation || '–', color: T.inkFaint };
  const ovSt = { position: 'fixed', inset: 0, background: '#000c', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
  const boxSt = { background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, width: '100%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto', padding: 28, fontFamily: T.font };
  const tagSt = { display: 'inline-block', background: `${T.amber}20`, border: `1px solid ${T.amber}40`, color: T.amber, fontSize: 9, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em', marginBottom: 8 };
  return (
    <div style={ovSt} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={boxSt}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={tagSt}>READ-ONLY SHARED REPORT</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.amber }}>{data.symbol}</div>
            <div style={{ fontSize: 13, color: T.inkDim }}>{data.name} · {data.currency} {f(data.price,2)}</div>
            <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 4 }}>{data.oneLine}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: T.inkFaint, fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 16 }}>
          {[['PER',f(m.per,1,'x')],['PBR',f(m.pbr,1,'x')],['ROE',f(m.roe,1,'%')],['FCF Mgn',f(m.fcfMargin,1,'%')],['Score',data.scores?.overall!=null?Math.round(data.scores.overall)+'pt':'–']].map(([k,v])=>(
            <div key={k} style={{ background: T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:'8px 10px' }}>
              <div style={{ fontSize:9, color:T.inkFaint, marginBottom:3 }}>{k}</div>
              <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>{v}</div>
            </div>
          ))}
        </div>
        {data.thesis && <><div style={{ fontSize:10, color:T.amber, fontWeight:700, marginBottom:6 }}>THESIS</div><div style={{ fontSize:11, color:T.inkDim, lineHeight:1.7, marginBottom:16, whiteSpace:'pre-wrap' }}>{data.thesis}</div></>}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {[['CATALYSTS', data.catalysts],['RISKS', data.risks]].map(([title, arr])=>(
            <div key={title}>
              <div style={{ fontSize:10, color:title==='CATALYSTS'?T.green:T.red, fontWeight:700, marginBottom:6 }}>{title}</div>
              {Array.isArray(arr)&&arr.length ? arr.map((x,i)=><div key={i} style={{ fontSize:11, color:T.inkDim, marginBottom:4 }}>• {typeof x==='string'?x:x.text||''}</div>) : <div style={{ fontSize:11, color:T.inkFaint }}>없음</div>}
            </div>
          ))}
        </div>
        <div style={{ marginTop:16, fontSize:9, color:T.inkFaint, borderTop:`1px solid ${T.border}`, paddingTop:10 }}>ThesisTrack Terminal — 읽기 전용 공유 리포트</div>
      </div>
    </div>
  );
}

// ─── Macro Correlation (F12) ──────────────────────────────────────────────────
const MACRO_TICKERS = [
  { sym: '^GSPC', label: 'S&P 500' },
  { sym: '^TNX',  label: 'US 10Y' },
  { sym: '^VIX',  label: 'VIX' },
  { sym: 'CL=F',  label: 'WTI 유가' },
  { sym: 'DX-Y.NYB', label: 'DXY 달러' },
];

function pearsonCorr(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 4) return null;
  const ax = x.slice(0, n), ay = y.slice(0, n);
  const mx = ax.reduce((s, v) => s + v, 0) / n;
  const my = ay.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) { const xi = ax[i] - mx, yi = ay[i] - my; num += xi * yi; dx2 += xi * xi; dy2 += yi * yi; }
  const denom = Math.sqrt(dx2 * dy2);
  return denom < 1e-10 ? 0 : Math.round(num / denom * 1000) / 1000;
}

function weeklyReturns(closes) {
  const r = [];
  for (let i = 1; i < closes.length; i++) if (closes[i - 1] > 0) r.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  return r;
}

function ToolsPanel({ stock, stocks, watchlistIds }) {
  const [tab, setTab] = useState('MACRO');
  const tabs = ['MACRO', 'AI'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              background: tab === t ? `${T.amber}18` : 'transparent',
              border: 'none', borderBottom: `2px solid ${tab === t ? T.amber : 'transparent'}`,
              color: tab === t ? T.amber : T.inkFaint, fontFamily: T.font, fontSize: 12,
              fontWeight: tab === t ? 700 : 500, letterSpacing: '0.1em',
              padding: '6px 16px', cursor: 'pointer',
            }}>{t}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'MACRO' && <MacroPanel stock={stock} stocks={stocks} watchlistIds={watchlistIds}/>}
        {tab === 'AI'    && <AIPanel stock={stock}/>}
      </div>
    </div>
  );
}

function MacroPanel({ stock, stocks, watchlistIds }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [stress, setStress]   = useState({ sym: '^GSPC', delta: 10 });

  const fetchAll = async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const yahooSym = toYahooSymbol(stock);
      const [stockRes, ...macroResults] = await Promise.allSettled([
        fetchYahooChartOhlc(yahooSym, '1y', '1wk'),
        ...MACRO_TICKERS.map(m => fetchYahooChartOhlc(m.sym, '1y', '1wk')),
      ]);
      if (stockRes.status === 'rejected') throw new Error(`${stock.symbol} 차트 실패: ${stockRes.reason?.message}`);
      const stockCloses = stockRes.value.map(c => c.close);
      const stockRets   = weeklyReturns(stockCloses);
      const macros = MACRO_TICKERS.map((m, i) => {
        const res = macroResults[i];
        if (res.status === 'rejected' || !res.value?.length) return { ...m, corr: null, rets: [] };
        const mCloses = res.value.map(c => c.close);
        const mRets   = weeklyReturns(mCloses);
        const minLen  = Math.min(stockRets.length, mRets.length);
        const corr    = pearsonCorr(stockRets.slice(0, minLen), mRets.slice(0, minLen));
        return { ...m, corr, rets: mRets, volatility: mRets.length > 1 ? Math.sqrt(mRets.reduce((s, r) => s + r * r, 0) / mRets.length) : 0 };
      });
      const stockVol = stockRets.length > 1 ? Math.sqrt(stockRets.reduce((s, r) => s + r * r, 0) / stockRets.length) : 0;
      setData({ macros, stockVol, stockRets });
    } catch (e) { setError(e.message || '데이터 로드 실패'); }
    finally { setLoading(false); }
  };

  const corrColor = (r) => {
    if (r == null) return T.inkFaint;
    if (r > 0.5) return T.green;
    if (r > 0.2) return '#86efac';
    if (r < -0.5) return T.red;
    if (r < -0.2) return '#fca5a5';
    return T.inkDim;
  };

  const stressImpact = useMemo(() => {
    if (!data) return null;
    const macro = data.macros.find(m => m.sym === stress.sym);
    if (!macro || macro.corr == null || macro.volatility === 0) return null;
    const deltaFrac = stress.delta / 100;
    const macroSd   = macro.volatility;
    const stockSd   = data.stockVol;
    const impact    = macro.corr * (deltaFrac / macroSd) * stockSd * 100;
    return Math.round(impact * 100) / 100;
  }, [data, stress]);

  const thSt = { padding: '5px 10px', color: T.inkFaint, fontSize: 10.5, letterSpacing: '0.08em', textAlign: 'left', borderBottom: `1px solid ${T.border}`, fontWeight: 600 };
  const tdSt = { padding: '6px 10px', fontSize: 11, borderBottom: `1px solid ${T.borderSoft}` };
  const inSt = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink, fontFamily: T.font, fontSize: 11, padding: '4px 7px', borderRadius: 3 };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
      <Cell label={`MACRO CORRELATION · ${stock.symbol} vs 글로벌 매크로 (1Y 주간 수익률 기준)`} accent={T.cyan}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={fetchAll} disabled={loading}
            style={{ background: 'transparent', border: `1px solid ${T.cyan}`, color: T.cyan, fontFamily: T.font, fontSize: 10, padding: '5px 14px', borderRadius: 3, cursor: loading ? 'wait' : 'pointer', letterSpacing: '0.08em' }}>
            {loading ? 'LOADING...' : '↻ LOAD DATA'}
          </button>
          {error && <span style={{ color: T.red, fontSize: 10 }}>{error}</span>}
          {!data && !loading && <span style={{ color: T.inkFaint, fontSize: 10 }}>버튼을 눌러 1년치 주간 데이터를 불러오세요.</span>}
        </div>
        {data && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
            <thead><tr>
              {['지표', '상관계수 (r)', '해석'].map(h => <th key={h} style={thSt}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.macros.map(m => {
                const r = m.corr;
                const interp = r == null ? '데이터 없음'
                  : r > 0.6 ? '강한 양의 상관 (함께 움직임)'
                  : r > 0.3 ? '보통 양의 상관'
                  : r < -0.6 ? '강한 음의 상관 (반대로 움직임)'
                  : r < -0.3 ? '보통 음의 상관'
                  : '상관 낮음';
                return (
                  <tr key={m.sym}>
                    <td style={{ ...tdSt, color: T.amber, fontWeight: 700 }}>{m.label}</td>
                    <td style={{ ...tdSt, color: corrColor(r), fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {r == null ? '–' : (r >= 0 ? '+' : '') + r.toFixed(3)}
                    </td>
                    <td style={{ ...tdSt, color: T.inkDim }}>{interp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Cell>

      {data && (
        <Cell label="STRESS TEST · 매크로 변화 시 예상 주가 영향" accent={T.amber}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: T.inkFaint, marginBottom: 3 }}>지표 선택</div>
              <select value={stress.sym} onChange={e => setStress(p => ({ ...p, sym: e.target.value }))} style={{ ...inSt }}>
                {data.macros.filter(m => m.corr != null).map(m => <option key={m.sym} value={m.sym}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: T.inkFaint, marginBottom: 3 }}>변화폭 (%)</div>
              <input type="range" min={-30} max={30} step={1} value={stress.delta} onChange={e => setStress(p => ({ ...p, delta: Number(e.target.value) }))} style={{ width: 140 }}/>
              <span style={{ fontSize: 11, color: T.ink, marginLeft: 8 }}>{stress.delta > 0 ? '+' : ''}{stress.delta}%</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: T.inkDim }}>{MACRO_TICKERS.find(m => m.sym === stress.sym)?.label} {stress.delta > 0 ? '+' : ''}{stress.delta}% 변화 시 {stock.symbol} 예상 영향:</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: stressImpact == null ? T.inkFaint : stressImpact >= 0 ? T.green : T.red }}>
              {stressImpact == null ? '–' : `${stressImpact >= 0 ? '+' : ''}${stressImpact.toFixed(2)}%`}
            </span>
          </div>
          <div style={{ fontSize: 10, color: T.inkFaint, marginTop: 6 }}>* 과거 상관관계 기반 통계적 추정치. 미래 수익률을 보장하지 않습니다.</div>
        </Cell>
      )}
    </div>
  );
}

// ─── Paper Trading (F11) ──────────────────────────────────────────────────────
function BacktestPanel({ stocks, watchlistIds, trades, onAddTrade, onDeleteTrade }) {
  const [form, setForm] = useState({ stockId: watchlistIds[0] || '', action: 'BUY', date: new Date().toISOString().slice(0,10), price: '', shares: '', note: '' });

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const inSt = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink, fontFamily: T.font, fontSize: 11, padding: '4px 7px', borderRadius: 3, width: '100%' };
  const btnSt = (col) => ({ background: 'transparent', border: `1px solid ${col}`, color: col, fontFamily: T.font, fontSize: 10, padding: '4px 12px', borderRadius: 3, cursor: 'pointer', letterSpacing: '0.08em' });

  const holdings = useMemo(() => {
    const map = {};
    [...trades].sort((a, b) => a.date < b.date ? -1 : 1).forEach(t => {
      if (!map[t.stockId]) map[t.stockId] = { stockId: t.stockId, symbol: t.stockId, name: t.name || t.stockId, shares: 0, totalCost: 0 };
      const h = map[t.stockId];
      if (t.action === 'BUY') { h.totalCost += t.price * t.shares; h.shares += t.shares; }
      else { const ratio = Math.min(t.shares, h.shares) / h.shares; h.totalCost *= (1 - ratio); h.shares = Math.max(0, h.shares - t.shares); }
    });
    return Object.values(map).filter(h => h.shares > 0.0001).map(h => {
      const cur = Number(stocks[h.stockId]?.price) || 0;
      const avgCost = h.shares > 0 ? h.totalCost / h.shares : 0;
      const curVal = cur * h.shares;
      const pl = curVal - h.totalCost;
      const plPct = h.totalCost > 0 ? (pl / h.totalCost) * 100 : 0;
      return { ...h, avgCost, curVal, pl, plPct, curPrice: cur };
    });
  }, [trades, stocks]);

  const totalCost = holdings.reduce((s, h) => s + h.totalCost, 0);
  const totalVal  = holdings.reduce((s, h) => s + h.curVal, 0);
  const totalPl   = totalVal - totalCost;
  const totalPlPct = totalCost > 0 ? (totalPl / totalCost) * 100 : 0;

  const handleSubmit = () => {
    const price = parseFloat(form.price);
    const shares = parseFloat(form.shares);
    if (!form.stockId || !price || !shares || !form.date) return;
    onAddTrade({ stockId: form.stockId, name: stocks[form.stockId]?.name || form.stockId, action: form.action, date: form.date, price, shares, note: form.note });
    setForm(p => ({ ...p, price: '', shares: '', note: '' }));
  };

  const thSt = { padding: '4px 8px', color: T.inkFaint, fontSize: 10.5, letterSpacing: '0.08em', textAlign: 'left', borderBottom: `1px solid ${T.border}`, fontWeight: 600 };
  const tdSt = { padding: '5px 8px', fontSize: 11, borderBottom: `1px solid ${T.borderSoft}` };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
      <Cell label="PAPER TRADING · 가상 거래 기록" accent={T.cyan}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 1fr auto', gap: 6, alignItems: 'end', padding: '0 0 8px' }}>
          <div>
            <div style={{ fontSize: 10, color: T.inkFaint, marginBottom: 3 }}>SYMBOL</div>
            <select value={form.stockId} onChange={e => setF('stockId', e.target.value)} style={{ ...inSt }}>
              {watchlistIds.map(id => <option key={id} value={id}>{stocks[id]?.symbol || id}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.inkFaint, marginBottom: 3 }}>ACTION</div>
            <select value={form.action} onChange={e => setF('action', e.target.value)} style={{ ...inSt }}>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.inkFaint, marginBottom: 3 }}>DATE</div>
            <input type="date" value={form.date} onChange={e => setF('date', e.target.value)} style={{ ...inSt }}/>
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.inkFaint, marginBottom: 3 }}>PRICE</div>
            <input type="number" value={form.price} onChange={e => setF('price', e.target.value)} style={{ ...inSt }} placeholder="0.00"/>
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.inkFaint, marginBottom: 3 }}>SHARES</div>
            <input type="number" value={form.shares} onChange={e => setF('shares', e.target.value)} style={{ ...inSt }} placeholder="0"/>
          </div>
          <button onClick={handleSubmit} style={btnSt(T.cyan)}>ADD</button>
        </div>
      </Cell>

      <Cell label="HOLDINGS · 현재 포지션" accent={T.amber}>
        {holdings.length === 0 ? (
          <div style={{ color: T.inkFaint, fontSize: 11, padding: 12 }}>거래 기록 없음</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr 1fr', marginBottom: 6 }}>
              <div style={{ padding: '4px 8px', color: T.amber, fontSize: 11, fontWeight: 700 }}>PORTFOLIO TOTAL</div>
              <div style={{ padding: '4px 8px', fontSize: 11, color: T.inkFaint }}>COST: {totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div style={{ padding: '4px 8px', fontSize: 11, color: T.inkFaint }}>VAL: {totalVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div style={{ padding: '4px 8px', fontSize: 12, fontWeight: 700, color: totalPl >= 0 ? T.green : T.red }}>
                {totalPl >= 0 ? '+' : ''}{totalPl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div style={{ padding: '4px 8px', fontSize: 12, fontWeight: 700, color: totalPlPct >= 0 ? T.green : T.red }}>
                {totalPlPct >= 0 ? '+' : ''}{totalPlPct.toFixed(2)}%
              </div>
              <div/>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['SYMBOL', 'SHARES', 'AVG COST', 'CUR PRICE', 'VALUE', 'P&L', 'P&L %'].map(h => <th key={h} style={thSt}>{h}</th>)}
              </tr></thead>
              <tbody>
                {holdings.map(h => (
                  <tr key={h.stockId}>
                    <td style={{ ...tdSt, color: T.amber, fontWeight: 700 }}>{h.symbol}</td>
                    <td style={{ ...tdSt, color: T.ink }}>{h.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td style={{ ...tdSt, color: T.inkDim }}>{h.avgCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td style={{ ...tdSt, color: T.inkDim }}>{h.curPrice > 0 ? h.curPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '–'}</td>
                    <td style={{ ...tdSt, color: T.ink }}>{h.curVal > 0 ? h.curVal.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '–'}</td>
                    <td style={{ ...tdSt, color: h.pl >= 0 ? T.green : T.red, fontWeight: 600 }}>{h.curVal > 0 ? `${h.pl >= 0 ? '+' : ''}${h.pl.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '–'}</td>
                    <td style={{ ...tdSt, color: h.plPct >= 0 ? T.green : T.red, fontWeight: 600 }}>{h.curVal > 0 ? `${h.plPct >= 0 ? '+' : ''}${h.plPct.toFixed(2)}%` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Cell>

      <Cell label="TRADE LOG · 거래 내역" accent={T.inkFaint}>
        {trades.length === 0 ? (
          <div style={{ color: T.inkFaint, fontSize: 11, padding: 12 }}>거래 내역 없음</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['DATE', 'ACTION', 'SYMBOL', 'PRICE', 'SHARES', 'TOTAL', ''].map(h => <th key={h} style={thSt}>{h}</th>)}
            </tr></thead>
            <tbody>
              {trades.map(t => (
                <tr key={t.id}>
                  <td style={{ ...tdSt, color: T.inkDim }}>{t.date}</td>
                  <td style={{ ...tdSt, color: t.action === 'BUY' ? T.green : T.red, fontWeight: 700 }}>{t.action}</td>
                  <td style={{ ...tdSt, color: T.amber }}>{t.stockId}</td>
                  <td style={{ ...tdSt, color: T.ink }}>{Number(t.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td style={{ ...tdSt, color: T.ink }}>{Number(t.shares).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td style={{ ...tdSt, color: T.ink }}>{(t.price * t.shares).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ ...tdSt }}>
                    <button onClick={() => onDeleteTrade(t.id)} style={{ background: 'transparent', border: 'none', color: T.inkFaint, cursor: 'pointer', fontSize: 10 }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cell>
    </div>
  );
}

// ─── Financial History ────────────────────────────────────────────────────────
function HistoryTable({ history }) {
  const sorted = [...history].sort((a, b) => a.fy - b.fy);
  const isKRW = sorted[0]?.currency === 'KRW';
  const unit = sorted[0]?.unit || (isKRW ? '억원' : 'M USD');

  const calcYoy = (curr, prev) => {
    if (curr == null || prev == null || prev === 0) return null;
    return Math.round((curr - prev) / Math.abs(prev) * 1000) / 10;
  };

  const rows = [
    { label: 'REVENUE',   key: 'revenue',   fmt: v => v != null ? fmtNum(v, { dp: 0 }) : '–' },
    { label: 'OP INCOME', key: 'opIncome',  fmt: v => v != null ? fmtNum(v, { dp: 0 }) : '–' },
    { label: 'FCF',       key: 'fcf',       fmt: v => v != null ? fmtNum(v, { dp: 0 }) : '–' },
    { label: 'OP MARGIN', key: 'opMargin',  fmt: v => v != null ? safeFixed(v, 1) + '%' : '–', isMargin: true },
    { label: 'EPS',       key: 'eps',       fmt: v => v != null ? (isKRW ? fmtNum(v, { dp: 0 }) : safeFixed(v, 2)) : '–' },
  ];

  const tdBase = { padding: '5px 10px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 10.5, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', color: T.inkFaint, fontSize: 10.5, letterSpacing: '0.1em', padding: '3px 10px 3px 0', minWidth: 72 }}>
              ({unit})
            </th>
            {sorted.map(r => (
              <th key={r.fy} style={{ textAlign: 'right', color: T.inkFaint, fontSize: 10.5, letterSpacing: '0.1em', padding: '3px 10px' }}>
                FY{r.fy}
              </th>
            ))}
            <th style={{ textAlign: 'right', color: T.inkFaint, fontSize: 10.5, letterSpacing: '0.1em', padding: '3px 10px' }}>YoY</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, key, fmt, isMargin }) => {
            const lastTwo = sorted.slice(-2);
            const yoy = lastTwo.length === 2 ? calcYoy(lastTwo[1][key], lastTwo[0][key]) : null;
            const vals = sorted.map(r => r[key]).filter(v => v != null && v > 0);
            const maxVal = vals.length ? Math.max(...vals) : 1;
            return (
              <tr key={key} style={{ borderTop: `1px solid ${T.border}` }}>
                <td style={{ ...tdBase, color: T.inkFaint, fontSize: 10.5, letterSpacing: '0.1em', paddingLeft: 0 }}>{label}</td>
                {sorted.map(r => {
                  const v = r[key];
                  const isLast = r.fy === sorted.at(-1)?.fy;
                  const barH = (!isMargin && v != null && v > 0) ? Math.max(2, Math.round((v / maxVal) * 14)) : 0;
                  const valueColor = isMargin
                    ? (v > 0 ? T.green : v < 0 ? T.red : T.inkDim)
                    : key === 'opIncome' || key === 'fcf'
                      ? (v != null && v < 0 ? T.red : T.ink)
                      : T.ink;
                  return (
                    <td key={r.fy} style={{
                      ...tdBase, textAlign: 'right', position: 'relative', color: valueColor,
                      background: isLast ? `${T.amber}0A` : 'transparent',
                      borderLeft: isLast ? `1px solid ${T.amber}33` : 'none',
                    }}>
                      {barH > 0 && (
                        <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 3, height: barH, background: `${T.amber}55`, borderRadius: 1 }}/>
                      )}
                      {fmt(v)}
                    </td>
                  );
                })}
                <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700,
                  color: yoy == null ? T.inkFaint : yoy > 0 ? T.green : T.red }}>
                  {yoy != null ? `${yoy > 0 ? '+' : ''}${yoy}%` : '–'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FinancialHistorySection({ stock, apiSettings, dartCorpMap, onSaveHistory }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const history = stock.metricsHistory || [];
  const isKRX        = stock.currency === 'KRW' || stock.market === 'KRX' || stock.country === '한국';
  const isSecEligible = ['NASDAQ', 'NYSE', 'AMEX'].includes(stock.market) || stock.country === '미국';
  const sourceHint   = isKRX ? 'DART (API 키 필요)' : isSecEligible ? 'SEC EDGAR → Yahoo 폴백' : 'Yahoo Finance';

  const handleFetch = async () => {
    setLoading(true);
    setError('');
    try {
      let data;
      if (isKRX) {
        data = await fetchDartFinancialHistory(stock, apiSettings, dartCorpMap);
      } else if (isSecEligible) {
        try {
          data = await fetchSecFinancialHistory(stock);
        } catch {
          data = await fetchYahooFinancialHistory(stock);
        }
      } else {
        data = await fetchYahooFinancialHistory(stock);
      }
      if (!data?.length) throw new Error('데이터 없음');
      onSaveHistory(stock.id, data);
    } catch (e) {
      setError(e.message || '수집 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Cell label="5Y FINANCIAL HISTORY" accent={T.amber}>
      <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={handleFetch} disabled={loading}
            style={{ ...btnSt, color: T.amber, border: `1px solid ${T.amber}`, padding: '3px 10px', fontSize: 10 }}>
            {loading ? '수집 중...' : '↻ FETCH HISTORY'}
          </button>
          {error && <span style={{ fontSize: 10, color: T.red }}>{error}</span>}
          {!error && history.length > 0 && (
            <span style={{ fontSize: 10, color: T.inkFaint }}>
              {history[0]?.source} · {history.length}개 연도 · FY{history.at(-1)?.fy}–FY{history[0]?.fy}
            </span>
          )}
          {!error && history.length === 0 && !loading && (
            <span style={{ fontSize: 10, color: T.inkFaint }}>{sourceHint}</span>
          )}
        </div>
        {history.length === 0 ? (
          <div style={{ color: T.inkFaint, fontSize: 11 }}>히스토리 없음 — FETCH HISTORY 버튼으로 수집</div>
        ) : (
          <HistoryTable history={history}/>
        )}
      </div>
    </Cell>
  );
}

// ─── Insider Trades Section ────────────────────────────────────────────────────
function InsiderSection({ stock, onSaveInsiders }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const trades = stock.insiderTrades || [];
  const isEligible = ['NASDAQ', 'NYSE', 'AMEX'].includes(stock.market) || stock.country === '미국';

  const handleFetch = async () => {
    setLoading(true); setError('');
    try {
      const data = await fetchInsiderTrades(stock);
      onSaveInsiders(stock.id, data);
    } catch (e) { setError(e.message || '수집 실패'); }
    finally { setLoading(false); }
  };

  const fmtSh = n => n >= 1e6 ? `${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(Math.round(n));
  const buys  = trades.filter(t => t.type === 'BUY').length;
  const sells = trades.filter(t => t.type === 'SELL').length;

  return (
    <Cell label="INSIDER TRADES (90일, SEC Form 4)" accent={T.amber}>
      <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={handleFetch} disabled={loading || !isEligible}
            style={{ ...btnSt, color: T.amber, border: `1px solid ${T.amber}`, padding: '3px 10px', fontSize: 10 }}>
            {loading ? '수집 중...' : '↻ FETCH INSIDERS'}
          </button>
          {error && <span style={{ fontSize: 10, color: T.red }}>{error}</span>}
          {!error && trades.length > 0 && (
            <span style={{ fontSize: 10, color: T.inkFaint }}>
              {trades.length}건
              {buys  > 0 && <span style={{ color: T.green  }}> · BUY {buys}</span>}
              {sells > 0 && <span style={{ color: T.red    }}> · SELL {sells}</span>}
            </span>
          )}
          {!error && trades.length === 0 && !loading && (
            <span style={{ fontSize: 10, color: T.inkFaint }}>
              {isEligible ? 'SEC Form 4 자동 수집 (API 키 불필요)' : '미국 상장 종목만 지원'}
            </span>
          )}
        </div>
        {trades.length === 0 ? (
          <div style={{ color: T.inkFaint, fontSize: 11 }}>
            {isEligible ? '거래 없음 — FETCH INSIDERS 버튼으로 최근 90일 수집' : '미국 상장 종목(NYSE/NASDAQ/AMEX)만 지원합니다.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {['DATE', 'INSIDER', 'TITLE', 'TYPE', 'SHARES', 'PRICE', 'VALUE'].map(h => (
                    <th key={h} style={{
                      padding: '4px 8px', color: T.inkFaint, fontSize: 10.5, letterSpacing: '0.08em',
                      textAlign: ['SHARES','PRICE','VALUE'].includes(h) ? 'right' : 'left',
                      borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.slice(0, 20).map((t, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                    <td style={{ padding: '5px 8px', color: T.inkDim, fontSize: 10, whiteSpace: 'nowrap' }}>{t.date}</td>
                    <td style={{ padding: '5px 8px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.ownerName}</td>
                    <td style={{ padding: '5px 8px', color: T.inkFaint, fontSize: 10, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.ownerTitle || (t.isDirector ? 'Director' : '–')}
                    </td>
                    <td style={{ padding: '5px 8px', color: t.type === 'BUY' ? T.green : T.red, fontWeight: 700, fontSize: 10 }}>{t.type}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: T.ink }}>{fmtSh(t.shares)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: T.inkDim }}>
                      {t.price != null ? `$${t.price.toFixed(2)}` : '–'}
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: T.inkFaint }}>
                      {t.value != null ? (t.value >= 1e6 ? `$${(t.value/1e6).toFixed(2)}M` : `$${(t.value/1e3).toFixed(0)}K`) : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Cell>
  );
}

// ─── Overview panel (wraps ScoreBreakdown + MetricsGrid with shared activeDim) ─
function OverviewPanel({ stock, apiSettings, dartCorpMap, onSaveHistory, onSaveInsiders }) {
  const [activeDim, setActiveDim] = useState(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 8, flex: '0 0 auto' }}>
        <ScoreBreakdown scores={stock.scores} activeDim={activeDim} onDimClick={setActiveDim}/>
        <MetricsGrid
          metrics={stock.metrics}
          metricsMeta={stock.metricsMeta}
          currency={stock.currency}
          activeDim={activeDim}
          refreshedAt={stock.refreshedAt}
          dataMode={apiSettings?.dataMode}
        />
      </div>
      <div style={{ flex: '0 0 auto' }}>
        <FinancialHistorySection stock={stock} apiSettings={apiSettings} dartCorpMap={dartCorpMap} onSaveHistory={onSaveHistory}/>
      </div>
      <div style={{ flex: '0 0 auto' }}>
        <InsiderSection stock={stock} onSaveInsiders={onSaveInsiders}/>
      </div>
    </div>
  );
}

// ─── Metrics grid ─────────────────────────────────────────────────────────────
function MetricsGrid({ metrics, metricsMeta, currency, activeDim, refreshedAt, dataMode }) {
  const categories = [
    {
      label: 'PROFITABILITY', color: T.amber,
      items: [
        { key: 'roe',       label: 'ROE',        fmt: v => safeFixed(v, 1) + '%' },
        { key: 'opMargin',  label: 'OP MARGIN',  fmt: v => safeFixed(v, 1) + '%' },
        { key: 'fcfMargin', label: 'FCF MARGIN', fmt: v => safeFixed(v, 1) + '%' },
      ],
    },
    {
      label: 'STABILITY', color: T.cyan,
      items: [
        { key: 'debtRatio',    label: 'DEBT/EQ',    fmt: v => safeFixed(v, 0) + '%' },
        { key: 'currentRatio', label: 'CUR RATIO',  fmt: v => safeFixed(v, 0) + '%' },
        { key: 'netMargin',    label: 'NET MARGIN', fmt: v => safeFixed(v, 1) + '%' },
      ],
    },
    {
      label: 'GROWTH', color: T.green,
      items: [
        { key: 'revGrowth',      label: 'REV GROWTH', fmt: v => safeFixed(v, 1) + '%' },
        { key: 'epsGrowth',      label: 'EPS GROWTH', fmt: v => safeFixed(v, 1) + '%' },
        { key: 'opIncomeGrowth', label: 'OP INC GR',  fmt: v => safeFixed(v, 1) + '%' },
      ],
    },
    {
      label: 'VALUATION', color: T.yellow,
      items: [
        { key: 'per',     label: 'PER',      fmt: v => safeFixed(v, 1) + 'x' },
        { key: 'pbr',     label: 'PBR',      fmt: v => safeFixed(v, 1) + 'x' },
        { key: 'evEbitda', label: 'EV/EBITDA', fmt: v => safeFixed(v, 1) + 'x' },
      ],
    },
  ];
  const colorFor = (key, v) => {
    if (!Number.isFinite(Number(v))) return T.ink;
    const n = Number(v);
    if (['revGrowth','epsGrowth','roe','opMargin','fcfMargin','netMargin','opIncomeGrowth'].includes(key)) return n >= 0 ? T.green : T.red;
    if (key === 'debtRatio') return n > 150 ? T.red : n > 80 ? T.yellow : T.green;
    return T.ink;
  };
  const staleFlag = (() => {
    if (!refreshedAt) return false;
    const parsed = new Date(refreshedAt);
    return Number.isFinite(parsed.getTime()) && (Date.now() - parsed.getTime()) > 90 * 86400000;
  })();
  const dimKey = activeDim?.toUpperCase();

  // Confidence summary
  const safeComputeDataConfidence = (typeof computeDataConfidence === 'function') ? computeDataConfidence : () => null;
  const conf = safeComputeDataConfidence(metrics, metricsMeta);
  const GRADE_COLOR = { A: T.green, B: T.cyan, C: T.yellow, D: T.red };
  const gradeColor = (g) => GRADE_COLOR[g] || T.inkFaint;
  const PROVIDER_SHORT = { 'Yahoo Finance': 'Yahoo', 'SEC EDGAR': 'SEC', 'OpenDART': 'DART', 'Alpha Vantage': 'AV', 'FMP': 'FMP' };
  const providerShort = (p) => PROVIDER_SHORT[p] || (p || '').slice(0, 6);

  // Commercial-safe warning: only show in commercialSafe mode when non-safe metrics exist
  const showCommercialWarning = dataMode === 'commercialSafe'
    && conf
    && conf.usedCount > 0
    && conf.commercialSafeCount < conf.usedCount;

  return (
    <Cell label="KEY METRICS" accent={T.cyan} style={{ height: '100%' }}>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {staleFlag && (
          <div style={{ fontSize: 9, color: T.yellow, background: `${T.yellow}15`, border: `1px solid ${T.yellow}44`, padding: '4px 8px' }}>
            ⚠ 마지막 Refresh 3개월+ 경과 ({refreshedAt?.slice(0, 10)}) — REFRESH 권장
          </div>
        )}

        {/* Confidence summary row */}
        {conf && conf.usedCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 9, color: T.inkFaint, borderBottom: `1px solid ${T.borderSoft}`, paddingBottom: 6, marginBottom: 2 }}>
            <span>Data Confidence: <span style={{ color: gradeColor(conf.grade), fontWeight: 700 }}>{conf.grade}</span></span>
            <span style={{ color: T.borderSoft }}>|</span>
            <span>Metrics: <span style={{ color: T.inkDim }}>{conf.usedCount} / {conf.totalCoreCount}</span></span>
            <span style={{ color: T.borderSoft }}>|</span>
            <span>Commercial-Safe: <span style={{ color: conf.commercialSafeCount < conf.usedCount ? T.yellow : T.green }}>{conf.commercialSafeCount} / {conf.usedCount}</span></span>
          </div>
        )}

        {showCommercialWarning && (
          <div style={{ fontSize: 9, color: T.yellow, background: `${T.yellow}12`, border: `1px solid ${T.yellow}44`, padding: '4px 8px' }}>
            ⚠ This score uses one or more non-commercial-safe data points.
          </div>
        )}

        {categories.map(cat => {
          const isActive = !dimKey || cat.label === dimKey;
          return (
            <div key={cat.label} style={{ opacity: isActive ? 1 : 0.35, transition: 'opacity 0.15s' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 5, fontSize: 8.5, fontWeight: 700,
                letterSpacing: '0.14em', color: cat.color,
              }}>
                <span style={{ width: 4, height: 4, background: cat.color, borderRadius: 1 }}/>
                {cat.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {cat.items.map(({ key, label, fmt }) => {
                  const v    = metrics?.[key];
                  const meta = metricsMeta?.[key];
                  const display = Number.isFinite(Number(v)) ? fmt(v) : '–';
                  const badgeProvider = meta?.provider ? providerShort(meta.provider) : null;
                  const badgeConf     = meta?.confidence || null;
                  const badgeColor    = badgeConf ? gradeColor(badgeConf) : T.inkFaint;
                  return (
                    <div key={key} style={{ background: T.surface2, padding: '7px 10px', border: `1px solid ${isActive && dimKey ? cat.color + '55' : T.borderSoft}` }}>
                      <div style={{ fontSize: 8.5, color: T.inkFaint, letterSpacing: '0.12em', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: colorFor(key, v), fontVariantNumeric: 'tabular-nums' }}>
                        {display}
                      </div>
                      {badgeProvider && Number.isFinite(Number(v)) && (
                        <div style={{ fontSize: 7.5, color: badgeColor, marginTop: 3, letterSpacing: '0.04em' }}>
                          [{badgeProvider} · {badgeConf}]
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Cell>
  );
}

// ─── Chart panel ─────────────────────────────────────────────────────────────
const CHART_PERIODS = [
  { label: '1M', range: '1mo', interval: '1d' },
  { label: '3M', range: '3mo', interval: '1d' },
  { label: '6M', range: '6mo', interval: '1wk' },
  { label: '1Y', range: '1y',  interval: '1wk' },
];

function ChartPanel({ stock, onRefresh, refreshing, fetchStatus, period: periodProp, chartType: chartTypeProp, onPeriodChange, onChartTypeChange }) {
  const [localPeriod, setLocalPeriod] = useState('3M');
  const [localChartType, setLocalChartType] = useState('line');
  const period = periodProp ?? localPeriod;
  const chartType = chartTypeProp ?? localChartType;
  const setPeriod = onPeriodChange ?? setLocalPeriod;
  const setChartType = onChartTypeChange ?? setLocalChartType;
  const [ohlcData, setOhlcData] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartErr, setChartErr] = useState('');
  const [indicators, setIndicators] = useState({ ma20: true, ma60: true, ma120: true, volume: true, bb: false, rsi: false, macd: false });
  const toggleInd = key => setIndicators(prev => ({ ...prev, [key]: !prev[key] }));

  const sym = toYahooSymbol(stock);
  const periodDef = CHART_PERIODS.find(p => p.label === period) || CHART_PERIODS[1];

  useEffect(() => {
    if (!sym || sym === 'EMPTY') return;
    let cancelled = false;
    setChartLoading(true);
    setChartErr('');
    fetchYahooChartOhlc(sym, periodDef.range, periodDef.interval)
      .then(data => { if (!cancelled) { setOhlcData(data); setChartLoading(false); } })
      .catch(e => { if (!cancelled) { setChartErr(e.message); setChartLoading(false); } });
    return () => { cancelled = true; };
  }, [sym, period]);

  const lineData = ohlcData ? ohlcData.map(c => c.close) : (stock.priceHistory || []);

  const btnSt = (active) => ({
    background: 'transparent',
    border: `1px solid ${active ? T.amber : T.border}`,
    color: active ? T.amber : T.inkFaint,
    padding: '2px 8px', fontFamily: T.font, fontSize: 9.5,
    cursor: 'pointer', letterSpacing: '0.08em',
  });

  const IND_DEFS = [
    { key: 'ma20',   label: 'MA20',   color: T.amber   },
    { key: 'ma60',   label: 'MA60',   color: T.cyan    },
    { key: 'ma120',  label: 'MA120',  color: T.magenta },
    { key: 'volume', label: 'VOL',    color: T.inkFaint },
    { key: 'bb',     label: 'BB',     color: '#a78bfa'  },
    { key: 'rsi',    label: 'RSI',    color: T.yellow  },
    { key: 'macd',   label: 'MACD',   color: T.green   },
  ];

  return (
    <Cell label={`PRICE CHART · ${period}`} accent={T.amber} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        {CHART_PERIODS.map(p => (
          <button key={p.label} onClick={() => setPeriod(p.label)} style={btnSt(period === p.label)}>{p.label}</button>
        ))}
        <div style={{ width: 1, height: 12, background: T.border, margin: '0 2px' }}/>
        <button onClick={() => setChartType('line')}   style={btnSt(chartType === 'line')}>LINE</button>
        <button onClick={() => setChartType('candle')} style={btnSt(chartType === 'candle')}>CANDLE</button>
        <div style={{ flex: 1 }}/>
        {chartLoading && <span style={{ color: T.amber, fontSize: 9.5 }}>⟳</span>}
        {chartErr && <span style={{ color: T.red, fontSize: 9.5 }} title={chartErr}>ERR</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 12px', borderBottom: `1px solid ${T.borderSoft}`, background: T.surface2, flexShrink: 0, flexWrap: 'wrap' }}>
        {IND_DEFS.map(({ key, label, color }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={!!indicators[key]} onChange={() => toggleInd(key)}
              style={{ accentColor: color, cursor: 'pointer' }}/>
            <span style={{ fontSize: 9, color: indicators[key] ? color : T.inkFaint, letterSpacing: '0.06em', fontFamily: T.font }}>
              {label}
            </span>
          </label>
        ))}
      </div>
      {fetchStatus && (
        <div style={{ padding: '4px 12px', fontSize: 10.5, color: T.amber, background: `${T.amber}10`, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          ⟳ {fetchStatus}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <PriceChart
          data={chartType === 'candle' ? [] : lineData}
          ohlcData={ohlcData || []}
          chartType={chartType}
          accent={T.amber}
          indicators={indicators}
        />
      </div>
      <div style={{ padding: '0 12px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 9.5, color: T.inkFaint }}>출처: {stock.priceSrc || '–'} · {stock.asOf || '–'}</span>
        {onRefresh && (
          <button onClick={() => onRefresh(stock.id)} disabled={refreshing}
            style={{ padding: '3px 12px', fontSize: 9.5, fontFamily: T.font, background: 'transparent',
              border: `1px solid ${T.cyan}`, color: refreshing ? T.inkFaint : T.cyan,
              cursor: refreshing ? 'default' : 'pointer', letterSpacing: '0.1em' }}>
            {refreshing ? '조회 중...' : '↻ REFRESH DATA'}
          </button>
        )}
      </div>
    </Cell>
  );
}

// ─── Pitch panel ─────────────────────────────────────────────────────────────
function MarkdownText({ text }) {
  if (typeof text !== 'string') return null;
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--amber, #fca5a5)">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:inherit; text-decoration:underline;">$1</a>')
    .replace(/\n/g, '<br/>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
function PitchPanel({ stock, onEditPitch, onCaptureJournal }) {
  return (
    <Cell label="INVESTMENT PITCH" accent={T.amber} style={{ height: '100%' }}>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
        <div>
          <div style={{ fontSize: 9.5, color: T.inkFaint, letterSpacing: '0.12em', marginBottom: 6 }}>KEY QUESTION</div>
          <div style={{ fontSize: 12.5, color: T.cyan, lineHeight: 1.55 }}>
            {stock.keyQuestion ? <MarkdownText text={stock.keyQuestion} /> : '–'}
          </div>
        </div>

        <TwoColumn label1="THESIS" label2="CATALYSTS" col1={
          <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {(stock.thesis || []).map((t, i) => (
              <li key={i} style={{ fontSize: 11.5, color: T.ink, lineHeight: 1.5 }}><MarkdownText text={t} /></li>
            ))}
          </ul>
        } col2={
          <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {(stock.catalysts || []).map((c, i) => (
              <li key={i} style={{ fontSize: 11.5, color: T.green, lineHeight: 1.5 }}><MarkdownText text={c} /></li>
            ))}
          </ul>
        }/>

        <TwoColumn label1="RISKS" label2="VARIANT VIEW" col1={
          <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {(stock.risks || []).map((r, i) => (
              <li key={i} style={{ fontSize: 11.5, color: T.red, lineHeight: 1.5 }}><MarkdownText text={r} /></li>
            ))}
          </ul>
        } col2={
          <div style={{ fontSize: 11.5, color: T.yellow, lineHeight: 1.55 }}>
            {stock.variantView ? <MarkdownText text={stock.variantView} /> : '–'}
          </div>
        }/>

        <div>
          <div style={{ fontSize: 9.5, color: T.inkFaint, letterSpacing: '0.12em', marginBottom: 6 }}>CHANGE MIND IF</div>
          <div style={{ fontSize: 11.5, color: T.ink, lineHeight: 1.55, borderLeft: `2px solid ${T.red}`, paddingLeft: 10 }}>
            {stock.changeMind ? <MarkdownText text={stock.changeMind} /> : '–'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9.5, color: T.inkFaint, letterSpacing: '0.12em', marginBottom: 6 }}>NUMBERS TO WATCH</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(stock.numbersToWatch || []).map((n, i) => (
              <span key={i} style={{ fontSize: 10.5, padding: '3px 9px', border: `1px solid ${T.border}`, color: T.inkDim }}>{n}</span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onEditPitch && (
            <button onClick={() => onEditPitch(stock.id)}
              style={{ padding: '5px 14px', fontSize: 10, fontFamily: T.font,
                background: 'transparent', border: `1px solid ${T.border}`, color: T.inkDim, cursor: 'pointer', letterSpacing: '0.1em' }}>
              EDIT PITCH
            </button>
          )}
          {onCaptureJournal && (
            <button onClick={() => onCaptureJournal(stock.id)}
              style={{ padding: '5px 14px', fontSize: 10, fontFamily: T.font,
                background: 'transparent', border: `1px solid ${T.yellow}`, color: T.yellow, cursor: 'pointer', letterSpacing: '0.1em' }}>
              CAPTURE SNAPSHOT
            </button>
          )}
        </div>
      </div>
    </Cell>
  );
}

function TwoColumn({ label1, label2, col1, col2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <div style={{ fontSize: 9.5, color: T.inkFaint, letterSpacing: '0.12em', marginBottom: 6 }}>{label1}</div>
        {col1}
      </div>
      <div>
        <div style={{ fontSize: 9.5, color: T.inkFaint, letterSpacing: '0.12em', marginBottom: 6 }}>{label2}</div>
        {col2}
      </div>
    </div>
  );
}

// ─── Valuation panel ─────────────────────────────────────────────────────────
function ValuationPanel({ stock, onEdit }) {
  const { bear, base, bull, note } = stock.valuation || {};
  const cur = Number(stock.price) || 0;
  const currency = stock.currency;
  const isKrw = currency === 'KRW';
  const px = (v) => isKrw ? `₩${fmtPx(v ?? 0, 'KRW')}` : `$${fmtPx(v ?? 0, currency)}`;

  const scenarios = [
    { label: 'BEAR', data: bear, color: T.red },
    { label: 'BASE', data: base, color: T.amber },
    { label: 'BULL', data: bull, color: T.green },
  ];

  return (
    <Cell label="VALUATION" accent={T.green} style={{ height: '100%' }}>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {scenarios.map(({ label, data, color }) => {
            const scUpside = (data?.price && cur) ? ((data.price - cur) / cur * 100) : null;
            const thinUpside = label === 'BASE' && scUpside !== null && scUpside < 10;
            return (
            <div key={label} style={{ background: T.surface2, border: `1px solid ${thinUpside ? T.yellow : T.borderSoft}`, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 9, color, letterSpacing: '0.14em', fontWeight: 700 }}>{label}</span>
                {thinUpside && <span style={{ fontSize: 8.5, color: T.yellow, border: `1px solid ${T.yellow}55`, padding: '1px 5px' }}>상승여력 부족</span>}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
                {px(data?.price)}
              </div>
              <div style={{ fontSize: 10, color: T.inkDim, marginBottom: 2 }}>
                {Number.isFinite(Number(data?.multiple)) ? `${data.multiple}x multiple` : '–'}
              </div>
              {scUpside !== null && (
                <div style={{ fontSize: 10, color: scUpside >= 0 ? T.green : T.red }}>{sign(scUpside)}{safeFixed(scUpside, 1)}% upside</div>
              )}
            </div>
            );
          })}
        </div>

        {note && (
          <div style={{ fontSize: 11.5, color: T.inkDim, lineHeight: 1.55, borderLeft: `2px solid ${T.border}`, paddingLeft: 10 }}>
            {note}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Stat label="Current Price" value={px(cur)} color={T.ink}/>
          <Stat label="Target"        value={px(stock.target)} color={T.amber}/>
          <Stat label="Upside"
            value={`${sign((stock.target - cur) / cur * 100)}${safeFixed((stock.target - cur) / cur * 100, 1)}%`}
            color={colorForChange(stock.target - cur)}/>
        </div>

        {onEdit && (
          <button onClick={() => onEdit(stock.id, 'valuation')}
            style={{ alignSelf: 'flex-start', padding: '4px 12px', fontSize: 10, fontFamily: T.font,
              background: 'transparent', border: `1px solid ${T.border}`, color: T.inkDim, cursor: 'pointer', letterSpacing: '0.1em' }}>
            EDIT VALUATION
          </button>
        )}
      </div>
    </Cell>
  );
}

// ─── History / notes panel ────────────────────────────────────────────────────
function HistoryPanel({ stock, onAddNote, onSaveReview }) {
  const [draft, setDraft] = useState({
    date: new Date().toISOString().slice(0, 10),
    kind: '뉴스',
    text: '',
    source: '',
  });
  const [reviewForm, setReviewForm] = useState({
    next: stock.review?.next || '',
    cadence: stock.review?.cadence ?? 30,
  });
  // sync when stock switches
  React.useEffect(() => {
    setReviewForm({ next: stock.review?.next || '', cadence: stock.review?.cadence ?? 30 });
  }, [stock.id]);

  const [search, setSearch] = useState('');
  const notes = [...(stock.notes || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const filteredNotes = notes.filter(n => !search.trim() ||
    n.text?.toLowerCase().includes(search.toLowerCase()) ||
    (n.source || '').toLowerCase().includes(search.toLowerCase())
  );
  const kindColor = { 실적: T.amber, 공시: T.cyan, 뉴스: T.green, 기타: T.inkDim };
  const kindCount = {};
  notes.forEach(n => { kindCount[n.kind] = (kindCount[n.kind] || 0) + 1; });
  const set = (k) => (e) => setDraft(d => ({ ...d, [k]: e.target.value }));
  const addNote = () => {
    if (!draft.text.trim()) return;
    onAddNote?.(stock.id, { ...draft, text: draft.text.trim(), source: draft.source.trim() });
    setDraft(d => ({ ...d, text: '', source: '' }));
  };

  const days = getDaysLeft(reviewForm.next);
  const daysColor = days === null ? T.inkFaint : days < 0 ? T.red : days <= 7 ? T.yellow : T.cyan;
  const daysLabel = days === null ? '미설정' : days < 0 ? `D+${Math.abs(days)} 지연` : days === 0 ? '오늘' : `D-${days}`;

  return (
    <Cell label="RESEARCH LOG" accent={T.cyan} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Review schedule strip */}
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${T.borderSoft}`, display: 'flex', alignItems: 'center', gap: 8, background: T.surface2 }}>
        <span style={{ fontSize: 10, color: T.inkFaint, whiteSpace: 'nowrap' }}>NEXT REVIEW</span>
        <input type="date" value={reviewForm.next} onChange={e => setReviewForm(f => ({ ...f, next: e.target.value }))}
          style={{ ...inputSt, width: 130 }}/>
        <select value={reviewForm.cadence} onChange={e => setReviewForm(f => ({ ...f, cadence: Number(e.target.value) }))}
          style={{ ...inputSt, width: 80 }}>
          {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d}일</option>)}
        </select>
        <button onClick={() => onSaveReview?.(stock.id, reviewForm)}
          style={{ ...btnSt, border: `1px solid ${T.cyan}`, color: T.cyan, padding: '4px 10px' }}>SAVE</button>
        <span style={{ fontSize: 10, color: daysColor, marginLeft: 4, fontVariantNumeric: 'tabular-nums' }}>{daysLabel}</span>
      </div>
      {/* Note input */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.borderSoft}`, display: 'grid', gridTemplateColumns: '112px 86px 1fr auto', gap: 8 }}>
        <input type="date" value={draft.date} onChange={set('date')} style={{ ...inputSt, minWidth: 0 }}/>
        <select value={draft.kind} onChange={set('kind')} style={{ ...inputSt, minWidth: 0 }}>
          {['실적', '공시', '뉴스', '기타'].map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <input value={draft.source} onChange={set('source')} placeholder="source URL" style={{ ...inputSt, minWidth: 0 }}/>
        <button onClick={addNote} style={{ ...btnSt, border: `1px solid ${T.cyan}`, color: T.cyan, padding: '5px 10px' }}>ADD</button>
        <textarea value={draft.text} onChange={set('text')} placeholder="실적, 공시, 뉴스에서 확인한 핵심 메모"
          rows={2} style={{ ...inputSt, gridColumn: '1 / -1', resize: 'vertical' }}/>
      </div>
      {/* Search + kind counts */}
      <div style={{ padding: '6px 14px', borderBottom: `1px solid ${T.borderSoft}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색..."
          style={{ ...inputSt, flex: 1, padding: '4px 8px' }}/>
        <div style={{ display: 'flex', gap: 5 }}>
          {['실적', '공시', '뉴스', '기타'].map(k => kindCount[k] ? (
            <span key={k} style={{ fontSize: 9, color: kindColor[k], border: `1px solid ${kindColor[k]}55`, padding: '2px 6px' }}>
              {k} {kindCount[k]}
            </span>
          ) : null)}
        </div>
        {notes.length > 0 && <span style={{ fontSize: 9, color: T.inkFaint, whiteSpace: 'nowrap' }}>{filteredNotes.length}/{notes.length}</span>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredNotes.length === 0 && (
          <div style={{ color: T.inkFaint, fontSize: 11, paddingTop: 8 }}>{notes.length === 0 ? '기록 없음' : '검색 결과 없음'}</div>
        )}
        {filteredNotes.map((n, i) => (
          <div key={i} style={{ borderLeft: `2px solid ${kindColor[n.kind] || T.border}`, paddingLeft: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 9.5, color: T.inkFaint }}>{n.date}</span>
              <span style={{ fontSize: 9, padding: '1px 6px', border: `1px solid ${kindColor[n.kind] || T.border}`, color: kindColor[n.kind] || T.inkDim }}>
                {n.kind}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: T.ink, lineHeight: 1.55 }}>{n.text}</div>
            {n.source && (
              <div style={{ fontSize: 10, color: T.cyan, marginTop: 2, wordBreak: 'break-all' }}>{n.source}</div>
            )}
          </div>
        ))}
      </div>
    </Cell>
  );
}

// ─── Quality checks panel ─────────────────────────────────────────────────────
function QualityPanel({ stock }) {
  const items = useMemo(() => computeDynamicQuality(stock), [stock]);
  const kindColor = { ok: T.green, info: T.cyan, warn: T.yellow };
  const kindPrefix = { ok: '✓', info: 'ℹ', warn: '⚠' };

  return (
    <Cell label="DATA QUALITY" accent={T.green} style={{ height: '100%' }}>
      <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: kindColor[item.kind] || T.inkDim, flex: '0 0 auto', lineHeight: 1.4 }}>
              {kindPrefix[item.kind] || '·'}
            </span>
            <span style={{ fontSize: 11, color: T.inkDim, lineHeight: 1.5 }}>{item.text}</span>
          </div>
        ))}
      </div>
    </Cell>
  );
}

// ─── Pre-mortem panel ─────────────────────────────────────────────────────────
function PreMortemPanel({ stock, onSave }) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState(stock.preMortem || []);
  useEffect(() => {
    setRows(stock.preMortem || []);
    setEditing(false);
  }, [stock.id]);

  const statusColor = { ok: T.green, warn: T.yellow, breach: T.red };
  const statusLabel = { ok: 'OK', warn: 'WATCH', breach: 'BREACH' };
  const updateRow = (idx, key, value) => {
    setRows(prev => prev.map((row, i) => i === idx ? { ...row, [key]: value } : row));
  };
  const addRow = () => {
    setRows(prev => [...prev, { metric: '', current: '', threshold: '', target: '', status: 'warn', delta: '' }]);
    setEditing(true);
  };
  const saveRows = () => {
    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && String(v).trim() !== '' ? n : v;
    };
    onSave?.(stock.id, rows
      .filter(r => String(r.metric || '').trim())
      .map(r => ({
        metric: String(r.metric || '').trim(),
        current: toNum(r.current),
        threshold: toNum(r.threshold),
        target: String(r.target || '').trim(),
        status: r.status || 'warn',
        delta: toNum(r.delta),
      })));
    setEditing(false);
  };

  return (
    <Cell label="PRE-MORTEM METRICS" accent={T.red} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={addRow} style={{ ...btnSt, color: T.inkDim, border: `1px solid ${T.border}`, padding: '4px 9px' }}>ADD</button>
          {editing ? (
            <button onClick={saveRows} style={{ ...btnSt, color: T.red, border: `1px solid ${T.red}`, padding: '4px 9px' }}>SAVE</button>
          ) : (
            <button onClick={() => setEditing(true)} style={{ ...btnSt, color: T.inkDim, border: `1px solid ${T.border}`, padding: '4px 9px' }}>EDIT</button>
          )}
        </div>
        {rows.length === 0 && <div style={{ color: T.inkFaint, fontSize: 11 }}>설정된 지표 없음</div>}
        {rows.map((row, i) => {
          const c = statusColor[row.status] || T.inkDim;
          return (
            <div key={i} style={{ background: T.surface2, border: `1px solid ${row.status === 'breach' ? T.red + '44' : T.borderSoft}`, padding: '8px 12px' }}>
              {editing ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 0.7fr 1fr 0.8fr 0.7fr auto', gap: 6, alignItems: 'center' }}>
                  <input value={row.metric || ''} onChange={(e) => updateRow(i, 'metric', e.target.value)} placeholder="metric" style={{ ...inputSt, minWidth: 0 }}/>
                  <input value={row.current ?? ''} onChange={(e) => updateRow(i, 'current', e.target.value)} placeholder="current" style={{ ...inputSt, minWidth: 0 }}/>
                  <input value={row.threshold ?? ''} onChange={(e) => updateRow(i, 'threshold', e.target.value)} placeholder="threshold" style={{ ...inputSt, minWidth: 0 }}/>
                  <input value={row.target || ''} onChange={(e) => updateRow(i, 'target', e.target.value)} placeholder="target" style={{ ...inputSt, minWidth: 0 }}/>
                  <select value={row.status || 'warn'} onChange={(e) => updateRow(i, 'status', e.target.value)} style={{ ...inputSt, minWidth: 0 }}>
                    <option value="ok">OK</option>
                    <option value="warn">WATCH</option>
                    <option value="breach">BREACH</option>
                  </select>
                  <input value={row.delta ?? ''} onChange={(e) => updateRow(i, 'delta', e.target.value)} placeholder="delta" style={{ ...inputSt, minWidth: 0 }}/>
                  <button onClick={() => setRows(prev => prev.filter((_, x) => x !== i))}
                    style={{ ...btnSt, color: T.inkFaint, border: `1px solid ${T.border}`, padding: '5px 8px' }}>DEL</button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: T.ink }}>{row.metric}</span>
                    <span style={{ fontSize: 9, padding: '2px 7px', border: `1px solid ${c}`, color: c, fontWeight: 700 }}>
                      {statusLabel[row.status] || row.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 10.5 }}>
                    <span style={{ color: T.inkDim }}>현재: <span style={{ color: c, fontWeight: 700 }}>{row.current}</span></span>
                    <span style={{ color: T.inkDim }}>목표: <span style={{ color: T.amber }}>{row.target}</span></span>
                    {Number.isFinite(Number(row.delta)) && (
                      <span style={{ color: T.inkDim }}>차이: <span style={{ color: colorForChange(Number(row.delta)), fontWeight: 700 }}>
                        {Number(row.delta) > 0 ? '+' : ''}{row.delta}
                      </span></span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Cell>
  );
}

// ─── Scenario sim ─────────────────────────────────────────────────────────────
function ScenarioSim({ stock }) {
  const [driverDelta, setDriverDelta] = useState(0);
  const [multDelta, setMultDelta] = useState(0);
  const { base } = stock.valuation || {};
  const baseDriver = Number(base?.driver ?? 0);
  const baseMult   = Number(base?.multiple ?? 0);
  const simPrice   = (baseDriver * (1 + driverDelta / 100)) * (baseMult * (1 + multDelta / 100));
  const cur = Number(stock.price) || 0;
  const upside = cur ? ((simPrice - cur) / cur) * 100 : 0;
  const isKrw = stock.currency === 'KRW';
  const px = (v) => isKrw ? `₩${fmtPx(v, 'KRW')}` : `$${fmtPx(v, stock.currency)}`;

  return (
    <Cell label="SCENARIO SIMULATOR" accent={T.yellow} style={{ height: '100%' }}>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SliderRow label="Driver ±%" value={driverDelta} min={-50} max={50} step={5} onChange={setDriverDelta}/>
        <SliderRow label="Multiple ±%" value={multDelta} min={-50} max={50} step={5} onChange={setMultDelta}/>
        <div style={{ background: T.surface2, padding: '12px 16px', border: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 9.5, color: T.inkFaint, marginBottom: 4 }}>SIMULATED PRICE</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.amber, fontVariantNumeric: 'tabular-nums' }}>
              {Number.isFinite(simPrice) && simPrice > 0 ? px(Math.round(simPrice * 10) / 10) : '–'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9.5, color: T.inkFaint, marginBottom: 4 }}>UPSIDE</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colorForChange(upside), fontVariantNumeric: 'tabular-nums' }}>
              {Number.isFinite(upside) ? `${sign(upside)}${upside.toFixed(1)}%` : '–'}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: T.inkFaint }}>
          BASE: driver {baseDriver} × {baseMult}x = {px(Math.round(baseDriver * baseMult * 10) / 10)}
        </div>
      </div>
    </Cell>
  );
}

function SliderRow({ label, value, min, max, step, onChange }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: T.inkDim }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: value >= 0 ? T.green : T.red, fontVariantNumeric: 'tabular-nums' }}>
          {value >= 0 ? '+' : ''}{value}%
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: T.amber, cursor: 'pointer' }}/>
    </div>
  );
}

// ─── F3 tabbed wrapper ───────────────────────────────────────────────────────
function F3Panel({ stock, onEdit }) {
  const [tab, setTab] = useState('VAL');
  const tabBtnSt = active => ({
    background: 'transparent',
    border: `1px solid ${active ? T.amber : T.border}`,
    color: active ? T.amber : T.inkFaint,
    fontFamily: T.font, fontSize: 9.5, cursor: 'pointer',
    padding: '2px 10px', letterSpacing: '0.08em',
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
        background: T.surface2, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <button style={tabBtnSt(tab === 'VAL')} onClick={() => setTab('VAL')}>VALUATION</button>
        <button style={tabBtnSt(tab === 'DCF')} onClick={() => setTab('DCF')}>DCF MODEL</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'VAL' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, height: '100%' }}>
            <ValuationPanel stock={stock} onEdit={onEdit}/>
            <ScenarioSim stock={stock}/>
          </div>
        ) : (
          <DcfMiniModeler stock={stock}/>
        )}
      </div>
    </div>
  );
}

// ─── DCF Mini Modeler ─────────────────────────────────────────────────────────
function DcfMiniModeler({ stock }) {
  const history = Array.isArray(stock.metricsHistory) ? stock.metricsHistory : [];
  const currency = stock.currency || 'USD';
  const isKrw = currency === 'KRW';
  const isJpy = currency === 'JPY';
  const unitLabel = isKrw ? '억원' : isJpy ? 'M JPY' : 'M USD';
  const curSymbol = isKrw ? '₩' : isJpy ? '¥' : '$';

  const autoFcf = history[0]?.fcf ?? null;

  // Derive shares outstanding (M) — priority: history EPS → PER fallback
  const autoShares = (() => {
    const h = history[0];
    if (!h) return null;
    const net = h.netIncome;
    if (!Number.isFinite(net) || net <= 0) return null;
    // KRW (DART): eps in 원, netIncome in 억원 → shares_M = net*1e8 / eps / 1e6 = net*100/eps
    if (isKrw && Number.isFinite(h.eps) && h.eps > 0) {
      const s = Math.round(net * 100 / h.eps);
      if (s > 0) return s;
    }
    // Non-KRW with direct EPS (SEC EDGAR: eps in USD, netIncome in M USD)
    if (!isKrw && Number.isFinite(h.eps) && h.eps > 0) {
      const s = Math.round(net / h.eps);  // M USD / USD = M shares
      if (s > 0) return s;
    }
    // Fallback: implied EPS from PER and current price (works for Yahoo non-US stocks)
    const per = Number(stock.metrics?.per);
    const price = Number(stock.price);
    if (Number.isFinite(per) && per > 0 && Number.isFinite(price) && price > 0) {
      const epsD = price / per;
      const s = isKrw
        ? Math.round(net * 100 / epsD)
        : Math.round(net / epsD);
      if (s > 0) return s;
    }
    return null;
  })();

  const autoGrowth = useMemo(() => {
    if (history.length < 2) return null;
    const newest = history[0]?.fcf;
    const oldest = history[history.length - 1]?.fcf;
    if (!newest || !oldest || oldest <= 0 || newest <= 0) return null;
    const yrs = history.length - 1;
    return Math.round((Math.pow(newest / oldest, 1 / yrs) - 1) * 1000) / 10;
  }, [history]);

  const [fcfStr, setFcfStr] = useState(autoFcf != null ? String(Math.round(autoFcf)) : '');
  const [sharesStr, setSharesStr] = useState(autoShares != null ? String(autoShares) : '');
  const [netDebtStr, setNetDebtStr] = useState('0');
  const [termG, setTermG] = useState(3);
  const [scenarios, setScenarios] = useState({
    bear: { growth: 5,  wacc: 12 },
    base: { growth: 12, wacc: 10 },
    bull: { growth: 20, wacc: 9  },
  });

  useEffect(() => {
    if (autoFcf != null) setFcfStr(String(Math.round(autoFcf)));
    else setFcfStr('');
  }, [stock.id]);

  const setScen = (key, field, val) =>
    setScenarios(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));

  const calcDcf = (fcf0, g, wacc, tg, yrs = 8) => {
    if (!Number.isFinite(fcf0) || fcf0 <= 0) return null;
    if (wacc <= tg) return null;
    let pv = 0, fcfY = fcf0;
    for (let i = 1; i <= yrs; i++) {
      fcfY *= 1 + g / 100;
      pv += fcfY / Math.pow(1 + wacc / 100, i);
    }
    const tv = (fcfY * (1 + tg / 100)) / ((wacc - tg) / 100);
    return pv + tv / Math.pow(1 + wacc / 100, yrs);
  };

  const fcfNum = parseFloat(fcfStr) || 0;
  const sharesNum = parseFloat(sharesStr) || 0;
  const netDebtNum = parseFloat(netDebtStr) || 0;
  const cur = Number(stock.price) || 0;

  const results = useMemo(() => {
    return [
      { key: 'bear', label: 'BEAR', color: T.red    },
      { key: 'base', label: 'BASE', color: T.amber  },
      { key: 'bull', label: 'BULL', color: T.green  },
    ].map(({ key, label, color }) => {
      const { growth, wacc } = scenarios[key];
      const ev = calcDcf(fcfNum, growth, wacc, termG);
      const equity = ev !== null ? ev - netDebtNum : null;
      let perShare = null;
      if (equity !== null && sharesNum > 0) {
        perShare = isKrw ? (equity * 100) / sharesNum : equity / sharesNum;
      }
      const upside = perShare !== null && cur > 0 ? (perShare - cur) / cur * 100 : null;
      return { key, label, color, growth, wacc, ev, equity, perShare, upside };
    });
  }, [fcfNum, sharesNum, netDebtNum, termG, scenarios, cur, isKrw]);

  const fmt = v => v == null || !Number.isFinite(v) ? '–'
    : v >= 1e6 ? (v / 1e6).toFixed(1) + (isKrw ? '조' : 'T')
    : v >= 1e3 ? (v / 1e3).toFixed(1) + (isKrw ? '兆' : 'B')
    : v.toFixed(0);
  const fmtPs = v => v == null || !Number.isFinite(v) ? '–'
    : `${curSymbol}${Number(v).toLocaleString('en-US', { maximumFractionDigits: isKrw ? 0 : 2 })}`;

  const inSt = {
    background: T.surface2, border: `1px solid ${T.border}`,
    color: T.ink, fontFamily: T.font, fontSize: 11,
    padding: '3px 6px', width: '100%',
  };
  const rowSt = { display: 'flex', flexDirection: 'column', gap: 3 };
  const lbSt = { fontSize: 10.5, color: T.inkFaint, letterSpacing: '0.1em' };

  return (
    <Cell label="DCF MINI MODEL · 8Y PROJECTION" accent={T.cyan} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Inputs row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          <div style={rowSt}>
            <span style={lbSt}>BASE FCF ({unitLabel})</span>
            <input value={fcfStr} onChange={e => setFcfStr(e.target.value)} style={inSt} placeholder="e.g. 50000"/>
            {autoFcf != null && <span style={{ fontSize: 10, color: T.inkFaint }}>히스토리: {Math.round(autoFcf).toLocaleString()}</span>}
          </div>
          <div style={rowSt}>
            <span style={lbSt}>SHARES (M)</span>
            <input value={sharesStr} onChange={e => setSharesStr(e.target.value)} style={inSt} placeholder="e.g. 5969"/>
            {autoShares != null && <span style={{ fontSize: 10, color: T.inkFaint }}>자동: {autoShares.toLocaleString()}M</span>}
          </div>
          <div style={rowSt}>
            <span style={lbSt}>NET DEBT ({unitLabel})</span>
            <input value={netDebtStr} onChange={e => setNetDebtStr(e.target.value)} style={inSt} placeholder="0"/>
          </div>
          <div style={rowSt}>
            <span style={lbSt}>TERMINAL G %</span>
            <input type="number" min={0} max={5} step={0.5} value={termG}
              onChange={e => setTermG(Number(e.target.value))} style={inSt}/>
          </div>
        </div>

        {/* Scenario inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', gap: 4, fontSize: 10 }}>
          <div/>
          {[{k:'bear',c:T.red},{k:'base',c:T.amber},{k:'bull',c:T.green}].map(({k,c}) => (
            <div key={k} style={{ color: c, fontWeight: 700, letterSpacing: '0.12em', textAlign: 'center', paddingBottom: 3, borderBottom: `1px solid ${c}40` }}>
              {k.toUpperCase()}
            </div>
          ))}
          <span style={{ color: T.inkFaint }}>GROWTH %</span>
          {[{k:'bear'},{k:'base'},{k:'bull'}].map(({k}) => (
            <input key={k} type="number" min={-30} max={60} step={1}
              value={scenarios[k].growth}
              onChange={e => setScen(k, 'growth', Number(e.target.value))}
              style={{ ...inSt, textAlign: 'center' }}/>
          ))}
          <span style={{ color: T.inkFaint }}>WACC %</span>
          {[{k:'bear'},{k:'base'},{k:'bull'}].map(({k}) => (
            <input key={k} type="number" min={1} max={30} step={0.5}
              value={scenarios[k].wacc}
              onChange={e => setScen(k, 'wacc', Number(e.target.value))}
              style={{ ...inSt, textAlign: 'center' }}/>
          ))}
        </div>

        {/* Results */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {results.map(({ key, label, color, ev, perShare, upside }) => (
            <div key={key} style={{ background: T.surface2, border: `1px solid ${color}33`, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: '0.14em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 9.5, color: T.inkFaint, marginBottom: 2 }}>EV ({unitLabel})</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>
                {fmt(ev)}
              </div>
              <div style={{ fontSize: 9.5, color: T.inkFaint, marginBottom: 2 }}>Per Share</div>
              <div style={{ fontSize: 15, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
                {fmtPs(perShare)}
              </div>
              {upside !== null && (
                <div style={{ fontSize: 10, color: upside >= 0 ? T.green : T.red }}>
                  {sign(upside)}{upside.toFixed(1)}% upside
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{ fontSize: 9, color: T.inkFaint, lineHeight: 1.6, borderTop: `1px solid ${T.border}`, paddingTop: 6 }}>
          {history.length > 0 && `FY${history[0]?.fy} FCF: ${Math.round(history[0]?.fcf ?? 0).toLocaleString()} ${unitLabel}`}
          {autoGrowth !== null && ` · 5Y FCF CAGR: ${sign(autoGrowth)}${autoGrowth}%/yr`}
          {!history.length && ' · ↻ F1 패널에서 FETCH HISTORY 후 FCF 자동 입력 가능'}
          {sharesNum === 0 && ' · Shares 입력 시 Per Share 계산'}
        </div>
      </div>
    </Cell>
  );
}

// ─── Peer comparison ─────────────────────────────────────────────────────────
function PeersPanel({ stock, stocks, watchlistIds, onSelect, onSavePeers, onAddPeer }) {
  const [editing, setEditing] = React.useState(false);
  const [sortBy, setSortBy] = React.useState(null);
  const [sortDir, setSortDir] = React.useState(1);
  const hasExplicit = Array.isArray(stock.peers);

  const peerIds = useMemo(() => {
    if (hasExplicit) return stock.peers.filter(id => id !== stock.id && stocks[id]);
    return watchlistIds.filter(id => id !== stock.id && stocks[id]);
  }, [stock, stocks, watchlistIds]);

  const allCandidates = Object.keys(stocks).filter(id => id !== stock.id);
  const selectedSet = new Set(hasExplicit ? stock.peers.filter(id => stocks[id] && id !== stock.id) : watchlistIds.filter(id => id !== stock.id && stocks[id]));

  const togglePeer = (id) => {
    const current = hasExplicit
      ? stock.peers.filter(i => stocks[i] && i !== stock.id)
      : watchlistIds.filter(i => stocks[i] && i !== stock.id);
    const next = current.includes(id) ? current.filter(i => i !== id) : [...current, id];
    onSavePeers?.(stock.id, next);
  };

  const resetToAll = () => onSavePeers?.(stock.id, []);

  const baseRows = [stock.id, ...peerIds].map(id => stocks[id]).filter(Boolean);
  const rows = sortBy ? [...baseRows].sort((a, b) => {
    const av = sortBy === 'overall' ? (a.scores?.overall ?? null) : (a.metrics?.[sortBy] ?? null);
    const bv = sortBy === 'overall' ? (b.scores?.overall ?? null) : (b.metrics?.[sortBy] ?? null);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (a.id === stock.id) return -1;
    if (b.id === stock.id) return 1;
    return (av - bv) * sortDir;
  }) : baseRows;
  const handleSort = (key) => {
    if (sortBy === key) setSortDir(d => -d);
    else { setSortBy(key); setSortDir(1); }
  };
  const metrics = [
    { key: 'per',      label: 'PER',   fmt: v => Number.isFinite(Number(v)) ? `${safeFixed(v, 1)}x`  : '–', lowerBetter: true },
    { key: 'pbr',      label: 'PBR',   fmt: v => Number.isFinite(Number(v)) ? `${safeFixed(v, 1)}x`  : '–', lowerBetter: true },
    { key: 'roe',      label: 'ROE',   fmt: v => Number.isFinite(Number(v)) ? `${safeFixed(v, 1)}%`  : '–' },
    { key: 'opMargin', label: 'OPM',   fmt: v => Number.isFinite(Number(v)) ? `${safeFixed(v, 1)}%`  : '–' },
    { key: 'debtRatio',label: 'DEBT',  fmt: v => Number.isFinite(Number(v)) ? `${safeFixed(v, 0)}%`  : '–', lowerBetter: true },
    { key: 'revGrowth',label: 'REV G', fmt: v => Number.isFinite(Number(v)) ? `${safeFixed(v, 1)}%`  : '–' },
    { key: 'overall',  label: 'SCORE', fmt: v => Number.isFinite(Number(v)) ? `${Math.round(v)}`     : '–' },
  ];
  const peerRows = rows.filter(r => r.id !== stock.id);
  const med = {};
  metrics.forEach(m => {
    med[m.key] = median(peerRows.map(r => m.key === 'overall' ? r.scores?.overall : r.metrics?.[m.key]));
  });

  const relColor = (value, m) => {
    if (!Number.isFinite(Number(value)) || !Number.isFinite(Number(med[m.key])) || med[m.key] === 0) return T.inkFaint;
    const rel = ((Number(value) - med[m.key]) / Math.abs(med[m.key])) * 100;
    const good = m.lowerBetter ? rel < 0 : rel > 0;
    return Math.abs(rel) < 5 ? T.inkDim : good ? T.green : T.red;
  };

  return (
    <Cell label="PEER COMPARISON" accent={T.cyan} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.borderSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: T.ink, fontWeight: 700 }}>
            {stock.symbol} vs {hasExplicit ? 'custom peers' : 'watchlist peers'}
          </div>
          <div style={{ fontSize: 10, color: T.inkFaint, marginTop: 2 }}>Peer median 기준 premium/discount를 빠르게 확인합니다.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: T.cyan }}>{peerRows.length} peers</span>
          <button onClick={() => setEditing(e => !e)}
            style={{ background: editing ? T.cyan : 'transparent', color: editing ? '#000' : T.cyan, border: `1px solid ${T.cyan}`, padding: '3px 10px', fontSize: 9, fontFamily: T.font, letterSpacing: '0.1em', cursor: 'pointer' }}>
            {editing ? 'DONE' : 'EDIT PEERS'}
          </button>
        </div>
      </div>

      {/* Peer selector (edit mode) */}
      {editing && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.borderSoft}`, background: T.surface }}>
          <div style={{ fontSize: 10, color: T.inkFaint, letterSpacing: '0.12em', marginBottom: 8 }}>
            PEER GROUP — 체크된 종목만 비교에 포함됩니다
            {hasExplicit && (
              <span onClick={resetToAll} style={{ marginLeft: 12, color: T.amber, cursor: 'pointer' }}>전체 초기화</span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {peerIds.map(id => {
              const s = stocks[id];
              return (
                <div key={id} onClick={() => togglePeer(id)} title="클릭하여 제거"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', border: `1px solid ${T.cyan}`, background: `${T.cyan}18`, cursor: 'pointer', fontSize: 10 }}>
                  <span style={{ color: T.cyan, fontWeight: 700 }}>{s.symbol}</span>
                  <span style={{ color: T.inkFaint, fontSize: 9 }}>{s.name}</span>
                  <span style={{ color: T.cyan, marginLeft: 4, fontSize: 11 }}>×</span>
                </div>
              );
            })}
            <button onClick={onAddPeer} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', border: `1px dashed ${T.cyan}`, background: 'transparent', color: T.cyan, cursor: 'pointer', fontSize: 10, fontFamily: T.font }}>
              + SEARCH NEW PEER
            </button>
            {allCandidates.length === 0 && (
              <span style={{ color: T.inkFaint, fontSize: 10 }}>워치리스트에 다른 종목이 없습니다.</span>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', color: T.inkFaint, padding: '7px 8px', borderBottom: `1px solid ${T.border}` }}>SYMBOL</th>
              <th style={{ textAlign: 'left', color: T.inkFaint, padding: '7px 8px', borderBottom: `1px solid ${T.border}` }}>NAME</th>
              {metrics.map(m => (
                <th key={m.key} onClick={() => handleSort(m.key)} style={{ textAlign: 'right', color: sortBy === m.key ? T.cyan : T.inkFaint, padding: '7px 8px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', userSelect: 'none' }}>
                  {m.label}{sortBy === m.key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isActive = r.id === stock.id;
              return (
                <tr key={r.id} onClick={() => onSelect?.(r.id)} style={{ cursor: 'pointer', background: isActive ? `${T.amber}10` : 'transparent' }}>
                  <td style={{ color: isActive ? T.amber : T.ink, fontWeight: 700, padding: '8px', borderBottom: `1px solid ${T.borderSoft}` }}>{r.symbol}</td>
                  <td style={{ color: T.inkDim, padding: '8px', borderBottom: `1px solid ${T.borderSoft}`, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</td>
                  {metrics.map(m => {
                    const v = m.key === 'overall' ? r.scores?.overall : r.metrics?.[m.key];
                    return (
                      <td key={m.key} style={{ textAlign: 'right', color: isActive ? relColor(v, m) : T.inkDim, padding: '8px', borderBottom: `1px solid ${T.borderSoft}` }}>
                        {m.fmt(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {peerRows.length > 0 && (
              <tr>
                <td style={{ color: T.cyan, fontWeight: 700, padding: '8px', borderTop: `1px solid ${T.border}` }}>MEDIAN</td>
                <td style={{ color: T.inkFaint, padding: '8px', borderTop: `1px solid ${T.border}` }}>{hasExplicit ? 'custom peers' : 'watchlist peers'}</td>
                {metrics.map(m => (
                  <td key={m.key} style={{ textAlign: 'right', color: T.cyan, padding: '8px', borderTop: `1px solid ${T.border}` }}>{m.fmt(med[m.key])}</td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
        {peerRows.length === 0 && (
          <div style={{ padding: 18, color: T.inkFaint, fontSize: 11, textAlign: 'center' }}>
            비교할 peer가 없습니다. EDIT PEERS를 눌러 추가하세요.
          </div>
        )}
      </div>
    </Cell>
  );
}

// ─── Search overlay ───────────────────────────────────────────────────────────
function SearchOverlay({ apiSettings, dartCorpMap, onAdd, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noResults, setNoResults] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const isKorean = q => /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(q);

  const searchKorean = (q) => {
    const map = dartCorpMap || {};
    return Object.entries(map)
      .filter(([, v]) => v.corpName && v.corpName.includes(q))
      .slice(0, 30)
      .map(([ticker, v]) => ({
        symbol: ticker,
        name: v.corpName,
        market: 'KRX',
        currency: 'KRW',
        flag: '🇰🇷',
        country: '대한민국',
      }));
  };

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setNoResults(false); return; }
    if (isKorean(q)) {
      const rows = searchKorean(q);
      setResults(rows);
      setNoResults(rows.length === 0);
      return;
    }
    setLoading(true); setError(''); setNoResults(false);
    try {
      const [yahoo, fmp] = await Promise.allSettled([
        searchWithYahoo(q),
        apiSettings.fmpKey ? searchWithFmp(q, apiSettings.fmpKey) : Promise.resolve([]),
      ]);
      const all = [
        ...(yahoo.status === 'fulfilled' ? yahoo.value : []),
        ...(fmp.status === 'fulfilled' ? fmp.value : []),
      ];
      const fmpEmptyOrUnavailable = !apiSettings.fmpKey
        || fmp.status === 'rejected'
        || (fmp.status === 'fulfilled' && !fmp.value.length);
      if (!all.length && yahoo.status === 'rejected' && fmpEmptyOrUnavailable) {
        throw new Error([yahoo.reason?.message, fmp.reason?.message].filter(Boolean).join(' / ') || 'Search failed');
      }
      const seen = new Set();
      const deduped = all.filter(r => { const k = `${r.market}:${r.symbol}`; if (seen.has(k)) return false; seen.add(k); return true; });
      setResults(deduped);
      setNoResults(deduped.length === 0);
    } catch (e) {
      setError(e.message);
      setNoResults(false);
    } finally {
      setLoading(false);
    }
  }, [apiSettings.fmpKey, dartCorpMap]);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 500);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const handleKey = (e) => { if (e.key === 'Escape') onClose(); };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, border: `1px solid ${T.border}`, width: 560, maxHeight: 480, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', borderBottom: `1px solid ${T.border}`, height: 44 }}>
          <span style={{ color: T.amber, fontWeight: 700, marginRight: 8 }}>/</span>
          <input ref={inputRef} value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="종목 검색 — 한글 기업명, 영문명, 티커 모두 가능"
            style={{ flex: 1, background: 'transparent', border: 0, outline: 0, color: T.ink, fontFamily: T.font, fontSize: 13 }}/>
          {loading && <span style={{ color: T.amber, fontSize: 11 }}>검색 중...</span>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {error && <div style={{ padding: 12, fontSize: 11, color: T.red }}>{error}</div>}
          {!error && noResults && <div style={{ padding: 12, fontSize: 11, color: T.inkFaint }}>검색 결과 없음</div>}
          {results.map((r, i) => (
            <div key={i} onClick={() => { onAdd(r); onClose(); }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderBottom: `1px solid ${T.borderSoft}`, cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.background = T.surface2}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: T.ink }}>{r.symbol}</span>
                  <span style={{ fontSize: 11 }}>{r.flag || ''}</span>
                  <span style={{ fontSize: 9, padding: '1px 6px', border: `1px solid ${T.border}`, color: T.inkFaint }}>{r.market}</span>
                </div>
                <div style={{ fontSize: 11, color: T.inkDim, marginTop: 2 }}>{r.name}</div>
              </div>
              <span style={{ fontSize: 9.5, color: T.cyan, padding: '3px 10px', border: `1px solid ${T.cyan}44`, cursor: 'pointer' }}>
                + ADD
              </span>
            </div>
          ))}
          {results.length === 0 && query.trim() && !loading && !error && !noResults && (
            <div style={{ padding: 16, color: T.inkFaint, fontSize: 11, textAlign: 'center' }}>검색 결과 없음</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── API settings modal ────────────────────────────────────────────────────────
function ApiSettingsModal({ settings, dartCorpMap, onSave, onClose }) {
  const [s, setS] = useState({ ...settings });
  const [dcm, setDcm] = useState(JSON.stringify(dartCorpMap, null, 2));
  const [dcmError, setDcmError] = useState('');

  const providerOpts = [
    { v: 'yahooExperimental', label: 'Yahoo Finance (무료)' },
    { v: 'alphaVantage',      label: 'Alpha Vantage' },
    { v: 'fmp',               label: 'Financial Modeling Prep' },
  ];

  const handleSave = () => {
    let parsedDcm = dartCorpMap;
    try { parsedDcm = JSON.parse(dcm); setDcmError(''); } catch { setDcmError('JSON 형식 오류'); return; }
    onSave(s, parsedDcm);
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, border: `1px solid ${T.border}`, width: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: T.amber }}>API SETTINGS</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 0, color: T.inkFaint, cursor: 'pointer', fontSize: 16, fontFamily: T.font }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SettingRow label="DATA PROVIDER">
            <select value={s.globalProvider} onChange={(e) => setS({ ...s, globalProvider: e.target.value })}
              style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.ink, fontFamily: T.font, fontSize: 11, padding: '5px 8px', width: '100%' }}>
              {providerOpts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </SettingRow>

          <SettingRow label="ALPHA VANTAGE KEY">
            <ApiKeyInput value={s.alphaVantageKey} onChange={(v) => setS({ ...s, alphaVantageKey: v })}/>
          </SettingRow>

          <SettingRow label="FMP KEY">
            <ApiKeyInput value={s.fmpKey} onChange={(v) => setS({ ...s, fmpKey: v })}/>
          </SettingRow>

          <SettingRow label="OPENDART KEY (한국주식 재무)">
            <ApiKeyInput value={s.openDartKey} onChange={(v) => setS({ ...s, openDartKey: v })}/>
          </SettingRow>

          <SettingRow label="DATA.GO.KR KEY (한국주식 주가)">
            <ApiKeyInput value={s.dataGoKrKey} onChange={(v) => setS({ ...s, dataGoKrKey: v })}/>
          </SettingRow>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <SettingRow label="DART 기준년도">
              <input type="number" value={s.dartFiscalYear} onChange={(e) => setS({ ...s, dartFiscalYear: Number(e.target.value) })}
                style={{ ...inputSt, width: '100%' }}/>
            </SettingRow>
            <SettingRow label="보고서 코드">
              <select value={s.dartReportCode} onChange={(e) => setS({ ...s, dartReportCode: e.target.value })}
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.ink, fontFamily: T.font, fontSize: 11, padding: '5px 8px', width: '100%' }}>
                <option value="11011">11011 사업</option>
                <option value="11012">11012 반기</option>
                <option value="11013">11013 1분기</option>
                <option value="11014">11014 3분기</option>
              </select>
            </SettingRow>
            <SettingRow label="재무제표">
              <select value={s.dartFsDiv} onChange={(e) => setS({ ...s, dartFsDiv: e.target.value })}
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.ink, fontFamily: T.font, fontSize: 11, padding: '5px 8px', width: '100%' }}>
                <option value="CFS">CFS 연결</option>
                <option value="OFS">OFS 별도</option>
              </select>
            </SettingRow>
          </div>

          <SettingRow label="캐시 유효기간 (일)">
            <input type="number" min="0" max="30" value={s.cacheDays} onChange={(e) => setS({ ...s, cacheDays: Number(e.target.value) })}
              style={{ ...inputSt, width: 80 }}/>
          </SettingRow>

          <SettingRow label="DART CORP CODE 맵 (JSON)">
            <textarea value={dcm} onChange={(e) => setDcm(e.target.value)}
              style={{ ...inputSt, width: '100%', height: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: 10 }}/>
            {dcmError && <div style={{ fontSize: 10, color: T.red, marginTop: 3 }}>{dcmError}</div>}
          </SettingRow>
        </div>
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSt, color: T.inkDim, border: `1px solid ${T.border}` }}>취소</button>
          <button onClick={handleSave} style={{ ...btnSt, color: T.amber, border: `1px solid ${T.amber}` }}>저장</button>
        </div>
      </div>
    </div>
  );
}

const inputSt = { background: T.surface2, border: `1px solid ${T.border}`, color: T.ink, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '5px 8px', outline: 'none' };
const btnSt = { background: 'transparent', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, cursor: 'pointer', padding: '6px 16px', letterSpacing: '0.08em' };

function SettingRow({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.inkFaint, letterSpacing: '0.14em', marginBottom: 5, textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  );
}

function ApiKeyInput({ value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ ...inputSt, flex: 1 }}/>
      <button onClick={() => setShow(v => !v)}
        style={{ ...btnSt, border: `1px solid ${T.border}`, color: T.inkDim, padding: '4px 10px' }}>
        {show ? 'HIDE' : 'SHOW'}
      </button>
    </div>
  );
}

// ─── Settings / data panel ───────────────────────────────────────────────────
function SettingsDataPanel({
  apiSettings, dartCorpMap, dataCache, providerStatus, dartAutoStatus, dartCoverage,
  onSaveSettings, onClearCache, onExportBackup, onImportBackup, onReloadDartMap,
}) {
  const [s, setS] = useState({ ...apiSettings });
  const [dcm, setDcm] = useState(JSON.stringify(dartCorpMap, null, 2));
  const [dcmError, setDcmError] = useState('');
  const [includeKeys, setIncludeKeys] = useState(false);
  const [importMode, setImportMode] = useState('merge');
  const fileRef = useRef(null);
  useEffect(() => { setS({ ...apiSettings }); }, [apiSettings]);
  useEffect(() => { setDcm(JSON.stringify(dartCorpMap, null, 2)); }, [dartCorpMap]);

  const save = () => {
    let parsedDcm = dartCorpMap;
    try { parsedDcm = JSON.parse(dcm); setDcmError(''); } catch { setDcmError('JSON 형식 오류'); return; }
    onSaveSettings(s, parsedDcm);
  };

  const importFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onImportBackup(reader.result, importMode);
    reader.readAsText(file, 'utf-8');
  };

  const cacheEntries = Object.values(dataCache || {});
  const cacheCount = cacheEntries.length;
  const cacheByProvider = cacheEntries.reduce((acc, e) => {
    const p = e.provider || 'unknown';
    if (!acc[p]) acc[p] = { count: 0, oldest: null };
    acc[p].count++;
    if (e.fetchedAt) {
      const ageD = Math.floor((Date.now() - new Date(e.fetchedAt).getTime()) / 86400000);
      if (acc[p].oldest === null || ageD > acc[p].oldest) acc[p].oldest = ageD;
    }
    return acc;
  }, {});
  const statusColor = providerStatus?.kind === 'ok' ? T.green : providerStatus?.kind === 'warn' ? T.yellow : providerStatus?.kind === 'error' ? T.red : T.inkFaint;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, height: '100%' }}>
      <Cell label="SETTINGS / DATA" accent={T.amber} style={{ height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <SettingRow label="DATA PROVIDER">
              <select value={s.globalProvider} onChange={(e) => setS({ ...s, globalProvider: e.target.value })}
                style={{ ...inputSt, width: '100%' }}>
                <option value="yahooExperimental">Yahoo Finance (무료)</option>
                <option value="alphaVantage">Alpha Vantage</option>
                <option value="fmp">Financial Modeling Prep</option>
              </select>
            </SettingRow>
            <SettingRow label="CACHE DAYS">
              <input type="number" min="0" max="30" value={s.cacheDays} onChange={(e) => setS({ ...s, cacheDays: Number(e.target.value) })}
                style={{ ...inputSt, width: '100%' }}/>
            </SettingRow>
          </div>

          <SettingRow label="DATA MODE">
            <select value={s.dataMode || 'personal'} onChange={(e) => setS({ ...s, dataMode: e.target.value })}
              style={{ ...inputSt, width: '100%' }}>
              <option value="personal">🔒 Personal — Yahoo 등 비공식 API 사용 가능</option>
              <option value="commercialSafe">🛡️ Commercial-Safe — 비상업용 데이터에 경고 표시</option>
            </select>
            <div style={{ fontSize: 9, color: T.inkFaint, marginTop: 4, lineHeight: 1.5 }}>
              Commercial-Safe 모드는 Yahoo 비공식 API 사용을 차단하지 않습니다.
              다만 KEY METRICS 패널에 비상업 데이터 출처를 시각적으로 표시합니다.
            </div>
          </SettingRow>

          <SettingRow label="ALPHA VANTAGE KEY">
            <ApiKeyInput value={s.alphaVantageKey} onChange={(v) => setS({ ...s, alphaVantageKey: v })}/>
          </SettingRow>
          <SettingRow label="FMP KEY">
            <ApiKeyInput value={s.fmpKey} onChange={(v) => setS({ ...s, fmpKey: v })}/>
          </SettingRow>
          <SettingRow label="OPENDART KEY">
            <ApiKeyInput value={s.openDartKey} onChange={(v) => setS({ ...s, openDartKey: v })}/>
          </SettingRow>
          <SettingRow label="DATA.GO.KR KEY">
            <ApiKeyInput value={s.dataGoKrKey} onChange={(v) => setS({ ...s, dataGoKrKey: v })}/>
          </SettingRow>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <SettingRow label="DART YEAR">
              <input type="number" value={s.dartFiscalYear} onChange={(e) => setS({ ...s, dartFiscalYear: Number(e.target.value) })}
                style={{ ...inputSt, width: '100%' }}/>
            </SettingRow>
            <SettingRow label="REPORT">
              <select value={s.dartReportCode} onChange={(e) => setS({ ...s, dartReportCode: e.target.value })} style={{ ...inputSt, width: '100%' }}>
                <option value="11011">사업</option>
                <option value="11012">반기</option>
                <option value="11013">1분기</option>
                <option value="11014">3분기</option>
              </select>
            </SettingRow>
            <SettingRow label="FS DIV">
              <select value={s.dartFsDiv} onChange={(e) => setS({ ...s, dartFsDiv: e.target.value })} style={{ ...inputSt, width: '100%' }}>
                <option value="CFS">연결</option>
                <option value="OFS">별도</option>
              </select>
            </SettingRow>
          </div>

          <SettingRow label="DART CORP CODE MAP">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8, fontSize: 10, color: T.inkFaint }}>
              <span style={{ color: T.inkDim }}>{Object.keys(dartCorpMap || {}).length.toLocaleString('en-US')} mapped</span>
              {dartAutoStatus && (
                <span style={{ color: dartAutoStatus.kind === 'ok' ? T.green : dartAutoStatus.kind === 'error' ? T.red : T.yellow }}>
                  {dartAutoStatus.text}
                </span>
              )}
              {dartCoverage?.missingKrx?.length > 0 && (
                <span style={{ color: T.yellow }}>
                  missing: {dartCoverage.missingKrx.map(s => s.symbol).join(', ')}
                </span>
              )}
            </div>
            <textarea value={dcm} onChange={(e) => setDcm(e.target.value)}
              style={{ ...inputSt, width: '100%', height: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 10 }}/>
            {dcmError && <div style={{ fontSize: 10, color: T.red, marginTop: 3 }}>{dcmError}</div>}
          </SettingRow>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onReloadDartMap} style={{ ...btnSt, color: T.cyan, border: `1px solid ${T.cyan}` }}>LOAD LOCAL DART JSON</button>
            <button onClick={save} style={{ ...btnSt, color: T.amber, border: `1px solid ${T.amber}` }}>SAVE SETTINGS</button>
          </div>
        </div>
      </Cell>

      <Cell label="BACKUP / CACHE" accent={T.cyan} style={{ height: '100%' }}>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, padding: 12 }}>
            <div style={{ fontSize: 10, color: T.inkFaint, letterSpacing: '0.12em', marginBottom: 6 }}>PROVIDER STATUS</div>
            <div style={{ color: statusColor, fontSize: 13, fontWeight: 700 }}>{providerStatus?.text || 'Ready'}</div>
          </div>

          <div style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, padding: 12 }}>
            <div style={{ fontSize: 10, color: T.inkFaint, letterSpacing: '0.12em', marginBottom: 6 }}>CACHE HEALTH</div>
            <div style={{ color: T.ink, fontSize: 12, marginBottom: 8 }}>{cacheCount} entries total</div>
            {Object.entries(cacheByProvider).map(([p, { count, oldest }]) => (
              <div key={p} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.inkDim, marginBottom: 4 }}>
                <span style={{ color: T.inkFaint }}>{p}</span>
                <span>{count}개 · 최대 {oldest ?? '?'}일</span>
              </div>
            ))}
            {cacheCount === 0 && <div style={{ fontSize: 10, color: T.inkFaint }}>캐시 없음</div>}
            <button onClick={onClearCache} style={{ ...btnSt, color: T.red, border: `1px solid ${T.red}`, marginTop: 8 }}>CLEAR CACHE</button>
          </div>

          <div style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 10, color: T.inkFaint, letterSpacing: '0.12em' }}>EXPORT</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: T.inkDim }}>
              <input type="checkbox" checked={includeKeys} onChange={(e) => setIncludeKeys(e.target.checked)}/>
              API keys 포함
            </label>
            <button onClick={() => onExportBackup(includeKeys)} style={{ ...btnSt, color: T.cyan, border: `1px solid ${T.cyan}` }}>EXPORT JSON</button>
          </div>

          <div style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 10, color: T.inkFaint, letterSpacing: '0.12em' }}>IMPORT</div>
            <select value={importMode} onChange={(e) => setImportMode(e.target.value)} style={{ ...inputSt, width: 160 }}>
              <option value="merge">MERGE</option>
              <option value="replace">REPLACE</option>
            </select>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => importFile(e.target.files?.[0])}
              style={{ color: T.inkDim, fontFamily: T.font, fontSize: 11 }}/>
          </div>
        </div>
      </Cell>
    </div>
  );
}

// ─── F6 Alerts panel ──────────────────────────────────────────────────────────
function AlertsPanel({
  stocks, watchlistIds, alerts, alertSettings, alertErrors, alertStatus,
  dartCoverage, lastPolled,
  onRefresh, onOpen, onLog, onDismiss, onMarkRead, onMarkAllRead, onSettingsChange,
}) {
  const [filter, setFilter] = useState({ status: 'new', source: '', kind: '', stockId: '' });
  const setting = alertSettings || {};
  const sources = setting.sources || {};
  const setSrc = (k, v) => onSettingsChange({ ...setting, sources: { ...sources, [k]: v } });

  const filtered = (alerts || []).filter(a => {
    if (filter.status === 'new'       && a.status !== 'new')       return false;
    if (filter.status === 'read'      && a.status !== 'read')      return false;
    if (filter.status === 'logged'    && a.status !== 'logged')    return false;
    if (filter.status === 'dismissed' && a.status !== 'dismissed') return false;
    if (filter.source && a.source !== filter.source) return false;
    if (filter.kind   && a.kind   !== filter.kind)   return false;
    if (filter.stockId && a.stockId !== filter.stockId) return false;
    return true;
  });
  const sorted = filtered.slice().sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  const counts = {
    new: (alerts || []).filter(a => a.status === 'new').length,
    read: (alerts || []).filter(a => a.status === 'read').length,
    logged: (alerts || []).filter(a => a.status === 'logged').length,
    dismissed: (alerts || []).filter(a => a.status === 'dismissed').length,
    total: (alerts || []).length,
  };

  const watchlistOptions = watchlistIds.map(id => ({ id, label: stocks[id]?.symbol || id }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 8, height: '100%' }}>
      <Cell label="ALERT SETTINGS" accent={T.red} style={{ height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', fontSize: 11 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.ink }}>
            <input type="checkbox" checked={!!setting.enabled} onChange={(e) => onSettingsChange({ ...setting, enabled: e.target.checked })}/>
            <span style={{ fontWeight: 700, letterSpacing: '0.08em' }}>ALERTS ENABLED</span>
          </label>
          <div style={{ borderTop: `1px solid ${T.borderSoft}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, color: T.inkFaint, letterSpacing: '0.12em' }}>SOURCES</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.inkDim }}>
              <input type="checkbox" checked={!!sources.dart} onChange={(e) => setSrc('dart', e.target.checked)}/>
              OpenDART (한국 공시)
            </label>
            {sources.dart && (
              <div style={{
                padding: 8, border: `1px solid ${T.borderSoft}`, background: T.surface2,
                color: !dartCoverage?.hasOpenDartKey || dartCoverage?.missingKrx?.length ? T.yellow : T.green,
                fontSize: 10, lineHeight: 1.45,
              }}>
                {!dartCoverage?.hasOpenDartKey
                  ? 'OpenDART key missing. F12 Settings에 key를 저장하세요.'
                  : `KRX mapping ${dartCoverage.mappedKrxCount}/${dartCoverage.krxCount}`}
                {dartCoverage?.missingKrx?.length > 0 && (
                  <div style={{ color: T.yellow, marginTop: 3 }}>
                    corp_code missing: {dartCoverage.missingKrx.map(s => `${s.symbol}(${normalizeKrxStockCode(s.symbol)})`).join(', ')}
                  </div>
                )}
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.inkDim }}>
              <input type="checkbox" checked={!!sources.sec} onChange={(e) => setSrc('sec', e.target.checked)}/>
              SEC EDGAR (미국 공시)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.inkDim }}>
              <input type="checkbox" checked={!!sources.yahooNews} onChange={(e) => setSrc('yahooNews', e.target.checked)}/>
              Yahoo News (비공식)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.inkDim }}>
              <input type="checkbox" checked={!!sources.googleNews} onChange={(e) => setSrc('googleNews', e.target.checked)}/>
              Google News RSS
            </label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 10, color: T.inkFaint, letterSpacing: '0.12em' }}>DAYS BACK</div>
            <input type="number" min="1" max="30" value={setting.daysBack ?? 7}
              onChange={(e) => onSettingsChange({ ...setting, daysBack: Math.max(1, Math.min(30, Number(e.target.value) || 7)) })}
              style={{ ...inputSt, width: '100%' }}/>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 10, color: T.inkFaint, letterSpacing: '0.12em' }}>GOOGLE NEWS PROXY (선택)</div>
            <input type="text" placeholder="https://corsproxy.io/?" value={setting.googleNewsProxy || ''}
              onChange={(e) => onSettingsChange({ ...setting, googleNewsProxy: e.target.value })}
              style={{ ...inputSt, width: '100%', fontFamily: 'monospace', fontSize: 10 }}/>
            <div style={{ fontSize: 9, color: T.inkFaint }}>file:// 또는 CORS 차단 시 무료 프록시 prefix 입력</div>
          </div>
          <div style={{ borderTop: `1px solid ${T.borderSoft}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, color: T.inkFaint, letterSpacing: '0.12em' }}>POLLING</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.inkDim }}>
              <input type="checkbox" checked={!!setting.autoPolling} onChange={(e) => onSettingsChange({ ...setting, autoPolling: e.target.checked })}/>
              자동 새로고침 사용
            </label>
            <input type="number" min="5" max="120" value={setting.pollIntervalMin ?? 15}
              onChange={(e) => onSettingsChange({ ...setting, pollIntervalMin: Math.max(5, Math.min(120, Number(e.target.value) || 15)) })}
              disabled={!setting.autoPolling}
              style={{ ...inputSt, width: '100%', opacity: setting.autoPolling ? 1 : 0.5 }}/>
            <div style={{ fontSize: 9, color: T.inkFaint }}>분 단위. 무료 API 한도 주의.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <button onClick={onRefresh} style={{ ...btnSt, color: T.amber, border: `1px solid ${T.amber}` }}>
              REFRESH NOW
            </button>
            {lastPolled && <span style={{ fontSize: 9, color: T.inkFaint }}>마지막: {lastPolled.replace('T', ' ').slice(0, 16)}</span>}
          </div>
          {alertStatus && (
            <div style={{ fontSize: 10, color: alertStatus.kind === 'error' ? T.red : T.inkFaint, lineHeight: 1.5 }}>
              {alertStatus.text}
            </div>
          )}
          {alertErrors && alertErrors.length > 0 && (
            <div style={{ fontSize: 10, color: T.yellow, lineHeight: 1.5, borderTop: `1px solid ${T.borderSoft}`, paddingTop: 8 }}>
              <div style={{ color: T.inkFaint, fontSize: 9, letterSpacing: '0.12em', marginBottom: 4 }}>RECENT ERRORS</div>
              {alertErrors.slice(0, 5).map((err, i) => (
                <div key={i}>· {err.source}: {err.message}</div>
              ))}
            </div>
          )}
        </div>
      </Cell>

      <Cell label={`ALERTS · ${counts.new} NEW / ${counts.total}`} accent={T.amber} style={{ height: '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 10, borderBottom: `1px solid ${T.borderSoft}`, fontSize: 10, alignItems: 'center' }}>
            <select value={filter.status} onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))} style={{ ...inputSt, fontSize: 10 }}>
              <option value="new">NEW ({counts.new})</option>
              <option value="read">READ ({counts.read})</option>
              <option value="">ALL ({counts.total})</option>
              <option value="logged">LOGGED ({counts.logged})</option>
              <option value="dismissed">DISMISSED ({counts.dismissed})</option>
            </select>
            <select value={filter.source} onChange={(e) => setFilter(f => ({ ...f, source: e.target.value }))} style={{ ...inputSt, fontSize: 10 }}>
              <option value="">SOURCE: ALL</option>
              <option value="OpenDART">OpenDART</option>
              <option value="SEC">SEC</option>
              <option value="Yahoo">Yahoo</option>
              <option value="GoogleNews">GoogleNews</option>
            </select>
            <select value={filter.kind} onChange={(e) => setFilter(f => ({ ...f, kind: e.target.value }))} style={{ ...inputSt, fontSize: 10 }}>
              <option value="">KIND: ALL</option>
              <option value="공시">공시</option>
              <option value="뉴스">뉴스</option>
            </select>
            <select value={filter.stockId} onChange={(e) => setFilter(f => ({ ...f, stockId: e.target.value }))} style={{ ...inputSt, fontSize: 10 }}>
              <option value="">STOCK: ALL</option>
              {watchlistOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <span style={{ flex: 1 }}/>
            {counts.new > 0 && (
              <button onClick={onMarkAllRead} style={{ ...btnSt, fontSize: 9, padding: '2px 10px', color: T.cyan, border: `1px solid ${T.cyan}` }}>
                ALL READ ({counts.new})
              </button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {sorted.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: T.inkFaint, fontSize: 11 }}>
                {(alerts || []).length === 0
                  ? setting.enabled ? '알림 없음. REFRESH NOW를 눌러 가져오세요.' : 'ALERTS ENABLED를 켜고 REFRESH NOW를 누르세요.'
                  : '필터 조건에 맞는 알림이 없습니다.'}
              </div>
            ) : sorted.map(a => {
              const sym = stocks[a.stockId]?.symbol || a.stockId;
              const dateStr = a.publishedAt ? new Date(a.publishedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
              const statusColor = a.status === 'new' ? T.amber : a.status === 'read' ? T.cyan : a.status === 'logged' ? T.green : T.inkFaint;
              return (
                <div key={a.id} style={{
                  borderBottom: `1px solid ${T.borderSoft}`, padding: 10,
                  display: 'flex', flexDirection: 'column', gap: 4,
                  opacity: a.status === 'dismissed' ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: T.inkFaint }}>
                    <span style={{ color: statusColor, fontWeight: 700, letterSpacing: '0.08em' }}>● {a.status?.toUpperCase()}</span>
                    <span style={{ color: T.amber, fontWeight: 700 }}>{sym}</span>
                    <span>· {a.source} / {a.kind}</span>
                    <span style={{ flex: 1 }}/>
                    <span>{dateStr}</span>
                  </div>
                  <div style={{ color: T.ink, fontSize: 12, lineHeight: 1.4 }}>{a.title || '(제목 없음)'}</div>
                  {a.summary && (
                    <div style={{ color: T.yellow, background: `${T.yellow}10`, border: `1px solid ${T.yellow}33`, padding: 8, fontSize: 10.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                      {a.summary}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    {a.url && (
                      <button onClick={() => onOpen(a)} style={{ ...btnSt, color: T.cyan, border: `1px solid ${T.cyan}`, fontSize: 9, padding: '2px 8px' }}>OPEN</button>
                    )}
                    {a.status === 'new' && (
                      <button onClick={() => onMarkRead(a)} style={{ ...btnSt, color: T.cyan, border: `1px solid ${T.cyan}44`, fontSize: 9, padding: '2px 8px' }}>READ</button>
                    )}
                    {a.status !== 'logged' && (
                      <button onClick={() => onLog(a)} style={{ ...btnSt, color: T.green, border: `1px solid ${T.green}`, fontSize: 9, padding: '2px 8px' }}>LOG</button>
                    )}
                    {a.status !== 'dismissed' && (
                      <button onClick={() => onDismiss(a)} style={{ ...btnSt, color: T.inkFaint, border: `1px solid ${T.borderSoft}`, fontSize: 9, padding: '2px 8px' }}>DISMISS</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Cell>
    </div>
  );
}

// ─── Edit pitch modal ─────────────────────────────────────────────────────────
function makeChecklistItem(row = {}) {
  return {
    id: row.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    category: row.category || 'GENERAL',
    text: row.text || '',
    done: !!row.done,
    updatedAt: row.updatedAt || new Date().toISOString(),
  };
}

function ChecklistPanel({ stock, onSave }) {
  const rows = stock.checklist || [];
  const [draft, setDraft] = useState({ category: 'THESIS', text: '' });
  const groups = ['DATA', 'THESIS', 'RISK', 'VALUATION', 'REVIEW', 'GENERAL'];
  const done = rows.filter(r => r.done).length;
  const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;
  const lastDoneAt = {};
  rows.forEach(r => {
    if (r.done && r.updatedAt) {
      const g = r.category || 'GENERAL';
      if (!lastDoneAt[g] || r.updatedAt > lastDoneAt[g]) lastDoneAt[g] = r.updatedAt;
    }
  });
  const saveRows = (next) => onSave?.(stock.id, next);
  const toggleRow = (id) => saveRows(rows.map(r => r.id === id ? { ...r, done: !r.done, updatedAt: new Date().toISOString() } : r));
  const removeRow = (id) => saveRows(rows.filter(r => r.id !== id));
  const addRow = () => {
    const text = draft.text.trim();
    if (!text) return;
    saveRows([makeChecklistItem({ ...draft, text }), ...rows]);
    setDraft(d => ({ ...d, text: '' }));
  };
  const loadTemplate = () => saveRows(CHECKLIST_TEMPLATE.map(makeChecklistItem));
  const clearDone = () => saveRows(rows.filter(r => !r.done));

  return (
    <Cell label={`CHECKLIST - ${done}/${rows.length} DONE`} accent={T.green} style={{ height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 8, height: '100%' }}>
        <div style={{ padding: 12, borderRight: `1px solid ${T.borderSoft}`, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.inkFaint, marginBottom: 6 }}>
              <span>COMPLETION</span><span style={{ color: T.green, fontWeight: 700 }}>{pct}%</span>
            </div>
            <div style={{ height: 7, background: T.surface2, border: `1px solid ${T.borderSoft}` }}>
              <div style={{ width: `${pct}%`, height: '100%', background: T.green }}/>
            </div>
          </div>
          <SettingRow label="CATEGORY">
            <select value={draft.category} onChange={(e) => setDraft(d => ({ ...d, category: e.target.value }))} style={{ ...inputSt, width: '100%' }}>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </SettingRow>
          <SettingRow label="NEW ITEM">
            <textarea value={draft.text} onChange={(e) => setDraft(d => ({ ...d, text: e.target.value }))}
              rows={3} style={{ ...inputSt, width: '100%', resize: 'vertical' }}/>
          </SettingRow>
          <button onClick={addRow} style={{ ...btnSt, color: T.green, border: `1px solid ${T.green}` }}>ADD CHECK</button>
          <button onClick={loadTemplate} style={{ ...btnSt, color: T.amber, border: `1px solid ${T.amber}` }}>LOAD TEMPLATE</button>
          <button onClick={clearDone} style={{ ...btnSt, color: T.inkFaint, border: `1px solid ${T.border}` }}>CLEAR DONE</button>
        </div>
        <div style={{ padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.length === 0 && <div style={{ color: T.inkFaint, fontSize: 12, padding: 12 }}>Load the default pitch checklist or add a custom item.</div>}
          {groups.map(group => {
            const items = rows.filter(r => (r.category || 'GENERAL') === group);
            if (!items.length) return null;
            return (
              <div key={group}>
                <div style={{ fontSize: 10, color: T.inkFaint, letterSpacing: '0.14em', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{group}</span>
                  {lastDoneAt[group] && <span style={{ color: T.inkFaint, fontWeight: 400 }}>완료 {lastDoneAt[group].slice(0, 10)}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto', gap: 8, alignItems: 'center', padding: '8px 10px', background: T.surface2, border: `1px solid ${item.done ? T.green + '55' : T.borderSoft}` }}>
                      <input type="checkbox" checked={!!item.done} onChange={() => toggleRow(item.id)} style={{ accentColor: T.green }}/>
                      <div style={{ color: item.done ? T.inkFaint : T.ink, fontSize: 11.5, lineHeight: 1.45, textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</div>
                      <button onClick={() => removeRow(item.id)} style={{ ...btnSt, color: T.inkFaint, border: `1px solid ${T.borderSoft}`, padding: '3px 7px', fontSize: 9 }}>DEL</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Cell>
  );
}

function CalendarPanel({ stocks, watchlistIds, activeId, onSelect, onSaveEvents }) {
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState({ date: today, kind: 'Manual', title: '', source: '', url: '' });
  const activeStock = stocks[activeId];
  const events = useMemo(() => {
    const list = [];
    for (const id of watchlistIds) {
      const s = stocks[id];
      if (!s) continue;
      if (s.review?.next) list.push({ id: `review-${id}`, stockId: id, symbol: s.symbol, date: s.review.next, kind: 'Review', title: `${s.symbol} review`, derived: true });
      for (const e of (s.calendarEvents || [])) list.push({ ...e, stockId: id, symbol: s.symbol, derived: false });
    }
    return list.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  }, [stocks, watchlistIds]);
  const addEvent = () => {
    if (!activeStock || !draft.title.trim()) return;
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, date: draft.date || today, kind: draft.kind || 'Manual', title: draft.title.trim(), source: draft.source.trim(), url: draft.url.trim(), done: false };
    onSaveEvents?.(activeStock.id, [item, ...(activeStock.calendarEvents || [])]);
    setDraft(d => ({ ...d, title: '', source: '', url: '' }));
  };
  const updateManual = (stockId, eventId, patch) => {
    const s = stocks[stockId];
    if (!s) return;
    onSaveEvents?.(stockId, (s.calendarEvents || []).map(e => e.id === eventId ? { ...e, ...patch } : e));
  };
  const removeManual = (stockId, eventId) => {
    const s = stocks[stockId];
    if (!s) return;
    onSaveEvents?.(stockId, (s.calendarEvents || []).filter(e => e.id !== eventId));
  };

  return (
    <Cell label="CALENDAR" accent={T.cyan} style={{ height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 8, height: '100%' }}>
        <div style={{ padding: 12, borderRight: `1px solid ${T.borderSoft}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 10, color: T.inkFaint }}>ADD EVENT FOR <span style={{ color: T.amber }}>{activeStock?.symbol}</span></div>
          <input type="date" value={draft.date} onChange={(e) => setDraft(d => ({ ...d, date: e.target.value }))} style={{ ...inputSt, width: '100%' }}/>
          <select value={draft.kind} onChange={(e) => setDraft(d => ({ ...d, kind: e.target.value }))} style={{ ...inputSt, width: '100%' }}>
            {['Earnings', 'Filing', 'Dividend', 'Investor Day', 'Manual'].map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <input value={draft.title} onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="event title" style={{ ...inputSt, width: '100%' }}/>
          <input value={draft.source} onChange={(e) => setDraft(d => ({ ...d, source: e.target.value }))} placeholder="source" style={{ ...inputSt, width: '100%' }}/>
          <input value={draft.url} onChange={(e) => setDraft(d => ({ ...d, url: e.target.value }))} placeholder="url" style={{ ...inputSt, width: '100%' }}/>
          <button onClick={addEvent} style={{ ...btnSt, color: T.cyan, border: `1px solid ${T.cyan}` }}>ADD EVENT</button>
        </div>
        <div style={{ padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {events.length === 0 && <div style={{ color: T.inkFaint, fontSize: 12 }}>No calendar events yet.</div>}
          {(() => {
            const week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
            const month = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
            const buckets = [
              { key: 'overdue', label: 'OVERDUE',      color: T.red,     items: events.filter(e => !e.done && e.date && e.date < today) },
              { key: 'week',    label: 'THIS WEEK',    color: T.yellow,  items: events.filter(e => !e.done && e.date >= today && e.date <= week) },
              { key: 'month',   label: 'NEXT 30 DAYS', color: T.cyan,    items: events.filter(e => !e.done && e.date > week && e.date <= month) },
              { key: 'later',   label: 'LATER',        color: T.inkFaint, items: events.filter(e => !e.done && (!e.date || e.date > month)) },
              { key: 'done',    label: 'DONE',         color: T.inkFaint, items: events.filter(e => e.done) },
            ].filter(b => b.items.length > 0);
            const renderRow = (e) => (
              <div key={`${e.stockId}-${e.id}`} style={{ display: 'grid', gridTemplateColumns: '96px 76px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 10px', background: T.surface2, border: `1px solid ${T.borderSoft}`, opacity: e.done ? 0.5 : 1 }}>
                <div style={{ fontSize: 10, color: T.inkFaint }}>{e.date || '--'}</div>
                <button onClick={() => onSelect?.(e.stockId)} style={{ ...btnSt, color: T.amber, border: `1px solid ${T.borderSoft}`, padding: '3px 7px', fontSize: 9 }}>{e.symbol}</button>
                <div>
                  <div style={{ color: T.ink, fontSize: 11.5 }}>{e.title}</div>
                  <div style={{ color: T.inkFaint, fontSize: 9 }}>{e.kind}{e.source ? ` - ${e.source}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {e.url && <button onClick={() => window.open(e.url, '_blank', 'noopener,noreferrer')} style={{ ...btnSt, color: T.cyan, border: `1px solid ${T.cyan}`, padding: '3px 7px', fontSize: 9 }}>OPEN</button>}
                  {!e.derived && <button onClick={() => updateManual(e.stockId, e.id, { done: !e.done })} style={{ ...btnSt, color: T.green, border: `1px solid ${T.green}`, padding: '3px 7px', fontSize: 9 }}>{e.done ? 'UNDO' : 'DONE'}</button>}
                  {!e.derived && <button onClick={() => removeManual(e.stockId, e.id)} style={{ ...btnSt, color: T.inkFaint, border: `1px solid ${T.borderSoft}`, padding: '3px 7px', fontSize: 9 }}>DEL</button>}
                </div>
              </div>
            );
            return buckets.map(b => (
              <div key={b.key}>
                <div style={{ fontSize: 9, color: b.color, letterSpacing: '0.14em', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 4, height: 4, background: b.color, borderRadius: 1 }}/>
                  {b.label} <span style={{ color: T.inkFaint, fontWeight: 400 }}>({b.items.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{b.items.map(renderRow)}</div>
              </div>
            ));
          })()}
        </div>
      </div>
    </Cell>
  );
}

const DECISION_TYPES = [
  { k: 'BUY',    color: '#4ade80' },
  { k: 'ADD',    color: '#60a5fa' },
  { k: 'SELL',   color: '#f87171' },
  { k: 'REVIEW', color: '#facc15' },
];

function JournalPanel({ stock, onCapture, onUpdate }) {
  const rows = [...(stock.journal || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const current = Number(stock.price) || 0;

  const updateRow = (id, patch, prevOutcome) => {
    const now = new Date().toISOString();
    const resolved = ['hit', 'miss', 'mixed'];
    const extra = {};
    if (patch.outcome && patch.outcome !== 'pending' && prevOutcome === 'pending' && resolved.includes(patch.outcome)) {
      extra.outcomePrice = current;
      extra.outcomeDate = now;
    }
    onUpdate?.(stock.id, (stock.journal || []).map(r => r.id === id ? { ...r, ...patch, ...extra } : r));
  };
  const removeRow = (id) => onUpdate?.(stock.id, (stock.journal || []).filter(r => r.id !== id));

  // Stats
  const resolved = rows.filter(r => r.outcome && r.outcome !== 'pending');
  const hits = resolved.filter(r => r.outcome === 'hit').length;
  const hitRate = resolved.length ? Math.round((hits / resolved.length) * 100) : null;
  const returns = resolved.filter(r => r.outcomePrice && r.price).map(r => ((r.outcomePrice - r.price) / r.price) * 100);
  const avgReturn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : null;

  const dtColor = { BUY: '#4ade80', ADD: '#60a5fa', SELL: '#f87171', REVIEW: '#facc15' };

  return (
    <Cell label="DECISION JOURNAL" accent={T.yellow} style={{ height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Stats bar */}
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${T.borderSoft}`, display: 'flex', gap: 20, alignItems: 'center', background: T.surface2 }}>
          <div style={{ fontSize: 10, color: T.inkFaint }}>SNAPSHOTS <span style={{ color: T.ink }}>{rows.length}</span></div>
          <div style={{ fontSize: 10, color: T.inkFaint }}>HIT RATE <span style={{ color: hitRate === null ? T.inkFaint : hitRate >= 60 ? '#4ade80' : hitRate >= 40 ? T.yellow : '#f87171' }}>{hitRate === null ? '--' : `${hitRate}%`}</span></div>
          <div style={{ fontSize: 10, color: T.inkFaint }}>AVG RETURN <span style={{ color: avgReturn === null ? T.inkFaint : colorForChange(avgReturn) }}>{avgReturn === null ? '--' : `${sign(avgReturn)}${safeFixed(avgReturn, 1)}%`}</span></div>
          <div style={{ fontSize: 10, color: T.inkFaint, marginLeft: 'auto' }}>{resolved.length}/{rows.length} resolved</div>
        </div>
        {/* Capture buttons */}
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${T.borderSoft}`, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: T.inkFaint, marginRight: 4 }}>CAPTURE AS:</span>
          {DECISION_TYPES.map(({ k, color }) => (
            <button key={k} onClick={() => onCapture?.(stock.id, k)}
              style={{ ...btnSt, color, border: `1px solid ${color}`, padding: '3px 10px', fontSize: 10 }}>
              {k}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.length === 0 && <div style={{ color: T.inkFaint, fontSize: 12 }}>No journal entries yet.</div>}
          {rows.map(row => {
            const entryPrice = Number(row.price) || 0;
            const move = entryPrice ? ((current - entryPrice) / entryPrice) * 100 : null;
            const outP = Number(row.outcomePrice) || 0;
            const outMove = (outP && entryPrice) ? ((outP - entryPrice) / entryPrice) * 100 : null;
            const dc = row.decisionType ? (dtColor[row.decisionType] || T.inkFaint) : null;
            const endMs = row.outcomeDate ? new Date(row.outcomeDate).getTime() : (row.outcome === 'pending' ? Date.now() : null);
            const heldDays = row.date && endMs ? Math.floor((endMs - new Date(row.date).getTime()) / 86400000) : null;
            return (
              <div key={row.id} style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 110px 1fr 110px auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  {dc ? (
                    <span style={{ fontSize: 9, fontWeight: 700, color: dc, border: `1px solid ${dc}`, padding: '1px 6px', letterSpacing: '0.08em' }}>{row.decisionType}</span>
                  ) : <span/>}
                  <div style={{ fontSize: 10, color: T.inkFaint }}>{String(row.date || '').replace('T', ' ').slice(0, 16)}</div>
                  <div style={{ fontSize: 11, color: T.ink, fontWeight: 700 }}>{row.recommendation || 'Watch'} · entry {fmtPx(row.price, stock.currency)} · target {fmtPx(row.target, stock.currency)}</div>
                  <select value={row.outcome || 'pending'} onChange={(e) => updateRow(row.id, { outcome: e.target.value }, row.outcome)} style={{ ...inputSt, width: '100%' }}>
                    <option value="pending">PENDING</option><option value="hit">HIT</option><option value="miss">MISS</option><option value="mixed">MIXED</option>
                  </select>
                  <button onClick={() => removeRow(row.id)} style={{ ...btnSt, color: T.inkFaint, border: `1px solid ${T.borderSoft}`, padding: '4px 8px' }}>DEL</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 12 }}>
                  <textarea value={row.note || ''} onChange={(e) => updateRow(row.id, { note: e.target.value }, row.outcome)} rows={3} placeholder="post-mortem note" style={{ ...inputSt, resize: 'vertical' }}/>
                  <div style={{ fontSize: 10, color: T.inkFaint, lineHeight: 1.8 }}>
                    <div>Now: <span style={{ color: T.ink }}>{fmtPx(current, stock.currency)}</span></div>
                    <div>Open P&L: <span style={{ color: move === null ? T.inkFaint : colorForChange(move) }}>{move === null ? '--' : `${sign(move)}${safeFixed(move, 1)}%`}</span></div>
                    {outP > 0 && (
                      <div>Realized: <span style={{ color: outMove === null ? T.inkFaint : colorForChange(outMove), fontWeight: 700 }}>{outMove === null ? '--' : `${sign(outMove)}${safeFixed(outMove, 1)}%`}</span></div>
                    )}
                    {heldDays !== null && (
                      <div>Held: <span style={{ color: T.inkDim }}>{row.outcome === 'pending' ? `${heldDays}d (진행중)` : `${heldDays}d`}</span></div>
                    )}
                    <div style={{ borderTop: `1px solid ${T.borderSoft}`, marginTop: 4, paddingTop: 4 }}>Score: <span style={{ color: T.inkDim }}>{row.score !== null && row.score !== undefined ? row.score : '--'}</span></div>
                    <div style={{ fontSize: 9, color: T.inkFaint, marginTop: 2 }}>{row.oneLine || '-'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Cell>
  );
}


function EditPitchModal({ stock, onSave, onClose }) {
  const valuation = stock.valuation || {};
  const scenarioKeys = ['bear', 'base', 'bull'];
  const scenarioLabel = { bear: 'BEAR', base: 'BASE', bull: 'BULL' };
  const scenarioForm = scenarioKeys.reduce((acc, key) => {
    const row = valuation[key] || {};
    acc[`${key}Driver`] = row.driver ?? '';
    acc[`${key}Multiple`] = row.multiple ?? '';
    acc[`${key}Mos`] = row.mos ?? '';
    acc[`${key}Price`] = row.price ?? '';
    return acc;
  }, {});
  const [form, setForm] = useState({
    recommendation: stock.recommendation || 'Watch',
    oneLine: stock.oneLine || '',
    keyQuestion: stock.keyQuestion || '',
    thesis: (stock.thesis || []).join('\n'),
    catalysts: (stock.catalysts || []).join('\n'),
    risks: (stock.risks || []).join('\n'),
    variantView: stock.variantView || '',
    changeMind: stock.changeMind || '',
    target: String(stock.target || ''),
    valuationNote: valuation.note || '',
    ...scenarioForm,
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const toNum = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) && String(v).trim() !== '' ? n : fallback;
  };
  const buildScenario = (key) => {
    const driver = toNum(form[`${key}Driver`], 0);
    const multiple = toNum(form[`${key}Multiple`], 0);
    const priceInput = form[`${key}Price`];
    const price = toNum(priceInput, driver && multiple ? driver * multiple : 0);
    return {
      driver,
      multiple,
      mos: toNum(form[`${key}Mos`], 0),
      price: Math.round(price * 10) / 10,
    };
  };

  const handleSave = () => {
    onSave(stock.id, {
      recommendation: form.recommendation,
      oneLine: form.oneLine,
      keyQuestion: form.keyQuestion,
      thesis: form.thesis.split('\n').map(s => s.trim()).filter(Boolean),
      catalysts: form.catalysts.split('\n').map(s => s.trim()).filter(Boolean),
      risks: form.risks.split('\n').map(s => s.trim()).filter(Boolean),
      variantView: form.variantView,
      changeMind: form.changeMind,
      target: Number(form.target) || stock.target,
      valuation: {
        bear: buildScenario('bear'),
        base: buildScenario('base'),
        bull: buildScenario('bull'),
        note: form.valuationNote,
      },
    });
    onClose();
  };

  const recOpts = ['Buy', 'Hold', 'Watch', 'Trim', 'Sell'];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, border: `1px solid ${T.border}`, width: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: T.amber }}>EDIT PITCH · {stock.symbol}</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 0, color: T.inkFaint, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SettingRow label="RECOMMENDATION">
              <select value={form.recommendation} onChange={set('recommendation')}
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.ink, fontFamily: T.font, fontSize: 11, padding: '5px 8px', width: '100%' }}>
                {recOpts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </SettingRow>
            <SettingRow label="TARGET PRICE">
              <input type="number" value={form.target} onChange={set('target')} style={{ ...inputSt, width: '100%' }}/>
            </SettingRow>
          </div>
          <SettingRow label="ONE-LINE SUMMARY">
            <input value={form.oneLine} onChange={set('oneLine')} style={{ ...inputSt, width: '100%' }}/>
          </SettingRow>
          <SettingRow label="KEY QUESTION">
            <input value={form.keyQuestion} onChange={set('keyQuestion')} style={{ ...inputSt, width: '100%' }}/>
          </SettingRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SettingRow label="THESIS (한 줄씩)">
              <textarea value={form.thesis} onChange={set('thesis')} rows={4} style={{ ...inputSt, width: '100%', resize: 'vertical' }}/>
            </SettingRow>
            <SettingRow label="CATALYSTS (한 줄씩)">
              <textarea value={form.catalysts} onChange={set('catalysts')} rows={4} style={{ ...inputSt, width: '100%', resize: 'vertical' }}/>
            </SettingRow>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SettingRow label="RISKS (한 줄씩)">
              <textarea value={form.risks} onChange={set('risks')} rows={3} style={{ ...inputSt, width: '100%', resize: 'vertical' }}/>
            </SettingRow>
            <SettingRow label="VARIANT VIEW">
              <textarea value={form.variantView} onChange={set('variantView')} rows={3} style={{ ...inputSt, width: '100%', resize: 'vertical' }}/>
            </SettingRow>
          </div>
          <SettingRow label="CHANGE MIND IF">
            <textarea value={form.changeMind} onChange={set('changeMind')} rows={2} style={{ ...inputSt, width: '100%', resize: 'vertical' }}/>
          </SettingRow>
          <div style={{ borderTop: `1px solid ${T.borderSoft}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 9, color: T.green, letterSpacing: '0.14em', fontWeight: 700 }}>VALUATION SCENARIOS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(4, 1fr)', gap: 8, alignItems: 'center' }}>
              <div />
              {['DRIVER', 'MULTIPLE', 'MOS %', 'PRICE'].map(h => (
                <div key={h} style={{ fontSize: 10, color: T.inkFaint, letterSpacing: '0.12em' }}>{h}</div>
              ))}
              {scenarioKeys.map(key => (
                <React.Fragment key={key}>
                  <div style={{ fontSize: 10, color: key === 'bear' ? T.red : key === 'base' ? T.amber : T.green, fontWeight: 700 }}>
                    {scenarioLabel[key]}
                  </div>
                  <input type="number" value={form[`${key}Driver`]} onChange={set(`${key}Driver`)} style={{ ...inputSt, minWidth: 0 }}/>
                  <input type="number" value={form[`${key}Multiple`]} onChange={set(`${key}Multiple`)} style={{ ...inputSt, minWidth: 0 }}/>
                  <input type="number" value={form[`${key}Mos`]} onChange={set(`${key}Mos`)} style={{ ...inputSt, minWidth: 0 }}/>
                  <input type="number" value={form[`${key}Price`]} onChange={set(`${key}Price`)} style={{ ...inputSt, minWidth: 0 }}/>
                </React.Fragment>
              ))}
            </div>
            <SettingRow label="VALUATION NOTE">
              <textarea value={form.valuationNote} onChange={set('valuationNote')} rows={2} style={{ ...inputSt, width: '100%', resize: 'vertical' }}/>
            </SettingRow>
          </div>
        </div>
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSt, color: T.inkDim, border: `1px solid ${T.border}` }}>취소</button>
          <button onClick={handleSave} style={{ ...btnSt, color: T.amber, border: `1px solid ${T.amber}` }}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ─── Status bar ───────────────────────────────────────────────────────────────
function StatusBar({ stocks, watchlistIds, fetchStatus, refreshing, userEmail, syncStatus, onLogout }) {
  const overdue = watchlistIds.filter(id => {
    const s = stocks[id];
    const d = getDaysLeft(s?.review?.next);
    return d !== null && d < 0;
  }).length;

  const avgScore = useMemo(() => {
    const vals = watchlistIds.map(id => stocks[id]?.scores?.overall).filter(v => Number.isFinite(v));
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [stocks, watchlistIds]);

  return (
    <div style={{
      height: 24, display: 'flex', alignItems: 'center', gap: 18, padding: '0 14px',
      background: T.bg, borderTop: `1px solid ${T.border}`, fontSize: 10, color: T.inkFaint,
      fontVariantNumeric: 'tabular-nums',
    }}>
      <span style={{ color: T.amber }}>{watchlistIds.length} stocks</span>
      {avgScore !== null && <span>avg score: {avgScore}pt</span>}
      {overdue > 0 && <span style={{ color: T.red }}>⚠ {overdue} review overdue</span>}
      {refreshing && <span style={{ color: T.amber }}>⟳ {fetchStatus || 'fetching...'}</span>}
      <span style={{ marginLeft: 'auto' }}>{new Date().toISOString().slice(0, 10)}</span>
      {userEmail && (
        <>
          {syncStatus === 'saving' && <span style={{ color: T.amber }}>SYNC↑</span>}
          {syncStatus === 'synced' && <span style={{ color: T.cyan  }}>SYNC↓</span>}
          {syncStatus === 'error'  && <span style={{ color: T.red   }}>SYNC ERR</span>}
          <span style={{ color: T.inkFaint }}>{userEmail}</span>
          <button onClick={onLogout} style={{
            background: 'none', border: 'none', color: T.inkFaint, fontFamily: T.font,
            fontSize: 10, cursor: 'pointer', letterSpacing: '0.06em', padding: 0,
          }}>LOGOUT</button>
        </>
      )}
    </div>
  );
}

// ─── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onSession }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(''); setInfo('');
    if (!email || !password) { setErr('이메일과 비밀번호를 입력하세요.'); return; }
    setBusy(true);
    try {
      const sb = getSb();
      if (mode === 'signup') {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('가입 이메일을 확인하세요. 확인 후 로그인할 수 있습니다.');
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSession(data.session);
      }
    } catch (ex) {
      setErr(ex.message || '로그인 실패');
    } finally {
      setBusy(false);
    }
  }

  const inp = {
    width: '100%', padding: '8px 10px', background: '#0d1116',
    border: `1px solid ${T.border}`, color: T.ink, fontFamily: T.font,
    fontSize: 12, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'grid', placeItems: 'center', padding: 24, fontFamily: T.font }}>
      <div style={{ width: 'min(380px, 100%)', border: `1px solid ${T.border}`, background: T.surface, padding: 28 }}>
        <div style={{ color: T.amber, fontSize: 11, letterSpacing: '0.14em', fontWeight: 800, marginBottom: 6 }}>THESISTRACK</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 22 }}>
          {mode === 'login' ? '로그인' : '회원가입'}
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="email" placeholder="이메일" value={email}
            onChange={e => setEmail(e.target.value)} style={inp} autoFocus/>
          <input type="password" placeholder="비밀번호" value={password}
            onChange={e => setPassword(e.target.value)} style={inp}/>
          {err  && <div style={{ color: T.red,   fontSize: 11 }}>{err}</div>}
          {info && <div style={{ color: T.green, fontSize: 11 }}>{info}</div>}
          <button type="submit" disabled={busy} style={{
            background: 'transparent', border: `1px solid ${T.amber}`, color: T.amber,
            padding: '9px 0', fontFamily: T.font, fontSize: 11, letterSpacing: '0.1em',
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
          }}>
            {busy ? '처리 중...' : mode === 'login' ? 'SIGN IN' : 'SIGN UP'}
          </button>
        </form>
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <button onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setErr(''); setInfo(''); }}
            style={{ background: 'none', border: 'none', color: T.inkDim, fontFamily: T.font, fontSize: 11, cursor: 'pointer' }}>
            {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ThesisTrack render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const msg = this.state.error?.message || 'Unknown render error';
    return (
      <div style={{
        minHeight: '100vh',
        background: T.bg,
        color: T.ink,
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        fontFamily: T.font,
      }}>
        <div style={{ width: 'min(720px, 100%)', border: `1px solid ${T.border}`, background: T.surface, padding: 22 }}>
          <div style={{ color: T.red, fontSize: 11, letterSpacing: '0.14em', fontWeight: 800, marginBottom: 10 }}>
            THESISTRACK RECOVERY
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>화면 렌더링 중 오류가 발생했습니다.</div>
          <div style={{ color: T.inkDim, fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
            저장된 종목 상태가 이전 버전과 맞지 않을 때 발생할 수 있습니다. 먼저 active 종목만 복구해 보세요.
          </div>
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: T.red,
            background: '#12090a',
            border: `1px solid ${T.red}55`,
            padding: 12,
            fontSize: 11,
            lineHeight: 1.5,
            margin: '0 0 14px',
          }}>{msg}</pre>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={repairSavedActiveStock} style={{ ...btnSt, color: T.cyan, border: `1px solid ${T.cyan}`, padding: '8px 12px' }}>
              REPAIR ACTIVE STOCK
            </button>
            <button onClick={resetSavedAppState} style={{ ...btnSt, color: T.red, border: `1px solid ${T.red}`, padding: '8px 12px' }}>
              RESET LOCAL DATA
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function App({ initialData }) {
  // ── Supabase auth state ───────────────────────────────────────────────────
  const sbConfigured = isSupabaseConfigured();
  const [session, setSession]         = useState(null);
  const [authLoading, setAuthLoading] = useState(sbConfigured);
  const [sbSyncStatus, setSbSyncStatus] = useState('idle'); // 'idle'|'saving'|'error'|'synced'
  const remoteLoadedRef = useRef(false);
  const sbSaveTimerRef      = useRef(null);
  const isApplyingRemoteRef = useRef(false);

  // ── State ──────────────────────────────────────────────────────────────────
  const initial = initialData;

  const [stocks, setStocks]               = useState(initial.stocks);
  const [watchlistIds, setWatchlistIds]   = useState(initial.watchlistIds);
  const [watchlists, setWatchlists]       = useState(initial.watchlists);
  const [activeWatchlistId, setActiveWatchlistId] = useState(initial.activeWatchlistId);
  const [trades, setTrades]               = useState(initial.trades || []);
  const [shareViewerData, setShareViewerData] = useState(null);
  const [activeId, setActiveId]           = useState(initial.activeId);
  const [apiSettings, setApiSettings]     = useState(initial.apiSettings);
  const [dataCache, setDataCache]         = useState(initial.dataCache);
  const [dartCorpMap, setDartCorpMap]     = useState(initial.dartCorpMap);
  const [dartAutoStatus, setDartAutoStatus] = useState({
    kind: 'idle',
    text: 'dart-corp-codes.json not checked',
  });
  const [marketTickers, setMarketTickers] = useState(DEFAULT_MARKET_TICKERS);

  useEffect(() => {
    let cancelled = false;
    const fetchMacros = async () => {
      try {
        const macros = await fetchMacroIndicators();
        if (cancelled || !macros || macros.length === 0) return;
        setMarketTickers(macros.map(m => {
          return {
            symbol: m.name.replace('USD/KRW', 'USDKRW').replace('S&P 500', 'S&P'),
            val: m.price ? m.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-',
            change: m.changePercent ? m.changePercent : 0,
          };
        }));
      } catch (e) { }
    };
    fetchMacros();
    const iv = setInterval(fetchMacros, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);
  const [alerts, setAlerts]                 = useState(initial.alerts);
  const [alertSettings, setAlertSettings]   = useState(initial.alertSettings);
  const [alertErrors, setAlertErrors]       = useState([]);
  const [alertStatus, setAlertStatus]       = useState(null);
  const [alertsRefreshing, setAlertsRefreshing] = useState(false);
  const [lastAlertsPolled, setLastAlertsPolled] = useState(null);

  const [refreshing, setRefreshing]       = useState(false);
  const [fetchStatus, setFetchStatus]     = useState('');
  const [chartPrefs, setChartPrefs]       = useState({});
  const [providerStatus, setProviderStatus] = useState(() => ({
    kind: 'idle',
    label: providerLabels[apiSettings.globalProvider] || 'DATA',
    text: '데이터 대기 중',
  }));
  const [toasts, setToasts]               = useState([]);
  const [activePanel, setActivePanel]     = useState('F1');
  const [searchMode, setSearchMode]       = useState(null); // 'watchlist' | 'peer' | null
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [pitchEditId, setPitchEditId]     = useState(null);
  const [showHelp, setShowHelp]           = useState(false);
  // tweaks-panel is a design-time tool; not used at runtime in terminal

  const stock = stocks[activeId] || Object.values(stocks)[0] || makeBlankStock({ id: 'EMPTY', symbol: 'EMPTY', name: 'No Stock' });
  const dartCoverage = useMemo(() => {
    const krx = watchlistIds.map(id => stocks[id]).filter(s => s?.market === 'KRX');
    const missingKrx = krx.filter(s => !getDartCorpEntry(dartCorpMap, s));
    return {
      mapCount: Object.keys(dartCorpMap || {}).length,
      krxCount: krx.length,
      mappedKrxCount: krx.length - missingKrx.length,
      missingKrx,
      hasOpenDartKey: !!apiSettings.openDartKey,
    };
  }, [stocks, watchlistIds, dartCorpMap, apiSettings.openDartKey]);
  const dartCorpMapRef = useRef(dartCorpMap);
  useEffect(() => { dartCorpMapRef.current = dartCorpMap; }, [dartCorpMap]);
  const stocksRef = useRef(stocks);
  const watchlistIdsRef = useRef(watchlistIds);
  const activeWatchlistIdRef = useRef(activeWatchlistId);
  const liveRefreshRef = useRef(false);
  useEffect(() => { stocksRef.current = stocks; }, [stocks]);
  useEffect(() => { watchlistIdsRef.current = watchlistIds; }, [watchlistIds]);
  useEffect(() => { activeWatchlistIdRef.current = activeWatchlistId; }, [activeWatchlistId]);

  // ── URL share param detection ──────────────────────────────────────────────
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('share');
    if (!param) return;
    try {
      const json = decodeURIComponent(escape(atob(param)));
      setShareViewerData(JSON.parse(json));
    } catch { /* malformed */ }
  }, []);

  // ── Persistence ────────────────────────────────────────────────────────────
  useEffect(() => {
    saveAppState({ stocks, watchlistIds, watchlists, activeWatchlistId, activeId, apiSettings, dataCache, dartCorpMap, alerts, alertSettings, trades });
  }, [stocks, watchlistIds, watchlists, activeWatchlistId, activeId, apiSettings, dataCache, dartCorpMap, alerts, alertSettings, trades]);

  // ── Supabase session bootstrap ────────────────────────────────────────────
  useEffect(() => {
    if (!sbConfigured) return;
    const sb = getSb();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_ev, sess) => {
      setSession(sess);
      if (!sess) remoteLoadedRef.current = false;
    });
    return () => subscription.unsubscribe();
  }, [sbConfigured]);

  // ── Realtime subscription — receive changes pushed from other devices ────
  useEffect(() => {
    if (!session || !sbConfigured) return;
    const sb = getSb();
    const channel = sb
      .channel(`user-data:${session.user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_data',
        filter: `user_id=eq.${session.user.id}`,
      }, ({ new: row }) => {
        const p = row?.payload;
        if (!p) return;
        isApplyingRemoteRef.current = true;
        if (p.stocks && typeof p.stocks === 'object') setStocks(normalizeStocksMap(p.stocks));
        if (Array.isArray(p.watchlistIds)) setWatchlistIds(p.watchlistIds);
        if (Array.isArray(p.watchlists)) setWatchlists(p.watchlists);
        if (p.activeWatchlistId != null) setActiveWatchlistId(p.activeWatchlistId);
        if (p.activeId) setActiveId(p.activeId);
        if (p.dartCorpMap && typeof p.dartCorpMap === 'object') setDartCorpMap(p.dartCorpMap);
        if (Array.isArray(p.alerts)) setAlerts(p.alerts);
        if (p.alertSettings && typeof p.alertSettings === 'object') setAlertSettings(s => ({ ...s, ...p.alertSettings }));
        if (Array.isArray(p.trades)) setTrades(p.trades);
        setSbSyncStatus('synced');
        // Clear guard after 3s (> 2s debounce) to prevent echo-back to Supabase
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
          setSbSyncStatus('idle');
        }, 3000);
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [session, sbConfigured]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load remote data once on first authenticated session ──────────────────
  useEffect(() => {
    if (!session || remoteLoadedRef.current) return;
    remoteLoadedRef.current = true;
    getSb().from('user_data').select('payload').eq('user_id', session.user.id).single()
      .then(({ data, error }) => {
        if (error || !data?.payload) {
          // 신규 사용자 — 빈 상태로 시작 (로컬 데이터를 덮어쓰지 않음)
          // 기존 로컬 데이터가 있다면 StatusBar의 "로컬 데이터 가져오기" 버튼으로 마이그레이션 가능
          const snap = { stocks: {}, watchlistIds: [], watchlists: [], activeWatchlistId: null, activeId: null, dartCorpMap: {}, alerts: [], alertSettings: {}, trades: [] };
          getSb().from('user_data').upsert({ user_id: session.user.id, payload: snap }, { onConflict: 'user_id' });
          setStocks({});
          setWatchlistIds([]);
          setWatchlists([]);
          setActiveWatchlistId(null);
          setActiveId(null);
          return;
        }
        // 기존 사용자 — 원격 데이터로 완전히 교체 (로컬 데이터 무시)
        const p = data.payload;
        if (p.stocks && typeof p.stocks === 'object') setStocks(normalizeStocksMap(p.stocks));
        setWatchlistIds(Array.isArray(p.watchlistIds) ? p.watchlistIds : []);
        if (Array.isArray(p.watchlists)) setWatchlists(p.watchlists);
        if (p.activeWatchlistId != null) setActiveWatchlistId(p.activeWatchlistId);
        if (p.activeId) setActiveId(p.activeId);
        // apiSettings: NOT synced — API keys stay device-local (localStorage only)
        // dataCache:   NOT synced — financial data cache stays device-local
        if (p.dartCorpMap && typeof p.dartCorpMap === 'object') setDartCorpMap(p.dartCorpMap);
        if (Array.isArray(p.alerts)) setAlerts(p.alerts);
        if (p.alertSettings && typeof p.alertSettings === 'object') setAlertSettings(p.alertSettings);
        if (Array.isArray(p.trades)) setTrades(p.trades);
      });
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced save to Supabase on every state change ──────────────────────
  useEffect(() => {
    if (!session || isApplyingRemoteRef.current) return;
    clearTimeout(sbSaveTimerRef.current);
    sbSaveTimerRef.current = setTimeout(async () => {
      if (isApplyingRemoteRef.current) return; // remote update still settling
      setSbSyncStatus('saving');
      // apiSettings excluded: API keys stay device-local (localStorage only)
      // dataCache excluded: financial data cache is large and transient
      const snap = { stocks, watchlistIds, watchlists, activeWatchlistId, activeId, dartCorpMap, alerts, alertSettings, trades };
      const { error } = await getSb().from('user_data').upsert(
        { user_id: session.user.id, payload: snap },
        { onConflict: 'user_id' }
      );
      setSbSyncStatus(error ? 'error' : 'idle');
    }, 2000);
    return () => clearTimeout(sbSaveTimerRef.current);
  }, [session, stocks, watchlistIds, watchlists, activeWatchlistId, activeId, dartCorpMap, alerts, alertSettings, trades]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const toast = useCallback((msg, kind = 'info', ms = 1500) => {
    const id = Date.now() + Math.random();
    setToasts(ts => [...ts, { id, msg, kind }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), ms);
  }, []);

  // ── Market ticker refresh ─────────────────────────────────────────────────
  const loadLocalDartMap = useCallback(async (showToast = false) => {
    setDartAutoStatus({ kind: 'info', text: 'loading dart-corp-codes.json...' });
    const result = await fetchLocalDartCorpMap();
    if (result.status === 'loaded') {
      const before = dartCorpMapRef.current || {};
      const next = { ...result.map, ...before };
      const added = Object.keys(next).length - Object.keys(before).length;
      if (added > 0) {
        dartCorpMapRef.current = next;
        setDartCorpMap(next);
      }
      const text = `dart-corp-codes.json loaded: ${result.count.toLocaleString('en-US')} entries, ${added} new`;
      setDartAutoStatus({ kind: 'ok', text });
      if (showToast) toast(text, 'ok');
      return result;
    }
    const kind = result.status === 'missing' ? 'warn' : 'error';
    const text = result.status === 'missing'
      ? 'dart-corp-codes.json not found'
      : `dart-corp-codes.json load failed: ${result.message}`;
    setDartAutoStatus({ kind, text });
    if (showToast) toast(text, kind === 'error' ? 'error' : 'info', 6000);
    return result;
  }, [toast]);

  useEffect(() => {
    loadLocalDartMap(false);
  }, [loadLocalDartMap]);

  const refreshMarketTickers = useCallback(async () => {
    const next = await Promise.all(DEFAULT_MARKET_TICKERS.map(async (ticker) => {
      const yahoo = tickerYahooMap[ticker.symbol];
      if (!yahoo) return ticker;
      try {
        const params = new URLSearchParams({ range: '5d', interval: '1d' });
        const res = await fetch(buildYahooChartUrl(yahoo, params));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        const quote = (result?.indicators?.quote?.[0]?.close || []).map(Number).filter(Number.isFinite);
        const price = Number(result?.meta?.regularMarketPrice) || quote.at(-1);
        const prev = Number(result?.meta?.regularMarketPreviousClose)
                  || Number(result?.meta?.previousClose)
                  || quote.at(-2)
                  || price;
        if (!Number.isFinite(price)) return ticker;
        const change = prev ? ((price - prev) / prev) * 100 : 0;
        const val = ticker.symbol === 'US10Y'
          ? `${safeFixed(price / 10, 3)}%`
          : ticker.symbol === 'USDKRW'
            ? safeFixed(price, 2)
            : ticker.symbol === 'BTC'
              ? Math.round(price).toLocaleString('en-US')
              : safeFixed(price, 2);
        return { ...ticker, val, change: Math.round(change * 100) / 100 };
      } catch {
        return ticker;
      }
    }));
    setMarketTickers(next);
  }, []);

  useEffect(() => {
    refreshMarketTickers();
  }, [refreshMarketTickers]);

  const refreshLivePrices = useCallback(async (ids = watchlistIdsRef.current, opts = {}) => {
    if (liveRefreshRef.current) return;
    const idList = [...new Set(ids || [])].filter(id => stocksRef.current[id]);
    if (!idList.length) return;
    liveRefreshRef.current = true;
    let ok = 0;
    const updates = {};

    try {
      for (const id of idList) {
        const s = stocksRef.current[id];
        try {
          updates[id] = await fetchLivePrice(s);
          ok += 1;
        } catch {
          // Live quotes are best-effort; full data refresh remains available.
        }
        await new Promise(r => setTimeout(r, 120));
      }

      if (Object.keys(updates).length) {
        setStocks(prev => {
          const next = { ...prev };
          for (const [id, payload] of Object.entries(updates)) {
            const old = next[id];
            if (!old) continue;
            next[id] = {
              ...old,
              ...(payload.price !== undefined ? { price: payload.price } : {}),
              ...(payload.prevClose !== undefined ? { prevClose: payload.prevClose } : {}),
              ...(payload.priceHistory !== undefined ? { priceHistory: payload.priceHistory } : {}),
              ...(payload.priceSrc !== undefined ? { priceSrc: payload.priceSrc } : {}),
              ...(payload.priceAsOf !== undefined ? { priceAsOf: payload.priceAsOf } : {}),
            };
          }
          return next;
        });
      }

      if (!opts.silent) {
        const stamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        setProviderStatus({
          kind: ok ? 'ok' : 'warn',
          label: 'LIVE',
          text: ok ? `실시간 가격 ${ok}/${idList.length} 갱신 · ${stamp}` : '실시간 가격 갱신 실패',
        });
        if (ok) toast(`실시간 가격 ${ok}개 갱신`, 'ok');
      }
    } finally {
      liveRefreshRef.current = false;
    }
  }, [toast]);

  useEffect(() => {
    refreshLivePrices(undefined, { silent: true });
    const id = setInterval(() => {
      if (!document.hidden) refreshLivePrices(undefined, { silent: true });
    }, 120000);
    const onVisible = () => {
      if (!document.hidden) refreshLivePrices(undefined, { silent: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshLivePrices]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = Object.fromEntries(PANEL_DEFS.map(p => [p.k, p.k]));
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (map[e.key]) { e.preventDefault(); setActivePanel(map[e.key]); }
      if (e.key === '/' && !searchMode) { e.preventDefault(); setSearchMode('watchlist'); }
      if (e.key === '?') { e.preventDefault(); setShowHelp(h => !h); }
      if (e.key === 'Escape') { setSearchMode(null); setSettingsOpen(false); setPitchEditId(null); setShowHelp(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchMode]);

  // ── Refresh handler ────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async (stockId) => {
    const s = stocks[stockId];
    if (!s || refreshing) return;
    setRefreshing(true);
    setFetchStatus('');
    setProviderStatus({ kind: 'idle', label: providerLabels[apiSettings.globalProvider] || 'DATA', text: `${providerLabels[apiSettings.globalProvider] || 'DATA'} 요청 중` });
    try {
      const result = await fetchStockData(s, apiSettings, dataCache, dartCorpMap, setFetchStatus);
      const { cacheUpdates, fromCache, fromStaleCache, staleAgeDays, fetchError, ...payload } = result;

      setStocks(prev => {
        const updated = { ...prev };
        const old = { ...updated[stockId] };
        const newMetrics = { ...old.metrics, ...(payload.metrics || {}) };
        const newIndustryGroup = payload.industryGroup || old.industryGroup || null;
        
        // Push the old score to history before computing the new one
        const now = new Date().toISOString().slice(0, 10);
        const newScoreHistory = [...(old.scoreHistory || []).slice(-11), old.scores?.overall ?? 0];

        updated[stockId] = {
          ...old,
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
          ...(payload.price !== undefined ? { price: payload.price } : {}),
          ...(payload.prevClose !== undefined ? { prevClose: payload.prevClose } : {}),
          ...(payload.priceHistory !== undefined ? { priceHistory: payload.priceHistory } : {}),
          ...(payload.asOf !== undefined ? { asOf: payload.asOf } : {}),
          ...(payload.priceSrc !== undefined ? { priceSrc: payload.priceSrc } : {}),
          ...(newIndustryGroup ? { industryGroup: newIndustryGroup } : {}),
          refreshedAt: now,
          metrics: newMetrics,
          // Merge metricsMeta: new payload's entries win over old, preserving any manually-set ones
          metricsMeta: {
            ...(old.metricsMeta || {}),
            ...(payload.metricsMeta || {}),
          },
          scoreHistory: newScoreHistory,
        };

        // Recompute cross-sectional Z-Scores for the entire watchlist
        return applyQuantScores(updated, watchlistIdsRef.current || []);
      });

      if (Object.keys(cacheUpdates).length) {
        setDataCache(prev => ({ ...prev, ...cacheUpdates }));
      }

      if (fromStaleCache) {
        const ageText = Number.isFinite(staleAgeDays) ? `${safeFixed(staleAgeDays, 1)}일 전` : '이전';
        setProviderStatus({ kind: 'warn', label: providerLabels[apiSettings.globalProvider] || 'CACHE', text: `${s.symbol} API 실패, ${ageText} 캐시 사용` });
        toast(`${s.symbol} — API 실패로 stale cache 사용 (${fetchError || 'unknown'})`, 'info', 7000);
      } else {
        setProviderStatus({ kind: 'ok', label: providerLabels[apiSettings.globalProvider] || 'DATA', text: fromCache ? `${s.symbol} 캐시 데이터 사용` : `${s.symbol} 데이터 업데이트 완료` });
        toast(fromCache ? `${s.symbol} — 캐시 데이터 사용` : `${s.symbol} 데이터 업데이트 완료`, 'ok');
      }
      refreshMarketTickers();
      refreshLivePrices([stockId], { silent: true });
    } catch (e) {
      setProviderStatus({ kind: 'error', label: providerLabels[apiSettings.globalProvider] || 'DATA', text: `${s.symbol}: ${e.message}` });
      toast(`${s.symbol}: ${e.message}`, 'error', 7000);
    } finally {
      setRefreshing(false);
        setFetchStatus('');
    }
  }, [stocks, refreshing, apiSettings, dataCache, dartCorpMap, toast, refreshMarketTickers, refreshLivePrices]);

  // ── Add stock from search ──────────────────────────────────────────────────
  const handleAddPeerFromSearch = async (s) => {
    setStocks(prev => {
      const next = { ...prev };
      if (!next[s.id]) next[s.id] = s;
      
      const currentStock = next[activeId];
      const currentPeers = Array.isArray(currentStock.peers) ? currentStock.peers : watchlistIds.filter(id => id !== activeId && prev[id]);
      
      next[activeId] = {
        ...currentStock,
        peers: [...new Set([...currentPeers, s.id])]
      };
      
      return next;
    });
    setSearchMode(null);
  };

  const handleAddFromSearch = useCallback((result = {}) => {
    try {
      const id = String(result.symbol || '').trim().toUpperCase();
      if (!id) {
        toast('검색 결과의 심볼이 비어 있습니다', 'error');
        return;
      }
      const newStock = makeBlankStock({
        id, symbol: id, name: result.name || id,
        market: result.market || result.marketKey || 'CUSTOM',
        currency: result.currency || 'USD',
        flag: result.flag || '🏷️', country: result.country || '기타',
      });
      const newWatchlistIds = [...new Set([...normalizeIdList(watchlistIdsRef.current), id].filter(Boolean))];
      setStocks(prev => {
        const next = prev[id] ? prev : ({ ...prev, [id]: newStock });
        return applyQuantScores(next, newWatchlistIds);
      });
      setWatchlistIds(newWatchlistIds);
      setWatchlists(prev => prev.map(w => w.id === activeWatchlistIdRef.current ? { ...w, stockIds: newWatchlistIds } : w));
      setActiveId(id);
      toast(`${id} 워치리스트 추가 완료. 데이터를 새로고침하세요.`, 'ok');
    } catch (e) {
      console.error('Search add failed', e);
      toast(`종목 추가 실패: ${e?.message || 'unknown error'}`, 'error', 7000);
    }
  }, [toast]);

  // ── Remove from watchlist ──────────────────────────────────────────────────
  const handleRemove = useCallback((id) => {
    const removeId = normalizeStockId(id);
    setWatchlistIds(prev => {
      const nextWatchlistIds = prev.filter(x => normalizeStockId(x) !== removeId);
      if (activeId === removeId && nextWatchlistIds.length) setActiveId(nextWatchlistIds[0]);
      setStocks(currStocks => applyQuantScores(currStocks, nextWatchlistIds));
      setWatchlists(prevWl => prevWl.map(w => w.id === activeWatchlistIdRef.current ? { ...w, stockIds: nextWatchlistIds } : w));
      return nextWatchlistIds;
    });
  }, [activeId]);

  // ── Multi-watchlist CRUD ───────────────────────────────────────────────────
  const handleSwitchWatchlist = useCallback((id) => {
    setWatchlists(prev => {
      const wl = prev.find(w => w.id === id);
      if (!wl) return prev;
      setActiveWatchlistId(id);
      const ids = wl.stockIds.filter(sid => stocksRef.current[sid]);
      setWatchlistIds(ids);
      setStocks(curr => applyQuantScores(curr, ids));
      if (!ids.includes(activeId) && ids.length) setActiveId(ids[0]);
      return prev;
    });
  }, [activeId]);

  const handleCreateWatchlist = useCallback(() => {
    const name = window.prompt('새 그룹 이름:');
    if (!name?.trim()) return;
    const id = `wl-${Date.now()}`;
    setWatchlists(prev => [...prev, { id, name: name.trim(), stockIds: [] }]);
    setActiveWatchlistId(id);
    setWatchlistIds([]);
  }, []);

  const handleRenameWatchlist = useCallback((id) => {
    const cur = watchlists.find(w => w.id === id)?.name || '';
    const name = window.prompt('새 이름:', cur);
    if (!name?.trim()) return;
    setWatchlists(prev => prev.map(w => w.id === id ? { ...w, name: name.trim() } : w));
  }, [watchlists]);

  const handleDeleteWatchlist = useCallback((id) => {
    setWatchlists(prev => {
      if (prev.length <= 1) { toast('마지막 그룹은 삭제할 수 없습니다', 'warn'); return prev; }
      const next = prev.filter(w => w.id !== id);
      if (activeWatchlistIdRef.current === id) {
        const fallback = next[0];
        setActiveWatchlistId(fallback.id);
        const ids = fallback.stockIds.filter(sid => stocksRef.current[sid]);
        setWatchlistIds(ids);
        setStocks(curr => applyQuantScores(curr, ids));
        if (ids.length) setActiveId(ids[0]);
      }
      return next;
    });
  }, [toast]);

  // ── Paper Trading (trades) ─────────────────────────────────────────────────
  const handleAddTrade = useCallback((trade) => {
    setTrades(prev => [{ ...trade, id: `tr-${Date.now()}` }, ...prev]);
    toast('거래 기록 추가', 'ok');
  }, [toast]);

  const handleDeleteTrade = useCallback((id) => {
    setTrades(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Save pitch edits ───────────────────────────────────────────────────────
  const handleSavePitch = useCallback((stockId, patch) => {
    setStocks(prev => ({ ...prev, [stockId]: { ...prev[stockId], ...patch } }));
    toast('피치 저장 완료', 'ok');
  }, [toast]);

  const handleAddResearchNote = useCallback((stockId, note) => {
    setStocks(prev => ({
      ...prev,
      [stockId]: {
        ...prev[stockId],
        notes: [note, ...(prev[stockId]?.notes || [])],
      },
    }));
    toast('리서치 로그 추가 완료', 'ok');
  }, [toast]);

  const handleSaveReview = useCallback((stockId, review) => {
    setStocks(prev => ({ ...prev, [stockId]: { ...prev[stockId], review } }));
    toast('리뷰 일정 저장 완료', 'ok');
  }, [toast]);

  const handleSavePreMortem = useCallback((stockId, preMortem) => {
    setStocks(prev => ({ ...prev, [stockId]: { ...prev[stockId], preMortem } }));
    toast('프리모템 지표 저장 완료', 'ok');
  }, [toast]);

  const handleSaveHistory = useCallback((stockId, metricsHistory) => {
    setStocks(prev => ({ ...prev, [stockId]: { ...prev[stockId], metricsHistory } }));
    toast(`${stockId} 5년 재무 히스토리 저장 완료 (${metricsHistory.length}개 연도)`, 'ok');
  }, [toast]);

  const handleSaveInsiders = useCallback((stockId, insiderTrades) => {
    setStocks(prev => ({ ...prev, [stockId]: { ...prev[stockId], insiderTrades } }));
    toast(`${stockId} 내부자 거래 저장 완료 (${insiderTrades.length}건)`, insiderTrades.length ? 'ok' : 'info');
  }, [toast]);

  // ── Alert actions (Phase 2) ────────────────────────────────────────────────
  const handleSavePeers = useCallback((stockId, peers) => {
    setStocks(prev => ({ ...prev, [stockId]: { ...prev[stockId], peers } }));
  }, []);

  const handleSaveChecklist = useCallback((stockId, checklist) => {
    setStocks(prev => ({ ...prev, [stockId]: { ...prev[stockId], checklist } }));
    toast('Checklist saved', 'ok');
  }, [toast]);

  const handleSaveCalendarEvents = useCallback((stockId, calendarEvents) => {
    setStocks(prev => ({ ...prev, [stockId]: { ...prev[stockId], calendarEvents } }));
    toast('Calendar saved', 'ok');
  }, [toast]);

  const handleCaptureJournal = useCallback((stockId, decisionType) => {
    setStocks(prev => {
      const s = prev[stockId];
      if (!s) return prev;
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        date: new Date().toISOString(),
        decisionType: decisionType || null,
        recommendation: s.recommendation || 'Watch',
        oneLine: s.oneLine || '',
        price: Number(s.price) || 0,
        target: Number(s.target) || 0,
        score: s.scores?.overall ?? null,
        thesis: [...(s.thesis || [])],
        risks: [...(s.risks || [])],
        outcome: 'pending',
        outcomePrice: null,
        outcomeDate: null,
        note: '',
      };
      return { ...prev, [stockId]: { ...s, journal: [entry, ...(s.journal || [])] } };
    });
    toast(`Journal snapshot captured${decisionType ? ` (${decisionType})` : ''}`, 'ok');
  }, [toast]);

  const handleUpdateJournal = useCallback((stockId, journal) => {
    setStocks(prev => ({ ...prev, [stockId]: { ...prev[stockId], journal } }));
  }, []);

  const handleRefreshAlerts = useCallback(async () => {
    if (alertsRefreshing) return;
    if (!alertSettings.enabled) {
      toast('ALERTS ENABLED를 먼저 켜세요', 'info');
      return;
    }
    const enabledSources = Object.entries(alertSettings.sources || {}).filter(([, v]) => v).map(([k]) => k);
    if (enabledSources.length === 0) {
      toast('알림 소스가 모두 꺼져 있습니다', 'info');
      return;
    }
    setAlertsRefreshing(true);
    setAlertStatus({ kind: 'info', text: `${watchlistIds.length}개 종목에서 알림을 가져오는 중...` });
    const allErrors = [];
    const incomingMap = new Map();
    const seenNativeIds = new Set();
    for (const id of watchlistIds) {
      const s = stocks[id];
      if (!s) continue;
      try {
        const { items, errors } = await fetchAlertsForStock(s, dartCorpMap, apiSettings, alertSettings);
        for (const it of items) {
          const nk = `${it.source}:${it.nativeId}`;
          if (!incomingMap.has(it.id) && !seenNativeIds.has(nk)) {
            incomingMap.set(it.id, it);
            seenNativeIds.add(nk);
          }
        }
        for (const err of errors) allErrors.push({ ...err, stockId: id });
      } catch (e) {
        allErrors.push({ source: 'fetchAlerts', message: e?.message || String(e), stockId: id });
      }
    }
    setAlerts(prev => {
      const existingById = new Map((prev || []).map(a => [a.id, a]));
      for (const fresh of incomingMap.values()) {
        const existing = existingById.get(fresh.id);
        if (existing) {
          // Preserve user state (logged/dismissed) on re-fetch
          existingById.set(fresh.id, { ...existing, ...fresh, status: existing.status });
        } else {
          existingById.set(fresh.id, { ...fresh, status: 'new' });
        }
      }
      return pruneAlerts(Array.from(existingById.values()));
    });
    setAlertErrors(allErrors);
    setAlertStatus({
      kind: allErrors.length ? 'warn' : 'ok',
      text: `${incomingMap.size}건 수신 · ${allErrors.length}개 소스 실패 · ${new Date().toLocaleTimeString('ko-KR')}`,
    });
    setAlertsRefreshing(false);
    setLastAlertsPolled(new Date().toISOString());
    if (incomingMap.size > 0) toast(`알림 ${incomingMap.size}건 갱신`, 'ok');
  }, [alertsRefreshing, alertSettings, watchlistIds, stocks, dartCorpMap, apiSettings, toast]);

  // Auto-polling effect
  useEffect(() => {
    if (!alertSettings.enabled || !alertSettings.autoPolling) return;
    const min = Math.max(5, Math.min(120, alertSettings.pollIntervalMin || 15));
    const id = setInterval(() => { handleRefreshAlerts(); }, min * 60 * 1000);
    return () => clearInterval(id);
  }, [alertSettings.enabled, alertSettings.autoPolling, alertSettings.pollIntervalMin, handleRefreshAlerts]);

  const handleAlertOpen = useCallback((alert) => {
    if (alert?.url) window.open(alert.url, '_blank', 'noopener,noreferrer');
    setAlerts(prev => prev.map(a => a.id === alert.id && a.status === 'new' ? { ...a, status: 'read' } : a));
  }, []);

  const handleAlertLog = useCallback((alert) => {
    const date = (alert.publishedAt || new Date().toISOString()).slice(0, 10);
    const note = {
      date,
      kind: alert.kind || '알림',
      text: alert.title || '(제목 없음)',
      source: alert.url || alert.source || '',
    };
    setStocks(prev => ({
      ...prev,
      [alert.stockId]: {
        ...prev[alert.stockId],
        notes: [note, ...(prev[alert.stockId]?.notes || [])],
      },
    }));
    setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'logged' } : a));
    toast('Research Log에 기록', 'ok');
  }, [toast]);

  const handleAlertDismiss = useCallback((alert) => {
    setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'dismissed' } : a));
  }, []);

  const handleAlertMarkRead = useCallback((alert) => {
    setAlerts(prev => prev.map(a => a.id === alert.id && a.status === 'new' ? { ...a, status: 'read' } : a));
  }, []);

  const handleAlertMarkAllRead = useCallback(() => {
    setAlerts(prev => prev.map(a => a.status === 'new' ? { ...a, status: 'read' } : a));
  }, []);


  const handleSaveSettings = useCallback((newSettings, newDcm) => {
    setApiSettings(newSettings);
    setDartCorpMap(newDcm);
    toast('설정 저장 완료', 'ok');
  }, [toast]);

  const handleClearCache = useCallback(() => {
    setDataCache({});
    setProviderStatus({ kind: 'idle', label: providerLabels[apiSettings.globalProvider] || 'DATA', text: '캐시 삭제 완료' });
    toast('API 캐시 삭제 완료', 'ok');
  }, [apiSettings.globalProvider, toast]);

  const handleExportBackup = useCallback((includeKeys = false) => {
    const exportSettings = includeKeys
      ? apiSettings
      : { ...apiSettings, alphaVantageKey: '', fmpKey: '', openDartKey: '', dataGoKrKey: '' };
    const payload = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      stocks,
      watchlistIds,
      activeId,
      apiSettings: exportSettings,
      dartCorpMap,
      dataCache,
      alerts,
      alertSettings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thesistrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('JSON 백업 파일 생성 완료', 'ok');
  }, [stocks, watchlistIds, activeId, apiSettings, dartCorpMap, dataCache, alerts, alertSettings, toast]);

  const handleImportBackup = useCallback((raw, mode = 'merge') => {
    try {
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') throw new Error('백업 JSON 형식 오류');
      const importedSettings = data.apiSettings ? { ...data.apiSettings } : null;
      if (mode === 'merge' && importedSettings) {
        ['alphaVantageKey', 'fmpKey', 'openDartKey', 'dataGoKrKey'].forEach(k => {
          if (!importedSettings[k]) delete importedSettings[k];
        });
      }
      const nextSettings = importedSettings ? { ...apiSettings, ...importedSettings } : apiSettings;
      if (mode === 'replace') {
        setStocks(normalizeStocksMap(data.stocks || DEFAULT_STOCKS));
        const importedWatchlist = [...new Set((data.watchlistIds || DEFAULT_WATCHLIST_IDS).map(normalizeStockId).filter(Boolean))];
        setWatchlistIds(importedWatchlist);
        setActiveId(normalizeStockId(data.activeId || importedWatchlist[0] || DEFAULT_WATCHLIST_IDS[0]));
        setApiSettings({ ...DEFAULT_API_SETTINGS, ...nextSettings });
        setDartCorpMap(data.dartCorpMap || DEFAULT_DART_CORP_MAP);
        setDataCache(data.dataCache || {});
        setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
        setAlertSettings({ ...DEFAULT_ALERT_SETTINGS, ...(data.alertSettings || {}) });
      } else {
        setStocks(prev => normalizeStocksMap({ ...prev, ...(data.stocks || {}) }));
        setWatchlistIds(prev => [...new Set([...prev.map(normalizeStockId), ...(data.watchlistIds || []).map(normalizeStockId)].filter(Boolean))]);
        if (data.activeId) setActiveId(normalizeStockId(data.activeId));
        setApiSettings(prev => ({ ...prev, ...(importedSettings || {}) }));
        setDartCorpMap(prev => ({ ...prev, ...(data.dartCorpMap || {}) }));
        setDataCache(prev => ({ ...prev, ...(data.dataCache || {}) }));
        if (Array.isArray(data.alerts)) {
          setAlerts(prev => {
            const seen = new Set(prev.map(a => a.id));
            const merged = [...prev, ...data.alerts.filter(a => !seen.has(a.id))];
            return pruneAlerts(merged);
          });
        }
        if (data.alertSettings) setAlertSettings(prev => ({ ...prev, ...data.alertSettings }));
      }
      toast(`JSON 복원 완료 (${mode})`, 'ok');
    } catch (e) {
      toast(`JSON 복원 실패: ${e.message}`, 'error', 7000);
    }
  }, [apiSettings, toast]);

  // ── Symbol navigate (CommandBar input) ───────────────────────────────────
  const handleSymbolNav = useCallback((sym) => {
    const id = sym.trim().toUpperCase();
    if (stocks[id]) {
      setActiveId(id);
    } else {
      toast(`${id} 워치리스트에 없음 — / 를 눌러 검색하세요`, 'info');
    }
  }, [stocks, toast]);

  const handleLogout = useCallback(async () => {
    await getSb().auth.signOut();
    setSession(null);
    remoteLoadedRef.current = false;
  }, []);

  // ── Auth gates (placed after all hooks) ───────────────────────────────────
  if (sbConfigured && authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'grid', placeItems: 'center', fontFamily: T.font, color: T.inkDim, fontSize: 12 }}>
        BOOTING...
      </div>
    );
  }
  if (sbConfigured && !session) {
    return <LoginScreen onSession={setSession}/>;
  }

  if (!stock) return <div style={{ color: T.inkFaint, padding: 32 }}>종목 없음</div>;

  // ── Panel content ──────────────────────────────────────────────────────────
  const panelContent = {
    F1: <OverviewPanel stock={stock} apiSettings={apiSettings} dartCorpMap={dartCorpMap} onSaveHistory={handleSaveHistory} onSaveInsiders={handleSaveInsiders}/>,
    F2: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%' }}>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => { const url = generateShareUrl(stock); navigator.clipboard?.writeText(url).catch(()=>{}); window.open(url, '_blank'); }}
            style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.amber, fontFamily: T.font, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', padding: '4px 12px', cursor: 'pointer' }}>
            SHARE LINK
          </button>
          <button onClick={() => downloadTextReport(stock)}
            style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkFaint, fontFamily: T.font, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', padding: '4px 12px', cursor: 'pointer' }}>
            TEXT REPORT
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 8, flex: 1, minHeight: 0 }}>
          <PitchPanel stock={stock} onEditPitch={setPitchEditId} onCaptureJournal={handleCaptureJournal}/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <QualityPanel stock={stock}/>
            <PreMortemPanel stock={stock} onSave={handleSavePreMortem}/>
          </div>
        </div>
      </div>
    ),
    F3: <F3Panel stock={stock} onEdit={setPitchEditId}/>,
    F4: (
      <div style={{ height: '100%' }}>
        <HistoryPanel stock={stock} onAddNote={handleAddResearchNote} onSaveReview={handleSaveReview}/>
      </div>
    ),
    F5: (
      <div style={{ height: '100%' }}>
        <ChartPanel
          stock={stock} onRefresh={handleRefresh} refreshing={refreshing} fetchStatus={fetchStatus}
          period={chartPrefs[stock?.id]?.period}
          chartType={chartPrefs[stock?.id]?.chartType}
          onPeriodChange={v => setChartPrefs(p => ({ ...p, [stock.id]: { ...(p[stock.id] || {}), period: v } }))}
          onChartTypeChange={v => setChartPrefs(p => ({ ...p, [stock.id]: { ...(p[stock.id] || {}), chartType: v } }))}
        />
      </div>
    ),
    F6: (
      <AlertsPanel
        stocks={stocks}
        watchlistIds={watchlistIds}
        alerts={alerts}
        alertSettings={alertSettings}
        alertErrors={alertErrors}
        alertStatus={alertsRefreshing ? { kind: 'info', text: '가져오는 중...' } : alertStatus}
        dartCoverage={dartCoverage}
        lastPolled={lastAlertsPolled}
        onRefresh={handleRefreshAlerts}
        onOpen={handleAlertOpen}
        onLog={handleAlertLog}
        onDismiss={handleAlertDismiss}
        onMarkRead={handleAlertMarkRead}
        onMarkAllRead={handleAlertMarkAllRead}
        onSettingsChange={setAlertSettings}
      />
    ),
    F7: (
      <PeersPanel stock={stock} stocks={stocks} watchlistIds={watchlistIds} onSelect={setActiveId} onSavePeers={handleSavePeers} onAddPeer={() => setSearchMode('peer')}/>
    ),
    F8: (
      <JournalPanel stock={stock} onCapture={handleCaptureJournal} onUpdate={handleUpdateJournal}/>
    ),
    F9: (
      <ScriptPanel stocks={stocks} watchlistIds={watchlistIds}/>
    ),
    F10: (
      <BacktestPanel stocks={stocks} watchlistIds={watchlistIds} trades={trades} onAddTrade={handleAddTrade} onDeleteTrade={handleDeleteTrade}/>
    ),
    F11: (
      <ToolsPanel stock={stock} stocks={stocks} watchlistIds={watchlistIds}/>
    ),
    F12: (
      <SettingsDataPanel
        apiSettings={apiSettings}
        dartCorpMap={dartCorpMap}
        dataCache={dataCache}
        providerStatus={providerStatus}
        dartAutoStatus={dartAutoStatus}
        dartCoverage={dartCoverage}
        onSaveSettings={handleSaveSettings}
        onClearCache={handleClearCache}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onReloadDartMap={() => loadLocalDartMap(true)}
      />
    ),
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: `${100 / APP_UI_SCALE}vw`,
      height: `${100 / APP_UI_SCALE}vh`,
      transform: `scale(${APP_UI_SCALE})`,
      transformOrigin: 'top left',
      background: T.bg,
      overflow: 'hidden',
    }}>
      {showHelp && (
        <div onClick={() => setShowHelp(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface, border: `1px solid ${T.border}`, padding: '24px 32px', minWidth: 380, maxWidth: 520, borderRadius: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ color: T.amber, fontFamily: T.font, fontSize: 12, letterSpacing: '0.18em', fontWeight: 700 }}>KEYBOARD SHORTCUTS</span>
              <button onClick={() => setShowHelp(false)} style={{ background: 'transparent', border: 'none', color: T.inkFaint, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            {[
              ['F1–F12', '패널 전환'],
              ['/', '종목 검색'],
              ['?', '단축키 도움말 토글'],
              ['Esc', '검색/다이얼로그 닫기'],
            ].map(([key, desc]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0', borderBottom: `1px solid ${T.borderSoft}` }}>
                <kbd style={{ fontFamily: T.font, fontSize: 11, background: T.bg, border: `1px solid ${T.border}`, padding: '2px 8px', borderRadius: 3, color: T.inkDim, minWidth: 56, textAlign: 'center', flexShrink: 0 }}>{key}</kbd>
                <span style={{ color: T.inkDim, fontSize: 12, fontFamily: T.font }}>{desc}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, color: T.inkFaint, fontSize: 10, fontFamily: T.font }}>배경 클릭 또는 Esc로 닫기</div>
          </div>
        </div>
      )}
      <CommandBar
        symbol={stock.symbol}
        onSymbol={handleSymbolNav}
        onSearch={() => setSearchMode('watchlist')}
        onSettings={() => setActivePanel('F12')}
        refreshing={refreshing}
        providerStatus={providerStatus}
        alertCount={alerts.filter(a => a.status === 'new').length}
        onAlerts={() => setActivePanel('F6')}
      />
      <TickerRail tickers={marketTickers}/>
      <HeroStrip stock={stock} onRefresh={handleRefresh} refreshing={refreshing}/>
      <PitchHeadline text={stock.oneLine} onEdit={() => setPitchEditId(stock.id)}/>

      {/* Panel selector tabs */}
      <div style={{ display: 'flex', alignItems: 'center', background: T.surface, borderBottom: `1px solid ${T.border}`, height: 36, flexShrink: 0 }}>
        {/* 탭 목록 — 독립적으로 가로 스크롤 */}
        <div style={{ display: 'flex', flex: 1, overflowX: 'auto', overflowY: 'hidden', height: '100%' }}>
          {PANEL_DEFS.map(({ k, label }) => {
            const on = activePanel === k;
            return (
              <button key={k} onClick={() => setActivePanel(k)}
                style={{
                  background: on ? `${T.amber}18` : 'transparent',
                  border: 'none', borderRight: `1px solid ${T.borderSoft}`,
                  borderBottom: `2px solid ${on ? T.amber : 'transparent'}`,
                  color: on ? T.amber : T.inkFaint, fontFamily: T.font, fontSize: 12,
                  fontWeight: on ? 700 : 500, letterSpacing: '0.1em',
                  padding: '0 12px', height: '100%', cursor: 'pointer', flex: '0 0 auto',
                }}>
                <kbd style={{ ...kbdStyle, fontSize: 10.5, marginRight: 5 }}>{k}</kbd>{label}
              </button>
            );
          })}
        </div>
        {/* REMOVE — 항상 우측 고정 */}
        <div style={{ flexShrink: 0, borderLeft: `1px solid ${T.border}`, padding: '0 14px', height: '100%', display: 'flex', alignItems: 'center' }}>
          <button onClick={() => { if (window.confirm(`"${stock.name || stock.symbol}" 을(를) 워치리스트에서 제거하시겠습니까?`)) handleRemove(stock.id); }}
            style={{ background: 'transparent', border: 0, color: T.red, fontFamily: T.font, fontSize: 10, cursor: 'pointer', letterSpacing: '0.08em', opacity: 0.7 }}>
            REMOVE
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr', gap: 0, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <WatchlistPanel
            stocks={stocks} watchlistIds={watchlistIds} activeId={activeId}
            watchlists={watchlists} activeWatchlistId={activeWatchlistId}
            onSelect={setActiveId} onAdd={() => setSearchMode('watchlist')}
            onRemove={handleRemove}
            onSwitchWatchlist={handleSwitchWatchlist}
            onCreateWatchlist={handleCreateWatchlist}
            onRenameWatchlist={handleRenameWatchlist}
            onDeleteWatchlist={handleDeleteWatchlist}
          />
        </div>

        {/* Panel area */}
        <div style={{ overflow: 'hidden', padding: 10, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto' }}>
            {panelContent[activePanel] || panelContent.F1}
          </div>
        </div>
      </div>

      <StatusBar
        stocks={stocks} watchlistIds={watchlistIds} fetchStatus={fetchStatus} refreshing={refreshing}
        userEmail={session?.user?.email} syncStatus={sbSyncStatus} onLogout={handleLogout}
      />

      {/* Overlays */}
      {searchMode && (
        <SearchOverlay apiSettings={apiSettings} dartCorpMap={dartCorpMap} onAdd={searchMode === 'watchlist' ? handleAddFromSearch : handleAddPeerFromSearch} onClose={() => setSearchMode(null)}/>
      )}
      {settingsOpen && (
        <ApiSettingsModal settings={apiSettings} dartCorpMap={dartCorpMap} onSave={handleSaveSettings} onClose={() => setSettingsOpen(false)}/>
      )}
      {pitchEditId && stocks[pitchEditId] && (
        <EditPitchModal stock={stocks[pitchEditId]} onSave={handleSavePitch} onClose={() => setPitchEditId(null)}/>
      )}
      {shareViewerData && (
        <ShareViewer data={shareViewerData} onClose={() => setShareViewerData(null)}/>
      )}

      <ToastContainer toasts={toasts}/>
    </div>
  );
}

// ─── Mount ────────────────────────────────────────────────────────────────────
function AppWrapper() {
  const [initial, setInitial] = useState(null);
  useEffect(() => {
    buildInitialAppState().then(setInitial);
  }, []);

  if (!initial) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', display: 'grid', placeItems: 'center', fontFamily: '"JetBrains Mono", monospace'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 16, color: '#22d3ee' }}>THESISTRACK</div>
          <div style={{ color: '#9ca3af', fontSize: 13, letterSpacing: '0.1em' }}>Booting Database...</div>
        </div>
      </div>
    );
  }
  return <App initialData={initial} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(AppErrorBoundary, null, React.createElement(AppWrapper))
);
