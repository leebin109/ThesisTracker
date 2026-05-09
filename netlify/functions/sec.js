// Proxy for SEC EDGAR APIs — works around CORS restriction in browsers.
// Route: /api/sec/* → /.netlify/functions/sec (via netlify.toml redirect)
// files/* → www.sec.gov, everything else → data.sec.gov

exports.handler = async (event) => {
  const suffix = (event.path || '').replace(/^\/?api\/sec\/?/, '');
  const qs = event.rawQuery ? `?${event.rawQuery}` : '';
  const host = suffix.startsWith('files/') ? 'www.sec.gov' : 'data.sec.gov';
  const target = `https://${host}/${suffix}${qs}`;

  let res;
  try {
    res = await fetch(target, {
      headers: {
        'User-Agent': 'ThesisTrack research@example.com',
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
