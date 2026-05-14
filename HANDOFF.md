# ThesisTrack Terminal — 인수인계 문서

## 0. 현재 상태 스냅샷 (2026-05-14)

- **빌드 시스템**: Vite + React 18 (`vite build` → `dist/`). `npm run dev` / `npm run build` / `npm run preview`.
- **레거시**: 루트의 `terminal.html`과 `tools/build.js`는 Vite 마이그레이션 이전 인라인 번들 파이프라인의 산출물·도구. **현재 카논은 `src/main.jsx` 진입의 Vite 빌드**. 새 작업은 `src/`만 수정하고 빌드는 `npm run build`로 한다.
- **데이터 정책**: Commercial-Safe 모드에서 Yahoo/FMP/Alpha Vantage/Google-like news 호출은 fetch 단계에서 차단. blocked host 호출 0건 자동화 검증 통과.
- **데이터 분리**: 캐시 entry에 `sourceMeta` 포함. 새로고침 payload는 `displayData` / `scoringData` 분리되며 점수 계산은 `scoringData.metrics` 기준.
- **SEC fallback**: Commercial-Safe 해외 검색은 SEC EDGAR fallback이 연결돼 있고, SEC XBRL metric coverage(`calculateSecMetrics`)는 7개 metric(revGrowth, opMargin, fcfMargin, epsGrowth, roe, debtRatio, currentRatio)을 결정적으로 산출.
- **Personal 모드**: 기존 Yahoo/FMP/Alpha/Google News 검색·차트·새로고침·매크로·뉴스 기능 모두 유지.
- **UI**: Pro Terminal UI는 가독성·반응형(`100dvh`, 노트북 폭 보호) 1차 정리 완료. 폰트 토큰(`--font-sans`/`--font-mono`)은 도입되어 있지만 **폰트 self-host는 아직 안 함** (Google Fonts CDN 그대로).
- **미구현 / 의도적 보류**: Learn Mode, 단계별 해금 시스템, 폰트 self-host, Telegram/Discord webhook, Supabase Realtime 구독.

## 1. 검증 / 감사 명령

| 명령 | 목적 | PASS 기준 |
|---|---|---|
| `npm run build` | Vite 프로덕션 빌드 (`dist/`) | 0 exit |
| `npm run verify:syntax` | `server/proxy-handler.cjs`, `api/proxy.mjs` 문법 체크 | 0 exit |
| `npm run verify:policy:commercial` | Commercial-Safe 모드에서 blocked host fetch 0건 검증 | `blocked host fetch calls = 0` |
| `npm run verify:policy:proxy` | 프록시 핸들러가 upstream fetch 없이 정책으로 차단함을 검증 | `upstream fetch calls = 0` |
| `npm run verify:policy` | 위 두 정책 검증을 순차 실행 | 두 항목 모두 통과 |
| `npm run verify:sec` | `calculateSecMetrics` 7개 metric + missing/zero/no-prev 케이스 검증 | 모든 assert 통과 |
| `npm run verify` | 위 항목을 `tools/verify-all.cjs`가 일관된 `[PASS]/[FAIL]` 출력으로 통합 실행 | `[VERIFY] N/N steps passed` |
| `npm run audit:hosts` | src/server/api 내 blocked host 문자열 위치 보고 (informational) | exit 0 — pass/fail 신호 아님 |

`audit:hosts`는 문자열이 등장한다고 실패가 아니다. Personal 모드 코드 경로와 proxy allowlist는 host 문자열을 식별자로 보유하는 것이 정상이다. **Commercial-Safe 실제 fetch 0건 여부는 `verify:policy:commercial`로만 판단한다.**

검증 스크립트 본체 위치:
- `tools/verify-all.cjs` — orchestrator. cross-shell 호환(Windows PowerShell 포함).
- `tools/verify-commercial-policy.cjs` — `terminal-data.jsx`를 vm sandbox에 로드, 차단/허용 경로 assert.
- `tools/verify-proxy-policy.cjs` — `server/proxy-handler.cjs`를 직접 require해서 403/404/SOURCE_POLICY_BLOCKED 응답 assert.
- `tools/verify-sec-metrics.cjs` — `calculateSecMetrics` 7개 metric 값 + `metricStatus` reason 코드 assert.
- `tools/audit-hosts.cjs` — 정적 텍스트 검색. rg 비의존(Node only).

## 2. Commercial-Safe vs Personal 모드

`apiSettings.dataMode` 값:
- `'personal'` (기본) — Yahoo, FMP, Alpha Vantage, Google News 모두 사용 가능. 사용자가 직접 API 키를 넣으면 그 키가 우선.
- `'commercialSafe'` — Yahoo, FMP, Alpha Vantage, 정체불명 뉴스 소스의 **fetch 자체를 차단**. 데이터는 SEC EDGAR(미국), OpenDART(한국), 사용자 import로 한정. `DATA_ENDPOINT_REGISTRY`에 등록되지 않은 endpoint는 default-block.

| 요소 | Personal | Commercial-Safe |
|---|---|---|
| Yahoo chart/quote/quoteSummary/timeseries/search | ✅ | ❌ (fetch 직전 차단) |
| FMP search/profile | ✅ | ❌ |
| Alpha Vantage OVERVIEW | ✅ | ❌ |
| Google News RSS | ✅ | ❌ |
| SEC EDGAR companyfacts/submissions | ✅ | ✅ |
| OpenDART fnlttSinglAcntAll | ✅ | ✅ |
| 새로고침 시 점수 계산 | scoringData 우선, fallback 허용 | scoringData만, 비안전 캐시 차단 |
| 캐시 entry sourceMeta | 항상 기록 | 항상 기록 + commercialSafe 플래그 검사 |

`server/proxy-handler.cjs`도 동일한 endpoint allowlist를 적용한다. 환경변수:
- `DISABLE_YAHOO_PROXY=1` / `YAHOO_PROXY_DISABLED=1` — Yahoo 프록시 비활성 (개발 환경)
- `DISABLE_YAHOO_PROXY_PROD=1` — `VERCEL_ENV=production`일 때만 Yahoo 프록시 비활성

## 3. Commercial-Safe 정책 요약 (변경 금지)

