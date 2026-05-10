# ThesisTrack Terminal — 인수인계 문서

## 프로젝트 개요

Bloomberg Terminal 스타일의 주식 투자 관리 앱. React 18 + Babel Standalone으로 빌드 없이 브라우저에서 직접 실행. 실시간 API 데이터(Yahoo Finance, Alpha Vantage, FMP, OpenDART, data.go.kr)를 연동해 재무지표 자동 계산, 점수 시각화, 투자 피치 관리를 제공.

---

## 현재 상태

### 완료된 작업

| 파일 | 상태 | 설명 |
|------|------|------|
| `tweaks-panel.jsx` | ✅ 완료 | 디자인 타임 tweaks 패널 (런타임에는 사용 안 함) |
| `terminal-components.jsx` | ✅ 완료 | UI 컴포넌트 (Cell, Stat, ScoreRing, CommandBar 등) + `[API]` 버튼 포함 |
| `terminal-data.jsx` | ✅ 완료 | 모든 API 호출 로직, 점수 계산, localStorage 관리 |
| `terminal-app.jsx` | ✅ 완료 | 메인 App 컴포넌트, 상태 관리, 모달, 키보드 단축키 |
| `terminal.html` | ✅ 완료 | 4개 JSX 파일을 인라인 Babel 블록으로 포함한 실행용 단일 HTML |

### 최근 완료된 작업

- **`terminal.html` 재작성 완료** — 4개의 JSX 파일을 `text/babel` 인라인 블록으로 로드함. API 버튼과 최신 App 상태가 단일 HTML에 반영되어 있음.
- **Research Log 입력 UI 완료** — F4 History 패널에서 날짜/분류/출처/메모를 바로 추가 가능.
- **Pre-mortem 편집 UI 완료** — F2 Pitch 패널의 Pre-mortem 영역에서 metric/current/threshold/target/status/delta 행 추가·수정·삭제 가능.
- **Valuation 시나리오 편집 UI 완료** — Edit Pitch 모달에서 bear/base/bull driver·multiple·MOS·price 및 valuation note 편집 가능.
- **Hero 기업명 표시 조정 완료** — 점수 옆 Hero 영역에서 기업명이 크게 한 줄로 보이고, 티커/시장/통화는 보조 라인으로 표시됨.
- **README 실행 안내 갱신 완료** — 실행 파일을 `index.html`이 아닌 `terminal.html`로 안내.
- **F1~F12 패널 확장 기반 완료** — 키보드 핸들러, 상단 function key 표시, 탭 렌더링을 F12까지 확장.
- **F7 Peers 완료** — 관심종목 기반 peer comparison 패널 추가. peer median 대비 핵심 지표 비교 가능.
- **F12 Settings/Data 완료** — API 설정, DART corp map, 캐시 삭제, JSON 백업/복원 패널 추가. `[API]` 버튼은 F12로 이동.
- **JSON 백업/복원 완료** — `schemaVersion`, merge/replace import, API key 기본 제외 export 구현.
- **마켓 티커 갱신 완료** — Yahoo chart 기반으로 KOSPI/S&P/NASDAQ/USDKRW/WTI/BTC/US10Y headline ticker 갱신.
- **provider 상태/fallback 개선 완료** — CommandBar provider indicator 추가, API 실패 시 만료 캐시(stale cache)가 있으면 표시.
- **Phase 1 완료 (2026-05-08)**
  - `start.bat`/`start.sh` 추가 — `python -m http.server 8080` 또는 `npx serve` 자동 실행 + 브라우저 자동 오픈. http 모드에서 file:// CORS 제약 해제.
  - README 갱신 — file:// 모드와 http 모드 차이 안내.
  - `tools/fetch-dart-corp-codes.ps1` 추가 — OpenDART corpCode.xml.zip 다운로드/파싱 후 `dart-corp-codes.json` 생성. http 모드에서는 앱이 자동 로드하고, file:// 모드에서는 F12 DART corp map 편집기에 붙여넣어 한국 종목을 일괄 매핑할 수 있음.
- **Phase 2 완료 (2026-05-08, F6 Alerts)**
  - `tools/build-terminal-html.ps1` 추가 — 4개 JSX 파일을 IIFE 래퍼로 인라인해 `terminal.html`을 일관되게 재생성하는 자동화 도구. 이후 모든 JSX 변경은 이 스크립트로 빌드.
  - `terminal-data.jsx` — `DEFAULT_ALERT_SETTINGS`, `ALERT_RETENTION_DAYS`, `fetchOpenDartDisclosures`, `fetchYahooNewsExperimental`, `fetchGoogleNewsRss`, `fetchAlertsForStock`, `makeAlertId`, `pruneAlerts` 추가.
  - `terminal-components.jsx` — `CommandBar`에 `[ALERT]` 버튼 + 새 알림 카운트 뱃지 추가 (`alertCount`, `onAlerts` props).
  - `terminal-app.jsx` — `alerts`/`alertSettings`/`alertErrors`/`alertStatus`/`alertsRefreshing` state, `handleRefreshAlerts`/`handleAlertOpen`/`handleAlertLog`/`handleAlertDismiss` 콜백, opt-in 자동 polling effect, F6 `AlertsPanel` 컴포넌트(필터/액션/소스 토글 내장), JSON export/import에 `alerts`/`alertSettings` 포함.
  - `LOG` 액션은 알림을 종목 `notes`에 Research Log 항목으로 저장하고 알림 상태를 `logged`로 전환.

### 2026-05-10 퀀트 스코어링 엔진 마이그레이션 (Phase 5) 완료 메모

- **데이터 추출 확장**: `terminal-data.jsx`의 Alpha Vantage, FMP, OpenDART 매핑 로직을 확장하여 `evEbitda`, `gpa`(Gross Profit/Assets), `roic` 등 신규 팩터를 `metrics`로 수집하도록 변경.
- **통계 유틸리티 추가**: `winsorize`, `zScore`, `zToScore`, `industryDemean` 등 퀀트 분석용 통계 함수들을 `terminal-data.jsx`에 구현.
- **상대평가(Cross-sectional) 로직 도입**: 기존 절대평가 `computeScores` 대신 유니버스 전체를 기반으로 팩터별 Z-Score를 산출하는 `computeQuantScores` 추가.
- **상태 관리 리팩터링**: `terminal-app.jsx`의 `handleRefresh`, `handleAddFromSearch`, `handleRemove`가 개별 종목 점수가 아닌 **워치리스트 전체의 상대 점수**를 재계산(applyQuantScores)하도록 수정. (이를 통해 종목 추가/삭제 시에도 유니버스에 맞는 점수 재조정이 이뤄짐).
- **점진적 배포 고려**: 프론트엔드 UI를 파괴하지 않기 위해, 새로운 `composite`, `quality`, `safety`, `value`, `growth` Z-score 결과를 기존 UI에서 사용하는 `overall`, `profitability`, `stability`, `valuation`, `growth` 필드에 매핑.
- **앱 빌드 완료**: `tools/build-terminal-html.ps1` 스크립트를 실행하여 변경된 코드를 `terminal.html`에 인라인 빌드.

### 2026-05-09 Phase 3/4 완료 메모

