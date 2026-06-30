// Netlify Function wrapper untuk gather.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/gather.js');
module.exports.handler = wrap(handler);
