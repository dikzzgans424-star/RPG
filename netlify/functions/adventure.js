// Netlify Function wrapper untuk adventure.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/adventure.js');
module.exports.handler = wrap(handler);
