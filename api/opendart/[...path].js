// Proxy for opendart.fss.or.kr — works around CORS restriction in browsers.
module.exports = async function handler(req, res) {
  const parts = req.query.path || [];
  const suffix = Array.isArray(parts) ? parts.join('/') : String(parts);
  const { path: _, ...params } = req.query;
  const qs = new URLSearchParams(params).toString();
  const target = `https://opendart.fss.or.kr/api/${suffix}${qs ? '?' + qs : ''}`;

  let upstream;
  try {
    upstream = await fetch(target, { headers: { 'User-Agent': 'ThesisTrack/1.0' } });
  } catch (err) {
    return res.status(502).json({ error: `upstream fetch failed: ${err.message}` });
  }

  const body = await upstream.text();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
  res.status(upstream.status).send(body);
};