- `apiSettings.dataMode === 'commercialSafe'` blocks Yahoo, FMP, Alpha Vantage, and unclear news sources before network calls.
- Endpoint policy is enforced through `DATA_ENDPOINT_REGISTRY`; unknown endpoints default-block in Commercial-Safe mode.
- Server proxy also enforces endpoint policy. `DISABLE_YAHOO_PROXY=1` / `YAHOO_PROXY_DISABLED=1` disables Yahoo proxy; `DISABLE_YAHOO_PROXY_PROD=1` disables it only when `VERCEL_ENV=production`.
- Cache entries include `sourceMeta`; refreshed payloads separate `displayData` from `scoringData`.
- Personal mode preserves existing Yahoo/FMP/Alpha search, chart, refresh, macro, and news functionality.
- No paid API or paid infrastructure dependency is introduced.
- Unknown 출처는 절대 safe로 간주하지 않는다 (`DATA_ENDPOINT_REGISTRY` default-block 유지).

*이 문서는 AI 에이전트와 개발자가 프로젝트의 핵심 구조와 현황을 빠르게 파악할 수 있도록 최적화된 인수인계서입니다. 과거의 상세한 논의와 폐기된 기획 등은 `ARCHIVE_HANDOFF_OLD.md`를 참고하세요.*

---

## 1. 프로젝트 개요 (Overview)
Bloomberg Terminal 스타일의 주식 투자 관리 웹 애플리케이션입니다.
- **주요 특징**: 백엔드나 데이터베이스 없이 브라우저의 `localStorage`와 외부 오픈 API만을 활용하는 100% Client-side 앱 (Local-first).
- **목적**: 퀀트 기반 재무 점수화, 투자 아이디어(Pitch) 기록, 포트폴리오 관리, 뉴스 알림 통합.

## 2. 아키텍처 및 빌드 시스템 (Architecture)
- **기술 스택**: React 18 + Vite (`@vitejs/plugin-react`), Supabase JS SDK, Vanilla CSS (CSS variables for fonts/sizes).
- **진입점**: `index.html` → `src/main.jsx` → 동적 import로 `tweaks-panel.jsx` → `terminal-components.jsx` → `terminal-data.jsx` → `terminal-app.jsx` 순 로드.
- **파일 구조**:
  - `src/main.jsx`: Vite 부트. React/Supabase를 `window`에 등록 후 네 모듈 로드.
  - `src/styles.css`: 글로벌 CSS 토큰 (`--font-sans`, `--font-mono`, 사이즈 스케일), `100dvh`, 스크롤바.
  - `src/terminal-app.jsx`: 메인 앱 상태 · 패널 라우팅(F1–F12) · Supabase sync · in-app confirm modal (`window.appConfirm`).
  - `src/terminal-components.jsx`: 공통 UI 컴포넌트.
  - `src/terminal-data.jsx`: API 호출, `DATA_SOURCE_REGISTRY` / `DATA_ENDPOINT_REGISTRY` 정책, 퀀트 엔진(`computeQuantScores`), `calculateSecMetrics`, localStorage / Supabase 연동.
  - `src/tweaks-panel.jsx`: 디자인 토큰 디버그 오버레이 (자체 스코프 CSS).
- **빌드 방식**: `npm run build` → Vite가 `dist/`로 산출. Vercel은 이 산출물을 정적으로 서빙하고 `api/proxy.mjs` 함수를 실행한다.
- **레거시**: 루트의 `terminal.html` 및 `tools/build.js` (Babel Standalone 인라인 번들 시절 산출물·도구)는 더 이상 빌드 경로에 포함되지 않는다. 새 작업은 `src/`만 수정하고 `npm run build` 사용.

## 3. 핵심 기능 및 패널 현황 (Panels)
| 패널 | 이름 | 상태 | 주요 역할 |
|---|---|---|---|
| **F1** | Overview | ✅ 완료 | 퀀트 스코어링 Breakdown (Z-Score 5팩터 + Piotroski F-Score), 핵심 지표 요약, **5Y 재무 히스토리** |
| **F2** | Pitch | ✅ 완료 | 투자 논리(Thesis), Pre-mortem(리스크), Bull/Base/Bear 가치평가 시나리오 |
| **F3** | Valuation | ✅ 완료 | DCF/PER/PBR 가치평가 시나리오 시뮬레이터 + **DCF Mini Modeler** (8년 FCF 프로젝션·WACC) |
| **F4** | History | ✅ 완료 | Research Log 작성 (날짜, 메모, 링크 등) |
| **F5** | Chart | ✅ 완료 | Yahoo Finance 기반 캔들/라인 차트, MA/Volume/RSI/MACD/Bollinger Bands 오버레이 |
| **F6** | Alerts | ✅ 완료 | 키워드 기반 Google News + OpenDART 공시 알림 자동 수집, 읽음 처리 |
| **F7** | Peers | ✅ 완료 | 워치리스트 내 경쟁사/유사 기업 상대 지표 비교 (Peer Analysis) |
| **F8** | Journal | ✅ 완료 | 매매 판단 일지 (BUY/SELL/REVIEW 캡처, 결과 기록) |
| **F9** | Script | ✅ 완료 | **AST 기반 조건식 인터프리터** — `P/E < 10 && ROE > 15` 등 커스텀 스크리닝 |
| **F10** | Settings | ✅ 완료 | API 키 관리(DART 등), JSON 백업/복원(Export/Import), 캐시 초기화 |
| **F11** | Backtest | ✅ 완료 | **Paper Trading** — 가상 매수/매도 내역 기록 및 포트폴리오 수익률 시뮬레이션 |
| **F12** | Tools | ✅ 완료 | **Macro Correlation** (S&P500·금리·VIX 상관분석·Stress Test) + **WebLLM Local AI** (브라우저 내 LLM) |

## 4. 퀀트 스코어링 엔진 (Quant Engine)
- 기존의 단순 절대평가(Absolute Threshold) 방식에서 **시장 기준점 기반 상대평가(Market Baseline-Anchored Z-Score)** 방식으로 개편 (Phase 5).
- 소규모 워치리스트에서의 '표본 오염'을 막기 위해 11개 산업군별 S&P500/KOSPI 장기 평균치를 하드코딩(`MARKET_BASELINES`, Capital IQ/FactSet 기준 2024-Q4).
- 자세한 공식과 팩터 산출 방식은 `SCORING_METHODOLOGY.md` 참조.