- **Phase 3 완료:** F8 Checklist, F9 Calendar, F10 Journal을 placeholder에서 실제 패널로 교체.
- **F8 Checklist:** `stock.checklist`에 종목별 체크리스트 저장. 기본 템플릿, 카테고리별 섹션, 체크/삭제, 완료율 progress bar, `LOAD TEMPLATE`, `CLEAR DONE` 구현.
- **F9 Calendar:** `stock.review.next`를 자동 리뷰 이벤트로 합치고, `stock.calendarEvents`에 수동 이벤트를 저장. 이벤트 추가, 완료/되돌리기, 삭제, URL OPEN, 종목 이동 지원.
- **F10 Journal:** F2 Pitch와 F10 Journal에서 `CAPTURE SNAPSHOT` 가능. 현재 recommendation, oneLine, price, target, score, thesis, risks를 `stock.journal`에 저장하고 outcome/note 사후검증 편집 가능.
- **Phase 4 완료:** F11 Portfolio와 선택형 BYOK Claude 요약 연결 완료.
- **F11 Portfolio:** 전역 `portfolio` state 저장. base currency, cash, 수동 FX rate, 종목별 shares/avg cost 입력, 평가금액, 비중, P/L, 통화 노출 표시.
- **BYOK 요약:** F12 Settings/Data에 `ANTHROPIC KEY (BYOK 요약)` 입력란 추가. `terminal-data.jsx`의 `summarizeWithClaude(text, key, model?)`가 Anthropic Messages API를 직접 호출. F6 alert 카드에는 key가 있을 때만 `요약` 버튼 표시, 결과는 alert `summary`에 저장.
- **비용 정책:** BYOK 요약은 선택 기능이다. 앱 자체에서 유료 API를 강제하지 않지만, 사용자가 Anthropic key를 입력해 호출하면 해당 Anthropic 계정의 과금/무료 크레딧 정책을 따른다.
- **백업/복원:** JSON export/import에 `portfolio` 포함. 기본 export는 `anthropicKey`를 비워 key 유출을 막고, merge import에서 빈 key는 기존 key를 덮어쓰지 않는다.
- **로컬 HTTP 실행 보강:** `tools/local-http-server.cjs` 추가. `start.bat`/`start.sh`는 Python이 없으면 Node fallback을 먼저 사용하고, 마지막으로 `npx serve`를 시도한다. 현재 Windows 환경에서는 Node fallback으로 `http://localhost:8080/terminal.html` 실행 확인.
- **UI 가독성 개선:** 100% 화면 배율에서 글자가 작아 보여 `terminal-app.jsx`에 `APP_UI_SCALE = 1.1` 적용. 최상위 App 컨테이너를 110%로 스케일하되 viewport에 맞게 width/height를 역보정한다. 더 크게/작게 조정하려면 이 상수만 변경 후 `tools/build-terminal-html.ps1`로 재빌드.
- **DART corp_code 자동 로드 완료:** http 모드에서 앱 시작 시 같은 폴더의 `dart-corp-codes.json`을 자동 fetch해 기존 `dartCorpMap`과 병합한다. F12 Settings/Data에 로드 상태, KRX watchlist 매핑 누락, `LOAD LOCAL DART JSON` 수동 재로드 버튼을 추가했고, F6 Alerts에는 OpenDART key/매핑 상태 안내를 표시한다. file:// 모드는 브라우저 CORS 정책상 자동 fetch가 막힐 수 있으므로 F12 수동 붙여넣기/백업 import가 fallback이다.
- **OpenDART CORS 대응 완료:** 브라우저 직접 호출에서 `Failed to fetch`가 발생할 수 있어 `tools/local-http-server.cjs`에 `/api/opendart/*.json` 로컬 프록시를 추가. `terminal-data.jsx`는 localhost/http origin에서 OpenDART 재무제표(`fnlttSinglAcntAll`, `fnlttSinglAcnt`)와 공시(`list`) 호출을 이 프록시로 보낸다. `start.bat`/`start.sh`는 Node 서버를 우선 사용하도록 변경했으며, Python/npx fallback은 OpenDART proxy 없음 경고를 출력한다.
- **SEC EDGAR 연동 완료:** F6 Alerts에 `SEC EDGAR (미국 공시)` 소스 추가. `tools/local-http-server.cjs`의 `/api/sec/*.json` 프록시가 SEC `company_tickers.json`과 `data.sec.gov/submissions/CIK##########.json`을 중계한다. `terminal-data.jsx`는 ticker → CIK 매핑 후 10-K/10-Q/8-K/20-F/40-F/6-K/S-1/S-3/DEF 14A를 alert 카드로 변환한다.
- **실시간 가격 갱신 완료:** `fetchLivePrice(stock)` 추가. 앱 로드 후 및 60초마다 watchlist 가격을 Yahoo chart 기반 현재가로 갱신하고, 수동 데이터 refresh 후에도 해당 종목 live price를 한 번 더 갱신한다. 재무제표/API 캐시와 분리되어 `Last Price`가 오래된 seed/cache 가격에 머무르는 문제를 완화한다.
- **Yahoo chart CORS 대응 완료:** 삼성전자 등 KRX live price가 브라우저 직접 Yahoo 호출 실패 시 반영되지 않는 문제를 줄이기 위해 `tools/local-http-server.cjs`에 `/api/yahoo/chart/:symbol` 프록시 추가. `fetchYahooChart`, `fetchLivePrice`, headline ticker 갱신이 localhost/http origin에서는 해당 프록시를 사용한다.
- **Yahoo 검색/뉴스 CORS 대응 완료:** `/` 종목 검색과 F6 Yahoo News가 브라우저 직접 Yahoo `finance/search` 호출 실패 시 빈 결과로 보이는 문제를 줄이기 위해 `tools/local-http-server.cjs`에 `/api/yahoo/search` 프록시 추가. `searchWithYahoo`와 `fetchYahooNewsExperimental`은 localhost/http origin에서 이 프록시를 사용한다.
- **검색 결과 추가 안정화 완료:** `/` 검색 결과 클릭 후 새 종목 데이터 모양이 불완전하거나 기존 localStorage에 꼬인 종목 ID가 있을 때 검은 화면으로 죽는 문제를 막기 위해 `makeBlankStock`, `normalizeStockRecord`, `normalizeStocksMap`, `normalizeStockId` 추가. 저장된 stocks/watchlist/activeId와 새 검색 결과를 모두 표준 종목 구조로 보정한다.
- **검은 화면 복구 로직 강화 완료:** 저장된 `localStorage`의 `stocks`/`watchlistIds`/`activeId`/settings/portfolio/alerts 형태가 이전 버전과 맞지 않아도 `buildInitialAppState()`가 안전하게 보정한다. React 렌더 오류가 발생하면 빈 검은 화면 대신 `THESISTRACK RECOVERY` 패널을 표시하고, `REPAIR ACTIVE STOCK` 또는 `RESET LOCAL DATA`로 복구할 수 있다. `/` 검색 결과 추가는 functional state update와 try/catch로 변경해 stale state 및 결과 객체 예외 가능성을 줄였다. React/Babel CDN 또는 스크립트 로딩 자체가 실패하는 경우를 대비해 `tools/build-terminal-html.ps1`의 `#root`에 정적 `THESISTRACK BOOT` fallback도 추가했다.

### 검증 메모

- **2026-05-09 Phase 3/4 브라우저 검증 완료:** `powershell -ExecutionPolicy Bypass -File tools/build-terminal-html.ps1`로 `terminal.html` 재생성 후 Chrome headless + CDP로 `file:///C:/Users/lsv/Desktop/project/terminal.html`을 실제 로드.
- **F8~F12 키 전환 검증:** CDP에서 `KeyboardEvent('keydown', { key: 'F8' ... 'F12' })`를 순차 발생시켜 CHECKLIST/CALENDAR/JOURNAL/PORTFOLIO/SETTINGS 패널 렌더링 확인. 스크린샷은 `.verify/f8-phase34.png`~`.verify/f12-phase34.png`, 첫 화면은 `.verify/terminal-phase34.png`.
- **재빌드 후 재검증:** placeholder key 정리 후 다시 `terminal.html` 빌드, F8~F12 핵심 텍스트(`ADD CHECK`, `ADD EVENT`, `CAPTURE SNAPSHOT`, `TOTAL VALUE`, `ANTHROPIC KEY`) 확인, runtime exception 0건.
- **2026-05-09 UI scale 검증:** `APP_UI_SCALE = 1.1` 적용 후 `terminal.html` 재빌드, `http://localhost:8080/terminal.html` HTTP 200 및 headless Chrome screenshot `.verify/ui-scale-110-http.png`로 기본 화면 레이아웃 확인.
- **2026-05-09 DART corp_code 자동 로드 검증:** `tools/build-terminal-html.ps1`로 `terminal.html` 재생성 후 `http://localhost:8080/terminal.html` HTTP 200 확인. Chrome headless + CDP로 실제 페이지를 로드하고 F12 Settings/Data 탭 클릭 후 DOM에서 `SETTINGS / DATA`, `DART CORP CODE MAP`, `LOAD LOCAL DART JSON`, `dart-corp-codes.json` 상태 문구 확인, runtime error 없음. `terminal-data.jsx` 헬퍼를 Node fetch mock으로 평가해 `005930.KS` → 기본 삼성전자 corpCode `00126380` 매핑과 `dart-corp-codes.json` 미존재 시 `missing` 상태 반환 확인.
- **2026-05-09 OpenDART proxy 검증:** 임시 Node 서버(`tools/local-http-server.cjs`, port 8090)로 `/api/opendart/list.json?...` 호출 시 OpenDART 원 응답 `{"status":"010","message":"등록되지 않은 인증키입니다."}` 수신 확인. 즉 로컬 프록시 경로와 외부 OpenDART 연결은 정상이며, 실제 데이터 조회는 사용자의 유효 key/요청 파라미터에 좌우된다.
- **2026-05-09 SEC/live price 검증:** 임시 Node 서버(`tools/local-http-server.cjs`, port 8091/8092)로 `/api/sec/files/company_tickers.json` 및 `/api/sec/submissions/CIK0000320193.json` 200 응답 확인. `terminal-data.jsx` 함수 평가 결과 AAPL 최근 30일 SEC alert 3건 변환, `fetchLivePrice(AAPL)`가 Yahoo live 가격과 `Yahoo live (AAPL)` source 반환 확인.
- **2026-05-09 Samsung live price 검증:** 임시 Node 서버(`tools/local-http-server.cjs`, port 8094/8095)에서 `/api/yahoo/chart/005930.KS?range=1d&interval=1m` 200 응답 확인. `fetchLivePrice({ symbol:'005930', market:'KRX' })` 결과 `price: 268500`, `prevClose: 271500`, `priceSrc: Yahoo live (005930.KS)` 반환 확인.
- **2026-05-09 검색 검은 화면 복구 검증:** `powershell -ExecutionPolicy Bypass -File tools/build-terminal-html.ps1`로 `terminal.html` 재생성 완료. `http://localhost:8080/terminal.html` HTTP 200, HTML 내 `THESISTRACK BOOT`, `THESISTRACK RECOVERY`, `buildInitialAppState`, `AppErrorBoundary` 포함 확인. `/api/yahoo/search?q=AAPL&quotesCount=10&newsCount=0` 200 응답 확인. 실제 브라우저 클릭 재현은 현재 세션의 browser-use Node REPL 도구 미노출 및 headless 브라우저 실행 제한으로 수행하지 못했으므로, 사용자가 새로고침 후 boot/recovery 패널 표시 여부를 확인해야 한다.
- **런타임 오류:** 새 패널 관련 React 예외는 발견되지 않음. file:// origin에서 Yahoo headline ticker fetch가 CORS로 실패하는 기존 로그는 관찰됨. 화면은 기본 ticker fallback 값으로 정상 렌더링됨.
- **2026-05-08 브라우저 렌더링 검증 완료:** Chrome headless + network 권한으로 `file:///C:/Users/lsv/Desktop/project/terminal.html`을 열어 React/Babel/CDN 실행 확인.
- 실제 렌더링 DOM에서 `#root > div`, `THESIS//TRACK`, `Tesla, Inc.`, `F7`, `PEERS`, `F12`, `SETTINGS` 확인.
- 스크린샷: `.verify/terminal-escalated.png`에 정상 렌더링 화면 저장.
- 주의: sandbox 기본 권한에서는 CDN 스크립트 로드가 막혀 `#root`가 비어 있고 검은 화면만 캡처됨. 브라우저 실검증 시 네트워크 권한 필요.
- CDP로 F7/F12 클릭 자동검증까지 시도했으나 해당 세션은 타임아웃. 정적 렌더링 검증은 완료, 패널 클릭 시각 검증은 추후 visible browser 또는 더 안정적인 Playwright 환경에서 재시도 권장.

