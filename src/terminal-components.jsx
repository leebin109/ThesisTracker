/* global React */
const { useState, useEffect, useRef, useMemo } = React;

// Design tokens
const T = {
  bg:        '#07090b',
  surface:   '#0d1116',
  surface2:  '#141a21',
  border:    '#1f2937',
  borderSoft:'#161d25',
  ink:       '#e5e7eb',
  inkDim:    '#cdd6de',
  inkFaint:  '#b0bdc9',
  amber:     '#FF9500',
  amberDim:  '#cc7700',
  cyan:      '#22d3ee',
  green:     '#22c55e',
  red:       '#ef4444',
  yellow:    '#eab308',
  magenta:   '#c084fc',
  font:      "'JetBrains Mono', ui-monospace, monospace",
  fontSans:  "Pretendard, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif",
};

// ── Technical indicator math ─────────────────────────────────────────────────
const calcMA = (period, source) => source.map((_, i) => {
  if (i < period - 1) return null;
  let sum = 0;
  for (let j = 0; j < period; j++) sum += source[i - j].close || source[i - j];
  return sum / period;
});

const calcEMA = (arr, period) => {
  const out = new Array(arr.length).fill(null);
  const k = 2 / (period + 1);
  let seed = 0, count = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v == null || !Number.isFinite(v)) continue;
    if (count < period) { seed += v; count++; if (count === period) out[i] = seed / period; }
    else { out[i] = v * k + out[i - 1] * (1 - k); }
  }
  return out;
};

const calcRSI = (prices, period = 14) => {
  const out = new Array(prices.length).fill(null);
  if (prices.length < period + 1) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
};

const calcMACD = (prices) => {
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  const macdLine = prices.map((_, i) =>
    ema12[i] !== null && ema26[i] !== null ? ema12[i] - ema26[i] : null
  );
  const signal = calcEMA(macdLine.map(v => v ?? 0), 9);
  const hist = macdLine.map((v, i) =>
    v !== null && signal[i] !== null ? v - signal[i] : null
  );
  return { macdLine, signal, hist };
};

const calcBB = (prices, period = 20, mult = 2) => {
  const upper = [], middle = [], lower = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { upper.push(null); middle.push(null); lower.push(null); continue; }
    const sl = prices.slice(i - period + 1, i + 1);
    const avg = sl.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(sl.reduce((a, b) => a + (b - avg) ** 2, 0) / period);
    upper.push(avg + mult * std);
    middle.push(avg);
    lower.push(avg - mult * std);
  }
  return { upper, middle, lower };
};

const fmtNum = (n, opts = {}) => {
  if (!Number.isFinite(Number(n))) return '–';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: opts.dp ?? 2, maximumFractionDigits: opts.dp ?? 2 });
};
const fmtPx = (n, currency) => {
  const dp = currency === 'KRW' || currency === 'JPY' ? 0 : 2;
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
};
const sign = (n) => (n > 0 ? '+' : n < 0 ? '' : '');
const colorForChange = (n) => (n > 0 ? T.green : n < 0 ? T.red : T.inkDim);
const safeFixed = (v, d = 1) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '–';

// ── Small building blocks ────────────────────────────────────────────────────
const Cell = ({ label, children, accent, style }) => (
  <div style={{
    border: `1px solid ${T.border}`, background: T.surface, position: 'relative',
    display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
    ...style,
  }}>
    {label && (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 26, padding: '0 12px',
        borderBottom: `1px solid ${T.borderSoft}`, background: T.surface2,
        fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em',
        color: accent || T.inkFaint, textTransform: 'uppercase',
        flex: '0 0 auto', fontFamily: T.font,
      }}>
        {accent && <span style={{ width: 4, height: 4, background: accent, borderRadius: 1 }}/>}
        {label}
      </div>
    )}
    {children}
  </div>
);

