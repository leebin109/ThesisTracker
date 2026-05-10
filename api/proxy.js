// Unified proxy — handles /api/proxy?service=opendart|sec|yahoo&path=...
// Called via vercel.json rewrites that map /api/opendart/*, /api/sec/*, /api/yahoo/*
module.exports = async function handler(req, res) {
  const { service, path: pathParam, ...rest } = req.query;
  const suffix = Array.isArray(pathParam) ? pathParam.join('/') : String(pathParam || '');
  const qs = new URLSearchParams(rest).toString();

  let targetUrl;
  if (service === 'opendart') {
    targetUrl = `https://opendart.fss.or.kr/api/${suffix}${qs ? '?' + qs : ''}`;
  } else if (service === 'sec') {
    const host = suffix.startsWith('files/') ? 'www.sec.gov' : 'data.sec.gov';
    targetUrl = `https://${host}/${suffix}${qs ? '?' + qs : ''}`;
  } else if (service === 'yahoo') {
    if (suffix.startsWith('chart/')) {
      const sym = suffix.slice('chart/'.length);
      targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}${qs ? '?' + qs : ''}`;
    } else if (suffix.startsWith('search')) {
      targetUrl = `https://query1.finance.yahoo.com/v1/finance/search${qs ? '?' + qs : ''}`;
    } else {
      return res.status(404).json({ error: `unknown yahoo path: ${suffix}` });
    }
  } else {
    return res.status(400).json({ error: `unknown service: ${service}` });
  }

  const headers = { 'User-Agent': 'ThesisTrack/1.0', 'Accept': 'application/json' };
  if (service === 'yahoo') headers['User-Agent'] = 'Mozilla/5.0 (compatible; ThesisTrack/1.0)';
  if (service === 'sec') headers['User-Agent'] = 'ThesisTrack research@example.com';

  let upstream;
  try {
    upstream = await fetch(targetUrl, { headers });
  } catch (err) {
    return res.status(502).json({ error: `upstream fetch failed: ${err.message}` });
  }

  const body = await upstream.text();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
  res.status(upstream.status).send(body);
};
