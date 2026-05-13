// Unified API proxy for Vercel and the local dev server.
// Canonical client contract:
//   /api/proxy?service=opendart&path=fnlttSinglAcntAll&...
//   /api/proxy?service=yahoo&path=chart&symbol=AAPL&...
//   /api/proxy?service=sec&path=files/company_tickers.json

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const OPENDART_ENDPOINTS = new Set(['fnlttSinglAcntAll', 'fnlttSinglAcnt', 'list', 'stockInfo']);
const YAHOO_SYMBOL_ENDPOINTS = new Set(['chart', 'quoteSummary', 'timeseries']);
const SEC_SECTIONS = new Set(['files', 'submissions', 'archives', 'companyfacts']);

let yahooSession = null;

function one(value) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanSegment(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '');
}

function getRawQueryPairs(req) {
  const raw = String(req.url || '').split('?')[1] || '';
  return new URLSearchParams(raw);
}

function buildQuery(req, omit = [], opts = {}) {
  const skip = new Set(['service', 'path', ...omit]);
  const preserveCommaKeys = new Set(opts.preserveCommaKeys || []);
  const raw = getRawQueryPairs(req);
  const parts = [];
  for (const [key, value] of raw.entries()) {
    if (skip.has(key)) continue;
    const encodedKey = encodeURIComponent(key);
    let encodedValue = encodeURIComponent(value);
    if (preserveCommaKeys.has(key)) encodedValue = encodedValue.replace(/%2C/gi, ',');
    parts.push(`${encodedKey}=${encodedValue}`);
  }
  return parts.join('&');
}

function bodySnippet(text, limit = 420) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function upstreamHttpError(res, upstream, body, service, path) {
  const contentType = upstream.headers.get('content-type') || '';
  return sendJson(res, upstream.status, {
    status: `UPSTREAM_HTTP_${upstream.status}`,
    message: `${service}/${path} upstream HTTP ${upstream.status}`,
    service,
    path,
    upstreamStatus: upstream.status,
    upstreamContentType: contentType,
    upstreamBody: bodySnippet(body),
  });
}

function normalizeRoute(req) {
  const query = req.query || {};
  const service = cleanSegment(one(query.service)).toLowerCase();
  let path = cleanSegment(one(query.path));

  if (service === 'opendart') {
    path = path.replace(/\.json$/i, '');
  }

  if (service === 'yahoo') {
    const symbol = cleanSegment(one(query.symbol));
    if (symbol && YAHOO_SYMBOL_ENDPOINTS.has(path)) path = `${path}/${symbol}`;
  }

  if (service === 'sec') {
    const section = path.split('/')[0];
    const file = cleanSegment(one(query.file));
    const archivePath = cleanSegment(one(query.archivePath));
    if (section === 'archives' && archivePath) path = `archives/${archivePath}`;
    if (file && !path.includes('/')) path = `${path}/${file}`;
  }

  return { service, path };
}

function validateOpenDartPath(path) {
  const endpoint = cleanSegment(path).replace(/\.json$/i, '');
  if (!OPENDART_ENDPOINTS.has(endpoint)) return null;
  return endpoint;
}

function validateYahooSymbol(symbol) {
  const sym = cleanSegment(symbol);
  if (!sym || sym.length > 64 || sym.includes('/')) return null;
  return sym;
}

function validateSecPath(path) {
  const clean = cleanSegment(path);
  if (!clean || clean.includes('..') || clean.includes('//')) return null;
  const [section] = clean.split('/');
  if (!SEC_SECTIONS.has(section)) return null;
  return clean;
}

async function getYahooSession() {
  if (yahooSession && Date.now() < yahooSession.expiresAt) return yahooSession;

  try {
    const consent = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': YAHOO_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
    });
    const rawCookie = consent.headers.get('set-cookie') || '';
    const cookie = rawCookie
      .split(',')
      .map(part => part.trim().split(';')[0])
      .filter(Boolean)
      .join('; ');

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': YAHOO_UA, ...(cookie ? { Cookie: cookie } : {}) },
    });
    if (!crumbRes.ok) return null;

    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.startsWith('<')) return null;

    yahooSession = { crumb, cookie, expiresAt: Date.now() + 55 * 60 * 1000 };
    return yahooSession;
  } catch {
    return null;
  }
}

