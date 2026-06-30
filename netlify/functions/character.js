// Netlify Function wrapper untuk character.js (logic asli tidak diubah)
const { wrap } = require('./_adapter');
const handler = require('./_impl/character.js');
module.exports.handler = wrap(handler);
