// Proxy for Yahoo Finance APIs — works around CORS restriction in browsers.
// /api/yahoo/chart/:symbol → query1.finance.yahoo.com/v8/finance/chart/:symbol
// /api/yahoo/search        → query1.finance.yahoo.com/v1/finance/search
module.exports = async function handler(req, res) {
  const parts = req.query.path || [];
  const path = Array.isArray(parts) ? parts.join('/') : String(parts);
  const { path: _, ...params } = req.query;
  const qs = new URLSearchParams(params).toString();

  let targetUrl;
  if (path.startsWith('chart/')) {
    const sym = path.slice('chart/'.length);
    targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}${qs ? '?' + qs : ''}`;
  } else if (path.startsWith('search')) {
    targetUrl = `https://query1.finance.yahoo.com/v1/finance/search${qs ? '?' + qs : ''}`;
  } else {
    return res.status(404).json({ error: `unknown yahoo proxy path: ${path}` });
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ThesisTrack/1.0)',
        'Accept': 'application/json',
      },
    });
  } catch (err) {
    return res.status(502).json({ error: `upstream fetch failed: ${err.message}` });
  }

  const body = await upstream.text();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
  res.status(upstream.status).send(body);
};
