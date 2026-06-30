// Netlify Function wrapper untuk battle-resolve.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/battle-resolve.js');
module.exports.handler = wrap(handler);
