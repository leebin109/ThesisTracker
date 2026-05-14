const assert = require('node:assert/strict');

process.env.DISABLE_YAHOO_PROXY = '1';

const handler = require('../server/proxy-handler.cjs');

function makeReq(query, headers = {}) {
  const qs = new URLSearchParams(query).toString();
  return {
    method: 'GET',
    url: `/api/proxy?${qs}`,
    headers,
    query,
  };
}

function makeRes() {
  const out = { statusCode: 200, headers: {}, body: null };
  return {
    out,
    setHeader(name, value) {
      out.headers[String(name).toLowerCase()] = value;
      return this;
    },
    status(code) {
      out.statusCode = code;
      return this;
    },
    json(payload) {
      out.body = payload;
      return this;
    },
    send(payload) {
      out.body = payload;
      return this;
    },
    end(payload) {
      out.body = payload;
      return this;
    },
  };
}

(async () => {
  let upstreamCalls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    upstreamCalls += 1;
    throw new Error('unexpected upstream fetch');
  };

  try {
    const yahooRes = makeRes();
    await handler(makeReq({ service: 'yahoo', path: 'quote', symbols: 'AAPL' }), yahooRes);
    assert.equal(yahooRes.out.statusCode, 403);
    assert.equal(yahooRes.out.body.status, 'YAHOO_PROXY_DISABLED');

    const unknownRes = makeRes();
    await handler(makeReq({ service: 'mystery', path: 'quote' }), unknownRes);
    assert.equal(unknownRes.out.statusCode, 404);
    assert.equal(unknownRes.out.body.status, 'PROXY_ENDPOINT_NOT_REGISTERED');

    process.env.DISABLE_YAHOO_PROXY = '';
    const commercialRes = makeRes();
    await handler(makeReq({ service: 'yahoo', path: 'chart', symbol: 'AAPL' }, { 'x-data-mode': 'commercialSafe' }), commercialRes);
    assert.equal(commercialRes.out.statusCode, 403);
    assert.equal(commercialRes.out.body.status, 'SOURCE_POLICY_BLOCKED');

    assert.equal(upstreamCalls, 0, `proxy policy should stop before upstream fetch, saw ${upstreamCalls}`);
    console.log('Proxy policy verified: upstream fetch calls = 0');
  } finally {
    global.fetch = originalFetch;
    process.env.DISABLE_YAHOO_PROXY = '';
  }
})();
