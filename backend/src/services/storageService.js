'use strict';
// Storage Service abstraction
// Supports local filesystem (development) and optional S3 (production)
// Env vars:
//   STORAGE_PROVIDER="local" (default) or "s3"
//   LOCAL_UPLOAD_DIR="uploads/events" (relative to project root)
//   S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

// ---------- Local storage ----------
function getLocalUploadDir() {
  const customDir = process.env.LOCAL_UPLOAD_DIR;
  const dir = customDir ? path.resolve(customDir) : path.resolve(__dirname, '../../../uploads/events');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

async function uploadLocal(buffer, mimetype) {
  const extMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const ext = extMap[mimetype] || '.jpg';
  // Random 32-char hex filename to prevent path traversal and collision
  const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  const dir = getLocalUploadDir();
  const filePath = path.join(dir, filename);
  await fs.promises.writeFile(filePath, buffer);
  // Return relative path for API responses
  return `uploads/events/${filename}`;
}

async function deleteLocal(relativePathOrUrl) {
  if (!relativePathOrUrl || typeof relativePathOrUrl !== 'string') return;
  // Ignore remote URLs
  if (relativePathOrUrl.startsWith('http://') || relativePathOrUrl.startsWith('https://')) return;

  const normalized = relativePathOrUrl.replace(/^\/+/, '');
  const dir = getLocalUploadDir();
  const filename = path.basename(normalized);
  const targetPath = path.join(dir, filename);

  // Security: Ensure path is within upload dir
  if (!targetPath.startsWith(dir)) return;

  try {
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
  } catch (err) {
    // Non-blocking cleanup failure logging
    console.warn(`[storageService] Não foi possível remover arquivo antigo: ${targetPath}`, err.message);
  }
}

// ---------- S3 storage (optional) ----------
let uploadS3 = null;
let deleteS3 = null;

if (provider === 's3') {
  try {
    const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION || 'us-east-1';

    if (!bucket || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
      console.warn('[storageService] Credenciais S3 incompletas no ambiente. Mantendo fallback para armazenamento local.');
    } else {
      const s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
      });

      uploadS3 = async function (buffer, mimetype) {
        const extMap = {
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'image/webp': '.webp',
        };
        const ext = extMap[mimetype] || '.jpg';
        const key = `events/${crypto.randomBytes(16).toString('hex')}${ext}`;
        const command = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
        });
        await s3Client.send(command);
        return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
      };

      deleteS3 = async function (urlOrKey) {
        if (!urlOrKey) return;
        const key = urlOrKey.includes('amazonaws.com/') ? urlOrKey.split('amazonaws.com/')[1] : urlOrKey;
        const command = new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        });
        await s3Client.send(command);
      };
    }
  } catch (err) {
    console.warn('[storageService] @aws-sdk/client-s3 não disponível. Fallback para armazenamento local.');
  }
}

module.exports = {
  uploadImage: (uploadS3 && provider === 's3') ? uploadS3 : uploadLocal,
  deleteImage: (deleteS3 && provider === 's3') ? deleteS3 : deleteLocal,
  getLocalUploadDir,
};