---

## 핵심 기술 제약 사항 (반드시 숙지)

### `file://` 프로토콜 + Babel Standalone CORS 문제

- Babel Standalone은 내부적으로 `fetch()`를 사용해 외부 JSX 파일을 로드
- `file://` 프로토콜에서는 CORS 정책으로 외부 파일 로드가 **차단됨**
- 결론: **4개 JSX 파일을 모두 `terminal.html` 안에 인라인으로 포함해야 함**

### `<script type="text/babel">` 다중 블록

```html
<!-- 이 방식이 정답 -->
<script type="text/babel">/* tweaks-panel.jsx 전체 내용 */</script>
<script type="text/babel">/* terminal-components.jsx 전체 내용 */</script>
<script type="text/babel">/* terminal-data.jsx 전체 내용 */</script>
<script type="text/babel">/* terminal-app.jsx 전체 내용 */</script>
```

- 각 블록은 Babel이 독립적으로 트랜스파일되고, 현재 `terminal.html`에서는 각 블록을 IIFE로 감싸 top-level 선언 충돌을 방지함.
- **`const { useState } = React;`가 4개 블록에 중복 선언되어도 충돌 없음** (각 블록이 별도 스코프)
- 블록 간 통신은 `window.*` 전역 변수로 수행 (이미 각 파일에 구현됨)
- **실행 순서**: tweaks → components → data → app (의존성 순서)

---

## 새 terminal.html 작성 명세

