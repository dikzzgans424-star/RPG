// Netlify Function wrapper untuk hunt-animal.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/hunt-animal.js');
module.exports.handler = wrap(handler);