### 스코어링 핵심 구조 (terminal-data.jsx)
| 함수 | 역할 |
|---|---|
| `MARKET_BASELINES` | 11개 산업군 × 11개 지표의 시장 평균(m)·표준편차(s) 딕셔너리 |
| `zScoreMarket(value, metric, ind, higherIsBetter)` | Z-Score 계산 → ±3 클리핑 → 방향 보정. **누락 데이터는 `null` 반환** (0 반환 시 평균값으로 오염되던 버그 수정) |
| `zToScore(z)` | Abramowitz-Stegun 5항 erf 근사 → 0~100 백분위 변환 |
| `computeQuantScores(universe)` | 4-Factor 가중합 + **Risk Penalty** → overall 산출 |
| `applyQuantScores(stocksMap, watchlistIds)` | 종목 추가/제거/새로고침 시 전체 재산출 후 `stock.scores` 갱신 |

### 가중 체계 (Phase 5 수정 이후 확정)
```
zComp = 0.30 × valueNeut + 0.30 × qualityNeut + 0.20 × safetyNeut + 0.20 × growthNeut
      − (riskFlagCount × 0.4)   ← Risk Guard penalty (각 플래그당 z-score −0.4)
overall = zToScore(zComp)       ← 0~100 백분위
```
- **Risk Guard 플래그 (8개)**: EPS성장 <−15%, FCF마진 <−5%, 부채비율 >250%, PER >60, PER≤0 & ROE<0, 유동성위기(CR<1 & D/E>150%), 매출급감(<−15%), 영업손실(OP<0)
- **Alpha Vantage ROIC**: Alpha Vantage OVERVIEW API는 ROIC를 제공하지 않으므로 `roa` 키로 저장하고 ROIC는 채우지 않음. ROIC 누락 시 자동으로 Quality 평균 산출에서 제외됨.

## 5. 5년 재무 히스토리 엔진 (Financial History)

### stock.metricsHistory 구조
`stock.metricsHistory` 배열에 연도별 레코드를 저장. `makeBlankStock`/`normalizeStockRecord`에 `metricsHistory: []`로 초기화.

```js
// 한 연도(FY)의 레코드
{
  fy:        2024,      // 회계연도
  source:    'SEC',     // 'SEC' | 'DART' | 'Yahoo'
  revenue:   391035,    // 매출 (USD: Millions, KRW: 억원, JPY: M JPY)
  opIncome:  123216,    // 영업이익
  netIncome:  93736,    // 당기순이익
  ocf:       118254,    // 영업활동현금흐름
  capex:      10959,    // 설비투자 (절대값)
  fcf:       107295,    // OCF − CapEx
  eps:          6.43,   // 주당순이익 (Yahoo timeseries는 dilutedEPS)
  opMargin:    31.5,    // 영업이익률 %
  unit:       'M',      // 'M' (USD/GBP/EUR 등) | '억원' (KRW) | 'M JPY' (JPY)
  currency:   'USD',
}
```

### 수집 함수 라우팅 (terminal-data.jsx)

**`fetchYahooFinancialHistory` 내 라우팅 분기**:
```
stock.market === 'KRX'                     → fetchDartFinancialHistory
stock.market ∈ {NASDAQ, NYSE, AMEX}        → fetchSecFinancialHistory
                                               실패 시 → fetchYahooFinancialHistory 폴백
그 외 (TSE, LSE, XETRA, Euronext 등)       → fetchYahooFinancialHistory
```

| 함수 | 소스 | 대상 종목 | 최대 연도 |
|---|---|---|---|
| `fetchSecFinancialHistory(stock)` | SEC EDGAR | 미국 (NASDAQ/NYSE/AMEX) | 5개년 |
| `fetchDartFinancialHistory(stock, apiSettings, dartCorpMap)` | OpenDART | 한국 (KRX) | 5개년 |
| `fetchYahooFinancialHistory(stock)` | Yahoo Finance | 비US·비KRX / US SEC 실패 폴백 | 4개년 |

**SEC XBRL 개념명 우선순위 (`SEC_CONCEPTS`)**
- Revenue: `Revenues` → `RevenueFromContractWithCustomerExcludingAssessedTax` → `SalesRevenueNet`
- OP: `OperatingIncomeLoss`
- Net: `NetIncomeLoss` → `ProfitLoss`
- OCF: `NetCashProvidedByUsedInOperatingActivities`
- CapEx: `PaymentsToAcquirePropertyPlantAndEquipment` → `CapitalExpenditures`
- EPS: `EarningsPerShareDiluted` → `EarningsPerShareBasic`

**DART 계정명**: `findDartRow` 재사용. KRW 원 단위 → `÷1e8` 억원 변환.

**`fetchYahooFinancialHistory` 처리 흐름**:
1. `fetchYahooStatements(yahooSym)` 호출 (아래 §Yahoo 재무제표 수집 흐름 참조)
2. 반환된 `summary.incomeStatementHistory.incomeStatementHistory[]` 배열을 순회
3. `endDate`(unix) → `new Date(endDate * 1000).getFullYear()` → `fy`
4. `divisor` 결정: JPY → `1e6` (M JPY), KRW → `1e8` (억원), 기타 → `1e6` (M)
5. `capex = Math.abs(capitalExpenditures)` (부호 무관), `fcf = ocf − capex`
6. 결과 내림차순 정렬 후 반환

### F1 레이아웃
```
┌──────────────────────────────────────────────┐
│  ScoreBreakdown (260px)  │  KEY METRICS (1fr) │  ← flex: 0 0 auto
├──────────────────────────────────────────────┤
│  5Y FINANCIAL HISTORY  (flex: 1, 스크롤)      │
│  [↻ FETCH HISTORY]  SEC · 5개 연도 FY20–FY24  │
│  표: FY컬럼 × 지표행 + YoY% 색상코딩 + 미니바 │
└──────────────────────────────────────────────┘
```
- `FinancialHistorySection` (로딩/에러 상태 관리) → `HistoryTable` (표 렌더링)
- 최신 FY 컬럼에 amber 하이라이트, YoY 양수=green/음수=red
- `handleSaveHistory(stockId, metricsHistory)` 콜백으로 App state 저장

