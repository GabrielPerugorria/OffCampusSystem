'use strict';
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1

function randomBlock(size) {
  const bytes = crypto.randomBytes(size);
  let out = '';
  for (let i = 0; i < size; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function prefix(text, size = 3) {
  const clean = String(text || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z]/g, '');
  return (clean.slice(0, size) || 'EVT').padEnd(size, 'X');
}

// Formato: EVE-LOT-XXXXXX  (legível na portaria, imprevisível o bastante
// para não ser adivinhado — o código antigo era sequencial de 4 dígitos).
function generateTicketCode(eventName, batchName) {
  return `${prefix(eventName)}-${prefix(batchName)}-${randomBlock(6)}`;
}

module.exports = { generateTicketCode };
