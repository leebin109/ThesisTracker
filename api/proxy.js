// Unified proxy — handles /api/proxy?service=opendart|sec|yahoo&path=...
// vercel.json rewrites: /api/opendart/*, /api/sec/*, /api/yahoo/* → here

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Module-level cache: valid within one Lambda warm instance
let _yahooCrumb = null; // { crumb, cookie, expiresAt }

async function getYahooCrumb() {
  if (_yahooCrumb && Date.now() < _yahooCrumb.expiresAt) return _yahooCrumb;
  try {
    // Step 1: hit Yahoo consent to get session cookie
    const consentRes = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': YAHOO_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
    });
    const rawCookie = consentRes.headers.get('set-cookie') || '';
    const cookie = rawCookie.split(',').map(c => c.trim().split(';')[0]).filter(Boolean).join('; ');

    // Step 2: fetch crumb using that cookie
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': YAHOO_UA, 'Cookie': cookie },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.startsWith('<')) return null;

    _yahooCrumb = { crumb, cookie, expiresAt: Date.now() + 55 * 60 * 1000 }; // 55 min TTL
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

async function fetchYahoo(targetUrl, crumbInfo) {
  const res = await fetch(targetUrl, { headers: yahooHeaders(crumbInfo?.cookie) });
  // If unauthorized, try once more with a fresh crumb
  if (res.status === 401 || res.status === 403) {
    _yahooCrumb = null;
    const fresh = await getYahooCrumb();
    if (!fresh) return res;
    const sep = targetUrl.includes('?') ? '&' : '?';
    return fetch(`${targetUrl}${sep}crumb=${encodeURIComponent(fresh.crumb)}`, {
      headers: yahooHeaders(fresh.cookie),
    });
  }
  return res;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { service, path: pathParam, ...rest } = req.query;
  const suffix = Array.isArray(pathParam) ? pathParam.join('/') : String(pathParam || '');
  const qs = new URLSearchParams(rest).toString();

  let upstream;
  try {
    if (service === 'opendart') {
      // suffix is the bare endpoint name (no .json) — OpenDART selects JSON output via the .json extension
      const ep = suffix.replace(/\.json$/, '');
      const url = `https://opendart.fss.or.kr/api/${ep}.json${qs ? '?' + qs : ''}`;
      upstream = await fetch(url, {
        headers: { 'User-Agent': 'ThesisTrack/1.0', 'Accept': 'application/json' },
      });

    } else if (service === 'sec') {
      let secUrl;
      if (suffix.startsWith('files/')) {
        secUrl = `https://www.sec.gov/${suffix}${qs ? '?' + qs : ''}`;
      } else if (suffix.startsWith('archives/')) {
        const archivePath = suffix.slice('archives/'.length);
        if (archivePath.includes('..') || archivePath.includes('//')) {
          return res.status(400).json({ error: 'Invalid path' });
        }
        secUrl = `https://www.sec.gov/Archives/edgar/data/${archivePath}${qs ? '?' + qs : ''}`;
      } else {
        secUrl = `https://data.sec.gov/${suffix}${qs ? '?' + qs : ''}`;
      }
      upstream = await fetch(secUrl, {
        headers: { 'User-Agent': 'ThesisTrack research@example.com', 'Accept': 'application/json, text/xml, application/xml, */*' },
      });

    } else if (service === 'yahoo') {
      const crumbInfo = await getYahooCrumb();
      const crumbSuffix = crumbInfo ? `${qs ? '&' : '?'}crumb=${encodeURIComponent(crumbInfo.crumb)}` : '';

      if (suffix.startsWith('chart/')) {
        const sym = suffix.slice('chart/'.length);
        if (!sym || sym.length > 40 || sym.includes('/')) {
          return res.status(400).json({ error: 'invalid symbol' });
        }
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}${qs ? '?' + qs : ''}${crumbSuffix}`;
        upstream = await fetchYahoo(url, crumbInfo);

      } else if (suffix === 'search' || suffix.startsWith('search')) {
        const url = `https://query1.finance.yahoo.com/v1/finance/search${qs ? '?' + qs : ''}${crumbSuffix}`;
        upstream = await fetchYahoo(url, crumbInfo);

      } else if (suffix.startsWith('quoteSummary/')) {
        const sym = suffix.slice('quoteSummary/'.length);
        if (!sym || sym.length > 40 || sym.includes('/')) {
          return res.status(400).json({ error: 'invalid symbol' });
        }
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}${qs ? '?' + qs : ''}${crumbSuffix}`;
        upstream = await fetchYahoo(url, crumbInfo);

      } else if (suffix === 'quote') {
        const url = `https://query1.finance.yahoo.com/v7/finance/quote${qs ? '?' + qs : ''}${crumbSuffix}`;
        upstream = await fetchYahoo(url, crumbInfo);

      } else if (suffix.startsWith('timeseries/')) {
        const sym = suffix.slice('timeseries/'.length);
        if (!sym || sym.length > 40 || sym.includes('/')) {
          return res.status(400).json({ error: 'invalid symbol' });
        }
        // Build query with literal commas in 'type' param — URLSearchParams encodes them as %2C
        // which Yahoo's timeseries endpoint may not accept. req.query values are already decoded.
        const { type: tsType, ...tsRest } = rest;
        const tsQs = [tsType ? `type=${tsType}` : '', new URLSearchParams(tsRest).toString()].filter(Boolean).join('&');
        const tsCs = crumbInfo ? `${tsQs ? '&' : '?'}crumb=${encodeURIComponent(crumbInfo.crumb)}` : '';
        const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(sym)}${tsQs ? '?' + tsQs : ''}${tsCs}`;
        upstream = await fetchYahoo(url, crumbInfo);

      } else {
        return res.status(404).json({ error: `unknown yahoo path: ${suffix}` });
      }

    } else {
      return res.status(400).json({ error: `unknown service: ${service}` });
    }
  } catch (err) {
    return res.status(502).json({ error: `upstream fetch failed: ${err.message}` });
  }

  const body = await upstream.text();
  if (service === 'opendart' && upstream.status === 404) {
    return res.status(404).json({
      status: 'UPSTREAM_HTTP_404',
      message: 'OpenDART upstream returned HTTP 404',
      upstreamBody: body.trim().replace(/\s+/g, ' ').slice(0, 180),
    });
  }
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
  res.status(upstream.status).send(body);
};