---

## 5-A. Yahoo Finance 데이터 아키텍처

### Vercel Proxy 라우트 (api/proxy.mjs + server/proxy-handler.cjs)

현재 앱의 canonical API 경로는 `/api/proxy?service=...&path=...`이다. Vercel entrypoint는 `api/proxy.mjs`이고, 실제 OpenDART/SEC/Yahoo 포워딩 로직은 `server/proxy-handler.cjs`가 공유한다. Yahoo crumb은 Lambda 인스턴스 내 모듈 변수로 55분 캐시.

| 프록시 경로 | 업스트림 URL | 용도 |
|---|---|---|
| `/api/yahoo/chart/{sym}?…` | `query1.../v8/finance/chart/{sym}` | OHLC 캔들 / 가격 히스토리 |
| `/api/yahoo/quote?symbols={sym}` | `query1.../v7/finance/quote` | 실시간 호가 · PER · PBR · sector |
| `/api/yahoo/quoteSummary/{sym}?modules=…` | `query2.../v10/finance/quoteSummary/{sym}` | 재무비율(financialData) · 통계 · 재무제표 모듈 |
| `/api/yahoo/timeseries/{sym}?type=…` | `query1.../ws/fundamentals-timeseries/v1/finance/timeseries/{sym}` | 연간 재무 시계열 (비US 종목 전용 폴백) |
| `/api/yahoo/search?…` | `query1.../v1/finance/search` | 종목 검색 자동완성 |

crumb 획득 실패 또는 401/403 응답 시 `fetchYahoo()` 내부에서 crumb 무효화 후 1회 재시도.

### fetchStockData — Yahoo 병렬 호출 구조

`apiSettings.globalProvider === 'yahooExperimental'` 경로에서 5개 함수를 **Promise.allSettled**로 동시 실행:

```
fetchYahooChart(sym)        → chart (OHLC, priceHistory, prevClose)  ← 실패 시 전체 throw
fetchYahooQuote(sym)        → quote (realtime price, PER, PBR, sector, currency)
fetchYahooQuoteSummary(sym) → coreSumm (financialData, defaultKeyStatistics, summaryDetail)
fetchYahooStatements(sym)   → stmts (incomeStatementHistory, balanceSheetHistory, cashflowStatementHistory)
fetchYahooEarnings(sym)     → earnData (earnings.financialsChart.yearly — 실패 시 null)
```

merge: `summary = { ...coreSumm, ...stmts, ...(earnData || {}) }` → `mapYahooPayload(stock, chart, sym, quote, summary)`

chart만 필수; 나머지 4개는 fulfilled 여부에 따라 null 허용.

### fetchYahooStatements — 재무제표 수집 폴백 체인

```
① quoteSummary v10: modules=incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory
   → HTTP 200 + result 있으면 반환

② quoteSummary v10: modules=incomeStatementHistory,balanceSheetHistory
   → HTTP 200 + result 있으면 반환

③ quoteSummary v10: modules=incomeStatementHistory
   → HTTP 200 + result 있으면 반환

④ fetchYahooTimeSeries(symbol)
   → GET /api/yahoo/timeseries/{sym}?type=annualTotalRevenue,...&period1=0&period2={now}
   → parseTimeSeriesStatements(results) 로 구조 변환
   → 성공 시 반환

⑤ throw new Error('Yahoo statements 모두 실패')
```

**①~③이 실패하는 경우**: Yahoo Finance v10 quoteSummary는 TSE(일본), LSE(영국), XETRA(독일), Euronext(프랑스) 등 비US 종목의 statement 모듈 요청에 HTTP 400 반환. 단일 모듈 요청도 동일하게 실패.

**④ timeseries 엔드포인트**: Yahoo Finance 웹사이트가 내부적으로 사용하는 `fundamentals-timeseries` API. 비US 종목 포함 전 시장 지원. 요청 타입 11개:

| timeseries type | 매핑 필드 | 용도 |
|---|---|---|
| `annualTotalRevenue` | `totalRevenue` | 매출 |
| `annualOperatingIncome` | `operatingIncome` | 영업이익 |
| `annualNetIncome` | `netIncome` | 당기순이익 |
| `annualDilutedEPS` | `dilutedEps` | 희석 EPS |
| `annualStockholdersEquity` | `totalShareholderEquity` | 자기자본 |
| `annualCurrentAssets` | `totalCurrentAssets` | 유동자산 |
| `annualCurrentLiabilities` | `totalCurrentLiabilities` | 유동부채 |
| `annualLongTermDebt` | `longTermDebt` | 장기차입금 |
| `annualCurrentDebt` | `shortLongTermDebt` | 단기차입금 |
| `annualOperatingCashFlow` | `totalCashFromOperatingActivities` | 영업현금흐름 |
| `annualCapitalExpenditure` | `capitalExpenditures` | 설비투자 |

**parseTimeSeriesStatements 변환 로직**:
- timeseries 응답은 타입별 배열 형태: `[{ type: 'annualTotalRevenue', annualTotalRevenue: [{ asOfDate: '2023-03-31', reportedValue: { raw: 123 } }] }]`
- `asOfDate`를 키로 `byDate` 맵 구성 → 날짜 내림차순 정렬
- 각 날짜별로 `{ endDate: unix_ts, totalRevenue: { raw: v }, ... }` 형태의 statement 행 생성
- **asOfDate 그대로 사용**: TSE(3월 결산), HK(12월)을 불문하고 실제 회계연도 종료일이 `endDate`로 저장됨 → `fetchYahooFinancialHistory`의 `getFullYear()` 추출이 정확

출력 구조는 quoteSummary 응답과 동일하므로 `mapYahooPayload` / `fetchYahooFinancialHistory` 코드 수정 없이 그대로 동작.

### mapYahooPayload — 재무지표 Fallback 체계

`summary` 객체를 분해하여 3단계 우선순위로 각 지표를 채움:

