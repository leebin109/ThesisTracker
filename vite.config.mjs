import { createRequire } from 'node:module';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const proxyHandler = require('./server/proxy-handler.cjs');

function queryObjectFromUrl(url) {
  const out = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = Array.isArray(out[key]) ? [...out[key], value] : [out[key], value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

function adaptResponse(res) {
  let statusCode = 200;
  return {
    setHeader(name, value) {
      res.setHeader(name, value);
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/json; charset=utf-8');
      res.statusCode = statusCode;
      res.end(JSON.stringify(payload));
      return this;
    },
    send(body) {
      res.statusCode = statusCode;
      res.end(body);
      return this;
    },
    end(body) {
      res.statusCode = statusCode;
      res.end(body);
      return this;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'thesis-track-api-proxy',
      configureServer(server) {
        server.middlewares.use('/api/proxy', async (req, res) => {
          const url = new URL(req.url || '', 'http://localhost/api/proxy');
          const localReq = Object.assign(Object.create(req), {
            method: req.method,
            url: `/api/proxy${url.search}`,
            headers: req.headers,
            query: queryObjectFromUrl(url),
          });
          try {
            await proxyHandler(localReq, adaptResponse(res));
          } catch (err) {
            res.statusCode = 502;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({
              status: 'LOCAL_PROXY_ERROR',
              message: err?.message || String(err),
            }));
          }
        });
      },
    },
  ],
});
