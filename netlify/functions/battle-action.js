// Netlify Function wrapper untuk battle-action.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/battle-action.js');
module.exports.handler = wrap(handler);