const Stat = ({ label, value, sub, color, align = 'left' }) => (
  <div style={{ textAlign: align, minWidth: 0 }}>
    <div style={{ fontSize: 10.5, color: T.inkFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
      {label}
    </div>
    <div style={{ fontSize: 16, fontWeight: 700, color: color || T.ink, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: 10.5, color: T.inkDim, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
  </div>
);

const ScoreRing = ({ score, size = 64, accent = T.amber, label = 'SCORE' }) => {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const sc = Number.isFinite(Number(score)) ? Number(score) : 0;
  const dash = (c * Math.max(0, Math.min(100, sc))) / 100;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
      <svg width={size} height={size} style={{ display: 'block' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.border} strokeWidth="3" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={accent} strokeWidth="3"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ filter: `drop-shadow(0 0 4px ${accent}99)` }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: size * 0.32, fontWeight: 700, color: T.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {Number.isFinite(sc) ? sc : '–'}
        </div>
        <div style={{ fontSize: 9, color: T.inkFaint, letterSpacing: '0.15em', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
};

const ScoreBar = ({ pct, color, height = 5 }) => (
  <div style={{ width: '100%', height, background: T.border, borderRadius: 1, position: 'relative', overflow: 'hidden' }}>
    <div style={{
      width: `${Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0))}%`, height: '100%',
      background: color, borderRadius: 1, boxShadow: `0 0 6px ${color}66`,
    }}/>
  </div>
);

const Spark = ({ data, width = 100, height = 24, color = T.amber, fill = true }) => {
  if (!data?.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const w = width, h = height;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * (w - 2) + 1,
    h - 2 - ((v - min) / range) * (h - 4),
  ]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${w-1} ${h-1} L 1 ${h-1} Z`;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {fill && <path d={area} fill={color} opacity="0.12"/>}
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
};

const PriceChart = ({ data = [], ohlcData = [], chartType = 'line', accent = T.amber, indicators = {} }) => {
  const {
    ma20:   showMa20   = true,
    ma60:   showMa60   = true,
    ma120:  showMa120  = true,
    volume: showVol    = true,
    bb:     showBB     = false,
    rsi:    showRSI    = false,
    macd:   showMACD   = false,
  } = indicators;

  const ref = useRef(null);
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);
  const [hoverIdx, setHoverIdx] = useState(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      setW(r.width);
      setH(r.height);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const isCandle = chartType === 'candle' && ohlcData.length > 0;
  const valid = useMemo(
    () => ohlcData.filter(c => Number.isFinite(c.low) && Number.isFinite(c.high) && c.low > 0),
    [ohlcData]
  );

  const sourceData = isCandle ? valid : data;
  const closes = useMemo(
    () => isCandle ? valid.map(c => c.close) : data.map(v => typeof v === 'object' ? v.close : v),
    [isCandle, valid, data]
  );

  const ma20data  = useMemo(() => calcMA(20,  sourceData), [sourceData]);
  const ma60data  = useMemo(() => calcMA(60,  sourceData), [sourceData]);
  const ma120data = useMemo(() => calcMA(120, sourceData), [sourceData]);
  const bbData    = useMemo(() => showBB  ? calcBB(closes)   : null, [closes, showBB]);
  const rsiData   = useMemo(() => showRSI ? calcRSI(closes)  : null, [closes, showRSI]);
  const macdData  = useMemo(() => showMACD ? calcMACD(closes) : null, [closes, showMACD]);

  if (!data.length && !valid.length) {
    return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
  }

  const totalH = h || 200;
  const rsiH   = showRSI  ? 65 : 0;
  const macdH  = showMACD ? 75 : 0;
  const mainH  = totalH - rsiH - macdH;

  const pad = { l: 50, r: 12, t: 10, b: 30 };
  const cw  = Math.max(1, w - pad.l - pad.r);
  const volFrac = showVol ? 0.18 : 0;
  const pch = Math.max(1, mainH - pad.t - pad.b) * (1 - volFrac);
  const vch = Math.max(1, mainH - pad.t - pad.b) * volFrac;

  const yLabel  = v => v >= 10000 ? (v / 1000).toFixed(0) + 'k' : v >= 1000 ? v.toFixed(0) : v.toFixed(1);
  const fmtDate = d => { if (!d) return ''; const m = parseInt(d.slice(5,7),10), day = parseInt(d.slice(8,10),10); return `${m}/${day}`; };
  const xTickIdxs = len => {
    if (len <= 1) return [0];
    const n = Math.min(6, len);
    const step = (len - 1) / (n - 1);
    return Array.from({ length: n }, (_, i) => Math.round(i * step));
  };

  const tipStyle = {
    position: 'absolute', top: 8, background: T.surface,
    border: `1px solid ${T.border}`, padding: '5px 9px',
    fontSize: 11, fontFamily: T.font, lineHeight: 1.65,
    pointerEvents: 'none', zIndex: 10, whiteSpace: 'nowrap',
  };

  const drawMALine = (maData, ypFn, xpFn, color) => {
    const pts = maData
      .map((v, i) => v !== null ? `${xpFn(i).toFixed(2)},${ypFn(v).toFixed(2)}` : null)
      .filter(Boolean);
    if (!pts.length) return null;
    return <path d={'M ' + pts.join(' L ')} fill="none" stroke={color} strokeWidth="1" opacity="0.8"/>;
  };

  const drawBBLine = (arr, ypFn, xpFn, color, dasharray) => {
    const pts = arr.map((v, i) => v !== null ? `${xpFn(i).toFixed(2)},${ypFn(v).toFixed(2)}` : null).filter(Boolean);
    if (!pts.length) return null;
    return <path d={'M ' + pts.join(' L ')} fill="none" stroke={color} strokeWidth="0.8" opacity="0.7" strokeDasharray={dasharray}/>;
  };

  // ─── SUB-PANEL helpers ─────────────────────────────────────────────────────
  const drawSubGrid = (offsetY, subH, minVal, maxVal, label) => {
    const range = maxVal - minVal || 1;
    const tks = [minVal + range * 0.2, minVal + range * 0.5, minVal + range * 0.8];
    return (
      <g>
        <line x1={pad.l} x2={pad.l + cw} y1={offsetY} y2={offsetY} stroke={T.border} strokeWidth="0.8"/>
        <text x={pad.l - 6} y={offsetY + 9} textAnchor="end" fontSize="9.5" fill={T.inkFaint} fontFamily={T.font}>{label}</text>
        {tks.map((v, i) => {
          const y = offsetY + subH - ((v - minVal) / range) * subH;
          return (
            <g key={i}>
              <line x1={pad.l} x2={pad.l + cw} y1={y} y2={y} stroke={T.border} strokeWidth="0.4" strokeDasharray="2 3" opacity="0.5"/>
              <text x={pad.l - 4} y={y + 3} textAnchor="end" fontSize="9" fill={T.inkFaint} fontFamily={T.font}>{v.toFixed(0)}</text>
            </g>
          );
        })}
      </g>
    );
  };

  const drawSubLine = (arr, offsetY, subH, minVal, maxVal, xpFn, color) => {
    const range = maxVal - minVal || 1;
    const ypSub = v => offsetY + subH - ((v - minVal) / range) * subH;
    const pts = arr.map((v, i) => v !== null && Number.isFinite(v) ? `${xpFn(i).toFixed(2)},${ypSub(v).toFixed(2)}` : null).filter(Boolean);
    if (!pts.length) return null;
    return <path d={'M ' + pts.join(' L ')} fill="none" stroke={color} strokeWidth="1" opacity="0.9"/>;
  };

  const drawHistBars = (hist, offsetY, subH, xpFn, bw) => {
    const vals = hist.filter(v => v !== null && Number.isFinite(v));
    if (!vals.length) return null;
    const mx = Math.max(...vals.map(Math.abs)) || 1;
    const midY = offsetY + subH / 2;
    return hist.map((v, i) => {
      if (v === null || !Number.isFinite(v)) return null;
      const bh = Math.abs((v / mx) * (subH / 2));
      const by = v >= 0 ? midY - bh : midY;
      return <rect key={i} x={xpFn(i) - bw / 2} y={by} width={bw} height={bh} fill={v >= 0 ? T.green : T.red} opacity="0.6"/>;
    });
  };

  // ─── CANDLE ────────────────────────────────────────────────────────────────
  if (isCandle) {
    if (!valid.length) return <div ref={ref} style={{ width: '100%', height: '100%' }} />;

    const allLo = valid.map(c => c.low), allHi = valid.map(c => c.high);
    const mn = Math.min(...allLo), mx = Math.max(...allHi);
    const rng = mx - mn || 1;
    const top = mx + rng * 0.05, bot = mn - rng * 0.05;
    const maxVol = Math.max(...valid.map(v => v.volume || 0)) || 1;
    const yp  = v => pad.t + ((top - v) / (top - bot)) * pch;
    const vpY = v => pad.t + pch + vch - (v / maxVol) * vch;
    const n    = valid.length;
    const cWid = Math.max(2, Math.floor(cw / n) - 1);
    const xp   = i => pad.l + ((i + 0.5) / n) * cw;

    const ticks = Array.from({ length: 5 }, (_, i) => top - ((top - bot) * i) / 4);

    const onMove = e => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const svgX = e.clientX - rect.left - pad.l;
      setHoverIdx(Math.max(0, Math.min(n - 1, Math.floor((svgX / cw) * n))));
    };

    const hc      = hoverIdx !== null ? valid[hoverIdx] : null;
    const hx      = hc ? xp(hoverIdx) : 0;
    const tipLeft = hx < w * 0.6 ? hx + 10 : hx - 102;

    const rsiOffset  = mainH;
    const macdOffset = mainH + rsiH;

    const rsiVals   = rsiData || [];
    const macdVals  = macdData?.macdLine || [];
    const sigVals   = macdData?.signal   || [];
    const histVals  = macdData?.hist     || [];

    const rsiMin = 0, rsiMax = 100;
    const macdAllVals = [...macdVals, ...sigVals].filter(v => v !== null && Number.isFinite(v));
    const macdMin = macdAllVals.length ? Math.min(...macdAllVals) * 1.1 : -1;
    const macdMax = macdAllVals.length ? Math.max(...macdAllVals) * 1.1 : 1;

    return (
      <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }}
        onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>
        {w > 0 && h > 0 && (
          <svg width={w} height={totalH} style={{ display: 'block' }}>
            {/* Price grid */}
            {ticks.map((v, i) => {
              const y = yp(v);
              return (
                <g key={i}>
                  <line x1={pad.l} x2={pad.l + cw} y1={y} y2={y} stroke={T.border} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.7"/>
                  <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill={T.inkFaint} fontFamily={T.font}>{yLabel(v)}</text>
                </g>
              );
            })}

            {/* Bollinger Bands */}
            {showBB && bbData && (
              <g>
                {drawBBLine(bbData.upper,  yp, xp, '#a78bfa', '4 2')}
                {drawBBLine(bbData.middle, yp, xp, '#a78bfa44', '')}
                {drawBBLine(bbData.lower,  yp, xp, '#a78bfa', '4 2')}
              </g>
            )}

            {/* Volume bars */}
            {showVol && valid.map((c, i) => {
              const x    = xp(i);
              const volY = vpY(c.volume || 0);
              const color = c.close >= c.open ? T.green : T.red;
              return <rect key={'v'+i} x={x - cWid / 2} y={volY} width={cWid} height={(pad.t + pch + vch) - volY} fill={color} opacity="0.25"/>;
            })}

            {/* MA lines */}
            {showMa20  && drawMALine(ma20data,  yp, xp, T.amber)}
            {showMa60  && drawMALine(ma60data,  yp, xp, T.cyan)}
            {showMa120 && drawMALine(ma120data, yp, xp, T.magenta)}

            {/* Candles */}
            {valid.map((c, i) => {
              const x      = xp(i);
              const openY  = yp(c.open), closeY = yp(c.close);
              const highY  = yp(c.high), lowY   = yp(c.low);
              const green  = c.close >= c.open;
              const color  = green ? T.green : T.red;
              const bodyTop = Math.min(openY, closeY);
              const bodyH   = Math.max(1, Math.abs(closeY - openY));
              return (
                <g key={i}>
                  <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth="1" opacity="0.8"/>
                  <rect x={x - cWid / 2} y={bodyTop} width={cWid} height={bodyH} fill={color} opacity="0.9"/>
                </g>
              );
            })}

            {/* Date ticks */}
            {xTickIdxs(n).map(i => (
              <text key={i} x={xp(i)} y={pad.t + pch + vch + 16} textAnchor="middle" fontSize="8.5" fill={T.inkFaint} fontFamily={T.font}>
                {fmtDate(valid[i]?.date)}
              </text>
            ))}

            {/* Hover crosshair */}
            {hc && (
              <g>
                <line x1={hx} x2={hx} y1={pad.t} y2={pad.t + pch + vch} stroke={T.inkFaint} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.5"/>
                <circle cx={hx} cy={yp(hc.close)} r="3" fill={hc.close >= hc.open ? T.green : T.red}/>
              </g>
            )}

            {/* RSI sub-panel */}
            {showRSI && rsiData && (
              <g>
                {drawSubGrid(rsiOffset, rsiH - 5, rsiMin, rsiMax, 'RSI')}
                <line x1={pad.l} x2={pad.l + cw} y1={rsiOffset + (rsiH - 5) * 0.3} y2={rsiOffset + (rsiH - 5) * 0.3} stroke={T.red} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5"/>
                <line x1={pad.l} x2={pad.l + cw} y1={rsiOffset + (rsiH - 5) * 0.7} y2={rsiOffset + (rsiH - 5) * 0.7} stroke={T.green} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5"/>
                {drawSubLine(rsiVals, rsiOffset, rsiH - 5, rsiMin, rsiMax, xp, T.yellow)}
              </g>
            )}

            {/* MACD sub-panel */}
            {showMACD && macdData && (
              <g>
                {drawSubGrid(macdOffset, macdH - 5, macdMin, macdMax, 'MACD')}
                {drawHistBars(histVals, macdOffset, macdH - 5, xp, cWid)}
                {drawSubLine(macdVals, macdOffset, macdH - 5, macdMin, macdMax, xp, T.cyan)}
                {drawSubLine(sigVals,  macdOffset, macdH - 5, macdMin, macdMax, xp, T.red)}
              </g>
            )}
          </svg>
        )}
        {hc && (
          <div style={{ ...tipStyle, left: tipLeft }}>
            <div style={{ color: T.inkFaint, marginBottom: 2 }}>{hc.date}</div>
            <div>O <span style={{ color: T.ink }}>{yLabel(hc.open)}</span>&nbsp;&nbsp;H <span style={{ color: T.green }}>{yLabel(hc.high)}</span></div>
            <div>L <span style={{ color: T.red }}>{yLabel(hc.low)}</span>&nbsp;&nbsp;C <span style={{ color: T.ink, fontWeight: 700 }}>{yLabel(hc.close)}</span></div>
            <div style={{ marginTop: 3, borderTop: `1px solid ${T.borderSoft}`, paddingTop: 3 }}>
              {showMa20  && <><span style={{ color: T.amber   }}>MA20:  {ma20data[hoverIdx]  != null ? ma20data[hoverIdx].toFixed(2)  : '-'}</span><br/></>}
              {showMa60  && <><span style={{ color: T.cyan    }}>MA60:  {ma60data[hoverIdx]  != null ? ma60data[hoverIdx].toFixed(2)  : '-'}</span><br/></>}
              {showMa120 && <><span style={{ color: T.magenta }}>MA120: {ma120data[hoverIdx] != null ? ma120data[hoverIdx].toFixed(2) : '-'}</span><br/></>}
              {showRSI   && rsiData && <><span style={{ color: T.yellow }}>RSI: {rsiData[hoverIdx] != null ? rsiData[hoverIdx].toFixed(1) : '-'}</span><br/></>}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─── LINE CHART ─────────────────────────────────────────────────────────── */
  if (!data.length) return <div ref={ref} style={{ width: '100%', height: '100%' }} />;

  const mn  = Math.min(...data), mx = Math.max(...data);
  const rng = mx - mn || 1;
  const top = mx + rng * 0.1, bot = mn - rng * 0.1;
  const yp  = v => pad.t + ((top - v) / (top - bot)) * pch;
  const xp  = i => pad.l + (i / Math.max(1, data.length - 1)) * cw;

  const ticks = Array.from({ length: 5 }, (_, i) => top - ((top - bot) * i) / 4);
  const pts   = data.map((v, i) => [xp(i), yp(v)]);
  const path  = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
  const area  = pts.length ? `${path} L ${pad.l + cw} ${pad.t + pch} L ${pad.l} ${pad.t + pch} Z` : '';
  const [lx, ly] = pts[pts.length - 1] || [0, 0];
  const dateSrc  = ohlcData.length > 0 ? ohlcData : [];
  const maxVol   = Math.max(...dateSrc.map(v => v.volume || 0)) || 1;
  const vpY      = v => pad.t + pch + vch - (v / maxVol) * vch;

  const onMove = e => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const svgX = e.clientX - rect.left - pad.l;
    setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round((svgX / cw) * (data.length - 1)))));
  };

  const hi      = hoverIdx !== null ? hoverIdx : null;
  const hPt     = hi !== null ? pts[hi] : null;
  const hDate   = hi !== null ? dateSrc[hi]?.date : null;
  const hPrice  = hi !== null ? data[hi] : null;
  const tipLeft = hPt ? (hPt[0] < w * 0.6 ? hPt[0] + 10 : hPt[0] - 88) : 0;

  const rsiOffset  = mainH;
  const macdOffset = mainH + rsiH;
  const rsiVals    = rsiData || [];
  const macdVals   = macdData?.macdLine || [];
  const sigVals    = macdData?.signal   || [];
  const histVals   = macdData?.hist     || [];
  const rsiMin = 0, rsiMax = 100;
  const macdAllVals = [...macdVals, ...sigVals].filter(v => v !== null && Number.isFinite(v));
  const macdMin = macdAllVals.length ? Math.min(...macdAllVals) * 1.1 : -1;
  const macdMax = macdAllVals.length ? Math.max(...macdAllVals) * 1.1 : 1;
  const cWid = Math.max(2, Math.floor(cw / Math.max(data.length, 1)) - 1);

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }}
      onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>
      {w > 0 && h > 0 && (
        <svg width={w} height={totalH} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.30"/>
              <stop offset="100%" stopColor={accent} stopOpacity="0"/>
            </linearGradient>
          </defs>

          {/* Price grid */}
          {ticks.map((v, i) => {
            const y = yp(v);
            return (
              <g key={i}>
                <line x1={pad.l} x2={pad.l + cw} y1={y} y2={y} stroke={T.border} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.7"/>
                <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill={T.inkFaint} fontFamily={T.font}>{yLabel(v)}</text>
              </g>
            );
          })}

          {/* Volume bars */}
          {showVol && dateSrc.map((c, i) => {
            const x    = xp(i);
            const volY = vpY(c.volume || 0);
            const color = c.close >= c.open ? T.green : T.red;
            return <rect key={'v'+i} x={x - cWid / 2} y={volY} width={cWid} height={(pad.t + pch + vch) - volY} fill={color} opacity="0.25"/>;
          })}

          {/* Bollinger Bands */}
          {showBB && bbData && (
            <g>
              {drawBBLine(bbData.upper,  yp, xp, '#a78bfa', '4 2')}
              {drawBBLine(bbData.middle, yp, xp, '#a78bfa44', '')}
              {drawBBLine(bbData.lower,  yp, xp, '#a78bfa', '4 2')}
            </g>
          )}

          {/* Price area + line */}
          <path d={area} fill="url(#chartFill)"/>
          <path d={path} fill="none" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px ${accent}aa)` }}/>

          {/* MA lines */}
          {showMa20  && drawMALine(ma20data,  yp, xp, T.amber)}
          {showMa60  && drawMALine(ma60data,  yp, xp, T.cyan)}
          {showMa120 && drawMALine(ma120data, yp, xp, T.magenta)}

          {/* Pulse dot */}
          {!hPt && pts.length > 0 && (
            <g>
              <circle cx={lx} cy={ly} r="3" fill={accent}/>
              <circle cx={lx} cy={ly} r="9" fill={accent} opacity="0.2">
                <animate attributeName="r" values="9;14;9" dur="2s" repeatCount="indefinite"/>
              </circle>
            </g>
          )}

          {/* Date ticks */}
          {xTickIdxs(data.length).map(i => (
            <text key={i} x={xp(i)} y={pad.t + pch + vch + 16} textAnchor="middle" fontSize="8.5" fill={T.inkFaint} fontFamily={T.font}>
              {fmtDate(dateSrc[i]?.date)}
            </text>
          ))}

          {/* Hover crosshair */}
          {hPt && (
            <g>
              <line x1={hPt[0]} x2={hPt[0]} y1={pad.t} y2={pad.t + pch + vch} stroke={T.inkFaint} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.5"/>
              <circle cx={hPt[0]} cy={hPt[1]} r="4" fill={T.surface} stroke={accent} strokeWidth="2"/>
            </g>
          )}

          {/* RSI sub-panel */}
          {showRSI && rsiData && (
            <g>
              {drawSubGrid(rsiOffset, rsiH - 5, rsiMin, rsiMax, 'RSI')}
              <line x1={pad.l} x2={pad.l + cw} y1={rsiOffset + (rsiH - 5) * 0.3} y2={rsiOffset + (rsiH - 5) * 0.3} stroke={T.red} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5"/>
              <line x1={pad.l} x2={pad.l + cw} y1={rsiOffset + (rsiH - 5) * 0.7} y2={rsiOffset + (rsiH - 5) * 0.7} stroke={T.green} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5"/>
              {drawSubLine(rsiVals, rsiOffset, rsiH - 5, rsiMin, rsiMax, xp, T.yellow)}
            </g>
          )}

          {/* MACD sub-panel */}
          {showMACD && macdData && (
            <g>
              {drawSubGrid(macdOffset, macdH - 5, macdMin, macdMax, 'MACD')}
              {drawHistBars(histVals, macdOffset, macdH - 5, xp, cWid)}
              {drawSubLine(macdVals, macdOffset, macdH - 5, macdMin, macdMax, xp, T.cyan)}
              {drawSubLine(sigVals,  macdOffset, macdH - 5, macdMin, macdMax, xp, T.red)}
            </g>
          )}
        </svg>
      )}
      {hPt && (
        <div style={{ ...tipStyle, left: tipLeft }}>
          <div style={{ color: T.inkFaint, marginBottom: 2 }}>{hDate || 'Point '+hi}</div>
          <div style={{ color: accent, fontWeight: 700 }}>{yLabel(hPrice)}</div>
          <div style={{ marginTop: 3, borderTop: `1px solid ${T.borderSoft}`, paddingTop: 3 }}>
            {showMa20  && <><span style={{ color: T.amber   }}>MA20:  {ma20data[hi]  != null ? ma20data[hi].toFixed(2)  : '-'}</span><br/></>}
            {showMa60  && <><span style={{ color: T.cyan    }}>MA60:  {ma60data[hi]  != null ? ma60data[hi].toFixed(2)  : '-'}</span><br/></>}
            {showMa120 && <><span style={{ color: T.magenta }}>MA120: {ma120data[hi] != null ? ma120data[hi].toFixed(2) : '-'}</span><br/></>}
            {showRSI   && rsiData && <><span style={{ color: T.yellow }}>RSI:  {rsiData[hi] != null ? rsiData[hi].toFixed(1) : '-'}</span><br/></>}
          </div>
        </div>
      )}
    </div>
  );
};

const CommandBar = ({ symbol, onSymbol, onSearch, onSettings, refreshing, providerStatus, alertCount = 0, onAlerts }) => {
  const [val, setVal] = useState(symbol);
  useEffect(() => { setVal(symbol); }, [symbol]);
  const statusColor = providerStatus?.kind === 'ok' ? T.green : providerStatus?.kind === 'warn' ? T.yellow : providerStatus?.kind === 'error' ? T.red : T.inkFaint;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, height: 40, padding: '0 12px 0 18px',
      background: T.surface, borderBottom: `1px solid ${T.border}`,
      whiteSpace: 'nowrap', overflow: 'hidden', flex: '0 0 auto',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
        <div style={{ width: 18, height: 18, background: T.amber, display: 'grid', placeItems: 'center',
          fontSize: 11, fontWeight: 800, color: '#000', boxShadow: `0 0 10px ${T.amber}88` }}>T</div>
        <span style={{ fontWeight: 700, color: T.amber, fontSize: 12, letterSpacing: '0.14em' }}>THESIS//TRACK</span>
      </div>

      {/* Symbol input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
        <span style={{ color: T.amber, fontWeight: 700 }}>&gt;</span>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') onSymbol?.(val); }}
          style={{ background: 'transparent', border: 0, outline: 0, color: T.amber,
            fontFamily: T.font, fontSize: 13, fontWeight: 600, width: 100, padding: 0, letterSpacing: '0.05em' }} />
      </div>

      {/* Search box */}
      <button
        onClick={onSearch}
        style={{
          flex: '0 1 640px', minWidth: 200,
          height: 30, background: T.bg, border: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
          cursor: 'pointer', textAlign: 'left', borderRadius: 3,
        }}>
        <span style={{ fontSize: 13, color: T.inkFaint, lineHeight: 1 }}>⌕</span>
        <span style={{ fontSize: 12, color: T.inkFaint, letterSpacing: '0.02em', fontFamily: T.fontSans }}>
          종목 검색 &nbsp;
          <span style={{ opacity: 0.55 }}>— <kbd style={{ ...kbdStyle, fontSize: 11 }}>/</kbd> 를 누르면 바로 활성화</span>
        </span>
      </button>

      <div style={{ flex: '1 1 auto' }}/>

      {/* Right side status */}
      {providerStatus && (
        <span title={providerStatus.text} style={{ color: statusColor, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', flex: '0 0 auto' }}>
          ● {providerStatus.label || 'DATA'}
        </span>
      )}
      {onAlerts && (
        <button
          onClick={onAlerts}
          title={alertCount > 0 ? `새 알림 ${alertCount}건` : '알림 센터 (F6)'}
          style={{
            background: alertCount > 0 ? T.amber : 'transparent',
            border: `1px solid ${alertCount > 0 ? T.amber : T.border}`,
            color: alertCount > 0 ? '#000' : T.inkDim,
            fontFamily: T.font, fontSize: 11.5, fontWeight: alertCount > 0 ? 800 : 500,
            cursor: 'pointer', padding: '5px 12px', letterSpacing: '0.08em',
            display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto',
            minHeight: 28, borderRadius: 3,
          }}>
          <span>ALERT</span>
          {alertCount > 0 && (
            <span style={{
              background: '#000', color: T.amber, borderRadius: 8, padding: '1px 6px',
              fontSize: 10, fontWeight: 800, minWidth: 16, textAlign: 'center',
            }}>{alertCount > 99 ? '99+' : alertCount}</span>
          )}
        </button>
      )}
      {onSettings && (
        <button onClick={onSettings} style={{ background: 'transparent', border: `1px solid ${T.border}`,
          color: T.inkDim, fontFamily: T.font, fontSize: 11.5, cursor: 'pointer',
          padding: '5px 12px', letterSpacing: '0.08em', minHeight: 28, borderRadius: 3 }}>
          API
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: T.inkFaint, flex: '0 0 auto' }}>
        {refreshing
          ? <span style={{ color: T.amber }}>⟳</span>
          : <Pulse />}
        <span>{refreshing ? 'FETCHING' : 'LIVE'} · {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} KST</span>
      </div>
      <style>{`
        @keyframes tt-pulse { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(2.5); opacity: 0; } }
        button:disabled, button[disabled] { opacity: 0.38 !important; cursor: not-allowed !important; }
        button:not(:disabled):hover { filter: brightness(1.15); }
        :focus-visible { outline: 2px solid #FF9500; outline-offset: 2px; border-radius: 2px; }
        input:focus-visible { outline: 2px solid #FF950066; outline-offset: 0; }
      `}</style>
    </div>
  );
};

const kbdStyle = {
  display: 'inline-block', padding: '2px 6px', background: T.surface2,
  border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 11.5, fontFamily: T.font, color: T.inkDim, margin: '0 2px',
};

const Pulse = () => (
  <span style={{ position: 'relative', display: 'inline-block', width: 7, height: 7, flex: '0 0 auto' }}>
    <span style={{ position: 'absolute', inset: 0, background: T.green, borderRadius: '50%', animation: 'tt-pulse 1.8s ease-out infinite' }}/>
    <span style={{ position: 'absolute', inset: 1, background: T.green, borderRadius: '50%' }}/>
  </span>
);

const TickerRail = ({ tickers }) => (
  <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 0,
    background: T.bg, borderBottom: `1px solid ${T.border}`, overflow: 'hidden', flex: '0 0 auto' }}>
    {tickers.map((t, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 14px', borderRight: `1px solid ${T.borderSoft}`,
        fontSize: 11, fontVariantNumeric: 'tabular-nums', fontFamily: T.font }}>
        <span style={{ color: T.inkDim, fontWeight: 600 }}>{t.symbol}</span>
        <span style={{ color: T.ink }}>{t.val}</span>
        {t.change != null && (
          <span style={{ color: colorForChange(t.change), fontWeight: 600 }}>
            {sign(t.change)}{Number(t.change).toFixed(2)}%
          </span>
        )}
      </div>
    ))}
  </div>
);

