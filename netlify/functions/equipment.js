// Netlify Function wrapper untuk equipment.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/equipment.js');
module.exports.handler = wrap(handler);
