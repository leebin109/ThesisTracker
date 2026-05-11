const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const port = Number(process.argv[2]) || 8080;
const root = path.resolve(__dirname, '..');
const secUserAgent = process.env.SEC_USER_AGENT || 'ThesisTrack local research contact@example.com';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const openDartEndpoints = new Set(['fnlttSinglAcntAll', 'fnlttSinglAcnt', 'list']);

function writePlain(res, status, text) {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(text);
}

function writeJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify(payload));
}

function proxyOpenDart(req, res, url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store',
    });
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    writeJson(res, 405, { status: 'LOCAL_PROXY_ERROR', message: 'Method not allowed' });
    return;
  }

  const match = url.pathname.match(/^\/api\/opendart\/([A-Za-z0-9_]+)\.json$/);
  const endpoint = match?.[1];
  if (!endpoint || !openDartEndpoints.has(endpoint)) {
    writeJson(res, 404, { status: 'LOCAL_PROXY_ERROR', message: 'Unknown OpenDART endpoint' });
    return;
  }

  const targetPath = `/api/${endpoint}.json?${url.searchParams.toString()}`;
  const proxyReq = https.request({
    hostname: 'opendart.fss.or.kr',
    path: targetPath,
    method: 'GET',
    headers: {
      accept: 'application/json,*/*',
      'user-agent': 'ThesisTrack local OpenDART proxy',
    },
  }, (proxyRes) => {
    const chunks = [];
    proxyRes.on('data', chunk => chunks.push(chunk));
    proxyRes.on('end', () => {
      res.writeHead(proxyRes.statusCode || 502, {
        'content-type': proxyRes.headers['content-type'] || 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      });
      res.end(Buffer.concat(chunks));
    });
  });

  proxyReq.setTimeout(20000, () => {
    proxyReq.destroy(new Error('OpenDART proxy timeout'));
  });
  proxyReq.on('error', (err) => {
    writeJson(res, 502, {
      status: 'LOCAL_PROXY_ERROR',
      message: err?.message || 'OpenDART proxy failed',
    });
  });
  proxyReq.end();
}

function proxySec(req, res, url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store',
    });
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    writeJson(res, 405, { status: 'LOCAL_PROXY_ERROR', message: 'Method not allowed' });
    return;
  }

  let hostname = '';
  let targetPath = '';
  if (url.pathname === '/api/sec/files/company_tickers.json') {
    hostname = 'www.sec.gov';
    targetPath = '/files/company_tickers.json';
  } else {
    const match = url.pathname.match(/^\/api\/sec\/submissions\/(CIK\d{10}\.json)$/);
    if (match) {
      hostname = 'data.sec.gov';
      targetPath = `/submissions/${match[1]}`;
    }
  }

  if (!hostname || !targetPath) {
    writeJson(res, 404, { status: 'LOCAL_PROXY_ERROR', message: 'Unknown SEC endpoint' });
    return;
  }

  const proxyReq = https.request({
    hostname,
    path: targetPath,
    method: 'GET',
    headers: {
      accept: 'application/json,*/*',
      'user-agent': secUserAgent,
    },
  }, (proxyRes) => {
    const chunks = [];
    proxyRes.on('data', chunk => chunks.push(chunk));
    proxyRes.on('end', () => {
      res.writeHead(proxyRes.statusCode || 502, {
        'content-type': proxyRes.headers['content-type'] || 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      });
      res.end(Buffer.concat(chunks));
    });
  });

  proxyReq.setTimeout(20000, () => {
    proxyReq.destroy(new Error('SEC proxy timeout'));
  });
  proxyReq.on('error', (err) => {
    writeJson(res, 502, {
      status: 'LOCAL_PROXY_ERROR',
      message: err?.message || 'SEC proxy failed',
    });
  });
  proxyReq.end();
}

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let _yahooCrumb = null;

async function getYahooCrumb() {
  if (_yahooCrumb && Date.now() < _yahooCrumb.expiresAt) return _yahooCrumb;
  try {
    const consentRes = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': YAHOO_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
    });
    const rawCookie = consentRes.headers.get('set-cookie') || '';
    const cookie = rawCookie.split(',').map(c => c.trim().split(';')[0]).filter(Boolean).join('; ');

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': YAHOO_UA, 'Cookie': cookie },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.startsWith('<')) return null;

    _yahooCrumb = { crumb, cookie, expiresAt: Date.now() + 55 * 60 * 1000 };
    return _yahooCrumb;
  } catch {
    return null;
  }
}