```
1순위  financialData 모듈 (US 종목 대부분, 비US 일부)
         fin.returnOnEquity, fin.operatingMargins, fin.freeCashflow,
         fin.debtToEquity, fin.currentRatio, fin.revenueGrowth, fin.earningsGrowth
         
2순위  재무제표 직접 계산 (incomeStatementHistory / balanceSheetHistory / cashflowStatementHistory)
         inc0/inc1/bal0/cf0에서 수치 추출 후:
         ROE         = netIncome / totalShareholderEquity × 100
         OP Margin   = operatingIncome / totalRevenue × 100
         FCF Margin  = (totalCashFromOperatingActivities − |capitalExpenditures|) / totalRevenue × 100
         Debt/Eq     = (shortLongTermDebt + longTermDebt) / totalShareholderEquity × 100
         Cur Ratio   = totalCurrentAssets / totalCurrentLiabilities × 100
         Rev Growth  = (rev₀ − rev₁) / rev₁ × 100

3순위  earnings 모듈 연간 차트 (earnings.financialsChart.yearly)
         연간 revenue / earnings 쌍에서 RevGrowth·EpsGrowth·OpMargin 근사
         (OP Margin을 earnings/revenue로 근사 — 실제 영업이익 아님, 최후 수단)
```

지표별 fallback 코드:
```js
roe:          fb(pct(fin, 'returnOnEquity'),   fbRoe)
opMargin:     fb(pct(fin, 'operatingMargins'), fb(fbOpMargin, fbOpMarginEy))
fcfMargin:    fb(계산식,                        fbFcfMargin)
debtRatio:    fb(raw(fin, 'debtToEquity'),     fbDebtRatio)
currentRatio: fb(finCr * 100,                  fbCurRatio)
revGrowth:    fb(pct(fin, 'revenueGrowth'),    fb(fbRevGrowth, fbRevGrowthEy))
epsGrowth:    fb(pct(fin, 'earningsGrowth'),   fbEpsGrowthEy)
```

`fb(primary, fallback)` = `Number.isFinite(primary) ? primary : fallback`. 최종적으로 NaN인 지표는 `compactMetrics`가 제거 → UI에 "–" 표시.

**캐시 주의**: `cacheDays`(기본 3일) 내 이미 저장된 빈 metrics 캐시는 Settings → Clear Cache 후 Fetch해야 새 데이터로 교체됨.

## 6. 변경 이력 (Recent Change Log)
- **2026-05-11 (비US 종목 재무제표 fundamentals-timeseries 폴백 — §5-A 참조)**:
  - **증상**: TSE/LSE/XETRA 등 비US 종목에서 5Y Financial History "Yahoo statements 모두 실패" + 재무지표(ROE/OP Margin/FCF 등) 전부 "–" 동시 발생.
  - **근본 원인**: Yahoo Finance v10 `quoteSummary` API가 비US 종목에서 statement 모듈(`incomeStatementHistory`, `balanceSheetHistory`, `cashflowStatementHistory`) 전부를 HTTP 400으로 거부. 단일 모듈 요청도 동일. → `fetchYahooStatements`의 3-combo 재시도 전부 실패 → `stmts = null` → `mapYahooPayload`에서 재무제표 기반 fallback 지표 계산도 전부 NaN.
  - **수정 1 — server/proxy-handler.cjs**: `timeseries/` 라우트 신규 추가. `/api/proxy?service=yahoo&path=timeseries&symbol={sym}&type=…` → `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{sym}` 포워딩 (crumb 포함).
  - **수정 2 — terminal-data.jsx**: `fetchYahooTimeSeries(symbol)` + `parseTimeSeriesStatements(results)` 신규 추가. timeseries 응답(`type`+`asOfDate`+`reportedValue[]` 구조)을 `incomeStatementHistory / balanceSheetHistory / cashflowStatementHistory` 구조로 변환 후 `fetchYahooStatements` 내 ④번 폴백으로 연결. 기존 `mapYahooPayload` / `fetchYahooFinancialHistory` 코드 **무변경**으로 동작.
  - **캐시 주의**: 기존 빈 metrics로 저장된 캐시는 Settings → Clear Cache 후 재조회 필요.
- **2026-05-11 (UI/UX 개선 2종)**:
  - **F9/F10 순서 교체**: F9=SCREEN, F10=SETTINGS (기존 반대).
  - **Alerts 읽음 처리**: 각 카드에 READ 버튼(new→read), 필터 바 우측 ALL READ(N) 버튼, 필터 드롭다운에 READ 탭 추가. 상태 색상: NEW=amber, READ=cyan, LOGGED=green, DISMISSED=회색.
- **2026-05-11 (Last Price 전일가 표시 버그)**:
  - **원인**: `fetchLivePriceForSymbol`에서 가격 우선순위가 반대. `closes.at(-1)`(1분봉 종가) PRIMARY, `meta.regularMarketPrice`(Yahoo 실시간 현재가) FALLBACK이었음. 1분봉 미확정 구간에서 직전 봉 종가 또는 전일 데이터가 표시됨.
  - **수정**: `firstFinite(meta.regularMarketPrice, closes.at(-1))` 순서로 변경. `prevClose`도 `regularMarketPreviousClose` → `previousClose` → `chartPreviousClose` 순으로 통일.
  - **갱신 주기**: 5분 → **2분** (Yahoo 무료 API 여유 충분, N종목×1 call/2min).
- **2026-05-11 (5Y Financial History 오류 3종)**:
  - **비US 종목 미지원 버그**: 일본(TSE) 등 비US/비KRX 종목은 `isSecEligibleStock` 체크에 막혀 항상 "미국 상장 종목만 지원" 에러. `fetchYahooFinancialHistory(stock)` 신규 함수 추가: `quoteSummary`의 `incomeStatementHistory/balanceSheetHistory/cashflowStatementHistory` 모듈에서 최대 4개년 재무 데이터 추출. KRX→DART, US(NASDAQ/NYSE/AMEX)→SEC EDGAR(Yahoo 폴백), 기타→Yahoo Finance.
  - **US 종목 SEC 실패 시 폴백 없음**: SEC CIK 조회 실패(`resolveSecCompany`) 시 `fetchYahooFinancialHistory`로 자동 폴백.
  - **레이아웃 버그**: ScoreBreakdown이 6줄+뱃지로 길면 5Y 섹션이 22px 헤더만 노출됨. `OverviewPanel`을 중첩 flex → 단일 `overflowY:auto` 스크롤 컨테이너로 변경.
