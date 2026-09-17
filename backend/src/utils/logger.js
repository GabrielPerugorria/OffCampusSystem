'use strict';
const env = require('../config/env');

const ts = () => new Date().toISOString();

module.exports = {
  info:  (...a) => console.log(`[${ts()}] INFO `, ...a),
  warn:  (...a) => console.warn(`[${ts()}] WARN `, ...a),
  error: (...a) => console.error(`[${ts()}] ERROR`, ...a),
  debug: (...a) => { if (!env.isProduction) console.log(`[${ts()}] DEBUG`, ...a); },
};