### HEAD 구성

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ThesisTrack — Terminal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: #07090b;
      color: #e5e7eb;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
    }
    #root { height: 100vh; display: flex; flex-direction: column; }
    ::selection { background: rgba(255, 149, 0, 0.35); color: #fff; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #0d1116; }
    ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #374151; }
  </style>
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" crossorigin="anonymous"></script>
</head>
<body>
  <div id="root"></div>
  <!-- 4개 인라인 블록 (순서 중요) -->
</body>
</html>
```

### BODY 스크립트 블록 순서

```
1. <script type="text/babel"> tweaks-panel.jsx 전체 </script>
2. <script type="text/babel"> terminal-components.jsx 전체 </script>
3. <script type="text/babel"> terminal-data.jsx 전체 </script>
4. <script type="text/babel"> terminal-app.jsx 전체 </script>
```

---

## 파일별 상세 설명

### `tweaks-panel.jsx` (310줄)

디자인 타임 도구. 런타임에는 패널이 보이지 않음 (postMessage로 활성화 필요).

**window에 노출하는 심볼:**
```
useTweaks, TweaksPanel, TweakSection, TweakRow,
TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakColor
```

### `terminal-components.jsx` (428줄)

**line 2:** `const { useState, useEffect, useRef, useMemo } = React;`

디자인 토큰(`T`), 공통 컴포넌트, CommandBar의 `[API]` 버튼 구현. `HeroStrip`은 기업명을 큰 한 줄 텍스트로, 티커/시장/통화는 보조 라인으로 표시. `CommandBar`는 F1~F12 function key 표시와 provider 상태 indicator를 받음.

**`CommandBar` 컴포넌트의 `[API]` 버튼 조건:**
```jsx
{onSettings && (
  <button onClick={onSettings} ...>API</button>
)}
```
→ App에서 `onSettings={() => setSettingsOpen(true)}`를 전달하면 버튼이 렌더됨.

**`kbdStyle` 위치 주의:** `CommandBar` 함수 선언 이후에 정의됨. CommandBar 내부에서 참조하지만, 함수 실행 시점에는 이미 정의되어 있어 문제없음.

**window에 노출하는 심볼:**
```
T, Cell, Stat, ScoreRing, ScoreBar, Spark, PriceChart,
CommandBar, TickerRail, HeroStrip, PitchHeadline,
fmtNum, fmtPx, sign, colorForChange, safeFixed, kbdStyle
```

### `terminal-data.jsx` (998줄)

**line 1:** `/* global React */`

모든 API 로직, 점수 계산, 기본 데이터 포함.

**중요: 메트릭 키 이름** (terminal 전용 네이밍)
```
opMargin    (operatingMargin 아님)
revGrowth   (revenueGrowth 아님)
```
SCORE_CFG, computeScores, MetricsGrid 모두 이 키 이름을 사용.

**localStorage 키:** `'tt-terminal-v1'`
(구 앱의 `'thesis-track-v1'`과 다름 — 의도적으로 분리)

**기본 종목:** TSLA, AAPL, NVDA, 005930 (삼성전자)

**`fetchStockData` 함수 반환 구조:**
```js
{
  name, currency, price, prevClose, priceHistory,
  metrics, asOf, priceSrc,
  cacheUpdates: { [cacheKey]: { fetchedAt, provider, payload } },
  fromCache: true | undefined
}
```
→ App의 `handleRefresh`에서 `{ cacheUpdates, fromCache, fromStaleCache, ...payload }` 구조분해로 사용.
→ 선택 provider API 요청 실패 시 같은 cacheKey의 만료 캐시가 있으면 `fromStaleCache: true`로 반환.

**캐시 TTL:** `cacheDays × 86400000ms`

**window에 노출하는 심볼:**
```
TT_KEY, MARKET_PROFILES, COUNTRY_FLAGS,
DEFAULT_STOCKS, DEFAULT_WATCHLIST_IDS, DEFAULT_API_SETTINGS,
DEFAULT_DART_CORP_MAP, DEFAULT_MARKET_TICKERS,
loadAppState, saveAppState,
computeScores, computeDynamicQuality,
getDaysLeft, fetchStockData, searchWithYahoo, searchWithFmp,
inferMarketFromExchange, normalizeSymbolForMarket, getMarketProfile,
SCORE_CFG
```

### `terminal-app.jsx` (1703줄)

**line 10:** `const { useState, useEffect, useRef, useMemo, useCallback } = React;`

**line 13:** `window.getDaysLeft = window.getDaysLeft || (...)` — terminal-data보다 먼저 평가될 경우 대비한 가드.

**`useTweaks` 관련:** 제거됨. 아래 주석으로 대체됨:
```js
// tweaks-panel is a design-time tool; not used at runtime in terminal
```

**App 컴포넌트 마운트:**
```js
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
```

**주요 상태 (App):**
```
stocks, watchlistIds, activeId, apiSettings, dataCache, dartCorpMap,
marketTickers, refreshing, fetchStatus, providerStatus, toasts, activePanel,
searchOpen, settingsOpen, pitchEditId
```

**패널 키:** F1(Overview), F2(Pitch), F3(Valuation), F4(History/Review), F5(Chart), F6(Alerts), F7(Peers), F8(Checklist), F9(Calendar), F10(Journal), F11(Portfolio), F12(Settings/Data)

**키보드 단축키:** F1–F12 패널 전환, `/` 검색, Escape 닫기

**최근 추가 UI:**
- `HistoryPanel`: Research Log 직접 입력
- `PreMortemPanel`: Pre-mortem 지표 행 편집
- `EditPitchModal`: valuation scenario 편집
- `PeersPanel`: F7 peer comparison
- `SettingsDataPanel`: F12 settings/data/cache/backup

---

## API 프로바이더 상세

### Yahoo Finance Experimental (무료, 기본값)
- 차트: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=3mo&interval=1d`
- 시세: `https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbol}&fields=...`
- 검색: `https://query1.finance.yahoo.com/v1/finance/search?q={query}`
- **API key 불필요**, 비공식 API — 간헐적 차단 가능성 있음
- KRX: `005930.KS`, TSE: `9984.T` 등 suffix 자동 변환 (`toYahooSymbol()`)
- 현재 데이터 새로고침은 선택된 provider만 사용함. Yahoo 실패 시 Alpha Vantage로 자동 fallback하지 않음.

### Alpha Vantage
- key: `apiSettings.alphaVantageKey`
- 5개 순차 요청: OVERVIEW, TIME_SERIES_DAILY, BALANCE_SHEET, CASH_FLOW, INCOME_STATEMENT
- 요청 간 **1250ms 딜레이** (무료 플랜 rate limit 대응)
- `assertAVResponse()`로 rate limit/오류 메시지 감지
- 무료 플랜은 요청량이 매우 제한적이므로 polling/알림 기능의 주 소스로 쓰지 않는 것을 권장.

### Financial Modeling Prep (FMP)
- key: `apiSettings.fmpKey`
- Base URL: `https://financialmodelingprep.com/stable/`
- 5개 엔드포인트: `quote`, `profile`, `ratios-ttm`, `key-metrics-ttm`, `historical-price-eod/light`
- 요청 간 **250ms 딜레이**
- symbol: `toFmpSymbol()` 변환 사용
- 무료 플랜은 제한이 있고 일부 뉴스/고급 데이터는 유료 플랜이 필요할 수 있으므로, 무료 우선 정책에서는 보조 소스로만 취급.

### OpenDART (한국 재무제표)
- key: `apiSettings.openDartKey`
- 엔드포인트: `fnlttSinglAcntAll.json` 우선, 실패 시 `fnlttSinglAcnt.json` fallback
- localhost/http origin에서는 CORS 회피를 위해 로컬 Node 서버의 `/api/opendart/*.json` proxy를 사용한다. `start.bat`/`start.sh`는 Node 서버를 우선 실행해야 한다.
- `dartCorpMap` 필요: `{ '005930': { corpCode: '00126380', corpName: '삼성전자' } }`
- http 모드에서는 같은 폴더의 `dart-corp-codes.json`을 앱 시작 시 자동 로드해 `dartCorpMap`과 병합한다.
- file:// 모드에서는 브라우저 CORS로 로컬 JSON fetch가 막힐 수 있으므로 F12 Settings/Data의 DART corp map 편집기 또는 백업 import를 사용한다. http 모드에서는 `LOAD LOCAL DART JSON` 버튼으로 수동 재로드 가능.

### data.go.kr (한국 현재가)
- key: `apiSettings.dataGoKrKey`
- `GetStockSecuritiesInfoService/getStockPriceInfo`
- 6자리 종목코드로 자동 패딩: `symbol.padStart(6, '0')`

### 무료 알림 기능 데이터 소스
- **한국 공시:** OpenDART `list.json` 공시검색 API. 무료 key 필요, 관심종목 `corp_code` 필요.
- **한국 주가:** data.go.kr 금융위원회 주식시세정보. 무료 key 필요. 실시간보다는 지연/일 단위 데이터로 취급.
- **미국 공시:** SEC EDGAR `company_tickers.json` + `submissions/CIK##########.json`. 무료, API key 불필요. `data.sec.gov` CORS 제약 때문에 Node 로컬 서버의 `/api/sec/*.json` 프록시 사용.
- **뉴스:** Yahoo Finance 비공식 뉴스/검색 엔드포인트를 무료 후보로 사용 가능. 공식 API가 아니므로 실패/구조 변경 대비 필요.
- **제외:** Alpha Vantage 유료 플랜, FMP 유료 뉴스/고급 데이터, NewsAPI 유료 플랜, 실시간 시세/뉴스 스트리밍 유료 데이터.

---

## 5차원 점수 계산 구조

```
overall = weighted_avg(profitability×25, stability×25, growth×20, valuation×20, risk×10)

profitability = wavg(roe×50%, opMargin×30%, fcfMargin×20%)
stability     = wavg(debtRatio×55%, currentRatio×45%)
growth        = wavg(revGrowth×48%, epsGrowth×52%)
valuation     = wavg(per×60%, pbr×40%)
risk          = 100 - (위반 플래그 수 × 22점)
```

위험 플래그 조건: `epsGrowth < 0`, `fcfMargin < 0`, `debtRatio > 150`, `per > 70`, `per <= 0`

---

## 향후 작업 목록

### 완료

- [x] **`terminal.html` 재작성** — 4개 JSX 파일을 별도 `<script type="text/babel">` 블록으로 인라인 포함. 위 명세 참고.
- [x] **Research Log 입력 UI** — `HistoryPanel`에서 날짜/분류/출처/메모를 바로 추가할 수 있음.
- [x] **Pre-mortem 편집 UI** — `PreMortemPanel`에서 metric/current/threshold/target/status/delta 행 추가·수정·삭제 가능.
- [x] **Valuation 시나리오 편집 UI** — `EditPitchModal`에서 bear/base/bull driver·multiple·MOS·price 및 valuation note 편집 가능.
- [x] **Hero 기업명/티커 표시 개선** — 기업명을 크게 한 줄로 표시하고 티커/시장/통화는 보조 라인으로 이동.
- [x] **README 실행 파일명 갱신** — `terminal.html` 실행 안내로 수정.
- [x] **F1~F12 패널 확장 기반** — `PANEL_DEFS` 기반 탭/키보드/CommandBar 확장.
- [x] **F7 Peer 비교 패널** — 관심종목 peer median 대비 PER/PBR/ROE/OPM/부채/성장률/점수 비교.
- [x] **F12 Settings/Data 패널** — API 설정, DART corp map, provider 선택, 캐시 삭제, JSON 백업/복원 통합.
- [x] **마켓 티커 실시간화** — Yahoo chart 기반 headline ticker 갱신. 별도 polling 없이 앱 로드/종목 refresh에 묶음.
- [x] **JSON 백업/복원** — `schemaVersion`, merge/replace import, API key 기본 제외 export 구현.
- [x] **데이터 provider fallback 정책 정리** — CommandBar provider 상태 indicator 추가, 만료 캐시 stale fallback 구현.
- [x] **F8 Checklist 패널** — 종목별 checklist, 기본 템플릿, 완료율, 추가/삭제/체크 토글 구현.
- [x] **F9 Calendar 패널** — review.next 자동 이벤트와 종목별 수동 이벤트 관리 구현.
- [x] **F10 Journal 패널** — 피치 snapshot 저장과 outcome/note 사후검증 구현.
- [x] **F11 Portfolio 패널** — 보유 수량/평단/비중, cash/base currency/수동 FX rate, 통화 노출 구현.
- [x] **BYOK Claude 요약** — Anthropic key 입력란, `summarizeWithClaude`, F6 alert 카드 요약 버튼/summary 저장 구현.

### 단기

- [x] **무료 공시/뉴스 알림** ✅ Phase 2 완료 — F6 Alerts 패널, OpenDART/Yahoo/Google News 소스, 필터/OPEN/LOG/DISMISS 액션, opt-in 자동 polling, CommandBar 뱃지까지 통합. 자세한 검증 항목은 "Phase 2 검증 체크리스트" 참조.
- [ ] **서비스 워커 / 오프라인 캐시** ❌ file://에선 불가. http 모드(start.bat)로 전환했을 때만 진행 가능. 보류 항목으로 분류.
- [x] **DART corp_code 자동 검색/로드** ✅ Phase 1 후속 완료 — `tools/fetch-dart-corp-codes.ps1`로 전체 listed company 매핑을 `dart-corp-codes.json`으로 생성하고, http 모드에서 앱이 시작 시 자동 로드한다. F12에서 수동 재로드/상태 확인/JSON 직접 편집도 가능.

### 장기

- [ ] **Supabase 연동** ⚠️ "무료 정적" 정신과 충돌 — 멀티 디바이스 동기화 (README: "배포를 생각할 때 검토"). (검토 메모: GitHub Gist 동기화 또는 Google Drive API가 제로 인프라 대안. 디바이스 1~2대면 manual JSON export/import만으로 충분할 수도 있음)
- [x] **공시/뉴스 요약** ✅ Phase 4 완료 — F12에 Anthropic BYOK key 입력란 추가, F6 alert 카드에서 key가 있을 때만 `요약` 버튼 표시. 선택 기능이며 key 사용 시 Anthropic 계정의 과금/무료 크레딧 정책을 따름.
- [ ] **백그라운드 Web Push 알림** ❌ 권장 안 함 — 브라우저가 닫혀 있어도 OS 알림을 띄우려면 Service Worker + Push subscription + 무료 백엔드/스케줄러가 필요. 무료 유지가 조건이므로 Cloudflare Workers/Supabase free tier 등만 검토. (검토 메모: file://에서 불가. Windows 작업 스케줄러로 페이지 자동 오픈 또는 포기 권장)
- [ ] **디스코드/텔레그램 알림 봇 (웹훅)** — 웹 배포 환경(Vercel 등)에서 주요 공시/뉴스가 감지될 때 사용자가 설정한 디스코드 웹훅이나 텔레그램 봇으로 푸시 알림 전송 (백그라운드 Web Push의 대안).

---

## 작업 검토 메모 (2026-05-08, Opus 4.7)

향후 작업 목록과 F6~F12 확장 후보를 종합 검토한 결과 정리. 코드 변경 없이 가능성 평가와 더 좋은 아이디어 위주.

### 모든 항목에 영향을 주는 큰 제약

`file://` 프로토콜에서 돌아가는 한 다음은 구조적으로 막혀있음:

- **Service Worker 사용 불가** → 오프라인 캐시, 백그라운드 Web Push 거의 불가능
- **CORS 추가 제약** → SEC EDGAR 같은 일부 API 직접 호출 차단
- **Notification API 제한적** → 데스크톱 알림이 origin별 권한 요구로 file://에서 안정성 떨어짐

#### 권장: 로컬 HTTP 서버 옵션

`start.bat`/`start.sh` 한 줄로 `python -m http.server 8080` 또는 `npx serve` 실행. README에 옵션으로 안내. file:// 모드도 같이 유지하면 무손실. 위 제약 대부분이 풀림.

### 단기 작업 평가 상세

#### 1. 무료 공시/뉴스 알림 팝업 — ✅ 구현됨
- OpenDART `list.json`: 한국 공시 free key로 안정 ✅
- Yahoo 비공식 뉴스: 동작하지만 비공식이라 깨질 수 있음. 실패 toast 처리 필수
- SEC EDGAR: Node 로컬 서버 프록시(`/api/sec/*.json`)로 구현 완료. file:///Python/npx 정적 서버에서는 CORS로 실패할 수 있음

**개선안:**
- IR RSS + Google News RSS (`https://news.google.com/rss/search?q={ticker}`)는 SEC/OpenDART 보조 뉴스 소스로 유지
- transient 팝업보다 CommandBar 빨간 점 뱃지 + F6 Alerts 패널 통합이 덜 산만함
- 5~15분 polling보다 패널 열 때만 fetch + manual refresh가 무료 정책에 안전 (rate limit 폭주 방지)

#### 2. 서비스 워커 / 오프라인 캐시 — ❌ file://에선 불가
- 현실적 대안: 기존 `dataCache`를 IndexedDB로 옮기거나 localStorage 캐시 적극 활용. `fromCache: true` 표시에 "stale data" 배지 추가만으로도 충분

#### 3. DART corp_code 자동 검색/로드 — 완료
- `tools/fetch-dart-corp-codes.ps1`가 OpenDART `corpCode.xml.zip`을 받아 listed company만 필터링해 `dart-corp-codes.json`을 생성한다.
- http 모드에서 앱 시작 시 `dart-corp-codes.json`을 자동 로드하고, F12의 `LOAD LOCAL DART JSON`으로 재시도할 수 있다.
- file:// 모드는 로컬 JSON fetch가 브라우저 정책에 막힐 수 있으므로 F12 직접 편집 또는 JSON import를 fallback으로 둔다.

#### 4. 마켓 티커 실시간화 — 완료
- Yahoo `^GSPC`, `^KS11`, `BTC-USD` 등 그대로 동작
- 별도 polling 만들지 말고 메인 refresh 사이클에 묶기 (rate limit 부담 방지)
- 구현됨: 앱 로드와 종목 refresh 후 `TickerRail` 값을 Yahoo chart 기반으로 갱신.

#### 5. Peer 비교 패널 — 완료
- 단순 테이블보다 peer median 대비 premium/discount % 컬럼 추가
- F7 Peers 패널 형태로 통합 구현 완료.
- 구현됨: F7 Peers 패널에서 watchlist peer median 기준 비교.

#### 6. JSON 백업/복원 — 완료
**개선안:** `schemaVersion` 필드 추가, import 시 merge vs replace 토글, API 키 기본 제외 정책 유지
- 구현됨: F12 Settings/Data 패널에서 export/import 제공.

#### 7. provider fallback 정책 — 완료
**개선안:** CommandBar에 provider 상태 indicator (●초록/●노랑/●빨강). Alpha Vantage 죽는 걸 한 눈에 확인
- 구현됨: provider indicator와 만료 캐시 stale fallback 추가. 단, Yahoo 실패 시 Alpha Vantage 자동 전환은 무료 요청량 정책상 구현하지 않음.

### 장기 작업 평가 상세

#### 1. Supabase 연동 — ⚠️ "무료 정적" 정신과 충돌
- 가입 + 백엔드 의존성 생김

**개선안 (우선순위 순):**
- **Plan A (제로 인프라):** GitHub Gist 동기화. 사용자 PAT → 비공개 gist에 JSON 저장. 버튼 한 개로 끝
- **Plan B:** Google Drive API. user-side OAuth, 백엔드 불필요
- **Plan C:** 동기화 포기, manual JSON export/import로 충분하다고 결론. 디바이스 1~2대면 인프라가 과함

#### 2. 공시/뉴스 LLM 요약 — ⚠️ 비용 발생
- LLM API는 무료 정책 위반

**개선안:** BYOK (Bring Your Own Key). 사용자가 자기 Anthropic API 키 입력. ApiSettings에 칸 하나 추가. 제로 인프라 + 무료 정책 유지

#### 3. 백그라운드 Web Push — ❌ 권장 안 함
- Service Worker + Push 구독 + 백엔드 + HTTPS 도메인 필요

**현실적 대안:**
- Windows 작업 스케줄러로 매일 아침 페이지 자동 오픈
- 또는 포기. 매일 한두 번 켤 때 F6 Alerts 확인하면 충분

### F6~F12 패널 추가 메모

- **F6 Alerts:** 단기 1과 합쳐 가장 먼저 만들면 효과 큼
- **F7 Peers:** 구현 완료.
- **F9 Calendar:** 무료 실적 발표일 안정 입수 어려움. 수동 입력 + `stock.review.next` 통합 뷰로 시작. 자동화는 후순위
- **F11 Portfolio:** 통화 혼합 환율 처리가 함정. 1차 버전은 base currency 한 종(예: KRW) 고정 + 수동 환율 입력
- **F12 Settings/Data:** 구현 완료. `[API]` 버튼은 F12 패널을 열도록 연결됨.

### 인수인계 추가 추천 항목 (현재 빠진 것)

1. **로컬 HTTP 서버 실행 옵션** — 위 큰 제약 해소
2. **BYOK Anthropic 키로 LLM 요약 활성화** — 장기 2 대안
3. **Provider 상태 indicator** — 완료
4. **Stale data 배지** — 부분 완료. provider 상태와 toast로 stale cache 사용을 표시함.
5. **Production bundle 모드** — Babel Standalone은 매 로딩마다 JSX 트랜스파일로 약 3MB + 1~2초 지연. esbuild로 한 번 컴파일한 `terminal.bundled.html`을 옵션으로 제공. 개발용 `terminal.html`은 그대로 유지

### 권장 구현 우선순위

**Phase 1 완료 → Phase 2 완료(F6 Alerts) → Phase 3 완료(F8 Checklist/F9 Calendar/F10 Journal) → Phase 4 완료(F11 Portfolio + BYOK 요약)**

---

## 향후 Phase 진행 절차 (Phase 2~4)

Phase 1은 완료. 아래는 Phase 2/3/4를 인계받을 사람이 절차/필수 숙지 사항을 한눈에 파악할 수 있게 정리한 것. 코드 변경 시 항상 다음 흐름을 따른다:

> JSX 4개 파일 수정 → terminal.html에 4개 블록을 IIFE로 감싸 인라인 재생성 → 브라우저에서 file:// 및 http 모드 둘 다 검증.

### Phase 2 — F6 Alerts (무료 공시/뉴스 알림) — ✅ 완료

**상태:** 2026-05-08 구현 완료. 아래 절차/숙지 사항은 향후 알림 소스 추가, 버그 수정, 또는 비슷한 패턴의 Phase 작업 시 참고.

**목표:** 관심종목의 새 공시/뉴스를 감지해 F6 패널과 CommandBar 뱃지에 표시. 가장 사용자 가치 큼.

#### 필수 숙지 사항

- **CORS 함정:** SEC EDGAR(`data.sec.gov`)는 file://에서 직접 호출 차단. http 모드(start.bat) 또는 무료 CORS 프록시(`corsproxy.io`, `allorigins.win`) 경유 필요. 프록시는 어디서나 끊길 수 있다는 전제로 try/catch + 조용한 실패.
- **OpenDART 호출 한도:** 무료 키 기준 일별 한도 있음. polling 간격을 `setInterval`로 짧게 잡으면 즉시 소진. 패널을 열 때 + 명시적 refresh 버튼 + 사용자가 직접 켠 경우만 polling.
- **비공식 소스 깨짐 대비:** Yahoo `/v1/finance/news`, Google News RSS 둘 다 비공식. 응답 구조가 바뀔 수 있으니 각 fetch 함수는 독립적으로 try/catch하고 toast는 종목당 한 번만.
- **알림 ID는 결정적 키:** `{source}:{stockId}:{publishedAtISO}:{nativeId}` 형태. 같은 항목 두 번 fetch해도 중복 알림 안 뜨게.
- **localStorage 5MB:** alerts 누적되면 한도 초과. 30일 자동 정리 또는 IndexedDB 이전 필요. 1차는 자동 정리로 충분.
- **schemaVersion 호환:** 새 필드(`alerts`, `dismissedAlertIds`, `lastSeenAlerts`, `alertSettings`)를 `loadAppState`/`saveAppState`/JSON export-import 모두에 추가. import에서 누락 시 기본값으로 복원.
- **DART corp_code 의존:** 한국 종목 알림은 OpenDART `corp_code`가 필요하다. http 모드에서는 `dart-corp-codes.json` 자동 로드로 대부분 해결하고, F12/F6에서 key 누락 또는 KRX 매핑 누락을 안내한다. file:// 모드는 F12 수동 붙여넣기 또는 JSON import가 필요하다.

#### 진행 절차

1. `terminal-data.jsx`에 fetch 함수 추가:
   - `fetchOpenDartDisclosures(corpCode, sinceISO)` — `list.json` 호출, `bgn_de`/`end_de` 사용, 응답을 통일된 alert 객체로 변환.
   - `fetchYahooNewsExperimental(symbol)` — Yahoo 비공식 뉴스 엔드포인트. 실패 시 빈 배열.
   - `fetchGoogleNewsRss(query, proxy?)` — `news.google.com/rss/search?q=...`. 프록시는 옵션.
   - 모두 `cacheUpdates`와 같은 컨벤션으로 cache key 등록.
2. App 상태에 `alerts`, `dismissedAlertIds`, `lastSeenAlerts`, `alertSettings` 추가하고 `loadAppState`/`saveAppState`에 포함.
3. `refreshAlerts()` 액션: 모든 watchlist 종목 순회 → 통일 형식으로 머지 → `dismissedAlertIds`에 있는 ID 필터링 → `lastSeenAlerts[stockId]`보다 새것만 `new` 상태로.
4. `terminal-components.jsx`의 `CommandBar`에 새 알림 카운트 뱃지(`alertCount` prop) 추가.
5. F6 `AlertsPanel` 컴포넌트:
   - 필터: 종목/종류(공시/뉴스)/상태(new/read/dismissed/logged).
   - 액션: `OPEN`(URL 새 탭), `LOG`(Research Log 항목으로 변환해 `stock.notes` 추가 + 상태 logged), `DISMISS`(상태 dismissed + ID 보존).
6. (옵션) `alertSettings.autoPolling`이 true일 때만 가벼운 setInterval 활성화. 기본값은 false.
7. terminal.html 재생성 → file:///http 두 모드에서 알림 흐름 검증.

#### 데이터 구조 (재확인)

```js
{
  id: 'DART:005930:2026-05-08T09:10:00+09:00:20260508000123',
  stockId: '005930',
  symbol: '005930',
  kind: '공시', // 공시 | 뉴스
  title: '분기보고서',
  source: 'OpenDART',
  url: 'https://dart.fss.or.kr/...',
  publishedAt: '2026-05-08T09:10:00+09:00',
  status: 'new'
}
```

---

### Phase 3 — F8 Checklist / F9 Calendar / F10 Journal

**상태:** 2026-05-09 구현 완료. 아래 진행 절차는 향후 개선/리팩터링 참고용.

**목표:** 외부 API 의존 없는 워크플로 패널 3개. 작고 안전. file:// 모드에서도 그대로 동작.

#### 공통 필수 숙지 사항

- **저장 위치 규칙:** 종목별 데이터는 `stocks[id].xxx`, 글로벌 데이터는 App 최상위 상태. 새 패널은 이 규칙을 어기면 JSON export/import에서 손실됨.
- **schemaVersion 갱신:** 새 필드 추가 시 `saveAppState`/`exportBackup`에 반드시 포함. import 시 누락된 필드는 빈 값으로 복원되도록 방어.
- **localStorage 키 유지:** `tt-terminal-v1`. 호환 깨질 변경이 있으면 `tt-terminal-v2`로 올리고 마이그레이션 함수 작성.
- **구현 상태:** F6/F8/F9/F10/F11은 모두 실제 패널로 구현됨. 향후 새 패널을 추가할 때는 `PANEL_DEFS`와 `panelContent`를 함께 갱신.

#### F8 Checklist 진행 절차

1. `stock.checklist = [{ id, text, done, category, updatedAt }]` 도입.
2. 신규 종목 추가 시 기본 템플릿 자동 생성 헬퍼: 실적/공시/리스크/target/pre-mortem/리뷰일 6개 항목.
3. `ChecklistPanel`: 카테고리별 섹션, checkbox toggle, Add/Edit/Remove, 완료율 progress bar, `Reset Template`/`Clear Done` 액션.
4. 체크 토글 시 `updatedAt` 갱신.

#### F9 Calendar 진행 절차

1. **1차 — 자동 통합 뷰:** App 최상위 `calendarEvents` 상태 추가. 모든 stocks의 `review.next`를 가상 이벤트로 변환해 1순위로 표시.
2. **2차 — 수동 이벤트:** `{ id, stockId, title, kind, date, source, url, done }` 추가/편집 UI.
3. 색상 분류: overdue(빨강) / today(주황) / 7일 이내(노랑) / 그 외(중립) / done(회색).
4. 자동 실적 일정 fetch는 후순위. Yahoo `/v7/finance/calendar/events`는 비공식이라 안정도 낮음.
5. 좌측: 날짜순 리스트, 우측: 선택 이벤트 상세 + 연결 종목 요약.

#### F10 Journal 진행 절차

1. `stock.journal = [{ id, date, action, price, target, recommendation, thesisSnapshot, outcome, note }]` 도입.
2. F2 Pitch 패널에 "Capture Snapshot" 버튼 추가 → 현재 `price`/`pitch.target`/`pitch.recommendation`/`pitch.oneLine`/`pitch.thesis` 스냅샷 저장.
3. F10 패널: 시계열 리스트. 각 항목에 현재가 대비 수익률, target 도달 여부, thesis hit/miss 라벨.
4. **Research Log와 명확 구분:** Research Log = 외부 관찰(공시/뉴스/지표 변화). Journal = 내 판단의 사후검증. 두 곳에 같은 내용을 중복 기록하지 않게 UI에서 안내.

---

### Phase 4 — F11 Portfolio + BYOK LLM 요약

**상태:** 2026-05-09 구현 완료. F11 Portfolio는 무료/수동 입력 기반, LLM 요약은 선택형 BYOK로만 활성화.

**목표:** 관심종목 앱을 자산 관리 영역으로 확장 + 알림 카드에 LLM 요약 옵션 부여. 둘 다 옵트인 성격.

#### F11 Portfolio 필수 숙지 사항

- **통화 혼합이 가장 큰 함정:** 미국·한국 종목이 섞이면 환율 데이터가 필요. 무료 안정 소스: Yahoo `KRW=X`, `EURKRW=X` 등(비공식). 1차는 단일 base currency만 지원.
- **무료 환율 데이터의 한계:** 비공식 → 누락/지연 가능. 사용자가 수동 환율 입력으로 override할 수 있는 칸 필요.
- **주문/거래 기능은 절대 만들지 않는다.** 수동 입력 전용. 외부 브로커 API 연동은 무료 정책 위반.
- **포지션 데이터의 보안 민감도:** JSON export 기본 포함이지만, 향후 Supabase/Gist 동기화 시 암호화 옵션 검토.

#### F11 진행 절차

1. App 상태에 `portfolio = { cash, positions: { [symbol]: { shares, avgCost, targetWeight } }, baseCurrency, fxRates }` 추가.
2. `loadAppState`/`saveAppState`/JSON export-import에 포함.
3. F11 `PortfolioPanel`:
   - 보유 종목 표 (관심종목과 별개로 portfolio.positions 기반).
   - 평가금액 = `shares × stocks[symbol].price × fxRate`.
   - 손익률, 실제 vs 목표 비중, 국가/통화/섹터 exposure.
4. (옵션) Yahoo 환율 자동 갱신. 실패 시 수동 입력 화면.

#### BYOK LLM 요약 필수 숙지 사항

- **API 키는 다른 키와 같은 정책:** ApiSettings에 `anthropicKey` 추가, JSON export 기본 제외, "API key 포함" 토글로만 export.
- **Anthropic API CORS:** 브라우저 직접 호출은 `anthropic-dangerous-direct-browser-access: true` 헤더 + 적절한 CORS 헤더 자동 처리됨(공식 지원). 일반적으로 백엔드를 두는 것이 권장이나, BYOK 단일 사용자 앱 컨텍스트에서는 직접 호출이 합리적.
- **모델 선택:** 짧은 요약은 `claude-haiku-4-5-20251001`로 충분. 더 긴/구조화 요약은 `claude-sonnet-4-6`.
- **프롬프트 캐싱:** 시스템 프롬프트가 길어지면 prompt cache(`cache_control`) 사용해 비용 절감.
- **무료 정책 유지:** 키 미설정 시 "요약" 버튼 자체를 숨김. 알림 패널이나 피치 영역 어디서도 사용자가 "내가 직접 켰을 때만" 비용이 발생.

#### BYOK 진행 절차

1. ApiSettings/F12 패널에 `anthropicKey` 입력 칸 추가.
2. `terminal-data.jsx`에 `summarizeWithClaude(text, key, model?)` 추가:
   - endpoint: `https://api.anthropic.com/v1/messages`
   - 헤더: `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`, `content-type: application/json`
   - body: `{ model, max_tokens, messages: [{ role: 'user', content: ... }] }`
3. F6 Alerts 카드에 "요약" 버튼: key 있을 때만 표시. 클릭 시 toast 로딩 → 완료 시 카드 하단 펼침 영역에 결과.
4. 결과는 캐시(`alert.summary`)에 저장해 재호출 방지.

---

### Phase 2 검증 체크리스트 (F6 Alerts)

Phase 2 변경분이 실제 동작하는지 직접 확인할 항목. **JSX → terminal.html 빌드 후** 브라우저에서 file:// 또는 http 모드로 검증.

빌드 명령:
```
powershell.exe -ExecutionPolicy Bypass -File ".\tools\build-terminal-html.ps1"
```
(`tools/build-terminal-html.ps1`은 4개 JSX를 IIFE로 감싸 `terminal.html`을 재생성. 빌드 결과: 약 3940줄, 4개 `<script type="text/babel">` 블록.)

#### 1. 정적 빌드 검증 (코드 변경 없이)
- [ ] `terminal.html`이 빌드 후 정상 로드되고 콘솔에 Babel 파싱 에러가 없다.
- [ ] CommandBar 우측에 `[ALERT]` 버튼이 보인다 (새 알림 0건일 때는 뱃지 숫자 없음).
- [ ] F6 키를 누르면 ALERTS 패널로 이동한다. 좌측에 ALERT SETTINGS, 우측에 ALERTS 리스트가 보인다.
- [ ] 알림이 비어있을 때 “ALERTS ENABLED를 켜고 REFRESH NOW를 누르세요” 안내가 보인다.
- [ ] localStorage(`tt-terminal-v1`)에 `alerts`, `alertSettings` 필드가 추가됐다 (기존 키 유지).

#### 2. OpenDART 공시 (한국 종목)
사전: `start.bat`/`start.sh`가 Node 서버(`tools/local-http-server.cjs`)로 실행되어야 한다. F12에서 OpenDART API key 입력. http 모드에서는 `tools/fetch-dart-corp-codes.ps1`로 생성한 `dart-corp-codes.json`을 `terminal.html` 옆에 두면 자동 로드된다. file:// 모드나 Python/npx 정적 서버에서는 OpenDART CORS 때문에 `Failed to fetch`가 날 수 있으므로 F6/OpenDART 검증 대상에서 제외한다.
- [ ] F12 Settings/Data에서 DART CORP CODE MAP 상태가 `dart-corp-codes.json loaded: ... entries` 또는 필요한 KRX 종목 `mapped` 상태로 보인다.
- [ ] F6에서 ALERTS ENABLED 체크 → SOURCES에서 OpenDART만 켜고 → REFRESH NOW.
- [ ] watchlist에 KRX 종목(예: 005930 삼성전자)이 있을 때 최근 공시가 `OpenDART / 공시` 카드로 표시된다.
- [ ] 공시 카드의 OPEN 클릭 시 `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=...` 가 새 탭으로 열린다.
- [ ] LOG 클릭 시 F4 History 패널의 Research Log에 동일 항목이 추가된다 (date/kind/text/source 채워짐).
- [ ] DISMISS 클릭 시 카드가 흐려지고 필터를 DISMISSED로 바꾸면 보인다.
- [ ] OpenDART key 미입력 또는 corp_code 매핑 누락 시 해당 종목은 결과에서 빠지지만 다른 종목은 동작한다 (전체 실패가 아님).

#### 3. Yahoo News (해외 종목)
- [ ] SOURCES에서 Yahoo News 켜고 REFRESH NOW.
- [ ] watchlist의 미국/해외 종목(예: TSLA)에 `Yahoo / 뉴스` 카드가 들어온다.
- [ ] OPEN 시 외부 기사 URL이 새 탭으로 열린다.
- [ ] **알려진 실패 모드:** Yahoo가 비공식 엔드포인트라 종종 200 + 빈 `news` 배열을 돌려준다. 이 경우 toast 없이 0건으로 처리되는 것이 정상.

#### 4. SEC EDGAR (미국 공시)
사전: `start.bat`/`start.sh`가 Node 서버(`tools/local-http-server.cjs`)로 실행되어야 한다.
- [ ] F6에서 ALERTS ENABLED 체크 → SOURCES에서 SEC EDGAR만 켜고 → DAYS BACK 30 → REFRESH NOW.
- [ ] watchlist의 미국 종목(예: AAPL/NVDA/TSLA)에 최근 10-K/10-Q/8-K 등이 `SEC / 공시` 카드로 표시된다.
- [ ] SEC 카드 OPEN 시 `https://www.sec.gov/Archives/edgar/data/...` 문서가 새 탭으로 열린다.
- [ ] LOG/DISMISS 액션이 OpenDART 카드와 동일하게 동작한다.

#### 5. Google News RSS
- [ ] file:// 모드: SOURCES에서 GoogleNews 켜고 REFRESH NOW → 대부분 CORS로 실패하고 RECENT ERRORS에 표시되는 것이 정상.
- [ ] 무료 CORS 프록시 prefix(예: `https://corsproxy.io/?`)를 입력 후 다시 REFRESH NOW → 결과가 들어오면 정상.
- [ ] http 모드에서도 news.google.com이 CORS를 허용하지 않으면 동일하게 프록시가 필요할 수 있음.

#### 6. 상태/뱃지/필터
- [ ] 새 알림이 들어온 직후 CommandBar `[ALERT]` 버튼이 amber 배경 + 카운트 뱃지로 강조된다.
- [ ] OPEN을 한 번 누르면 해당 알림 상태가 `read`로 바뀌고 카운트가 1 줄어든다.
- [ ] ALL/NEW/LOGGED/DISMISSED 필터, SOURCE/KIND/STOCK 필터 모두 정상 동작한다.
- [ ] 자동 polling 토글 ON 후 분 단위 입력이 활성화되고, 설정 시간 경과 시 자동으로 갱신된다 (테스트 시 5분으로 설정 권장).

#### 7. 영속성 / JSON 백업
- [ ] 브라우저 새로고침 후 알림과 상태(read/logged/dismissed)가 유지된다.
- [ ] F12에서 EXPORT JSON → 파일을 열어 `alerts`, `alertSettings` 필드가 들어있는지 확인.
- [ ] 그 JSON을 IMPORT(merge) → 기존 알림과 병합되고 중복 ID는 한 번만 들어온다.
- [ ] IMPORT(replace) → alerts/alertSettings가 그대로 교체된다.

#### 8. 보존/에러 처리
- [ ] 알림은 30일 이전(`ALERT_RETENTION_DAYS`) 항목이 자동으로 정리된다 (`pruneAlerts`).
- [ ] 모든 소스가 실패해도 앱이 멈추지 않고, RECENT ERRORS에 소스별 에러가 누적된다.

#### 9. 알려진 한계 / 추후 작업
- 실제 데스크톱 OS 알림 띄우기는 없음. 텔레그램식 transient 팝업은 의도적으로 제외(산만함). 필요해지면 `Notification.requestPermission()` 흐름 추가 검토.
- SEC EDGAR 미국 공시는 Node 로컬 서버에서 구현됨. SEC fair access 정책상 10 requests/second 이하와 선언된 User-Agent를 지켜야 하며, file:///Python/npx 정적 서버에서는 CORS 때문에 실패할 수 있음.
- `dart-corp-codes.json` 자동 fetch는 http 모드에서만 안정적이다. file:// 모드에서는 브라우저 CORS 정책 때문에 F12 수동 붙여넣기 또는 백업 import가 필요하다.

---

### 보류 항목 — 진행 조건

진행하기 전에 다음 조건 충족 필요. 충족되지 않으면 무료 정책/정적 호스팅 정신과 충돌.

| 항목 | 진행 조건 |
|------|-----------|
| Service Worker / 오프라인 캐시 | http 모드 또는 정적 호스팅 필수. file://에선 불가능. 진행 시 Cloudflare Pages/GitHub Pages 등 무료 호스팅으로 마이그레이션 + HTTPS 확보. |
| 백그라운드 Web Push | Service Worker + Push subscription + 무료 백엔드/스케줄러(Cloudflare Workers/Supabase free tier). 단일 사용자 앱이라면 비용 대비 가치 낮음. Windows 작업 스케줄러로 페이지 자동 오픈하는 회피책이 더 실용적. |
| Supabase 연동 | 멀티 사용자/멀티 디바이스가 실제 필요해진 시점. 우선 GitHub Gist 동기화(사용자 PAT)나 Google Drive API로 검토 — 가입/백엔드 의존 없음. |
| Production bundle (esbuild) | 사용자가 매 로딩 1~2초 지연을 명확한 불만으로 보고할 때. 빌드 시 dev/prod 두 HTML 동시 유지 필요(개발 편의 vs 사용 속도 trade-off). |

---

## F6~F12 확장 상태

현재 F1~F12 키/탭/CommandBar 표시는 구현됨. F6 Alerts, F7 Peers, F8 Checklist, F9 Calendar, F10 Journal, F11 Portfolio, F12 Settings/Data는 기능 패널까지 구현 완료.

### 추천 키 배치

| 키 | 후보 패널 | 설명 | 우선순위 |
|----|-----------|------|----------|
| F6 | Alerts | 구현 완료. OpenDART/Yahoo News/Google News RSS 통합, 필터, OPEN/LOG/DISMISS, opt-in 자동 polling. | 완료 |
| F7 | Peers | 구현 완료. 동종/관심종목 PER/PBR/ROE/OP Margin/부채비율/성장률 비교. | 완료 |
| F8 | Checklist | 구현 완료. 투자 전/리뷰 전 체크리스트, 기본 템플릿, 완료율, 종목별 저장. | 완료 |
| F9 | Calendar | 구현 완료. `review.next` 자동 이벤트 + 수동 이벤트 추가/완료/삭제/OPEN. | 완료 |
| F10 | Journal | 구현 완료. 피치 snapshot 저장, 현재가 대비 성과, outcome/note 사후검증. | 완료 |
| F11 | Portfolio | 구현 완료. 보유 수량/평단/비중, cash/base currency/수동 FX rate, 통화 노출 관리. | 완료 |
| F12 | Settings/Data | 구현 완료. API 설정, DART corp_code 매핑, provider 선택, 캐시 삭제, JSON 백업/복원 등 관리 기능 통합. `[API]` 버튼은 F12로 이동. | 완료 |

### 구현 우선순위 제안

1. ~~**F6 Alerts**~~ — Phase 2 구현 완료.
2. ~~**F8 Checklist**~~ — Phase 3 구현 완료.
3. ~~**F9 Calendar**~~ — Phase 3 구현 완료.
4. ~~**F10 Journal**~~ — Phase 3 구현 완료.
5. ~~**F11 Portfolio**~~ — Phase 4 구현 완료.

### 구현 메모

- `activePanel`과 키보드 핸들러는 F1~F12까지 확장 완료.
- `CommandBar`의 function key 표시는 `PANEL_DEFS` 기반으로 F12까지 확장 완료. 작은 화면에서는 기존처럼 숨김.
- `[API]` 버튼은 F12 Settings/Data 패널을 열도록 연결 완료.
- F6 Alerts는 알림 팝업 UI와 알림 센터 패널을 분리해서 구현하면 좋음. 팝업은 transient UI, F6는 전체 이력/처리 상태 관리.

### 공통 구현 방식

1. `terminal-app.jsx`의 `panelContent` 객체에 `F6`~`F12` 키 추가 완료.
2. 탭 렌더링 배열을 `PANEL_DEFS` 상수로 분리 완료.
3. 키보드 핸들러의 function key 처리 범위를 `F1`~`F12`로 확장 완료.
4. `CommandBar`의 function key 도움말도 같은 `PANEL_DEFS`를 사용.
5. 새 패널 데이터는 우선 `stocks[stockId]` 내부에 종목별로 저장하고, 공통 데이터는 App 최상위 상태에 저장.
6. `saveAppState` 호출에 새 상태를 포함해야 함. localStorage 키는 기존 `tt-terminal-v1` 유지.
7. `terminal.html`은 직접 수정하지 말고, JSX 파일 수정 후 4개 JSX를 다시 인라인으로 포함해 재생성.

### 패널별 구현 방식

#### F6 Alerts — ✅ Phase 2에서 구현 완료

**구현된 상태:** `alerts`, `alertSettings`, `alertErrors`, `alertStatus`, `alertsRefreshing` (App). 알림 객체에는 `status` 필드(new/read/logged/dismissed)가 있어 `dismissedAlertIds`/`lastSeenAlerts`를 별도로 두지 않음. 30일이 지나면 `pruneAlerts`가 자동 정리.

**참고 상태 (초기 설계 시 후보였던 형태):**
```js
alerts, dismissedAlertIds, lastSeenAlerts, alertSettings
```

**데이터 구조 예시:**
```js
{
  id: 'DART:005930:20260508:20260508000123',
  stockId: '005930',
  symbol: '005930',
  kind: '공시',
  title: '분기보고서',
  source: 'OpenDART',
  url: 'https://dart.fss.or.kr/...',
  publishedAt: '2026-05-08T09:10:00+09:00',
  status: 'new' // new | read | dismissed | logged
}
```

**조회 방식:**
- 한국 공시: OpenDART `list.json` 사용. `corp_code`, `bgn_de`, `end_de`, `page_count` 지정.
- 뉴스: Yahoo Finance 비공식 뉴스 후보를 우선 사용. 실패 가능성을 전제로 `try/catch`와 조용한 fallback 필요.
- 미국 공시: SEC EDGAR `company_tickers.json`으로 CIK를 얻고 `submissions/CIK##########.json`에서 최근 filings를 읽는다. CORS 제약 때문에 Node 로컬 서버의 `/api/sec/*.json` 프록시가 필요하다.

**UI 방식:**
- 오른쪽 하단 팝업: 새 알림만 짧게 표시.
- F6 패널: 전체 알림 목록, 종목/종류 필터, `OPEN`, `LOG`, `DISMISS` 버튼.
- `LOG` 클릭 시 해당 알림을 `stock.notes`에 Research Log 항목으로 저장.

#### F7 Peers

**목표:** 현재 종목과 동종 기업의 핵심 밸류에이션/수익성 지표 비교.

**추천 상태:**
```js
peerGroups, stock.peers
```

**데이터 구조 예시:**
```js
stock.peers = ['AAPL', 'MSFT', 'GOOGL'];
peerGroups = {
  bigTech: { name: 'Big Tech', symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'] }
}
```

**구현 방식:**
- 1차는 watchlist에 이미 있는 종목만 비교.
- 없는 peer는 `SearchOverlay`의 추가 로직을 재사용해 추가 가능하게 함.
- 비교 지표: price, target upside, PER, PBR, ROE, opMargin, debtRatio, revGrowth, epsGrowth, overall score.
- 현재 종목 대비 peer median과 premium/discount를 계산.

#### F8 Checklist

**목표:** 종목별 투자/리뷰 체크리스트 관리.

**추천 저장 위치:**
```js
stock.checklist = [
  { id, text, done, category, updatedAt }
]
```

**초기 템플릿 후보:**
- 최신 실적 확인
- 최신 공시 확인
- 핵심 리스크 업데이트
- target price 재검토
- pre-mortem breach 여부 확인
- 다음 리뷰일 설정

**UI 방식:**
- 카테고리별 checkbox 리스트.
- 완료율 progress bar.
- `Reset Template`, `Add Item`, `Clear Done` 액션.

#### F9 Calendar

**목표:** 리뷰일, 실적 발표, 배당, 수동 이벤트를 한 화면에서 확인.

**추천 저장 위치:**
```js
calendarEvents = [
  { id, stockId, title, kind, date, source, url, done }
]
```

**구현 방식:**
- 1차는 `stock.review.next` 기반으로 review queue를 calendar view로 확장.
- 이후 수동 이벤트 추가 UI 제공.
- 무료 API로 실적 발표일을 안정적으로 가져오기 어렵다면 자동 일정은 후순위.

**UI 방식:**
- 좌측: 날짜순 이벤트 리스트.
- 우측: 선택 이벤트 상세 및 연결 종목 요약.
- overdue/upcoming 색상 구분.

#### F10 Journal

**목표:** 피치 작성 시점의 판단과 이후 결과를 추적.

**추천 저장 위치:**
```js
stock.journal = [
  {
    id, date, action, price, target, recommendation,
    thesisSnapshot, outcome, note
  }
]
```

**구현 방식:**
- `Capture Snapshot` 버튼으로 현재 price/target/recommendation/oneLine/thesis를 저장.
- 이후 현재가 대비 수익률, target 달성 여부, thesis hit/miss를 표시.
- Research Log와 다르게 “내 판단의 사후검증”에 초점.

#### F11 Portfolio

**목표:** 관심종목을 실제 보유/비중 관리로 확장.

**추천 저장 위치:**
```js
portfolio = {
  cash: 0,
  positions: {
    TSLA: { shares: 2, avgCost: 210, targetWeight: 8 }
  }
}
```

**구현 방식:**
- `stocks`의 현재가를 사용해 평가금액, 손익률, 비중 계산.
- 국가/통화/시장별 exposure 집계.
- 주문 기능은 만들지 않고 수동 입력만 제공.

**주의:**
- 통화가 섞이면 환율 데이터가 필요함. 무료 유지 조건에서는 1차 버전은 원 통화 기준 또는 수동 환율 입력으로 제한.

#### F12 Settings/Data

**목표:** API 설정과 데이터 관리 기능을 한곳에 모음.

**포함 기능:**
- 기존 `ApiSettingsModal` 내용
- provider 선택
- Alpha Vantage/FMP/OpenDART/data.go.kr key 저장
- DART corp_code JSON 맵 편집
- cacheDays 설정
- dataCache 삭제
- JSON export/import

**구현 방식:**
- 현재 modal인 `ApiSettingsModal`을 패널에서도 재사용할 수 있게 `SettingsPanel`로 분리.
- `[API]` 버튼은 `setActivePanel('F12')` 또는 기존 모달 열기 중 하나로 연결. 추천은 F12로 이동.
- JSON 백업 시 API key는 기본 제외. “API key 포함” 옵션은 명확한 토글로 제공.

---

## 파일 구조 (현재)

```
project/
├── terminal.html                   ← 실행용 단일 HTML, 4개 JSX 인라인 포함 (~3940줄, build 스크립트로 재생성)
├── terminal-app.jsx                ← App 진입점 (Phase 2 후 ~1880줄) ✅
├── terminal-components.jsx         ← UI 컴포넌트 (Phase 2 후 ~450줄) ✅
├── terminal-data.jsx               ← API + 데이터 로직 (Phase 2 후 ~1170줄) ✅
├── tweaks-panel.jsx                ← 디자인 도구 (310줄) ✅
├── start.bat                       ← Windows http 모드 런처 (Node proxy 우선)
├── start.sh                        ← mac/linux http 모드 런처 (Node proxy 우선)
├── tools/
│   ├── build-terminal-html.ps1     ← 4개 JSX → terminal.html 재생성 (Phase 2)
│   ├── fetch-dart-corp-codes.ps1   ← OpenDART corp_code 일괄 생성 스크립트 (Phase 1)
│   └── local-http-server.cjs       ← Node 로컬 HTTP 서버 + OpenDART/SEC/Yahoo chart/search 프록시
├── dart-corp-codes.json            ← (선택) fetch 스크립트 결과. http 모드에서 자동 로드, F12에서 수동 재로드 가능
├── README.md                       ← 기능 설명 및 실행 안내
└── anthropic-design.tar            ← 원본 디자인 아카이브 (참고용)
```

**중요:** `terminal.html`은 build 스크립트가 덮어쓰는 산출물. 직접 편집 금지. 변경은 항상 4개 JSX → `tools/build-terminal-html.ps1` 흐름.

**삭제된 파일 (구 Vanilla JS 앱):**
- `app.js` — 삭제됨
- `styles.css` — 삭제됨
- `index.html` — 삭제됨

---

## 디버깅 팁

- **API 버튼 안 보임** → `terminal.html`의 인라인 블록 순서와 `CommandBar`의 `onSettings` 전달 여부 확인.
- **Babel 파싱 에러** → 브라우저 콘솔에서 확인. `<script type="text/babel">` 블록 중 하나에 JSX 문법 오류.
- **`window.T is not defined`** → 스크립트 블록 순서 오류. components → data → app 순서 유지.
- **`window.kbdStyle is not defined`** → terminal-components.jsx가 terminal-app.jsx보다 먼저 실행되어야 함.
- **KRX 종목 데이터 없음** → `apiSettings.openDartKey` 또는 `apiSettings.dataGoKrKey` 미설정, 또는 `dartCorpMap`에 해당 종목 corp_code 없음.
- **Alpha Vantage `Note:` 응답** → 분당 5회 제한 초과. `assertAVResponse()`가 throw하면 catch에서 toast로 표시됨.
