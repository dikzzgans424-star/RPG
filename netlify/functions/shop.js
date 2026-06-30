// Netlify Function wrapper untuk shop.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/shop.js');
module.exports.handler = wrap(handler);
