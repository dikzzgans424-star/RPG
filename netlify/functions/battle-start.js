// Netlify Function wrapper untuk battle-start.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/battle-start.js');
module.exports.handler = wrap(handler);