// ── Hero strip ───────────────────────────────────────────────────────────────
const HeroStrip = ({ stock, onRefresh, refreshing }) => {
  const price = Number(stock.price) || 0;
  const prev = Number(stock.prevClose) || price;
  const change = price - prev;
  const changePct = prev ? (change / prev) * 100 : 0;
  const target = Number(stock.target) || 0;
  const upside = price ? ((target - price) / price) * 100 : 0;
  const daysLeft = window.getDaysLeft ? window.getDaysLeft(stock.review?.next) : null;
  const heroName = stock.name || stock.symbol;
  const heroNameSize = heroName.length > 34 ? 14 : heroName.length > 24 ? 16 : heroName.length > 16 ? 18 : 20;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto minmax(260px, 1.4fr) 1fr 1fr 1.2fr 0.9fr 1fr',
      gap: 0, padding: '10px 16px',
      background: `linear-gradient(180deg, ${T.surface} 0%, ${T.bg} 100%)`,
      borderBottom: `1px solid ${T.border}`, alignItems: 'center',
    }}>
      <ScoreRing score={stock.scores?.overall ?? 0} size={58} accent={T.amber}/>
      <div style={{ paddingLeft: 14, paddingRight: 14, borderRight: `1px solid ${T.borderSoft}`, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ marginBottom: 4, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontSize: heroNameSize, fontWeight: 800, color: T.ink, letterSpacing: '0.01em',
            lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            display: 'block' }}
            title={heroName}>
            {heroName}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: T.inkDim, fontWeight: 600, letterSpacing: '0.04em', minWidth: 0, overflow: 'hidden' }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
            {stock.symbol} · {stock.market} · {stock.currency}
          </span>
          <span style={{ fontSize: 13, flex: '0 0 auto' }}>{stock.flag || ''}</span>
          <span style={{ fontSize: 10.5, padding: '2px 6px', border: `1px solid ${T.amber}`,
            color: T.amber, fontWeight: 700, letterSpacing: '0.1em', flex: '0 0 auto' }}>
            {(stock.recommendation || 'Watch').toUpperCase()}
          </span>
          {onRefresh && (
            <button onClick={() => onRefresh(stock.id)} disabled={refreshing}
              style={{ marginLeft: 4, padding: '2px 8px', fontSize: 10.5, fontFamily: T.font,
                background: 'transparent', border: `1px solid ${T.border}`,
                color: refreshing ? T.inkFaint : T.cyan, cursor: refreshing ? 'default' : 'pointer',
                letterSpacing: '0.08em', flex: '0 0 auto' }}>
              {refreshing ? '...' : '↻ REFRESH'}
            </button>
          )}
        </div>
      </div>
      <div style={{ paddingLeft: 18, paddingRight: 18, borderRight: `1px solid ${T.borderSoft}` }}>
        <Stat
          label="Last Price"
          value={stock.currency === 'KRW' ? `₩${fmtPx(price, 'KRW')}` : `$${fmtPx(price, stock.currency)}`}
          sub={<span style={{ color: colorForChange(change) }}>
            {sign(change)}{Number.isFinite(change) ? fmtPx(Math.abs(change), stock.currency) : '–'} ({sign(changePct)}{changePct.toFixed(2)}%)
          </span>}
        />
      </div>
      <div style={{ paddingLeft: 18, paddingRight: 18, borderRight: `1px solid ${T.borderSoft}` }}>
        <Stat
          label="Target · Upside"
          value={stock.currency === 'KRW' ? `₩${fmtPx(target, 'KRW')}` : `$${fmtPx(target, stock.currency)}`}
          sub={<span style={{ color: colorForChange(upside) }}>{sign(upside)}{upside.toFixed(2)}%</span>}
        />
      </div>
      <div style={{ paddingLeft: 18, paddingRight: 18, borderRight: `1px solid ${T.borderSoft}` }}>
        <div style={{ fontSize: 10.5, color: T.inkFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          Bull · Base · Bear
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: T.green, fontSize: 14, fontWeight: 700 }}>{fmtPx(stock.valuation?.bull?.price ?? 0, stock.currency)}</span>
          <span style={{ color: T.inkFaint }}>·</span>
          <span style={{ color: T.amber, fontSize: 14, fontWeight: 700 }}>{fmtPx(stock.valuation?.base?.price ?? 0, stock.currency)}</span>
          <span style={{ color: T.inkFaint }}>·</span>
          <span style={{ color: T.red, fontSize: 14, fontWeight: 700 }}>{fmtPx(stock.valuation?.bear?.price ?? 0, stock.currency)}</span>
        </div>
        <div style={{ fontSize: 10, color: T.inkDim, marginTop: 4 }}>
          PER {stock.valuation?.base?.multiple ?? '?'}x · base
        </div>
      </div>
      <div style={{ paddingLeft: 18, paddingRight: 18, borderRight: `1px solid ${T.borderSoft}` }}>
        <Stat
          label="Next Review"
          value={daysLeft !== null
            ? <span style={{ color: daysLeft < 0 ? T.red : T.cyan }}>D{daysLeft >= 0 ? '-' : '+'}{Math.abs(daysLeft)}</span>
            : <span style={{ color: T.inkFaint }}>–</span>}
          sub={stock.review?.next || '미설정'}
        />
      </div>
      <div style={{ paddingLeft: 18 }}>
        <div style={{ fontSize: 10.5, color: T.inkFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          Score Trend · 12M
        </div>
        <Spark data={stock.scoreHistory || []} width={140} height={26} color={T.amber}/>
        <div style={{ fontSize: 10, color: T.inkDim, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
          {stock.scoreHistory?.length
            ? `${stock.scoreHistory[0]} → ${stock.scoreHistory[stock.scoreHistory.length-1]}`
            : '–'}
        </div>
      </div>
    </div>
  );
};

const PitchHeadline = ({ text, onEdit }) => (
  <div style={{
    padding: '10px 20px', background: T.bg, borderBottom: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '0 0 auto',
  }}>
    <div style={{ fontSize: 10, color: T.amber, letterSpacing: '0.18em', fontWeight: 700,
      writingMode: 'vertical-rl', transform: 'rotate(180deg)', flex: '0 0 auto', fontFamily: T.font }}>PITCH</div>
    <div style={{ width: 2, alignSelf: 'stretch', background: T.amber, boxShadow: `0 0 8px ${T.amber}88`, flex: '0 0 auto' }}/>
    <div style={{ fontFamily: T.fontSans, fontSize: 16, fontWeight: 500, color: T.ink,
      lineHeight: 1.4, letterSpacing: '-0.005em', flex: 1, minWidth: 0,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      title={text}>
      "{text || '—'}"
    </div>
    {onEdit && (
      <button onClick={onEdit} style={{ background: 'transparent', border: `1px solid ${T.border}`,
        color: T.inkDim, fontFamily: T.font, fontSize: 11, cursor: 'pointer',
        padding: '5px 12px', letterSpacing: '0.1em', whiteSpace: 'nowrap',
        minHeight: 28, borderRadius: 3 }}>
        EDIT PITCH
      </button>
    )}
  </div>
);

window.T = T;
window.Cell = Cell;
window.Stat = Stat;
window.ScoreRing = ScoreRing;
window.ScoreBar = ScoreBar;
window.Spark = Spark;
window.PriceChart = PriceChart;
window.CommandBar = CommandBar;
window.TickerRail = TickerRail;
window.HeroStrip = HeroStrip;
window.PitchHeadline = PitchHeadline;
window.fmtNum = fmtNum;
window.fmtPx = fmtPx;
window.sign = sign;
window.colorForChange = colorForChange;
window.safeFixed = safeFixed;
window.kbdStyle = kbdStyle;
