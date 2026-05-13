# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running locally

```bat
start.bat          # Windows — opens http://localhost:8080/terminal.html
bash start.sh      # mac/Linux
```

`start.bat` prefers `node tools/local-http-server.cjs 8080`. Falls back to Python `http.server`, then `npx serve`. The Node server is required for OpenDART/SEC EDGAR/Yahoo proxy routes (`/api/*`). No npm install is needed.

To open directly without a server: double-click `terminal.html` (`file://` mode). DART, SEC EDGAR, and some Yahoo routes won't work in this mode due to CORS.

## Build

**Source files are in `src/`; `terminal.html` is a generated output — never edit it directly.**

```bash
node tools/build.js
```

This inlines `tweaks-panel.jsx → terminal-components.jsx → terminal-data.jsx → terminal-app.jsx` into `terminal.html` as `<script type="text/babel">` blocks. React 18 and Babel standalone are loaded from CDN; JSX is transpiled in-browser at page load.

The PowerShell shortcut `tools/build-terminal-html.ps1` is equivalent (`node $PSScriptRoot/build.js`).

## Architecture

### File responsibilities

| File | Role |
|---|---|
| `terminal.html` | **Generated output.** Entry point. Loads CDN scripts (React, Babel, Supabase), then inlines all four JSX files in order |
| `src/terminal-components.jsx` | UI primitives: `Cell`, `Stat`, `ScoreRing`, `ScoreBar`, `Spark`, `PriceChart`, `CommandBar`, `TickerRail`, etc. |
| `src/terminal-data.jsx` | All data fetching, caching, state persistence, score computation, `metricsMeta` helpers. Exports via `window.*`. |
| `src/terminal-app.jsx` | React component tree: panels (F1–F12), `MetricsGrid`, `SettingsDataPanel`, stock state management, Supabase sync |
| `src/tweaks-panel.jsx` | Debug/zoom overlay (independent) |
| `api/proxy.js` | Vercel serverless function — CORS proxy for OpenDART, SEC EDGAR, and Yahoo Finance |
| `tools/local-http-server.cjs` | Local Node server with identical proxy routes for development |
| `vercel.json` | Rewrites `/api/opendart/*`, `/api/sec/*`, `/api/yahoo/*` → `api/proxy.js` |

### Data flow

All state lives in `localStorage` under key `tt-terminal-v1`. Supabase is used for optional cloud sync if credentials are configured in `terminal-app.jsx`. `apiSettings` and `dataCache` are **not** synced to Supabase (they stay device-local for security and size reasons).

**Stock data fetch path** (`fetchStockData` in `terminal-data.jsx`):
1. `getCachedEntry` — smart TTL: full-metrics = `cacheDays` days; partial (<5 core metrics) = 12 h; empty = 30 min; error state = 10 min
2. Parallel fetch: `fetchYahooQuoteSummary` (price/overview modules) + `fetchYahooStatements` (financial statements)
3. `fetchYahooStatements` tries `quoteSummary` with progressive module fallback, then falls back to `fetchYahooTimeSeries`
4. `mapYahooPayload` normalizes the raw Yahoo response into `metrics` + `metricsMeta` with 3-tier fallbacks per field

**Financial history fetch path** (F1 panel):
- Korean stocks (KRX): `fetchDartFinancialHistory` → OpenDART API via `/api/opendart/`
- US stocks: `fetchSecFinancialHistory` → SEC EDGAR via `/api/sec/`
- Other markets: `fetchYahooFinancialHistory` → Yahoo quoteSummary or timeseries

### metricsMeta — Data Provenance

Every stock has `stock.metricsMeta: { [metricKey]: MetricMeta }`. `MetricMeta` shape:

