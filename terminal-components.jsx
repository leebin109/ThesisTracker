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
  inkDim:    '#9ca3af',
  inkFaint:  '#6b7280',
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
    display: 'flex', flexDirection: 'column', minHeight: 0,
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
  const pad = { l: 50, r: 12, t: 10, b: 22 };
  const cw = Math.max(1, w - pad.l - pad.r);
  const ch = Math.max(1, height - pad.t - pad.b);

  const isCandle = chartType === 'candle' && ohlcData.length > 0;

  if (!data.length && !ohlcData.length) {
    return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
  }

  const yLabel = v => v >= 10000 ? (v / 1000).toFixed(0) + 'k' : v >= 1000 ? v.toFixed(0) : v.toFixed(1);

  if (isCandle) {
    const valid = ohlcData.filter(c => Number.isFinite(c.low) && Number.isFinite(c.high) && c.low > 0);
    if (!valid.length) return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
    const allLo = valid.map(c => c.low), allHi = valid.map(c => c.high);
    const mn = Math.min(...allLo), mx = Math.max(...allHi);
    const rng = mx - mn || 1;
    const top = mx + rng * 0.05, bot = mn - rng * 0.05;
    const yp = v => pad.t + ((top - v) / (top - bot)) * ch;
    const n = valid.length;
    const cWid = Math.max(2, Math.floor(cw / n) - 1);
    const xp = i => pad.l + ((i + 0.5) / n) * cw;
    const ticks = Array.from({ length: 5 }, (_, i) => top - ((top - bot) * i) / 4);
    return (
      <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }}>
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
          </svg>
        )}
      </div>
    );
  }

  // Line chart
  const hasData = data.length > 0;
  if (!hasData) return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
  const mn = Math.min(...data), mx = Math.max(...data);
  const rng = mx - mn || 1;
  const top = mx + rng * 0.1, bot = mn - rng * 0.1;
  const ticks = Array.from({ length: 5 }, (_, i) => top - ((top - bot) * i) / 4);
  const pts = data.map((v, i) => [
    pad.l + (i / Math.max(1, data.length - 1)) * cw,
    pad.t + ((top - v) / (top - bot)) * ch,
  ]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
  const area = pts.length ? `${path} L ${pad.l + cw} ${pad.t + ch} L ${pad.l} ${pad.t + ch} Z` : '';
  const [lx, ly] = pts[pts.length - 1] || [0, 0];
  return (
    <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {w > 0 && h > 0 && (
        <svg width={w} height={height} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.30"/>
              <stop offset="100%" stopColor={accent} stopOpacity="0"/>
            </linearGradient>
          </defs>
          {ticks.map((v, i) => {
            const y = pad.t + ((top - v) / (top - bot)) * ch;
            return (
              <g key={i}>
                <line x1={pad.l} x2={pad.l + cw} y1={y} y2={y} stroke={T.border} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.7"/>
                <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill={T.inkFaint} fontFamily={T.font}>{yLabel(v)}</text>
              </g>
            );
          })}
          <path d={area} fill="url(#chartFill)"/>
          <path d={path} fill="none" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px ${accent}aa)` }}/>
          {pts.length > 0 && (
            <g>
              <circle cx={lx} cy={ly} r="3" fill={accent}/>
              <line x1={pad.l} x2={pad.l + cw} y1={ly} y2={ly} stroke={accent} strokeWidth="0.6" strokeDasharray="3 3" opacity="0.5"/>
            </g>
          )}
        </svg>
      )}
    </div>
  );
};

// ── Top bar components ────────────────────────────────────────────────────────
const CommandBar = ({ symbol, onSymbol, activePanel = 'F1', onSearch, onSettings, refreshing, panelDefs, providerStatus, alertCount = 0, onAlerts }) => {
  const [val, setVal] = useState(symbol);
  useEffect(() => { setVal(symbol); }, [symbol]);
  const fkeys = panelDefs || [
    { k: 'F1', label: 'OVR' },
    { k: 'F2', label: 'PITCH' },
    { k: 'F3', label: 'VAL' },
    { k: 'F4', label: 'HX' },
    { k: 'F5', label: 'CHART' },
  ];
  const statusColor = providerStatus?.kind === 'ok' ? T.green : providerStatus?.kind === 'warn' ? T.yellow : providerStatus?.kind === 'error' ? T.red : T.inkFaint;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, height: 34, padding: '0 12px 0 18px',
      background: T.surface, borderBottom: `1px solid ${T.border}`,
      whiteSpace: 'nowrap', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
        <div style={{ width: 18, height: 18, background: T.amber, display: 'grid', placeItems: 'center',
          fontSize: 11, fontWeight: 800, color: '#000', boxShadow: `0 0 10px ${T.amber}88` }}>T</div>
        <span style={{ fontWeight: 700, color: T.amber, fontSize: 12, letterSpacing: '0.14em' }}>THESIS//TRACK</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 1 auto', minWidth: 0 }}>
        <span style={{ color: T.amber, fontWeight: 700, flex: '0 0 auto' }}>&gt;</span>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') onSymbol?.(val); }}
          style={{ background: 'transparent', border: 0, outline: 0, color: T.amber,
            fontFamily: T.font, fontSize: 13, fontWeight: 600, width: 110, padding: 0, letterSpacing: '0.05em' }} />
      </div>
      <div className="cmd-hints" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10.5, color: T.inkFaint, flex: '0 0 auto' }}>
        <span><kbd style={kbdStyle}>:</kbd>cmd</span>
        <button onClick={onSearch} style={{ background: 'transparent', border: 0, color: T.inkFaint,
          fontFamily: T.font, fontSize: 10.5, cursor: 'pointer', padding: 0 }}>
          <kbd style={kbdStyle}>/</kbd>search
        </button>
      </div>
      <div className="cmd-fkeys" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, flex: '0 0 auto', minWidth: 0, overflow: 'hidden' }}>
        {fkeys.map(f => {
          const on = activePanel === f.k;
          return (
            <span key={f.k} style={{ color: on ? T.amber : T.inkDim, fontWeight: on ? 700 : 500 }}>
              <kbd style={kbdStyle}>{f.k}</kbd>{f.short || f.label}
            </span>
          );
        })}
      </div>
      <div style={{ flex: '1 1 auto' }}/>
      {providerStatus && (
        <span title={providerStatus.text} style={{ color: statusColor, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', flex: '0 0 auto' }}>
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
            fontFamily: T.font, fontSize: 10, fontWeight: alertCount > 0 ? 800 : 500,
            cursor: 'pointer', padding: '3px 10px', letterSpacing: '0.08em',
            display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto',
          }}>
          <span>ALERT</span>
          {alertCount > 0 && (
            <span style={{
              background: '#000', color: T.amber, borderRadius: 8, padding: '1px 6px',
              fontSize: 9, fontWeight: 800, minWidth: 16, textAlign: 'center',
            }}>{alertCount > 99 ? '99+' : alertCount}</span>
          )}
        </button>
      )}
      {onSettings && (
        <button onClick={onSettings} style={{ background: 'transparent', border: `1px solid ${T.border}`,
          color: T.inkDim, fontFamily: T.font, fontSize: 10, cursor: 'pointer',
          padding: '3px 10px', letterSpacing: '0.08em' }}>
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
        @media (max-width: 1320px) { .cmd-fkeys { display: none !important; } }
        @media (max-width: 980px)  { .cmd-hints { display: none !important; } }
      `}</style>
    </div>
  );
};

