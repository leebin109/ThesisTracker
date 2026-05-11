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
| **F1** | Overview | ✅ 완료 | 기업 개요, 퀀트 스코어링 Breakdown (상대/절대평가), 핵심 지표 요약 |
| **F2** | Pitch | ✅ 완료 | 투자 논리(Thesis), Pre-mortem(리스크), Bull/Base/Bear 가치평가 시나리오 |
| **F3** | Valuation | ✅ 완료 | (향후 추가 고도화 가능) 현재는 F1/F2와 통합 관리 중 |
| **F4** | History | ✅ 완료 | Research Log 작성 (날짜, 메모, 링크 등) |
| **F5** | Chart | ✅ 완료 | Yahoo Finance 기반 캔들/라인 차트 표시 |
| **F6** | Alerts | ✅ 완료 | 설정한 키워드 기반 Google News, OpenDART 공시 알림 자동 수집 |
| **F7** | Peers | ✅ 완료 | 워치리스트 내 경쟁사/유사 기업 상대 지표 비교 (Peer Analysis) |
| **F8~10** | Check/Cal/Jour | 🗓️ 대기 | 체크리스트, 캘린더, 투자 일지 (현재 Placeholder) |
| **F11** | Portfolio | 🗓️ 대기 | 개인 포트폴리오 비중 및 통합 성과 추적 (LLM 연동 예정) |
| **F12** | Settings | ✅ 완료 | API 키 관리(FMP, Alpha, DART 등), JSON 백업/복원, 캐시 초기화 |

## 4. 퀀트 스코어링 엔진 (Quant Engine)
- 기존의 단순 절대평가(Absolute Threshold) 방식에서 **시장 기준점 기반 상대평가(Market Baseline-Anchored Z-Score)** 방식으로 개편 (Phase 5).
- 소규모 워치리스트에서의 '표본 오염'을 막기 위해 11개 산업군별 S&P500 장기 평균치를 하드코딩(`MARKET_BASELINES`).
- 자세한 공식과 팩터 산출 방식은 `SCORING_METHODOLOGY.md` 참조.

## 5. 변경 이력 (Recent Change Log)
- **2024-05-10 (Phase 5 수정)**: 퀀트 엔진에 `MARKET_BASELINES` 하드코딩 도입. 크로스섹셔널 연산을 제거하고 정적 시장 평균/표준편차 잣대에 대조하는 `zScoreMarket` 함수 도입 (표본 오염 문제 해결).
- **2024-05-10 (Phase 5)**: Alpha Vantage, FMP, OpenDART 연동을 확장하여 EV/EBITDA, GP/A, ROIC 등 신규 퀀트 팩터 수집. `computeQuantScores` 추가.
- **2024-05-08 (Phase 2)**: F6 Alerts 기능 완료. `build-terminal-html.ps1` 빌드 파이프라인 도입.
- **2024-05-10 (Phase 6)**: 동기식 `localStorage`를 비동기식 대용량 `IndexedDB`로 안전하게 이전(Migration) 완료. 초기 부팅 대기 화면 도입. 사용하지 않는 패널(F8, F9) 및 포트폴리오 기획 취소로 UI를 9개 패널(F1~F9)로 최종 정리.
- **2024-05-11 (Phase 6.2)**: F7 PEERS 패널 고도화. 워치리스트 종속성을 제거하여 피어 0개 및 임의 종목 추가 허용. 패널 내부에 글로벌 검색(SearchOverlay)을 연동하여 검색한 종목이 메인 워치리스트를 오염시키지 않고 피어 그룹에만 추가되도록 격리 구현. 직관성을 위해 EDIT 화면에서 선택된 피어만 노출하도록 UI 개편.
- **2024-05-11 (Phase 7)**: 터미널 분석 기능 대규모 고도화 완료.
  - **F2 PITCH**: 자체 구현한 초경량 마크다운 렌더러를 탑재하여 볼드체, 기울임꼴, 글머리 기호, 하이퍼링크 등 리포트 양식 작성 지원.
  - **F5 CHART**: SVG 차트 렌더러를 개편하여 거래량(Volume) 바텀 오버레이 및 이동평균선(MA20, MA60, MA120) 실시간 계산 기능 추가.
  - **MACRO DASHBOARD**: 글로벌 시장 동향을 실시간 파악할 수 있도록 상단 TickerRail에 S&P500, USD/KRW, US10Y, VIX를 연동.

## 6. 향후 과제 (Next Steps)
- **외부 알림 연동**: Telegram / Discord Webhook 봇 연동 (F6 Alerts의 알림을 스마트폰으로 푸시).