```ts
{
  provider: string;      // 'Yahoo Finance' | 'OpenDART' | 'SEC EDGAR' | 'FMP' | ...
  source: string;        // human-readable description
  method: string;        // 'financialData' | 'calculated-stmts' | 'official-filing' | 'fallback'
  confidence: 'A'|'B'|'C'|'D'; // A=official filing, B=direct API field, C=calculated, D=unknown/missing
  commercialSafe: boolean;
  periodEnd: string|null;
  fiscalYear: number|null;
  fetchedAt: string;     // ISO timestamp
  usedInScore: boolean;
}
```

Helpers in `terminal-data.jsx` (exposed on `window`):
- `makeMetricMeta(opts)` — create a single meta entry
- `setMetricWithMeta(existingMetrics, existingMeta, key, value, opts)` — attach value + meta
- `computeDataConfidence(metrics, metricsMeta)` — returns `{ grade, usedCount, totalCoreCount, commercialSafeCount, missingCoreMetrics, lowConfidenceMetrics }`

### dataMode

`apiSettings.dataMode` is `'personal'` (default) or `'commercialSafe'`. Stored in localStorage. Surfaced in `SettingsDataPanel` (F12). In `commercialSafe` mode, `MetricsGrid` shows a warning banner when non-commercial-safe metrics are present. It does not block fetches.

### Proxy routing

In development (`isProxiedOrigin()` = true when `window.location.hostname === 'localhost'`):
- `/api/yahoo/chart/:symbol` — Yahoo Finance chart/price
- `/api/yahoo/quoteSummary/:symbol?modules=...` — Yahoo quoteSummary v10
- `/api/yahoo/timeseries/:symbol?type=annualX,annualY,...` — Yahoo fundamentals-timeseries
- `/api/opendart/fnlttSinglAcntAll.json?...` — OpenDART financials
- `/api/sec/submissions/CIK##########.json` — SEC EDGAR submissions

In production (Vercel): same paths, routed via `vercel.json` rewrites to `api/proxy.js`.

## Key implementation details

**Yahoo timeseries `type` param**: Must use literal commas, not `%2C`. `local-http-server.cjs` preserves commas via `url.search.slice(1)`; `api/proxy.js` reconstructs the query string manually to avoid `URLSearchParams` encoding.

**Yahoo timeseries response parsing**: `item.type` is `undefined`. The type name is in `item.meta.type[0]`. Always access via `item.type ?? item.meta?.type?.[0]`.

**Cache schema version**: Current = `CACHE_SCHEMA_VERSION = 3` (includes `metricsMeta`). Entries with `schemaVersion < 2` (missing timeseries) are treated as stale. Entries with `schemaVersion < 3` (missing `metricsMeta`) will re-fetch on next cache miss.

**React Rules of Hooks**: All `useState`/`useEffect`/`useMemo`/`useCallback` calls must appear before any early return in a component.

**DART corp code lookup**: `getDartCorpEntry(dartCorpMap, stockOrSymbol)` — `dartCorpMap` is first arg, stock/symbol second. Reversed args silently return `undefined`.

**Score dimensions**: PROFITABILITY · STABILITY · GROWTH · VALUATION · RISK. Weights are user-configurable and stored per stock. `computeQuantScores` derives scores from `metrics`; `computeScores` computes weighted overall.

**`metrics` object keys** (used in `MetricsGrid` and scoring): `per`, `pbr`, `roe`, `opMargin`, `fcfMargin`, `debtRatio`, `currentRatio`, `revGrowth`, `epsGrowth`, `netMargin`, `opIncomeGrowth`, `evEbitda`

**F-key panel mapping**: F1=OVERVIEW, F2=PITCH, F3=VALUATION, F4=HISTORY, F5=CHART, F6=ALERTS, F7=PEERS, F8=JOURNAL, F9=SCRIPT, F10=TRADE, F11=TOOLS, F12=SETTINGS

**Supabase sync**: Stocks, watchlists, alerts, trades are synced. `apiSettings`, `dataCache`, and `dartCorpMap` are NOT synced (device-local).

## Deployment

```bash
vercel --prod    # deploy to production
```

No build command needed in Vercel config. Vercel serves `terminal.html` as static and runs `api/proxy.js` as a serverless function.
