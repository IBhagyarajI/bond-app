const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@libsql/client');
const crypto = require('crypto');

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'accept': 'application/json', 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ sender: { name: 'Bond App', email: process.env.BREVO_SENDER_EMAIL }, to: [{ email: to }], subject, htmlContent: html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
}

async function getUserById(id) {
  const result = await db.execute({
    sql: `SELECT u.id, u.name, u.email, u.invite_code, u.friend_id, u.profile_pic, u.avatar_color, u.bond_start_date,
               f.name as friend_name, f.profile_pic as friend_profile_pic, f.avatar_color as friend_avatar_color
          FROM users u LEFT JOIN users f ON u.friend_id = f.id WHERE u.id = ?`,
    args: [id],
  });
  if (!result.rows.length) return null;
  const u = result.rows[0];
  return {
    id: u.id, name: u.name, email: u.email,
    invite_code: u.invite_code, friend_id: u.friend_id,
    profile_pic: u.profile_pic, avatar_color: u.avatar_color, bond_start_date: u.bond_start_date,
    friend: u.friend_id ? { name: u.friend_name, profile_pic: u.friend_profile_pic, avatar_color: u.friend_avatar_color } : null,
  };
}

router.get('/me', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const user = await getUserById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { console.error('Me error:', err); res.status(401).json({ error: 'Invalid token' }); }
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
    if (existing.rows.length) return res.status(400).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    await db.execute({ sql: 'INSERT INTO users (name, email, password, invite_code) VALUES (?, ?, ?, ?)', args: [name, email, hashed, inviteCode] });
    const newUser = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
    const user = await getUserById(newUser.rows[0].id);
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '90d' });
    res.json({ token, user });
  } catch (err) { console.error('Register error:', err); res.status(500).json({ error: 'Registration failed' }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, remember } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid email or password' });
    const row = result.rows[0];
    if (!await bcrypt.compare(password, row.password)) return res.status(401).json({ error: 'Invalid email or password' });
    const expiry = remember === false ? '1d' : '90d';
    const token = jwt.sign({ userId: row.id }, process.env.JWT_SECRET, { expiresIn: expiry });
    const user = await getUserById(row.id);
    res.json({ token, user });
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Login failed' }); }
});

router.post('/connect', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const { invite_code } = req.body;
    if (!invite_code) return res.status(400).json({ error: 'Invite code required' });
    const friendResult = await db.execute({ sql: 'SELECT id FROM users WHERE invite_code = ?', args: [invite_code.toUpperCase()] });
    if (!friendResult.rows.length) return res.status(404).json({ error: 'Invalid invite code' });
    const friendId = friendResult.rows[0].id;
    if (friendId === decoded.userId) return res.status(400).json({ error: "Can't connect with yourself" });
    const now = new Date().toISOString().slice(0, 10);
    await db.execute({ sql: 'UPDATE users SET friend_id = ?, bond_start_date = ? WHERE id = ?', args: [friendId, now, decoded.userId] });
    await db.execute({ sql: 'UPDATE users SET friend_id = ?, bond_start_date = ? WHERE id = ?', args: [decoded.userId, now, friendId] });
    const user = await getUserById(decoded.userId);
    res.json({ message: 'Connected!', user });
  } catch (err) { console.error('Connect error:', err); res.status(500).json({ error: 'Connection failed' }); }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const result = await db.execute({ sql: 'SELECT id, name FROM users WHERE email = ?', args: [email] });
    if (!result.rows.length) return res.json({ message: 'If that email exists, a reset link has been sent.' });
    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 60 * 60 * 1000;
    await db.execute({ sql: 'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?', args: [resetToken, expiry, user.id] });
    const resetLink = `${process.env.FRONTEND_URL || 'https://bond-app.vercel.app'}/reset-password?token=${resetToken}`;
    await sendEmail({ to: email, subject: 'Reset your Bond password', html: `<p>Hi ${user.name},</p><a href="${resetLink}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">Reset My Password</a><p style="color:#888;font-size:13px">Expires in 1 hour.</p>` });
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) { console.error('Forgot pw error:', err); res.status(500).json({ error: 'Failed to send email.' }); }
});

router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.json({ valid: false });
    const result = await db.execute({ sql: 'SELECT reset_token_expiry FROM users WHERE reset_token = ?', args: [token] });
    if (!result.rows.length || Date.now() > result.rows[0].reset_token_expiry) return res.json({ valid: false });
    res.json({ valid: true });
  } catch { res.json({ valid: false }); }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    const result = await db.execute({ sql: 'SELECT id, reset_token_expiry FROM users WHERE reset_token = ?', args: [token] });
    if (!result.rows.length) return res.status(400).json({ error: 'Invalid or expired link' });
    if (Date.now() > result.rows[0].reset_token_expiry) return res.status(400).json({ error: 'Link expired.' });
    const hashed = await bcrypt.hash(password, 10);
    await db.execute({ sql: 'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?', args: [hashed, result.rows[0].id] });
    res.json({ message: 'Password reset successfully!' });
  } catch (err) { console.error('Reset error:', err); res.status(500).json({ error: 'Reset failed' }); }
});

router.patch('/update-name', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
    await db.execute({ sql: 'UPDATE users SET name = ? WHERE id = ?', args: [name.trim(), decoded.userId] });
    res.json({ name: name.trim() });
  } catch (err) { console.error('Update name error:', err); res.status(500).json({ error: 'Update failed' }); }
});

module.exports = router;
