const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@libsql/client');
const crypto = require('crypto');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not set');
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@bond-app.com';
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ sender: { name: 'Bond App', email: senderEmail }, to: [{ email: to }], subject, htmlContent: html }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Brevo error: ${JSON.stringify(data)}`);
  return data;
}

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const result = await db.execute({
      sql: 'SELECT id, name, email, invite_code, friend_id, profile_pic FROM users WHERE id = ?',
      args: [decoded.userId],
    });
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({ id: u.id, name: u.name, email: u.email, inviteCode: u.invite_code, friendId: u.friend_id, profilePic: u.profile_pic });
  } catch (err) {
    console.error('Me error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    await db.execute({ sql: 'INSERT INTO users (name, email, password, invite_code) VALUES (?, ?, ?, ?)', args: [name, email, hashedPassword, inviteCode] });
    const user = await db.execute({ sql: 'SELECT id, name, email, invite_code, friend_id, profile_pic FROM users WHERE email = ?', args: [email] });
    const u = user.rows[0];
    const token = jwt.sign({ userId: u.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: u.id, name: u.name, email: u.email, inviteCode: u.invite_code, friendId: u.friend_id, profilePic: u.profile_pic } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, inviteCode: user.invite_code, friendId: user.friend_id, profilePic: user.profile_pic } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/connect
router.post('/connect', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ error: 'Invite code is required' });
    const friendResult = await db.execute({ sql: 'SELECT id FROM users WHERE invite_code = ?', args: [inviteCode.toUpperCase()] });
    if (friendResult.rows.length === 0) return res.status(404).json({ error: 'Invalid invite code' });
    const friendId = friendResult.rows[0].id;
    if (friendId === decoded.userId) return res.status(400).json({ error: "You can't connect with yourself" });
    await db.execute({ sql: 'UPDATE users SET friend_id = ? WHERE id = ?', args: [friendId, decoded.userId] });
    await db.execute({ sql: 'UPDATE users SET friend_id = ? WHERE id = ?', args: [decoded.userId, friendId] });
    res.json({ message: 'Connected successfully!' });
  } catch (err) {
    console.error('Connect error:', err);
    res.status(500).json({ error: 'Connection failed' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const result = await db.execute({ sql: 'SELECT id, name FROM users WHERE email = ?', args: [email] });
    if (result.rows.length === 0) return res.json({ message: 'If that email exists, a reset link has been sent.' });
    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 60 * 60 * 1000;
    await db.execute({ sql: 'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?', args: [resetToken, expiry, user.id] });
    const frontendUrl = process.env.FRONTEND_URL || 'https://bond-app.vercel.app';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
    await sendEmail({
      to: email,
      subject: '🔐 Reset your Bond App password',
      html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;"><h2 style="color:#6366f1;">Bond App — Password Reset</h2><p>Hi ${user.name},</p><p>Click the button below to reset your password:</p><a href="${resetLink}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Reset My Password</a><p style="color:#888;font-size:13px;">Expires in 1 hour.</p></div>`,
    });
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
});

// GET /api/auth/verify-reset-token
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.json({ valid: false });
    const result = await db.execute({ sql: 'SELECT id, reset_token_expiry FROM users WHERE reset_token = ?', args: [token] });
    if (result.rows.length === 0) return res.json({ valid: false });
    if (Date.now() > result.rows[0].reset_token_expiry) return res.json({ valid: false });
    res.json({ valid: true });
  } catch {
    res.json({ valid: false });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
    const result = await db.execute({ sql: 'SELECT id, reset_token_expiry FROM users WHERE reset_token = ?', args: [token] });
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired reset link' });
    if (Date.now() > result.rows[0].reset_token_expiry) return res.status(400).json({ error: 'Reset link expired. Please request a new one.' });
    const hashed = await bcrypt.hash(password, 10);
    await db.execute({ sql: 'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?', args: [hashed, result.rows[0].id] });
    res.json({ message: 'Password reset successfully!' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

module.exports = router;
