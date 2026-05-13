// Proxy for opendart.fss.or.kr — works around CORS restriction in browsers.
// Route: /api/opendart/* → /.netlify/functions/opendart (via netlify.toml redirect)
// App URLs omit the .json suffix; OpenDART upstream requires it.

const OPEN_DART_ENDPOINTS = new Set(['fnlttSinglAcntAll', 'fnlttSinglAcnt', 'list', 'stockInfo']);

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

  const suffix = proxySuffix(event, '/api/opendart/');
  const endpoint = suffix.replace(/\.json$/, '');
  if (!OPEN_DART_ENDPOINTS.has(endpoint)) {
    return {
      statusCode: 404,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `unknown opendart proxy path: ${suffix}` }),
    };
  }

  const qs = event.rawQuery ? `?${event.rawQuery}` : '';
  const target = `https://opendart.fss.or.kr/api/${endpoint}.json${qs}`;

  let res;
  try {
    res = await fetch(target, {
      headers: { 'User-Agent': 'ThesisTrack/1.0' },
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
