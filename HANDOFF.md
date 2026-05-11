# ThesisTrack Terminal — 인수인계 문서

*이 문서는 AI 에이전트와 개발자가 프로젝트의 핵심 구조와 현황을 빠르게 파악할 수 있도록 최적화된 인수인계서입니다. 과거의 상세한 논의와 폐기된 기획 등은 `ARCHIVE_HANDOFF_OLD.md`를 참고하세요.*

---

## 1. 프로젝트 개요 (Overview)
Bloomberg Terminal 스타일의 주식 투자 관리 웹 애플리케이션입니다.
- **주요 특징**: 백엔드나 데이터베이스 없이 브라우저의 `localStorage`와 외부 오픈 API만을 활용하는 100% Client-side 앱 (Local-first).
- **목적**: 퀀트 기반 재무 점수화, 투자 아이디어(Pitch) 기록, 포트폴리오 관리, 뉴스 알림 통합.

## 2. 아키텍처 및 빌드 시스템 (Architecture)
- **기술 스택**: React 18 (CDN), Babel Standalone (런타임 트랜스파일), Vanilla CSS.
- **파일 구조**:
  - `terminal-app.jsx`: 메인 앱 상태 관리 및 패널 라우팅.
  - `terminal-components.jsx`: 공통 UI 컴포넌트 (버튼, 모달, 차트 등).
  - `terminal-data.jsx`: API 호출, 퀀트 엔진(`computeQuantScores`), 로컬 스토리지 연동.
  - `tweaks-panel.jsx`: 테마 및 UI 디버깅 패널.
  - `terminal.html`: 위 4개의 JSX를 단일 파일로 인라인(Inline) 컴파일한 최종 배포본.
- **빌드 방식**: 개발 후 **반드시** `tools/build-terminal-html.ps1` (Windows) 또는 `start.sh` (Mac/Linux)를 실행하여 `terminal.html`을 재생성한 뒤 배포(Git Push)해야 Vercel에 반영됩니다.

