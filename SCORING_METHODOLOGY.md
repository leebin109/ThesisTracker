# ThesisTrack Scoring Methodology: Market Baseline Anchoring

이 문서는 ThesisTrack의 퀀트 스코어링 엔진이 기존의 단순 절대평가(Absolute Threshold) 방식에서 **시장 기준점 기반 상대평가(Market Baseline-Anchored Z-Score)** 방식으로 진화한 과정과 그 수학적/논리적 근거를 설명합니다.

## 1. 개요 (Overview)

개인 투자자의 소규모 워치리스트(10~50종목) 내에서만 평균과 표준편차를 구하여 Z-Score를 산출하는 기존의 순수 Cross-sectional 방식은 표본의 크기(N)가 작고 이질적인 종목들이 섞여 있어 **통계적 착시(표본 오염, Sample Contamination)**를 유발합니다.

이를 해결하기 위해, S&P 500 및 KOSPI의 장기 섹터 평균(Historical Sector Averages)을 **정적 시장 기준점(Static Market Baseline)**으로 도입했습니다. 
이를 통해 관심 종목이 단 1개라도, 해당 종목이 속한 '거시적 산업군'의 보편적 기준에 비추어 얼마나 우수한지를 객관적으로 평가할 수 있습니다.

## 2. 퀀트 팩터 (The Quant Factors)

현대 퀀트 투자의 표준(Standard) 팩터 모델(Fama-French, AQR QMJ, MSCI Quality 등)을 기반으로, 4가지 핵심 팩터와 리스크 팩터를 정의합니다.

| Factor | Metrics Used | Rationale |
|---|---|---|
| **Value (가치)** | PER, PBR, EV/EBITDA | P/E의 한계를 보완하기 위해 자본구조에 중립적인 EV/EBITDA를 통합하여 사용합니다. 낮을수록 고득점 처리합니다. |
| **Quality (수익성)** | ROE, ROIC, OP Margin, GP/A | Novy-Marx의 매출총이익/자산(GP/A) 및 ROIC를 통합하여, 부채에 의한 착시가 없는 순수 자본 효율성을 측정합니다. |
| **Safety (안정성)** | Debt/Equity, Current Ratio | 전통적인 신용평가 방식에 따라, 부채비율은 낮을수록, 유동비율은 높을수록 높은 Z-Score를 부여합니다. |
| **Growth (성장성)** | Revenue Growth, EPS Growth | 전년 대비 매출 및 이익 성장률을 바탕으로 측정합니다. |
| **Risk Guard** | 복합 하드 플래그 (EPS < -15%, FCF 마진 < -5% 등) | 학술적으로 검증된 Sloan Accruals나 Altman Z-Score의 철학을 차용하여, 치명적 결함을 가진 기업을 감점합니다. |

## 3. 알고리즘: Market Baseline-Anchored Z-Score

### 3.1. Market Baselines (시장 기준점)
엔진 내부에 `MARKET_BASELINES` 딕셔너리를 하드코딩하여, 각 산업군별(예: 테크, 바이오, 금융 등) 장기 평균(Mean)과 표준편차(StDev)를 정의합니다.
* 예: 소프트웨어(`SW_AI`)는 평균 PER 35, 금융(`FINANCIAL`)은 평균 PER 11을 기준으로 평가받습니다.

### 3.2. 점수 산출 로직 (`zScoreMarket`)
워치리스트 내의 종목들을 비교하는 것이 아니라, 종목의 지표를 **시장 기준점**에 대입하여 Z-Score를 산출합니다.

```javascript
function zScoreMarket(value, metricKey, industryGroup, higherIsBetter = true) {
  const cfg = MARKET_BASELINES[industryGroup] || MARKET_BASELINES.ALL;
  const stat = cfg[metricKey];
  
  // 1. Z-Score 계산
  let z = (value - stat.m) / stat.s;
  
  // 2. 극단값 클리핑 (±3 표준편차 이내)
  const clipped = Math.max(-3, Math.min(3, z));
  
  // 3. 방향성 조정 (낮을수록 좋은 Valuation 지표는 부호 반전)
  return higherIsBetter ? clipped : -clipped;
}
```

### 3.3. 백분위 환산 (`zToScore`)
계산된 Z-Score(보통 -3.0 ~ +3.0)를 일반 사용자가 직관적으로 이해할 수 있는 **0~100점** 스케일로 변환합니다. 이때 정규분포의 누적분포함수(CDF) 근사식을 사용하여 퍼센타일(Percentile) 점수로 매핑합니다.

```javascript
// Z-score를 0~100 스케일(Percentile)로 변환
function zToScore(z) {
  return Math.round(50*(1+erf(z/Math.SQRT2))); // 오차함수(erf) 기반
}
```

## 4. 아키텍처의 장점
1. **소규모 샘플 문제 해결**: 워치리스트에 단 1개의 종목만 있거나 극단적인 종목이 섞여 있어도 점수가 왜곡되지 않습니다.
2. **섹터 중립성(Sector Neutrality) 확보**: 테크주는 테크주의 잣대로, 은행주는 은행주의 잣대로 평가되어 '사과와 오렌지'를 비교하는 오류를 방지합니다.
3. **무료/경량화 유지**: 대규모 백엔드 데이터베이스나 값비싼 유료 API 없이도, 브라우저 단에서 기관 수준의 상대평가 랭킹을 모사(Simulate)할 수 있습니다.
