# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running locally

```bat
start.bat          # Windows — opens http://localhost:8080/terminal.html
bash start.sh      # mac/Linux
```

`start.bat` prefers `node tools/local-http-server.cjs 8080`. Falls back to Python `http.server`, then `npx serve`. The Node server is required for OpenDART/SEC EDGAR/Yahoo proxy routes (`/api/*`). No npm install or build step is needed.

To open directly without a server: double-click `terminal.html` (`file://` mode). DART, SEC EDGAR, and some Yahoo routes won't work in this mode due to CORS.

## Architecture

**No build step.** React 18 and Babel standalone are loaded from CDN. JSX files are embedded directly inside `terminal.html` as `<script type="text/babel">` blocks and transpiled in-browser at page load. Editing a `.jsx` file takes effect on the next page reload — no compile step, no bundler.

### File responsibilities

| File | Role |
|---|---|
| `terminal.html` | Entry point. Loads CDN scripts (React, Babel, Supabase), then inlines all four JSX files in order |
| `src/terminal-components.jsx` | UI primitives: `Cell`, `Stat`, `ScoreRing`, `ScoreBar`, `Spark`, `PriceChart`, `CommandBar`, `TickerRail`, etc. |
| `src/terminal-data.jsx` | All data fetching, caching, state persistence, score computation. Exports functions consumed by `terminal-app.jsx` via globals. |
| `src/terminal-app.jsx` | React component tree: panels (F1–F10), `MetricsGrid`, `FinancialHistorySection`, stock state management, Supabase sync |
| `src/tweaks-panel.jsx` | Debug/zoom overlay (independent) |
| `api/proxy.js` | Vercel serverless function — CORS proxy for OpenDART, SEC EDGAR, and Yahoo Finance |
| `tools/local-http-server.cjs` | Local Node server with identical proxy routes for development |
| `vercel.json` | Rewrites `/api/opendart/*`, `/api/sec/*`, `/api/yahoo/*` → `api/proxy.js` |

### Data flow

All state lives in `localStorage` under key `tt-terminal-v1`. Supabase is used for optional cloud sync if credentials are configured in `terminal-app.jsx`.

**Stock data fetch path** (`fetchStockData` in `terminal-data.jsx`):
1. Check cache (`schemaVersion >= 2` required to bypass stale pre-timeseries cache)
2. Parallel fetch: `fetchYahooQuoteSummary` (price/overview modules) + `fetchYahooStatements` (financial statements)
3. `fetchYahooStatements` tries `quoteSummary` with progressive module fallback, then falls back to `fetchYahooTimeSeries` (fundamentals-timeseries API)
4. `mapYahooPayload` normalizes raw Yahoo response into `metrics` object with 3-tier fallbacks per field

**Financial history fetch path** (F1 panel):
- Korean stocks (KRX): `fetchDartFinancialHistory` → OpenDART API via `/api/opendart/`
- US stocks: `fetchSecFinancialHistory` → SEC EDGAR via `/api/sec/`
- Other markets: `fetchYahooFinancialHistory` → Yahoo quoteSummary or timeseries

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

**Cache invalidation**: Yahoo cache entries with `schemaVersion < 2` (or missing) are treated as stale and re-fetched. New entries must set `schemaVersion: 2`.

**React Rules of Hooks**: All `useState`/`useEffect`/`useMemo`/`useCallback` calls must appear before any early return in a component. This has caused bugs before when hooks were placed after conditional returns.

**DART corp code lookup**: `getDartCorpEntry(dartCorpMap, stockOrSymbol)` — `dartCorpMap` is first arg, stock/symbol second. Reversed args silently return `undefined`.

**Score dimensions**: PROFITABILITY · STABILITY · GROWTH · VALUATION · RISK. Weights are user-configurable and stored per stock. `computeQuantScores` derives scores from `metrics`; `computeScores` computes weighted overall.

**`metrics` object keys** (used in `MetricsGrid` and scoring): `per`, `pbr`, `roe`, `opMargin`, `fcfMargin`, `debtRatio`, `currentRatio`, `revGrowth`, `epsGrowth`, `netMargin`, `opIncomeGrowth`, `evEbitda`

## Deployment

```bash
vercel --prod    # deploy to production
```

No build command needed. Vercel serves `terminal.html` as static and runs `api/proxy.js` as a serverless function.