## 3. 핵심 기능 및 패널 현황 (Panels)
| 패널 | 이름 | 상태 | 주요 역할 |
|---|---|---|---|
| **F1** | Overview | ✅ 완료 | 퀀트 스코어링 Breakdown (Z-Score 5팩터 + Piotroski F-Score), 핵심 지표 요약, **5Y 재무 히스토리** |
| **F2** | Pitch | ✅ 완료 | 투자 논리(Thesis), Pre-mortem(리스크), Bull/Base/Bear 가치평가 시나리오 |
| **F3** | Valuation | ✅ 완료 | DCF/PER/PBR 가치평가 시나리오 시뮬레이터 |
| **F4** | History | ✅ 완료 | Research Log 작성 (날짜, 메모, 링크 등) |
| **F5** | Chart | ✅ 완료 | Yahoo Finance 기반 캔들/라인 차트, MA/Volume 오버레이 |
| **F6** | Alerts | ✅ 완료 | 키워드 기반 Google News + OpenDART 공시 알림 자동 수집 |
| **F7** | Peers | ✅ 완료 | 워치리스트 내 경쟁사/유사 기업 상대 지표 비교 (Peer Analysis) |
| **F8** | Journal | ✅ 완료 | 매매 판단 일지 (BUY/SELL/REVIEW 캡처, 결과 기록) |
| **F9** | Settings | ✅ 완료 | API 키 관리(FMP, Alpha, DART 등), JSON 백업/복원, 캐시 초기화 |
| **F10** | Screen | ✅ 완료 | **EQS Screener** — 워치리스트 내 종목 조건 필터링 (프리셋 4종 + 커스텀 최대 8조건) |

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
  source:    'SEC',     // 'SEC' | 'DART'
  revenue:   391035,    // 매출 (USD: Millions, KRW: 억원)
  opIncome:  123216,    // 영업이익
  netIncome:  93736,    // 당기순이익
  ocf:       118254,    // 영업활동현금흐름
  capex:      10959,    // 설비투자 (절대값)
  fcf:       107295,    // OCF − CapEx
  eps:          6.43,   // 주당순이익
  opMargin:    31.5,    // 영업이익률 %
  unit:       'M',      // 'M' (USD) | '억원' (KRW)
  currency:   'USD',
}
```

### 수집 함수 (terminal-data.jsx)
| 함수 | 소스 | 대상 종목 | 방식 |
|---|---|---|---|
| `fetchSecFinancialHistory(stock)` | SEC EDGAR | 미국 (NASDAQ/NYSE) | `/companyfacts/CIK{}.json` XBRL → 10-K/20-F FY 필터, 최대 5개년 |
| `fetchDartFinancialHistory(stock, apiSettings, dartCorpMap)` | OpenDART | 한국 (KRX) | `fnlttSinglAcntAll` 2회 병렬 호출 (year−1, year−3) → thstrm/frmtrm/bfefrmtrm 3개 컬럼 → 5개년 |

**SEC XBRL 개념명 우선순위 (`SEC_CONCEPTS`)**
- Revenue: `Revenues` → `RevenueFromContractWithCustomerExcludingAssessedTax` → `SalesRevenueNet`
- OP: `OperatingIncomeLoss`
- Net: `NetIncomeLoss` → `ProfitLoss`
- OCF: `NetCashProvidedByUsedInOperatingActivities`
- CapEx: `PaymentsToAcquirePropertyPlantAndEquipment` → `CapitalExpenditures`
- EPS: `EarningsPerShareDiluted` → `EarningsPerShareBasic`

**DART 계정명**: 기존 `findDartRow` 함수 재사용. KRW는 원 단위 → `÷1e8` 억원 변환.

### F1 레이아웃 변경
```
┌──────────────────────────────────────────────┐
│  ScoreBreakdown (260px)  │  KEY METRICS (1fr) │  ← flex: 0 0 auto
├──────────────────────────────────────────────┤
│  5Y FINANCIAL HISTORY  (flex: 1, 스크롤)      │  ← 신규
│  [↻ FETCH HISTORY]  SEC · 5개 연도 FY20–FY24  │
│  표: FY컬럼 × 지표행 + YoY% 색상코딩 + 미니바 │
└──────────────────────────────────────────────┘
```
- `FinancialHistorySection` (로딩/에러 상태 관리) → `HistoryTable` (표 렌더링)
- 최신 FY 컬럼에 amber 하이라이트, YoY 양수=green/음수=red
- `handleSaveHistory(stockId, metricsHistory)` 콜백으로 App state 저장

## 6. 변경 이력 (Recent Change Log)
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
- F10 EQS Screener — 프리셋 4종 + 커스텀 8조건 필터

### ✅ Month 3 (완료): 5-Year Financial History
- **SEC EDGAR 자동 수집**: 미국 종목 `/companyfacts/` XBRL → 10-K 5개년 (API 키 불필요)
- **DART 다년도 수집**: 한국 종목 `fnlttSinglAcntAll` 2회 호출 → 5개년 (DART 키 필요)
- **F1 HistoryTable**: Revenue / OP Income / FCF / OP Margin / EPS, YoY % 색상 코딩, 미니 바
- **stock.metricsHistory[]** 필드 신규 도입

### 🚀 Month 4 (다음): DCF Mini Modeler
- 8년 FCF 프로젝션 + WACC + Terminal Value 자동 계산
- F3 Valuation 패널과 연동 (Bull/Base/Bear 시나리오별 DCF)
- metricsHistory 5년 FCF 데이터를 기반 성장률 자동 제안

### 🚀 Phase 8: Automation & Notifications (외부 연동 및 자동화)
현재 수동으로 확인해야 하는 데이터와 알림을 능동적으로 사용자에게 전달합니다.
- **Telegram / Discord Webhook 연동**: `F6 Alerts` 패널에서 설정한 알림 조건이 충족될 때, `fetch` API를 사용하여 텔레그램 봇 API로 JSON 페이로드를 전송하여 푸시 알림 구현.
- **Service Worker 백그라운드 Fetch**: 브라우저의 Service Worker API(`navigator.serviceWorker`)를 등록하여 탭이 닫혀 있더라도 백그라운드에서 `setInterval`처럼 일정 주기로 가격 동기화를 수행하고 OS 네이티브 알림을 띄우는 기능 구현.
- **클라우드 수동 백업 및 복원 (Export/Import)**: `IndexedDB`에 쌓인 전체 데이터를 `JSON.stringify`하여 Blob 객체로 변환한 뒤 `<a>` 태그의 `download` 속성으로 내보내기 구현. 복원은 FileReader를 통해 파싱하여 DB 덮어쓰기.

### 🤖 Phase 9: Zero-Cost Local AI (WebLLM)
**완전 무료** 철학을 지키면서 AI 기능을 터미널에 결합합니다. API 키·계정·구독 일절 없음.
- **WebLLM 단독 도입**: 브라우저의 `WebGPU` API 기반 `@mlc-ai/web-llm` 라이브러리를 사용하여 LLM을 사용자 로컬 GPU에서 직접 구동. 외부 서버 호출 없음 — 데이터가 브라우저 밖으로 나가지 않음.
- **권장 모델**: Llama 3.2 3B Instruct (1.8GB, 빠름) 또는 Qwen 2.5 7B (4GB, 정확도↑). 첫 실행 시 한 번만 다운로드, 이후 IndexedDB 캐시.
- **주요 사용처**: F6 Alerts 뉴스/공시 요약, F2 PITCH Pre-mortem 자동 작성("이 thesis의 반대 논리는?"), 공시 핵심 지표 추출.
- **BYOK 제거 사유**: "완전 무료" 철학과 충돌. Anthropic/OpenAI 키는 유료 과금 발생. `summarizeWithClaude` 함수 및 관련 Settings UI 제거 완료 (2026-05-11).

### 📈 Phase 10: Advanced Pro-Charting & Backtesting (전문가급 시각화)
터미널의 가장 큰 장점인 빠르고 가벼운 자체 SVG 차트를 증권사 HTS/MTS 급으로 고도화합니다.
- **심화 기술적 보조 지표 (RSI, MACD, Bollinger Bands)**: `terminal-components.jsx`의 `PriceChart` 컴포넌트 내부에 RSI 연산 로직(지수이동평균 EMA 활용)을 추가하고, Volume 바텀 오버레이처럼 하단에 별도의 SVG `<path>` 그룹을 생성해 렌더링.
- **초경량 포트폴리오 시뮬레이션 (Paper Trading)**: 가상의 매수/매도 내역을 IndexedDB에 배열로 저장하고, 해당 내역의 시계열 자산 평가액을 계산하여 S&P 500 ETF(SPY)의 누적 수익률 곡선과 겹쳐서 비교하는 새로운 `F10 Backtest` 패널 추가.

### 🔄 Phase 11: Cross-Device Sync (다중 기기 동기화)
PC, 노트북, 모바일 등 여러 기기에서 동일한 터미널 경험을 끊김없이 이어갑니다.
- **Supabase 무료 티어 실시간 동기화**: 프로젝트에 이미 추가되어 있는 `supabase-js` 클라이언트를 활성화하여 `Realtime` 구독(Subscribe) 기능 연동. 로컬 IndexedDB에 변경(Mutate)이 발생할 때마다 Supabase PostgreSQL 테이블로 비동기 업싱크(Upsync) 수행.
- **멀티 워크스페이스 (Multi-Watchlist)**: 단일 `watchlist` 배열을 `{ id, name, symbols: [] }` 형태의 객체 배열로 구조 변경. 터미널 좌측이나 상단 탭을 통해 여러 개의 관심 그룹을 전환할 수 있도록 상태 관리(`useState`) 개편.

### 🧩 Phase 12: Alternative Data & Smart Money (대안 데이터 분석)
재무제표와 가격 데이터를 넘어, 시장을 움직이는 진짜 '스마트 머니'의 흐름을 쫓습니다.
- **내부자 및 의원 거래 추적**: 무료 대안 데이터 API(예: Quiver Quantitative 등)의 엔드포인트를 `fetch`로 호출하여, 특정 종목(symbol)의 SEC Form 4 내부자 매수/매도 내역을 파싱. 워치리스트나 피어 탭 내부에 뱃지(Badge) 형태의 인디케이터로 시각화.
- **Social Sentiment (소셜 여론 분석)**: Reddit API(r/wallstreetbets)를 직접 브라우저 단에서 호출(CORS 허용 엔드포인트 또는 프록시 서버 활용)하여, 지난 24시간 동안 가장 많이 언급된 종목(Tickers)과 긍/부정 비율을 수집해 메인 대시보드에 리스트업.

### 💻 Phase 13: Custom Quant Scripting (나만의 수식 에디터)
개발자/파워 유저를 위해 터미널 내부에 코딩 기능을 삽입하여 무한한 확장성을 부여합니다.
- **In-App 수식 에디터 내장**: MS의 오픈소스 에디터 뷰어인 `Monaco Editor` 모듈을 패널 내부에 `<iframe>` 또는 컴포넌트 형태로 마운트.
- **AST 기반의 안전한 조건식 인터프리터 구현**: 사용자가 입력한 `P/E < 10 && RSI < 30` 등의 문자열 수식을 자바스크립트의 안전한 파서(Parser)를 통해 Abstract Syntax Tree(AST)로 변환하여 `eval()` 없이 실행 가능하도록 샌드박스 룰 구축. 조건이 참인 종목만 화면에 필터링 표시.

### 🌐 Phase 14: Macro Correlation Engine (매크로 상관관계 분석)
단일 종목 분석을 넘어, 세계 거시경제와 내 종목이 어떤 영향을 주고받는지 통계적으로 분석합니다.
- **상관계수 매트릭스 (Correlation Matrix)**: `terminal-data.jsx`에서 S&P500, US10Y(국채), WTI(유가) 등의 매크로 지표 과거 1년치 시계열 데이터를 캐싱. 내 워치리스트 종목들의 동일 시계열 가격 데이터와 매칭하여 피어슨 상관계수(Pearson Correlation Coefficient)를 계산하는 순수 수학 유틸리티 함수 구현.
- **민감도 백테스팅(Stress Test)**: 사용자가 슬라이더 UI로 "달러 +5% 상승"을 세팅하면, 기존 상관계수 연산 결과를 역으로 곱하여 내 포트폴리오의 예상 변동폭(Risk)을 추정하는 시뮬레이터 기능 추가.

### 🎨 Phase 15: Social Share & Reporting (리포팅 및 공유)
내가 분석한 훌륭한 결과물(Thesis)을 멋지게 포장하고 외부에 자랑할 수 있는 수단입니다.
- **원클릭 투자 리포트 생성기**: HTML5 Canvas를 활용하는 `html2canvas`나 `dom-to-image` 라이브러리를 동적으로 로딩하여, `F2 PITCH` (마크다운 렌더링 결과)와 `F5 CHART` (SVG)를 한 장의 고해상도 PNG 이미지로 합쳐서 렌더링(Export) 및 다운로드.
- **웹 퍼블리싱 (Web Publishing)**: `PITCH` 데이터 객체 전체를 Base64로 인코딩한 뒤, 쿼리 스트링(`?thesis=base64...`)으로 포함시켜 Vercel 배포 URL을 생성하는 버튼 클릭 이벤트 추가. 다른 사람이 이 링크를 열면 읽기 전용 뷰어(Read-only Mode)로 해당 리포트 팝업 출력.