function yahooHeaders(cookie) {
  return {
    'User-Agent': YAHOO_UA,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://finance.yahoo.com/',
    Origin: 'https://finance.yahoo.com',
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

async function fetchYahoo(targetUrl, session) {
  let upstream = await fetch(targetUrl, { headers: yahooHeaders(session?.cookie) });
  if (upstream.status !== 401 && upstream.status !== 403) return upstream;

  yahooSession = null;
  const fresh = await getYahooSession();
  if (!fresh) return upstream;

  const sep = targetUrl.includes('?') ? '&' : '?';
  upstream = await fetch(`${targetUrl}${sep}crumb=${encodeURIComponent(fresh.crumb)}`, {
    headers: yahooHeaders(fresh.cookie),
  });
  return upstream;
}

function appendCrumb(url, qs, session) {
  if (!session?.crumb) return url;
  const sep = qs ? '&' : '?';
  return `${url}${sep}crumb=${encodeURIComponent(session.crumb)}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  const { service, path } = normalizeRoute(req);
  let upstream;

  try {
    if (service === 'opendart') {
      const endpoint = validateOpenDartPath(path);
      if (!endpoint) return sendJson(res, 404, { error: `unknown OpenDART endpoint: ${path}` });

      const qs = buildQuery(req);
      const targetUrl = `https://opendart.fss.or.kr/api/${endpoint}.json${qs ? `?${qs}` : ''}`;
      upstream = await fetch(targetUrl, {
        headers: { 'User-Agent': 'ThesisTrack/1.0', Accept: 'application/json, text/plain, */*' },
      });

    } else if (service === 'yahoo') {
      const session = await getYahooSession();
      const [endpoint, ...parts] = cleanSegment(path).split('/');
      if (!endpoint) return sendJson(res, 404, { error: 'unknown Yahoo endpoint' });

      if (endpoint === 'search') {
        const qs = buildQuery(req, ['symbol']);
        const base = `https://query1.finance.yahoo.com/v1/finance/search${qs ? `?${qs}` : ''}`;
        upstream = await fetchYahoo(appendCrumb(base, qs, session), session);

      } else if (endpoint === 'quote') {
        const qs = buildQuery(req, ['symbol']);
        const base = `https://query1.finance.yahoo.com/v7/finance/quote${qs ? `?${qs}` : ''}`;
        upstream = await fetchYahoo(appendCrumb(base, qs, session), session);

      } else if (endpoint === 'chart') {
        const sym = validateYahooSymbol(parts.join('/'));
        if (!sym) return sendJson(res, 400, { error: 'invalid Yahoo chart symbol' });
        const qs = buildQuery(req, ['symbol']);
        const base = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}${qs ? `?${qs}` : ''}`;
        upstream = await fetchYahoo(appendCrumb(base, qs, session), session);

      } else if (endpoint === 'quoteSummary') {
        const sym = validateYahooSymbol(parts.join('/'));
        if (!sym) return sendJson(res, 400, { error: 'invalid Yahoo quoteSummary symbol' });
        const qs = buildQuery(req, ['symbol']);
        const base = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}${qs ? `?${qs}` : ''}`;
        upstream = await fetchYahoo(appendCrumb(base, qs, session), session);

      } else if (endpoint === 'timeseries') {
        const sym = validateYahooSymbol(parts.join('/'));
        if (!sym) return sendJson(res, 400, { error: 'invalid Yahoo timeseries symbol' });
        const qs = buildQuery(req, ['symbol'], { preserveCommaKeys: ['type'] });
        const base = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(sym)}${qs ? `?${qs}` : ''}`;
        upstream = await fetchYahoo(appendCrumb(base, qs, session), session);

      } else {
        return sendJson(res, 404, { error: `unknown Yahoo endpoint: ${endpoint}` });
      }

    } else if (service === 'sec') {
      const clean = validateSecPath(path);
      if (!clean) return sendJson(res, 404, { error: `unknown SEC path: ${path}` });

      const qs = buildQuery(req, ['file', 'archivePath']);
      let targetUrl;
      if (clean === 'files/company_tickers.json') {
        targetUrl = `https://www.sec.gov/files/company_tickers.json${qs ? `?${qs}` : ''}`;
      } else if (clean.startsWith('archives/')) {
        targetUrl = `https://www.sec.gov/Archives/edgar/data/${clean.slice('archives/'.length)}${qs ? `?${qs}` : ''}`;
      } else if (clean.startsWith('companyfacts/')) {
        targetUrl = `https://data.sec.gov/api/xbrl/${clean}${qs ? `?${qs}` : ''}`;
      } else if (clean.startsWith('submissions/')) {
        targetUrl = `https://data.sec.gov/${clean}${qs ? `?${qs}` : ''}`;
      } else {
        return sendJson(res, 404, { error: `unknown SEC path: ${path}` });
      }

      upstream = await fetch(targetUrl, {
        headers: {
          'User-Agent': process.env.SEC_USER_AGENT || 'ThesisTrack research@example.com',
          Accept: 'application/json, text/xml, application/xml, */*',
        },
      });

    } else {
      return sendJson(res, 400, { error: `unknown service: ${service || '(missing)'}` });
    }
  } catch (err) {
    return sendJson(res, 502, {
      status: 'PROXY_FETCH_FAILED',
      message: err?.message || String(err),
      service,
      path,
    });
  }

  const body = await upstream.text();
  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
  res.setHeader('Content-Type', contentType);

  if (!upstream.ok) {
    return upstreamHttpError(res, upstream, body, service, path);
  }

  return res.status(upstream.status).send(body);
};
