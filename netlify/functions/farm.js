// Netlify Function wrapper untuk farm.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/farm.js');
module.exports.handler = wrap(handler);
