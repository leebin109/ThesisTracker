// Proxy for Yahoo Finance APIs — works around CORS restriction in browsers.
// Route: /api/yahoo/* → /.netlify/functions/yahoo (via netlify.toml redirect)

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let yahooCrumb = null; // { crumb, cookie, expiresAt }

function proxySuffix(event, prefix) {
  const paths = [];
  if (event.rawUrl) {
    try { paths.push(new URL(event.rawUrl).pathname); } catch {}
  }
  if (event.path) paths.push(event.path);

  for (const path of paths) {
    const idx = path.indexOf(prefix);
    if (idx >= 0) return decodeURIComponent(path.slice(idx + prefix.length).replace(/^\/+/, ''));
  }
  return '';
}

async function getYahooCrumb() {
  if (yahooCrumb && Date.now() < yahooCrumb.expiresAt) return yahooCrumb;
  try {
    const consentRes = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': YAHOO_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
    });
    const rawCookie = consentRes.headers.get('set-cookie') || '';
    const cookie = rawCookie.split(',').map(c => c.trim().split(';')[0]).filter(Boolean).join('; ');

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': YAHOO_UA, Cookie: cookie },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.startsWith('<')) return null;

    yahooCrumb = { crumb, cookie, expiresAt: Date.now() + 55 * 60 * 1000 };
    return yahooCrumb;
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

async function fetchYahoo(targetUrl, crumbInfo) {
  let res = await fetch(targetUrl, { headers: yahooHeaders(crumbInfo?.cookie) });
  if (res.status === 401 || res.status === 403) {
    yahooCrumb = null;
    const fresh = await getYahooCrumb();
    if (!fresh) return res;
    const sep = targetUrl.includes('?') ? '&' : '?';
    res = await fetch(`${targetUrl}${sep}crumb=${encodeURIComponent(fresh.crumb)}`, {
      headers: yahooHeaders(fresh.cookie),
    });
  }
  return res;
}

function invalidSymbol(sym) {
  return !sym || sym.length > 40 || sym.includes('/');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
      },
      body: '',
    };
  }

  if (event.httpMethod && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const suffix = proxySuffix(event, '/api/yahoo/');
  const qs = event.rawQuery ? event.rawQuery : '';
  const crumbInfo = await getYahooCrumb();
  const crumbSuffix = crumbInfo ? `${qs ? '&' : '?'}crumb=${encodeURIComponent(crumbInfo.crumb)}` : '';

  let targetUrl;
  if (suffix.startsWith('chart/')) {
    const sym = suffix.slice('chart/'.length);
    if (invalidSymbol(sym)) {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'invalid symbol' }) };
    }
    targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}${qs ? '?' + qs : ''}${crumbSuffix}`;

  } else if (suffix === 'search' || suffix.startsWith('search')) {
    targetUrl = `https://query1.finance.yahoo.com/v1/finance/search${qs ? '?' + qs : ''}${crumbSuffix}`;

  } else if (suffix.startsWith('quoteSummary/')) {
    const sym = suffix.slice('quoteSummary/'.length);
    if (invalidSymbol(sym)) {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'invalid symbol' }) };
    }
    targetUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}${qs ? '?' + qs : ''}${crumbSuffix}`;

  } else if (suffix === 'quote') {
    targetUrl = `https://query1.finance.yahoo.com/v7/finance/quote${qs ? '?' + qs : ''}${crumbSuffix}`;

  } else if (suffix.startsWith('timeseries/')) {
    const sym = suffix.slice('timeseries/'.length);
    if (invalidSymbol(sym)) {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'invalid symbol' }) };
    }
    targetUrl = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(sym)}${qs ? '?' + qs : ''}${crumbSuffix}`;

  } else {
    return {
      statusCode: 404,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `unknown yahoo proxy path: ${suffix}` }),
    };
  }

  let res;
  try {
    res = await fetchYahoo(targetUrl, crumbInfo);
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `upstream fetch failed: ${err.message}` }),
    };
  }

  const body = await res.text();
  return {
    statusCode: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body,
  };
};