- **2026-05-11 (비US 종목 재무 지표 수정 — §5-A mapYahooPayload Fallback 참조)**:
  - **원인**: `financialData` 모듈이 TSE 등 비US 종목에서 빈 객체 반환 → ROE/OP Margin/FCF/D-E/CR/RevGrowth 전부 "–". PER·PBR는 `quote`(v7) 객체에 별도 값이 있어 표시됨.
  - **수정**: `mapYahooPayload`에 2·3순위 fallback 추가 (§5-A 상세). `financialData` NaN 시 재무제표(inc/bal/cf)에서 직접 계산 → earnings 모듈 연간 차트 순으로 대체. 단 재무제표 자체가 없으면 `null` → `compactMetrics` 제거 → "–". 이 경우 위 "fundamentals-timeseries 폴백" 수정으로 재무제표가 공급됨.
- **2026-05-11 (PriceChart 크래시 — 훅 개수 불일치)**:
  - **원인**: `PriceChart` 컴포넌트(`terminal-components.jsx`)에서 `useMemo`(ma20/ma60/ma120) 3개가 early return(`if (!data.length && !valid.length) return ...`) 이후에 위치. 차트 데이터가 없을 때 훅 6개, 있을 때 훅 9개로 렌더 간 개수가 달라져 "Rendered more hooks than during the previous render" 에러로 앱 전체가 복구 화면으로 전환됨.
  - **수정**: `calcMA`, `sourceData`, 3개 `useMemo`를 early return 위로 이동. 데이터 유무와 관계없이 항상 9개 훅이 동일 순서로 호출됨.
  - **주의**: React 훅은 조건문·early return 이전에 모두 선언해야 함. early return이 추가될 때마다 그 아래 훅 유무 확인 필요.
- **2026-05-11 (Yahoo quoteSummary 400 오류 수정)**:
  - **원인**: `fetchYahooQuoteSummary`에 6개 모듈을 한꺼번에 요청 → Yahoo Finance v10이 TSE/LSE 등 비US 종목에서 statement 모듈(`incomeStatementHistory` 등)을 지원하지 않으면 요청 전체를 **HTTP 400**으로 거부. 결과: summary 전체 null → Fetch History 클릭 시 "Yahoo quoteSummary HTTP 400" 에러 + 메인 지표도 전부 "–".
  - **수정**: 모듈 요청을 두 함수로 분리:
    - `fetchYahooQuoteSummary`: core 3개 모듈만 (`financialData, defaultKeyStatistics, summaryDetail`) — US/비US 모두 안정 지원
    - `fetchYahooStatements` (신규): statement 3개 모듈만 (`incomeStatementHistory, balanceSheetHistory, cashflowStatementHistory`)
  - 메인 데이터 fetch(`fetchStockData`)에서 두 함수를 `Promise.allSettled`로 병렬 실행 → 결과 merge. 어느 쪽이 실패해도 나머지는 정상 동작.
  - `fetchYahooFinancialHistory`는 `fetchYahooStatements` 사용 (기존 `fetchYahooQuoteSummary` 호출 제거).
- **2026-05-11 (F6 Alerts 품질 개선)**:
  - **Yahoo 뉴스 검색 쿼리 개선**: `fetchYahooNewsExperimental`이 ticker symbol(`005930.KS`, `MU`) 대신 `stock.name`(회사명)으로 Yahoo 검색 API를 호출. 종목과 무관한 광범위 기사 유입 차단.
  - **관련성 필터 (`isNewsRelevant`)**: 기사 제목에 회사명 키워드(3자↑, stop-word 제외) 또는 ticker 베이스가 포함되지 않으면 드롭. 국문/영문 회사명 모두 지원.
  - **크로스-종목 중복 제거**: `handleRefreshAlerts`에서 `seenNativeIds` Set(`source:nativeId` 키)을 유지하여 동일 기사가 워치리스트 N개 종목에 걸쳐 중복 수집되는 현상 차단. 기존 `incomingMap`은 단일 종목 내 id 중복만 처리해 이 케이스를 놓쳤음.
- **2026-05-11 (Month 3 — 5년 재무 히스토리)**:
  - **fetchSecFinancialHistory**: SEC EDGAR `/companyfacts/` XBRL 파싱으로 미국 종목 10-K 5개년 자동 수집 (API 키 불필요).
  - **fetchDartFinancialHistory**: DART `fnlttSinglAcntAll` 2회 병렬 호출로 한국 종목 5개년 수집 (DART API 키 필요).
  - **HistoryTable**: Revenue/OP Income/FCF/OP Margin/EPS 5개 지표, FY 컬럼, YoY % 색상 코딩, 미니 바 배경.
  - **F1 OverviewPanel 레이아웃 변경**: ScoreBreakdown+MetricsGrid 고정 상단 + FinancialHistorySection 스크롤 하단.
  - **metricsHistory[] 필드 추가**: `makeBlankStock` / `normalizeStockRecord`에 신규 배열 필드 등록.
- **2026-05-11 (버그픽스 3종)**:
  - **TickerRail 전일비 오류**: `chartPreviousClose`(차트 시작 이전 종가) → `regularMarketPreviousClose`(실제 전일 종가)로 교체. KOSPI +18% 오표시 해결.
  - **Last Price 변동값 포맷**: KRW/JPY 종목 변동액에 `fmtPx` 적용 → `-10,000` 형식 (기존 `-10000.00`).
  - **DEFAULT_MARKET_TICKERS 초기값**: 2024년 고정값 → `'–'`로 교체, 실시간 fetch 전 오해 방지.
