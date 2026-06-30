// Netlify Function wrapper untuk gacha.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/gacha.js');
module.exports.handler = wrap(handler);
