'use strict';
// Multer middleware for event image uploads
// Uses memoryStorage, validates size, MIME type, and file signature (magic numbers)

const multer = require('multer');

// Configuration constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

// Memory storage – keep file in RAM for validation and further processing
const storage = multer.memoryStorage();

// Custom file filter for MIME type
function mimeFilter(req, file, cb) {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error('Invalid file type. Only JPEG, PNG and WebP are allowed.');
    err.code = 'INVALID_FILE_TYPE';
    cb(err);
  }
}

// Multer instance
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: mimeFilter,
});
upload.upload = upload;

// Helper to verify file signature (magic numbers check)
async function verifyFileSignature(buffer) {
  if (!buffer || buffer.length < 12) return false;

  // JPEG: FF D8 FF
  const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A;

  // WebP: RIFF (bytes 0-3: 52 49 46 46) and WEBP (bytes 8-11: 57 45 42 50)
  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  return isJpeg || isPng || isWebp;
}

module.exports = {
  upload,
  verifyFileSignature,
  MAX_FILE_SIZE,
  ALLOWED_MIME,
};
