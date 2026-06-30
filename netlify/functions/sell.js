// Netlify Function wrapper untuk sell.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/sell.js');
module.exports.handler = wrap(handler);
