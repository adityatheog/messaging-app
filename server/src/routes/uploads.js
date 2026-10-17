const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const { getMaxUploadBytes } = require('../config/env');
const { getStore } = require('../storage');

const router = express.Router();

const ALLOWED_MIMES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['application/pdf', '.pdf'],
  ['text/plain', '.txt'],
  ['audio/webm', '.webm'],
  ['audio/ogg', '.ogg'],
  ['audio/wav', '.wav'],
  ['audio/mpeg', '.mp3'],
  ['audio/mp4', '.m4a']
]);

const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

const sanitizeOriginalName = (rawName, fallbackExt) => {
  const base = path.basename(String(rawName || '')).replace(/[^\w.\- ()]/g, '_').trim();
  if (!base || base === '.' || base === '..') {
    return `attachment${fallbackExt}`;
  }
  return base.slice(0, 120);
};

const matchesMagicBytes = (buf, mimeType) => {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return false;
  switch (mimeType) {
    case 'image/png':
      return (
        buf.length >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
      );
    case 'image/jpeg':
      return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'image/gif':
      return (
        buf.length >= 6 &&
        buf.slice(0, 6).toString('ascii') === 'GIF87a' ||
        buf.slice(0, 6).toString('ascii') === 'GIF89a'
      );
    case 'image/webp':
      return (
        buf.length >= 12 &&
        buf.slice(0, 4).toString('ascii') === 'RIFF' &&
        buf.slice(8, 12).toString('ascii') === 'WEBP'
      );
    case 'application/pdf':
      return buf.length >= 5 && buf.slice(0, 5).toString('ascii') === '%PDF-';
    case 'text/plain':
      return !buf.includes(0x00);
    case 'audio/ogg':
      return buf.length >= 4 && buf.slice(0, 4).toString('ascii') === 'OggS';
    case 'audio/wav':
      return (
        buf.length >= 12 &&
        buf.slice(0, 4).toString('ascii') === 'RIFF' &&
        buf.slice(8, 12).toString('ascii') === 'WAVE'
      );
    case 'audio/webm':
      return (
        buf.length >= 4 &&
        buf[0] === 0x1a &&
        buf[1] === 0x45 &&
        buf[2] === 0xdf &&
        buf[3] === 0xa3
      );
    case 'audio/mpeg':
      return (
        (buf.length >= 3 && buf.slice(0, 3).toString('ascii') === 'ID3') ||
        (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
      );
    case 'audio/mp4':
      return buf.length >= 8 && buf.slice(4, 8).toString('ascii') === 'ftyp';
    default:
      return false;
  }
};

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { fileName, mimeType, dataBase64 } = req.body || {};
    if (typeof mimeType !== 'string' || !ALLOWED_MIMES.has(mimeType.trim().toLowerCase())) {
      return res.status(400).json({ error: 'Unsupported or missing file MIME type' });
    }
    if (typeof dataBase64 !== 'string' || !dataBase64.trim()) {
      return res.status(400).json({ error: 'File content (dataBase64) is required' });
    }

    const normalizedMime = mimeType.trim().toLowerCase();
    const ext = ALLOWED_MIMES.get(normalizedMime);
    const strippedBase64 = dataBase64.replace(/^data:[^;]+;base64,/, '').trim();

    if (!/^[A-Za-z0-9+/=\r\n]+$/.test(strippedBase64)) {
      return res.status(400).json({ error: 'Invalid base64 file encoding' });
    }

    const buffer = Buffer.from(strippedBase64, 'base64');
    const maxBytes = getMaxUploadBytes();
    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Uploaded file cannot be empty' });
    }
    if (buffer.length > maxBytes) {
      return res.status(413).json({ error: `File exceeds maximum size of ${maxBytes} bytes` });
    }

    if (!matchesMagicBytes(buffer, normalizedMime)) {
      return res.status(400).json({ error: 'File content does not match declared MIME type' });
    }

    const store = getStore();
    await store.initialize();
    const uploadsDir =
      store.uploadsDir ||
      (process.env.UPLOADS_DIR
        ? path.resolve(process.env.UPLOADS_DIR)
        : path.join(store.dataDir, 'uploads'));
    await fs.mkdir(uploadsDir, { recursive: true });

    const id = uuidv4();
    const storedName = `${id}${ext}`;
    const originalName = sanitizeOriginalName(fileName, ext);
    const targetPath = path.join(uploadsDir, storedName);

    await fs.writeFile(targetPath, buffer, { flag: 'wx' });

    const attachment = await store.createAttachment({
      id,
      uploaderId: req.user.id,
      originalName,
      storedName,
      mimeType: normalizedMime,
      sizeBytes: buffer.length,
      createdAt: new Date().toISOString()
    });

    res.status(201).json({
      message: 'File uploaded',
      attachment: {
        ...attachment,
        url: `/api/uploads/${attachment.id}`
      }
    });
  } catch (error) {
    console.error('File upload error:', error.message);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!SAFE_ID_RE.test(id)) {
      return res.status(400).json({ error: 'Invalid attachment ID' });
    }

    const store = getStore();
    await store.initialize();
    const attachment = await store.getAttachmentById(id);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const uploadsDir = path.resolve(
      store.uploadsDir ||
        (process.env.UPLOADS_DIR
          ? path.resolve(process.env.UPLOADS_DIR)
          : path.join(store.dataDir, 'uploads'))
    );
    const safeStoredName = path.basename(attachment.storedName);
    const filePath = path.resolve(uploadsDir, safeStoredName);

    if (!filePath.startsWith(uploadsDir + path.sep)) {
      return res.status(400).json({ error: 'Invalid attachment path' });
    }

    let fileBuffer;
    try {
      fileBuffer = await fs.readFile(filePath);
    } catch {
      return res.status(404).json({ error: 'Attachment file missing on disk' });
    }

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', String(fileBuffer.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    const disposition = attachment.mimeType.startsWith('image/') ? 'inline' : 'attachment';
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${attachment.originalName.replace(/"/g, '')}"`
    );
    res.send(fileBuffer);
  } catch (error) {
    console.error('File download error:', error.message);
    res.status(500).json({ error: 'Failed to retrieve attachment' });
  }
});

module.exports = router;
