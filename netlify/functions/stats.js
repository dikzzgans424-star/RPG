// Netlify Function wrapper untuk stats.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/stats.js');
module.exports.handler = wrap(handler);
