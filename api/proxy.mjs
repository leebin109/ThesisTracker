import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handler = require('./proxy.cjs');

export default handler;