- **2026-05-11 (Month 1~2 — IB-grade Risk + EQS Screener)**:
  - **Piotroski F-Score (7점)**: `computePiotroski()` 추가. ROE+, FCF+, OP>avg, D/E↓, CR>1, Rev+, EPS+ 7개 바이너리 신호 합산. F1 ScoreBreakdown 하단에 STRONG/NEUTRAL/WEAK 표시.
  - **Risk Guard 8개 확장**: 기존 5개 플래그 → 유동성 위기(CR<1 & D/E>150%), 매출 급감(<-15%), 영업손실 3개 추가. 플래그당 패널티 0.5→0.4 조정.
  - **F10 EQS Screener**: 새 패널 추가. CapIQ Screening 무료 대체. 프리셋 4종(Quality Compounder, Deep Value, High Momentum, Safe & Stable) + 커스텀 조건 최대 8개. 결과에 필터 지표값 + Overall Score + Piotroski 병렬 표시.
- **2026-05-11 (Phase 5 버그픽스 — 스코어링 정합성 수정)**:
  - **Risk Guard 미반영 버그 수정**: `computeQuantScores`가 `riskFlags`를 계산은 했으나 `zComp`에 반영하지 않고 있었음 (`weights.risk: 0`). 이제 플래그당 −0.5 z-score 패널티를 적용하여 Overall 점수를 직접 낮춤. `SCORING_METHODOLOGY.md`에서 약속한 Risk Guard 감점 로직이 실제로 구현됨.
  - **누락 데이터 → 평균값 오염 버그 수정**: `zScoreMarket`이 `null`/`NaN` 입력 시 `0`(= 시장 평균과 동일)을 반환하여 미입력 지표가 '평균 기업'처럼 처리되던 문제를 수정. 이제 `null` 반환 후 `nonNullArray` 필터로 제외하므로 보유한 지표만으로 정확히 평균을 냄.
  - **음수 P/E 처리 개선**: 음수/미입력 P/E에 대해 `999` 대신 `null`을 전달하도록 수정. PER 제외 후 PBR + EV/EBITDA로만 Value Factor를 산출하며, 적자 기업 패널티는 Risk Guard가 담당.
  - **Alpha Vantage ROIC 오라벨 수정**: `ReturnOnAssetsTTM`을 `roic`로 잘못 매핑하던 코드를 `roa`로 정정. ROIC 미입력 시 Quality Factor 평균 산출에서 자동 제외됨.
  - **`weights.risk: 0 → 10`**: UI 표시 가중치를 실제 작동 방식(리스크 패널티 적용)과 일치하도록 수정.
- **2024-05-10 (Phase 5 수정)**: 퀀트 엔진에 `MARKET_BASELINES` 하드코딩 도입. 크로스섹셔널 연산을 제거하고 정적 시장 평균/표준편차 잣대에 대조하는 `zScoreMarket` 함수 도입 (표본 오염 문제 해결).
- **2024-05-10 (Phase 5)**: Alpha Vantage, FMP, OpenDART 연동을 확장하여 EV/EBITDA, GP/A, ROIC 등 신규 퀀트 팩터 수집. `computeQuantScores` 추가.
- **2024-05-08 (Phase 2)**: F6 Alerts 기능 완료. `build-terminal-html.ps1` 빌드 파이프라인 도입.
- **2024-05-10 (Phase 6)**: 동기식 `localStorage`를 비동기식 대용량 `IndexedDB`로 안전하게 이전(Migration) 완료. 초기 부팅 대기 화면 도입. 사용하지 않는 패널(F8, F9) 및 포트폴리오 기획 취소로 UI를 9개 패널(F1~F9)로 최종 정리.
- **2024-05-11 (Phase 6.2)**: F7 PEERS 패널 고도화. 워치리스트 종속성을 제거하여 피어 0개 및 임의 종목 추가 허용. 패널 내부에 글로벌 검색(SearchOverlay)을 연동하여 검색한 종목이 메인 워치리스트를 오염시키지 않고 피어 그룹에만 추가되도록 격리 구현. 직관성을 위해 EDIT 화면에서 선택된 피어만 노출하도록 UI 개편.
- **2024-05-11 (Phase 7)**: 터미널 분석 기능 대규모 고도화 완료.
  - **F2 PITCH**: 자체 구현한 초경량 마크다운 렌더러를 탑재하여 볼드체, 기울임꼴, 글머리 기호, 하이퍼링크 등 리포트 양식 작성 지원.
  - **F5 CHART**: SVG 차트 렌더러를 개편하여 거래량(Volume) 바텀 오버레이 및 이동평균선(MA20, MA60, MA120) 실시간 계산 기능 추가.
  - **MACRO DASHBOARD**: 글로벌 시장 동향을 실시간 파악할 수 있도록 상단 TickerRail에 S&P500, USD/KRW, US10Y, VIX를 연동.
  - **BUGFIX**: Windows PowerShell 인코딩 문제로 인한 한글 깨짐 현상을 해결하기 위해, 빌드 스크립트를 Node.js 기반(`tools/build.js`)으로 전면 교체하여 완벽한 UTF-8 호환성 확보.
  - **BUGFIX**: 컴포넌트 파일(`terminal-components.jsx`) 수정 과정에서 유실되었던 `CommandBar`, `HeroStrip`, `TickerRail` 등의 핵심 UI 컴포넌트들을 성공적으로 복구하여 터미널 앱의 `CommandBar is not defined` 로딩 에러(Syntax Error) 해결 완료.
  - **REFACTOR**: 루트 폴더에 흩어져 있던 코드, 데이터, 문서를 정리하여 `src/`, `data/`, `docs/` 디렉토리로 구조화하고, 빌드 파이프라인(`tools/build.js`) 및 정적 JSON Fetcher의 경로를 연동 업데이트함.


## 6. 중장기 개발 대전략 (Grand Strategy Roadmap)
앞으로의 기능 개선 및 추가 계획을 Phase 별로 구분하여 관리합니다.

### ✅ Month 1~2 (완료): IB-Grade Risk Engine + EQS Screener
- Piotroski F-Score (7점 간이 버전) — F1 ScoreBreakdown 표시
- Risk Guard 5개 → 8개 확장 (유동성위기, 매출급감, 영업손실 추가)
- ~~F10 EQS Screener~~ → Phase 13 AST Script Engine(F9)으로 대체 완료