function yahooHeaders(cookie) {
  return {
    'User-Agent': YAHOO_UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com',
    ...(cookie ? { 'Cookie': cookie } : {}),
  };
}

async function fetchYahooWithFallback(targetUrl, crumbInfo) {
  let res = await fetch(targetUrl, { headers: yahooHeaders(crumbInfo?.cookie) });
  if (res.status === 401 || res.status === 403) {
    _yahooCrumb = null;
    const fresh = await getYahooCrumb();
    if (!fresh) return res;
    const sep = targetUrl.includes('?') ? '&' : '?';
    res = await fetch(`${targetUrl}${sep}crumb=${encodeURIComponent(fresh.crumb)}`, {
      headers: yahooHeaders(fresh.cookie),
    });
  }
  return res;
}

async function proxyYahoo(req, res, url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store',
    });
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    writeJson(res, 405, { status: 'LOCAL_PROXY_ERROR', message: 'Method not allowed' });
    return;
  }

  const suffix = url.pathname.slice('/api/yahoo/'.length);
  const qs = url.searchParams.toString();

  let upstreamUrl;
  try {
    const crumbInfo = await getYahooCrumb();
    const crumbSuffix = crumbInfo ? `${qs ? '&' : '?'}crumb=${encodeURIComponent(crumbInfo.crumb)}` : '';

    if (suffix.startsWith('chart/')) {
      const sym = suffix.slice('chart/'.length);
      if (!sym || sym.length > 40 || sym.includes('/')) return writeJson(res, 400, { error: 'invalid symbol' });
      upstreamUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}${qs ? '?' + qs : ''}${crumbSuffix}`;

    } else if (suffix === 'search' || suffix.startsWith('search')) {
      upstreamUrl = `https://query1.finance.yahoo.com/v1/finance/search${qs ? '?' + qs : ''}${crumbSuffix}`;

    } else if (suffix === 'quote' || suffix.startsWith('quote')) {
      upstreamUrl = `https://query1.finance.yahoo.com/v7/finance/quote${qs ? '?' + qs : ''}${crumbSuffix}`;

    } else if (suffix.startsWith('quoteSummary/')) {
      const sym = suffix.slice('quoteSummary/'.length);
      if (!sym || sym.length > 40 || sym.includes('/')) return writeJson(res, 400, { error: 'invalid symbol' });
      upstreamUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}${qs ? '?' + qs : ''}${crumbSuffix}`;

    } else if (suffix.startsWith('timeseries/')) {
      const sym = suffix.slice('timeseries/'.length);
      if (!sym || sym.length > 40 || sym.includes('/')) return writeJson(res, 400, { error: 'invalid symbol' });
      // Use raw search string to preserve literal commas in 'type' param
      const rawQs = url.search ? url.search.slice(1) : '';
      const rawCs = crumbInfo ? `${rawQs ? '&' : '?'}crumb=${encodeURIComponent(crumbInfo.crumb)}` : '';
      upstreamUrl = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(sym)}${rawQs ? '?' + rawQs : ''}${rawCs}`;

    } else {
      return writeJson(res, 404, { error: `unknown yahoo path: ${suffix}` });
    }

    const upstream = await fetchYahooWithFallback(upstreamUrl, crumbInfo);
    const body = await upstream.text();
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end(body);

  } catch (err) {
    writeJson(res, 502, { status: 'LOCAL_PROXY_ERROR', message: err.message });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname.startsWith('/api/opendart/')) {
    proxyOpenDart(req, res, url);
    return;
  }
  if (url.pathname.startsWith('/api/sec/')) {
    proxySec(req, res, url);
    return;
  }
  if (url.pathname.startsWith('/api/yahoo/')) {
    proxyYahoo(req, res, url);
    return;
  }

  let rel = decodeURIComponent(url.pathname === '/' ? '/terminal.html' : url.pathname);
  rel = rel.replace(/^\/+/, '');

  const file = path.resolve(root, rel);
  if (!file.startsWith(root)) {
    writePlain(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      writePlain(res, 404, 'Not found');
      return;
    }

    res.writeHead(200, {
      'content-type': contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[start] Serving on http://localhost:${port}/terminal.html`);
  console.log('[start] OpenDART proxy enabled at /api/opendart/*.json.');
  console.log('[start] SEC EDGAR proxy enabled at /api/sec/*.json.');
  console.log('[start] Yahoo proxy enabled at /api/yahoo/chart/:symbol and /api/yahoo/search.');
  console.log('[start] Press Ctrl+C to stop.');
});
