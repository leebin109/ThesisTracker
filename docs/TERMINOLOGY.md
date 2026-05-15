# ThesisTrack 한국어 용어 사전

본 문서는 UI/문서/마케팅 카피에서 **사용해야 하는 한국어 표기**와 **피해야 하는 표기**를 정리한 단일 reference입니다.

새 문구 작성·기존 문구 수정 시 이 사전을 기준으로 통일합니다. 추가/변경이 필요하면 PR로 이 문서를 먼저 수정한 뒤 코드를 반영합니다.

## 1. 서비스 자기 규정

| 상황 | 사용 | 피해야 함 |
|---|---|---|
| 서비스 정체성 | "분석 보조 도구", "리서치 도구" | "투자 서비스", "주식 추천 서비스", "투자자문" |
| 서비스가 제공하는 것 | "참고 지표", "분석 자료", "비교 자료" | "투자 의견", "매매 신호", "추천 종목" |
| 사용자에게 권하는 행동 | "검토해보세요", "함께 확인해보세요", "본인 판단에 활용하세요" | "지금 사세요", "매수 추천", "놓치지 마세요" |

근거: 자본시장법상 점수·신호·추천 표현은 투자권유로 해석될 소지. `tools/audit-copy.cjs`가 자동 검사.

## 2. 데이터 정책

| 개념 | UI 표기 | 코드 식별자 | 비고 |
|---|---|---|---|
| Commercial-Safe 모드 | "Commercial-Safe 모드" (원어 유지) | `dataMode === 'commercialSafe'` | 한자식 번역("상업 안전")은 모호하므로 영문 유지 |
| Personal 모드 | "Personal 모드" (원어 유지) | `dataMode === 'personal'` | 동일 |
| 출처 | "출처" 또는 "Provider" | `provider` | "공급자"는 사용하지 않음 |
| 출처 신뢰도 등급 | "Confidence A/B/C/D" | `confidence` | 한글만 단독으로 "신뢰도"는 가능 |
| 계산 근거 메타 | "계산 근거", "Source Metadata" | `metricsMeta` | 코드 식별자 그대로 노출하지 않음 |
| 마지막 갱신 시각 | "갱신 시각" | `fetchedAt` | "마지막 업데이트"는 사용하지 않음 |

## 3. 점수 차원 (Score Dimensions)

영문 라벨 대문자는 그대로 유지 (PROFITABILITY · STABILITY · GROWTH · VALUATION · RISK). 본문 설명에서 풀어 쓸 때만 한국어 사용.

| 영문 | 본문 설명용 한국어 |
|---|---|
| PROFITABILITY | 수익성 |
| STABILITY | 재무 안정성 |
| GROWTH | 성장성 |
| VALUATION | 가격 부담 (또는 밸류에이션) |
| RISK | 리스크 신호 |

"수익률"은 PROFITABILITY와 다른 개념이므로 혼용 금지.

## 4. 상태 (Status Labels)

코드 식별자 → 사용자 노출 한국어:

| 식별자 | UI 표기 |
|---|---|
| `limited_metrics` | "LIMITED METRICS" + 부제 "계산 가능 지표 부족" |
| `priceRequired` / `PRICE NEEDED` | "PRICE NEEDED" + 부제 "가격 입력 필요" |
| `LIMITED_METRICS` (배지) | 영문 원형 유지 |
| `userInputPrice` | "사용자 입력값" 배지 (cyan) |
| 캐시 만료 / 오래된 데이터 | "데이터 오래됨" |

## 5. 분석 워크플로우 (F-key 패널)

영문 패널 라벨(F1 OVERVIEW · F2 PITCH 등)은 Bloomberg 스타일을 유지하므로 변경하지 않음. 본문 설명에서만 한국어 사용.

| 영문 | 본문 한국어 |
|---|---|
| Thesis | 투자 논거 (또는 Thesis 그대로) |
| Catalyst | 촉매 / 트리거 |
| Risk | 리스크 |
| Variant View | 대안 시나리오 |
| Change Mind If | 판단을 바꾸는 조건 |
| Pre-mortem | 사전 점검 (Pre-mortem 병기 가능) |
| Numbers to Watch | 지켜볼 지표 |
| Decision Journal | 결정 저널 |
| Hit Rate | 적중률 |
| Watchlist | 워치리스트 (관심 종목) |

## 6. 시장 / 종목 메타

| 항목 | 사용 | 피해야 함 |
|---|---|---|
| 국내 시장 | "KRX", "한국 시장", "국내" | "코스피만" (코스닥 포함하면 안 됨) |
| 미국 시장 | "미국 시장", "US" | "양키", "월가" 등 비격식 |
| 시장 식별 | "NASDAQ / NYSE / AMEX" | "나스닥/뉴욕증권거래소" 단독 사용은 피함 |
| 종목 코드 | "심볼" 또는 "티커" | 두 표기 중 한 쪽 일관 사용 |

## 7. 가격 / 시점

| 개념 | 표기 |
|---|---|
| 현재가 | "현재가" 또는 "Current Price" |
| 사용자 입력 가격 | "User Price" 또는 "사용자 입력 가격" |
| 시나리오 가격 | "Bear · Base · Bull" (영문 유지) |
| 목표가 | "Target" 또는 "목표가" |

"매수가" / "매도가" 같이 매매 행위와 결합된 표현은 사용자 자신의 거래 기록 입력 컨텍스트에서만 허용. 시스템이 제시하는 값에는 사용 금지.

## 8. 금지 / 주의 표현

`tools/audit-copy.cjs`가 자동 검사하는 패턴은 사용 금지. 대표 항목:

- 매수 신호 · 매도 신호 · 매수 시그널 · 매도 시그널
- 매수 시점 · 매도 시점 (시스템 제시 컨텍스트)
- 매수 추천 · 매도 추천 · 종목 추천 · 추천 종목
- 수익 보장 · 수익률 보장 · 원금 보장 · 무조건 …
- 급등주 · 급등 임박 · 급락 임박 · 핫 종목
- 놓치지 마세요 · 절호의 기회 · 마지막 기회
- Strong Buy · Strong Sell · Buy Now · Sell Now · Hot Stock · Guaranteed Return

부정형 면책 문장에서 위 표현이 필요한 경우 같은 줄에 `audit-copy-ignore` 코멘트를 붙입니다.

## 9. 영문 약어를 한글 본문에 쓸 때

원어 + 괄호 한글 풀이를 첫 등장에만 표기, 이후엔 원어만 사용.

예:
- 첫 등장: "PER (주가수익비율)"
- 이후: "PER"

대상: PER, PBR, ROE, ROA, FCF, EBITDA, EPS, BPS, OCF, DCF, EV/EBITDA.

이미 자주 쓰는 용어(KRW, USD, NASDAQ 등)는 풀이 생략.