### ✅ Month 3 (완료): 5-Year Financial History
- **SEC EDGAR 자동 수집**: 미국 종목 `/companyfacts/` XBRL → 10-K 5개년 (API 키 불필요)
- **DART 다년도 수집**: 한국 종목 `fnlttSinglAcntAll` 2회 호출 → 5개년 (DART 키 필요)
- **F1 HistoryTable**: Revenue / OP Income / FCF / OP Margin / EPS, YoY % 색상 코딩, 미니 바
- **stock.metricsHistory[]** 필드 신규 도입

### ✅ Month 4 (완료): DCF Mini Modeler
- 8년 FCF 프로젝션 + WACC + Terminal Value 자동 계산 (`DcfMiniModeler` 컴포넌트)
- F3 Valuation 패널 내 DCF MODEL 탭으로 통합 (Bull/Base/Bear 시나리오)
- DART EPS 기반 발행주식수 자동 입력 기능 포함

### ✅ Phase 9 (완료): Zero-Cost Local AI (WebLLM)
- F12 Tools → AI 탭: `AIPanel` 컴포넌트. WebLLM ESM 모듈 동적 로딩
- 브라우저 WebGPU 기반 로컬 LLM 추론 (Llama 3.2 3B / Qwen 2.5 7B)
- F6 뉴스 요약, F2 Pre-mortem 자동 작성 등 사용 가능

### ✅ Phase 10 (완료): Advanced Pro-Charting & Backtesting
- **기술적 지표**: RSI, MACD, Bollinger Bands — F5 Chart 패널 오버레이 추가
- **Paper Trading**: `BacktestPanel` (F11) — 가상 매수/매도 기록 + 누적 수익률 시뮬레이션

### ✅ Phase 11 (완료): Cross-Device Sync (다중 기기 동기화)
- **Multi-Watchlist**: `{ id, name, symbols[] }` 배열로 여러 관심 그룹 관리 (WatchlistPanel)
- **Supabase 단방향 sync**: 상태 변경 시 debounced upsert → Supabase PostgreSQL
- ⚠️ **미완**: Supabase Realtime 구독(타 기기 변경 → 현재 탭 실시간 반영)은 미구현

### ✅ Phase 13 (완료): Custom Quant Scripting
- `ScriptPanel` (F9): AST 기반 조건식 인터프리터 (`eval()` 없는 샌드박스)
- `P/E < 10 && ROE > 15 && FCF > 0` 등 커스텀 표현식으로 워치리스트 필터링

### ✅ Phase 14 (완료): Macro Correlation Engine
- `MacroPanel` (F12 MACRO 탭): S&P500·금리·VIX·WTI·달러인덱스 1년 주봉 기반 피어슨 상관계수
- Stress Test 슬라이더: 매크로 지표 ±% 변화 → 종목 예상 변동폭 추정

### ✅ Phase 15 (완료): Social Share & Reporting
- **URL 공유**: `generateShareUrl(stock)` — Pitch 데이터 Base64 인코딩 → 쿼리스트링 URL 생성 + 클립보드 복사
- **텍스트 리포트**: `downloadTextReport(stock)` — `.txt` 파일 다운로드
- **읽기 전용 뷰어**: `ShareViewer` 컴포넌트 — 공유 URL 접근 시 팝업

---

## 7. 미완료 기능 및 구현 우선순위 (Remaining Roadmap)

### 🔴 Tier 1 — 실용성 높음, 구현 용이 (즉시 권장)

#### Phase 8-A: Telegram / Discord Webhook 알림
- **현황**: F6 Alerts가 알림을 수집하지만 브라우저를 열어야만 확인 가능
- **구현**: F10 Settings에 Telegram Bot Token + Chat ID 입력 필드 추가. `handleRefreshAlerts` 내에서 NEW 알림 발생 시 `fetch('https://api.telegram.org/bot{TOKEN}/sendMessage', ...)` 호출
- **난이도**: 낮음 — `fetch` 호출 하나, CORS 없음 (Telegram API는 클라이언트에서 직접 호출 가능)
- **효과**: 앱을 열지 않아도 공시/뉴스 알림을 즉시 수신

#### Phase 11-B: Supabase Realtime 구독 (양방향 sync 완성)
- **현황**: 로컬 변경 → Supabase push는 구현됨. 반대 방향(타 기기 변경 → 현재 탭 반영)이 없음
- **구현**: `supabase.channel('terminal').on('postgres_changes', ...).subscribe()` 추가. 변경 수신 시 `loadAppState()` 재실행
- **난이도**: 낮음 — Supabase JS SDK가 이미 로드되어 있음
- **효과**: PC/모바일 간 실시간 동기화 완성

### 🟡 Tier 2 — 투자 의사결정에 직접 도움 (중기 권장)

#### Phase 12-A: 내부자 거래 추적 (Insider Trading Tracker)
- **구현**: [Quiver Quantitative](https://api.quiverquant.com/) 무료 API → SEC Form 4 파싱. 워치리스트 종목별 최근 내부자 매수/매도 뱃지 표시 (F7 Peers 또는 F1 Overview 사이드바)
- **난이도**: 중간 — API 키 등록 필요, CORS 이슈 시 `server/proxy-handler.cjs`에 라우트 추가
- **효과**: 경영진 매수는 강력한 bullish 시그널 — EQS Screener 조건식 통합 가능

#### Phase 8-B: Service Worker 백그라운드 Fetch
- **구현**: `service-worker.js` 등록 → `setInterval` 대신 `Periodic Background Sync` API 활용. 가격 조건 충족 시 `self.registration.showNotification()` 호출
- **난이도**: 높음 — Periodic Background Sync는 HTTPS + Chrome 한정, iOS Safari 미지원
- **효과**: 탭 닫혀도 OS 알림 수신. 단, 브라우저 호환성 제약 큼

### ⚪ Tier 3 — 선택적, ROI 낮음

#### Phase 12-B: Reddit Social Sentiment
- **구현**: Reddit JSON API (`/r/wallstreetbets/search.json?q={ticker}`) 직접 호출 (CORS 허용)
- **난이도**: 낮음 — API 구현 자체는 쉬움
- **효과**: 노이즈 비율 매우 높음. r/WSB 특성상 단기 투기 종목 편향. 장기 투자 중심 이 터미널과 철학 불일치. **구현 가치 낮음**
