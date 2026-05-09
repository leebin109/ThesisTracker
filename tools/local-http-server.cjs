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

function proxyYahoo(req, res, url) {
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

  let targetPath = '';
  const chartMatch = url.pathname.match(/^\/api\/yahoo\/chart\/(.+)$/);
  if (chartMatch) {
    const symbol = decodeURIComponent(chartMatch[1] || '');
    if (!symbol || symbol.includes('/') || symbol.length > 40) {
      writeJson(res, 400, { status: 'LOCAL_PROXY_ERROR', message: 'Invalid Yahoo symbol' });
      return;
    }
    const allowed = new URLSearchParams();
    for (const key of ['range', 'interval', 'includePrePost', 'events']) {
      const value = url.searchParams.get(key);
      if (value !== null) allowed.set(key, value);
    }
    targetPath = `/v8/finance/chart/${encodeURIComponent(symbol)}?${allowed.toString()}`;
  } else if (url.pathname === '/api/yahoo/search') {
    const q = String(url.searchParams.get('q') || '').trim();
    if (!q || q.length > 80) {
      writeJson(res, 400, { status: 'LOCAL_PROXY_ERROR', message: 'Invalid Yahoo search query' });
      return;
    }
    const allowed = new URLSearchParams();
    allowed.set('q', q);
    allowed.set('quotesCount', String(Math.min(20, Math.max(0, Number(url.searchParams.get('quotesCount')) || 10))));
    allowed.set('newsCount', String(Math.min(30, Math.max(0, Number(url.searchParams.get('newsCount')) || 0))));
    targetPath = `/v1/finance/search?${allowed.toString()}`;
  } else {
    writeJson(res, 404, { status: 'LOCAL_PROXY_ERROR', message: 'Unknown Yahoo endpoint' });
    return;
  }

  const proxyReq = https.request({
    hostname: 'query1.finance.yahoo.com',
    path: targetPath,
    method: 'GET',
    headers: {
      accept: 'application/json,*/*',
      'user-agent': 'Mozilla/5.0 ThesisTrack local Yahoo chart proxy',
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
    proxyReq.destroy(new Error('Yahoo proxy timeout'));
  });
  proxyReq.on('error', (err) => {
    writeJson(res, 502, {
      status: 'LOCAL_PROXY_ERROR',
      message: err?.message || 'Yahoo proxy failed',
    });
  });
  proxyReq.end();
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
  if (url.pathname.startsWith('/api/yahoo/chart/')) {
    proxyYahoo(req, res, url);
    return;
  }
  if (url.pathname === '/api/yahoo/search') {
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
