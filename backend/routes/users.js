const express = require('express');
const router = express.Router();
const { createClient } = require('@libsql/client');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const upload = multer({ storage: multer.memoryStorage() });

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/users/upload-profile-pic
router.post('/upload-profile-pic', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'bond-profiles', transformation: [{ width: 400, height: 400, crop: 'fill' }] },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    await db.execute({
      sql: 'UPDATE users SET profile_pic = ? WHERE id = ?',
      args: [result.secure_url, req.userId],
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    console.error('Profile pic upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
