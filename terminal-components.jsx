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
  font:      "'JetBrains Mono', ui-monospace, monospace",
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
        display: 'flex', alignItems: 'center', gap: 8, height: 22, padding: '0 10px',
        borderBottom: `1px solid ${T.borderSoft}`, background: T.surface2,
        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em',
        color: accent || T.inkFaint, textTransform: 'uppercase',
        flex: '0 0 auto',
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
    <div style={{ fontSize: 9.5, color: T.inkFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
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
        <div style={{ fontSize: 7.5, color: T.inkFaint, letterSpacing: '0.15em', marginTop: 2 }}>{label}</div>
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

const PriceChart = ({ data = [], ohlcData = [], chartType = 'line', accent = T.amber }) => {
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

  const height = h || 200;
  const pad = { l: 50, r: 12, t: 10, b: 30 };
  const cw = Math.max(1, w - pad.l - pad.r);
  const ch = Math.max(1, height - pad.t - pad.b);
  const pch = ch * 0.75;
  const vch = ch * 0.2;

  const isCandle = chartType === 'candle' && ohlcData.length > 0;
  const valid = useMemo(
    () => ohlcData.filter(c => Number.isFinite(c.low) && Number.isFinite(c.high) && c.low > 0),
    [ohlcData]
  );

  if (!data.length && !valid.length) {
    return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
  }

  const yLabel = v => v >= 10000 ? (v / 1000).toFixed(0) + 'k' : v >= 1000 ? v.toFixed(0) : v.toFixed(1);
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
    fontSize: 9.5, fontFamily: T.font, lineHeight: 1.65,
    pointerEvents: 'none', zIndex: 10, whiteSpace: 'nowrap',
  };

  const calcMA = (period, source) => source.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = 0; j < period; j++) sum += source[i - j].close || source[i - j];
    return sum / period;
  });

  const sourceData = isCandle ? valid : data;
  const ma20 = useMemo(() => calcMA(20, sourceData), [sourceData]);
  const ma60 = useMemo(() => calcMA(60, sourceData), [sourceData]);
  const ma120 = useMemo(() => calcMA(120, sourceData), [sourceData]);

  const drawMA = (maData, yp, xp, color) => {
    const pts = maData.map((v, i) => v !== null ? `${xp(i).toFixed(2)},${yp(v).toFixed(2)}` : null).filter(Boolean);
    if (pts.length === 0) return null;
    const d = 'M ' + pts.join(' L ');
    return <path d={d} fill="none" stroke={color} strokeWidth="1" opacity="0.8" />;
  };

  if (isCandle) {
    if (!valid.length) return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
    const allLo = valid.map(c => c.low), allHi = valid.map(c => c.high);
    const mn = Math.min(...allLo), mx = Math.max(...allHi);
    const rng = mx - mn || 1;
    const top = mx + rng * 0.05, bot = mn - rng * 0.05;
    
    const maxVol = Math.max(...valid.map(v => v.volume || 0)) || 1;
    
    const yp = v => pad.t + ((top - v) / (top - bot)) * pch;
    const vp = v => pad.t + ch - (v / maxVol) * vch;
    
    const n = valid.length;
    const cWid = Math.max(2, Math.floor(cw / n) - 1);
    const xp = i => pad.l + ((i + 0.5) / n) * cw;

    const ticks = Array.from({ length: 5 }, (_, i) => top - ((top - bot) * i) / 4);

    const onMove = e => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const svgX = e.clientX - rect.left - pad.l;
      setHoverIdx(Math.max(0, Math.min(n - 1, Math.floor((svgX / cw) * n))));
    };

    const hc = hoverIdx !== null ? valid[hoverIdx] : null;
    const hx = hc ? xp(hoverIdx) : 0;
    const tipLeft = hx < w * 0.6 ? hx + 10 : hx - 102;

    return (
      <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }}
        onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>
        {w > 0 && h > 0 && (
          <svg width={w} height={height} style={{ display: 'block' }}>
            {ticks.map((v, i) => {
              const y = yp(v);
              return (
                <g key={i}>
                  <line x1={pad.l} x2={pad.l + cw} y1={y} y2={y} stroke={T.border} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.7"/>
                  <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill={T.inkFaint} fontFamily={T.font}>{yLabel(v)}</text>
                </g>
              );
            })}
            
            {valid.map((c, i) => {
              const x = xp(i);
              const volY = vp(c.volume || 0);
              const green = c.close >= c.open;
              const color = green ? T.green : T.red;
              return (
                <rect key={'v'+i} x={x - cWid / 2} y={volY} width={cWid} height={(pad.t + ch) - volY} fill={color} opacity="0.3" />
              );
            })}
            
            {drawMA(ma20, yp, xp, T.amber)}
            {drawMA(ma60, yp, xp, T.cyan)}
            {drawMA(ma120, yp, xp, T.magenta)}
            
            {valid.map((c, i) => {
              const x = xp(i);
              const openY = yp(c.open), closeY = yp(c.close);
              const highY = yp(c.high), lowY = yp(c.low);
              const green = c.close >= c.open;
              const color = green ? T.green : T.red;
              const bodyTop = Math.min(openY, closeY);
              const bodyH = Math.max(1, Math.abs(closeY - openY));
              return (
                <g key={i}>
                  <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth="1" opacity="0.8"/>
                  <rect x={x - cWid / 2} y={bodyTop} width={cWid} height={bodyH} fill={color} opacity="0.9"/>
                </g>
              );
            })}
            {xTickIdxs(valid.length).map(i => (
              <text key={i} x={xp(i)} y={pad.t + ch + 16} textAnchor="middle" fontSize="8.5" fill={T.inkFaint} fontFamily={T.font}>
                {fmtDate(valid[i]?.date)}
              </text>
            ))}
            {hc && (
              <g>
                <line x1={hx} x2={hx} y1={pad.t} y2={pad.t + ch} stroke={T.inkFaint} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.5"/>
                <circle cx={hx} cy={yp(hc.close)} r="3" fill={hc.close >= hc.open ? T.green : T.red}/>
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
               <span style={{ color: T.amber }}>MA20: {ma20[hoverIdx] ? ma20[hoverIdx].toFixed(2) : '-'}</span><br/>
               <span style={{ color: T.cyan }}>MA60: {ma60[hoverIdx] ? ma60[hoverIdx].toFixed(2) : '-'}</span><br/>
               <span style={{ color: T.magenta }}>MA120: {ma120[hoverIdx] ? ma120[hoverIdx].toFixed(2) : '-'}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* LINE CHART */
  if (!data.length) return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
  const mn = Math.min(...data), mx = Math.max(...data);
  const rng = mx - mn || 1;
  const top = mx + rng * 0.1, bot = mn - rng * 0.1;
  const yp = v => pad.t + ((top - v) / (top - bot)) * pch;
  const xp = i => pad.l + (i / Math.max(1, data.length - 1)) * cw;
  
  const ticks = Array.from({ length: 5 }, (_, i) => top - ((top - bot) * i) / 4);
  const pts = data.map((v, i) => [xp(i), yp(v)]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
  const area = pts.length ? `${path} L ${pad.l + cw} ${pad.t + ch} L ${pad.l} ${pad.t + ch} Z` : '';
  const [lx, ly] = pts[pts.length - 1] || [0, 0];
  const dateSrc = ohlcData.length > 0 ? ohlcData : [];

  const maxVol = Math.max(...dateSrc.map(v => v.volume || 0)) || 1;
  const vp = v => pad.t + ch - (v / maxVol) * vch;

  const onMove = e => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const svgX = e.clientX - rect.left - pad.l;
    setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round((svgX / cw) * (data.length - 1)))));
  };

  const hi = hoverIdx !== null ? hoverIdx : null;
  const hPt = hi !== null ? pts[hi] : null;
  const hDate = hi !== null ? dateSrc[hi]?.date : null;
  const hPrice = hi !== null ? data[hi] : null;
  const tipLeft = hPt ? (hPt[0] < w * 0.6 ? hPt[0] + 10 : hPt[0] - 88) : 0;

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }}
      onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>
      {w > 0 && h > 0 && (
        <svg width={w} height={height} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.30"/>
              <stop offset="100%" stopColor={accent} stopOpacity="0"/>
            </linearGradient>
          </defs>
          {ticks.map((v, i) => {
            const y = yp(v);
            return (
              <g key={i}>
                <line x1={pad.l} x2={pad.l + cw} y1={y} y2={y} stroke={T.border} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.7"/>
                <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill={T.inkFaint} fontFamily={T.font}>{yLabel(v)}</text>
              </g>
            );
          })}
          
          {dateSrc.map((c, i) => {
            const x = xp(i);
            const volY = vp(c.volume || 0);
            const green = c.close >= c.open;
            const color = green ? T.green : T.red;
            const cWid = Math.max(2, Math.floor(cw / data.length) - 1);
            return (
              <rect key={'v'+i} x={x - cWid / 2} y={volY} width={cWid} height={(pad.t + ch) - volY} fill={color} opacity="0.3" />
            );
          })}

          <path d={area} fill="url(#chartFill)"/>
          <path d={path} fill="none" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px ${accent}aa)` }}/>
            
          {drawMA(ma20, yp, xp, T.amber)}
          {drawMA(ma60, yp, xp, T.cyan)}
          {drawMA(ma120, yp, xp, T.magenta)}

          {!hPt && pts.length > 0 && (
            <g>
              <circle cx={lx} cy={ly} r="3" fill={accent}/>
              <circle cx={lx} cy={ly} r="9" fill={accent} opacity="0.2">
                <animate attributeName="r" values="9;14;9" dur="2s" repeatCount="indefinite"/>
              </circle>
            </g>
          )}
          {xTickIdxs(data.length).map(i => (
            <text key={i} x={xp(i)} y={pad.t + ch + 16} textAnchor="middle" fontSize="8.5" fill={T.inkFaint} fontFamily={T.font}>
              {fmtDate(dateSrc[i]?.date)}
            </text>
          ))}
          {hPt && (
            <g>
              <line x1={hPt[0]} x2={hPt[0]} y1={pad.t} y2={pad.t + ch} stroke={T.inkFaint} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.5"/>
              <circle cx={hPt[0]} cy={hPt[1]} r="4" fill={T.surface} stroke={accent} strokeWidth="2"/>
            </g>
          )}
        </svg>
      )}
      {hPt && (
        <div style={{ ...tipStyle, left: tipLeft }}>
          <div style={{ color: T.inkFaint, marginBottom: 2 }}>{hDate || 'Point '+hi}</div>
          <div style={{ color: accent, fontWeight: 700 }}>{yLabel(hPrice)}</div>
          <div style={{ marginTop: 3, borderTop: `1px solid ${T.borderSoft}`, paddingTop: 3 }}>
             <span style={{ color: T.amber }}>MA20: {ma20[hi] ? ma20[hi].toFixed(2) : '-'}</span><br/>
             <span style={{ color: T.cyan }}>MA60: {ma60[hi] ? ma60[hi].toFixed(2) : '-'}</span><br/>
             <span style={{ color: T.magenta }}>MA120: {ma120[hi] ? ma120[hi].toFixed(2) : '-'}</span>
          </div>
        </div>
      )}
    </div>
  );
};


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
