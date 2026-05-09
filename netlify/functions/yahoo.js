// Proxy for Yahoo Finance APIs — works around CORS restriction in browsers.
// Route: /api/yahoo/* → /.netlify/functions/yahoo (via netlify.toml redirect)
// /api/yahoo/chart/:symbol → query1.finance.yahoo.com/v8/finance/chart/:symbol
// /api/yahoo/search        → query1.finance.yahoo.com/v1/finance/search

exports.handler = async (event) => {
  const path = (event.path || '').replace(/^\/?api\/yahoo\/?/, '');
  const qs = event.rawQuery ? `?${event.rawQuery}` : '';

  let targetUrl;
  if (path.startsWith('chart/')) {
    const sym = path.slice('chart/'.length);
    targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}${qs}`;
  } else if (path === 'search' || path.startsWith('search')) {
    targetUrl = `https://query1.finance.yahoo.com/v1/finance/search${qs}`;
  } else {
    return { statusCode: 404, body: JSON.stringify({ error: `unknown yahoo proxy path: ${path}` }) };
  }

  let res;
  try {
    res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ThesisTrack/1.0)',
        'Accept': 'application/json',
      },
    });
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: `upstream fetch failed: ${err.message}` }) };
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
