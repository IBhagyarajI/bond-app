const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { createClient } = require('@libsql/client');

// ── DB ────────────────────────────────────────────────────
function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

// ── helpers ───────────────────────────────────────────────
function makeToken(userId, rememberMe = false) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: rememberMe ? '90d' : '1d' }
  );
}

// Gmail transporter — port 587 (STARTTLS) works on Render
function makeTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    tls: { rejectUnauthorized: false },
  });
}

// ── REGISTER ──────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields required' });

    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });
    if (existing.rows.length > 0)
      return res.status(400).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    await db.execute({
      sql: 'INSERT INTO users (name, email, password, invite_code) VALUES (?, ?, ?, ?)',
      args: [name, email.toLowerCase(), hash, inviteCode],
    });

    const user = await db.execute({
      sql: 'SELECT id, name, email, invite_code, partner_id, avatar_color FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });

    const token = makeToken(user.rows[0].id);
    res.json({ token, user: user.rows[0] });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ── LOGIN ─────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });
    if (result.rows.length === 0)
      return res.status(400).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(400).json({ error: 'Invalid credentials' });

    const token = makeToken(user.id, rememberMe);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        invite_code: user.invite_code,
        partner_id: user.partner_id,
        avatar_color: user.avatar_color,
        profile_picture: user.profile_picture,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ── ME ────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT id, name, email, invite_code, partner_id, avatar_color, profile_picture FROM users WHERE id = ?',
      args: [decoded.userId],
    });
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'User not found' });

    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ── CONNECT (pair with friend) ────────────────────────────
router.post('/connect', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { inviteCode } = req.body;
    const db = getDb();

    const partner = await db.execute({
      sql: 'SELECT * FROM users WHERE invite_code = ?',
      args: [inviteCode.toUpperCase()],
    });
    if (partner.rows.length === 0)
      return res.status(404).json({ error: 'Invite code not found' });

    if (partner.rows[0].id === decoded.userId)
      return res.status(400).json({ error: "You can't connect with yourself" });

    const partnerId = partner.rows[0].id;

    await db.execute({
      sql: 'UPDATE users SET partner_id = ? WHERE id = ?',
      args: [partnerId, decoded.userId],
    });
    await db.execute({
      sql: 'UPDATE users SET partner_id = ? WHERE id = ?',
      args: [decoded.userId, partnerId],
    });

    res.json({ success: true, partner: { name: partner.rows[0].name } });
  } catch (err) {
    console.error('Connect error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── FORGOT PASSWORD ───────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });

    // Always return success so we don't reveal if email exists
    if (result.rows.length === 0)
      return res.json({ success: true });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 3600000; // 1 hour

    await db.execute({
      sql: 'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
      args: [resetToken, expiry, email.toLowerCase()],
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const transporter = makeTransporter();

    await transporter.sendMail({
      from: `"Bond App" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '🔐 Reset your Bond password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#1a1a1a;color:#f5f5f5;border-radius:12px;">
          <h2 style="color:#c9a84c;text-align:center;">Bond</h2>
          <p>Hi there,</p>
          <p>Someone requested a password reset for your Bond account. Click the button below to set a new password:</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetUrl}" style="background:#c9a84c;color:#1a1a1a;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
          </div>
          <p style="font-size:13px;color:#aaa;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
});

// ── RESET PASSWORD ────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ error: 'Token and password required' });

    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE reset_token = ?',
      args: [token],
    });

    if (result.rows.length === 0)
      return res.status(400).json({ error: 'Invalid or expired reset link' });

    const user = result.rows[0];
    if (Date.now() > Number(user.reset_token_expiry))
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });

    const hash = await bcrypt.hash(password, 12);
    await db.execute({
      sql: 'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      args: [hash, user.id],
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