const kbdStyle = {
  display: 'inline-block', padding: '1px 5px', background: T.surface2,
  border: `1px solid ${T.border}`, borderRadius: 2, fontSize: 10, fontFamily: T.font, color: T.inkDim, margin: '0 2px',
};

const Pulse = () => (
  <span style={{ position: 'relative', display: 'inline-block', width: 7, height: 7, flex: '0 0 auto' }}>
    <span style={{ position: 'absolute', inset: 0, background: T.green, borderRadius: '50%', animation: 'tt-pulse 1.8s ease-out infinite' }}/>
    <span style={{ position: 'absolute', inset: 1, background: T.green, borderRadius: '50%' }}/>
  </span>
);

const TickerRail = ({ tickers }) => (
  <div style={{ height: 26, display: 'flex', alignItems: 'center', gap: 0,
    background: T.bg, borderBottom: `1px solid ${T.border}`, overflow: 'hidden' }}>
    {tickers.map((t, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 14px', borderRight: `1px solid ${T.borderSoft}`,
        fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: T.inkDim, fontWeight: 600 }}>{t.symbol}</span>
        <span style={{ color: T.ink }}>{t.val}</span>
        <span style={{ color: colorForChange(t.change), fontWeight: 600 }}>
          {sign(t.change)}{Number(t.change).toFixed(2)}%
        </span>
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
          <span style={{ fontSize: 9, padding: '2px 6px', border: `1px solid ${T.amber}`,
            color: T.amber, fontWeight: 700, letterSpacing: '0.1em', flex: '0 0 auto' }}>
            {(stock.recommendation || 'Watch').toUpperCase()}
          </span>
          {onRefresh && (
            <button onClick={() => onRefresh(stock.id)} disabled={refreshing}
              style={{ marginLeft: 4, padding: '2px 8px', fontSize: 9, fontFamily: T.font,
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
            {sign(change)}{Number.isFinite(change) ? change.toFixed(2) : '–'} ({sign(changePct)}{changePct.toFixed(2)}%)
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
        <div style={{ fontSize: 9.5, color: T.inkFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
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
        <div style={{ fontSize: 9.5, color: T.inkFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
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
    display: 'flex', alignItems: 'center', gap: 12, minWidth: 0,
  }}>
    <div style={{ fontSize: 9, color: T.amber, letterSpacing: '0.18em', fontWeight: 700,
      writingMode: 'vertical-rl', transform: 'rotate(180deg)', flex: '0 0 auto' }}>PITCH</div>
    <div style={{ width: 2, alignSelf: 'stretch', background: T.amber, boxShadow: `0 0 8px ${T.amber}88`, flex: '0 0 auto' }}/>
    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 500, color: T.ink,
      lineHeight: 1.35, letterSpacing: '-0.01em', flex: 1, minWidth: 0,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      title={text}>
      "{text || '—'}"
    </div>
    {onEdit && (
      <button onClick={onEdit} style={{ background: 'transparent', border: `1px solid ${T.border}`,
        color: T.inkDim, fontFamily: T.font, fontSize: 9, cursor: 'pointer',
        padding: '4px 10px', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
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
