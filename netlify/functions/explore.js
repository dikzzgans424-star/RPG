// Netlify Function wrapper untuk explore.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/explore.js');
module.exports.handler = wrap(handler);
