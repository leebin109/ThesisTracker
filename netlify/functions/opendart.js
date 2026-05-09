// Proxy for opendart.fss.or.kr — works around CORS restriction in browsers.
// Route: /api/opendart/* → /.netlify/functions/opendart (via netlify.toml redirect)
// The original path (/api/opendart/fnlttIsInks.json) is forwarded as-is with query params.

exports.handler = async (event) => {
  const suffix = (event.path || '').replace(/^\/?api\/opendart\/?/, '');
  const qs = event.rawQuery ? `?${event.rawQuery}` : '';
  const target = `https://opendart.fss.or.kr/api/${suffix}${qs}`;

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
