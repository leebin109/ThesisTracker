import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handler = require('../server/proxy-handler.cjs');

export default handler;
