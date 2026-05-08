const express = require('express');
const router = express.Router();
const { createClient } = require('@libsql/client');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try { req.userId = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET).userId; next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

// POST /api/users/upload-profile-pic
// Handles TWO cases:
//   1. Mobile — sends JSON { photo_url } after uploading directly to Cloudinary
//   2. Web    — sends multipart file, we upload to Cloudinary here
router.post('/upload-profile-pic', auth, (req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/json')) return next(); // mobile: skip multer
  upload.single('photo')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ error: 'Image too large. Max 5MB.' });
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    // Mobile path: JSON body with photo_url already uploaded to Cloudinary
    if (req.body && req.body.photo_url !== undefined) {
      const url = req.body.photo_url; // null = remove photo, string = set photo
      await db.execute({ sql: 'UPDATE users SET profile_pic = ? WHERE id = ?', args: [url, req.userId] });
      return res.json({ url });
    }

    // Web path: file upload, send to Cloudinary ourselves
    if (!req.file) return res.status(400).json({ error: 'No image selected' });
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'bond-profiles', transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }] },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(req.file.buffer);
    });
    await db.execute({ sql: 'UPDATE users SET profile_pic = ? WHERE id = ?', args: [result.secure_url, req.userId] });
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed: ' + (err.message || 'Unknown error') });
  }
});

module.exports = router;
