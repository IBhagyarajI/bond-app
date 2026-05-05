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

// Helper: send email via Brevo HTTP API (no SMTP, no ports, works on Render)
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not set in environment variables');

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@bond-app.com';

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Bond App', email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Brevo API error: ${JSON.stringify(data)}`);
  return data;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email, and password are required' });

    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
    if (existing.rows.length > 0)
      return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    await db.execute({
      sql: 'INSERT INTO users (name, email, password, invite_code) VALUES (?, ?, ?, ?)',
      args: [name, email, hashedPassword, inviteCode],
    });

    const user = await db.execute({ sql: 'SELECT id, name, email, invite_code, friend_id FROM users WHERE email = ?', args: [email] });
    const userData = user.rows[0];
    const token = jwt.sign({ userId: userData.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: userData.id, name: userData.name, email: userData.email, inviteCode: userData.invite_code, friendId: userData.friend_id } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Invalid email or password' });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, inviteCode: user.invite_code, friendId: user.friend_id } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/connect
router.post('/connect', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ error: 'Invite code is required' });

    const friendResult = await db.execute({ sql: 'SELECT id FROM users WHERE invite_code = ?', args: [inviteCode.toUpperCase()] });
    if (friendResult.rows.length === 0)
      return res.status(404).json({ error: 'Invalid invite code' });

    const friendId = friendResult.rows[0].id;
    if (friendId === userId)
      return res.status(400).json({ error: "You can't connect with yourself" });

    await db.execute({ sql: 'UPDATE users SET friend_id = ? WHERE id = ?', args: [friendId, userId] });
    await db.execute({ sql: 'UPDATE users SET friend_id = ? WHERE id = ?', args: [userId, friendId] });

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

    // Always return success even if email not found (security best practice)
    if (result.rows.length === 0)
      return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour

    await db.execute({
      sql: 'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
      args: [resetToken, expiry, user.id],
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://bond-app.vercel.app';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: email,
      subject: '🔐 Reset your Bond App password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #6366f1;">Bond App — Password Reset</h2>
          <p>Hi ${user.name},</p>
          <p>Someone requested a password reset for your account. If that was you, click the button below:</p>
          <a href="${resetLink}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
            Reset My Password
          </a>
          <p style="color:#888;font-size:13px;">This link expires in 1 hour. If you didn't request this, just ignore this email.</p>
        </div>
      `,
    });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
});

// ✅ GET /api/auth/verify-reset-token  ← THIS WAS THE MISSING ROUTE
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.json({ valid: false });

    const result = await db.execute({
      sql: 'SELECT id, reset_token_expiry FROM users WHERE reset_token = ?',
      args: [token],
    });

    if (result.rows.length === 0) return res.json({ valid: false });

    const user = result.rows[0];
    if (Date.now() > user.reset_token_expiry) return res.json({ valid: false });

    res.json({ valid: true });
  } catch (err) {
    console.error('Verify token error:', err);
    res.json({ valid: false });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ error: 'Token and new password are required' });

    const result = await db.execute({
      sql: 'SELECT id, reset_token_expiry FROM users WHERE reset_token = ?',
      args: [token],
    });

    if (result.rows.length === 0)
      return res.status(400).json({ error: 'Invalid or expired reset link' });

    const user = result.rows[0];
    if (Date.now() > user.reset_token_expiry)
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute({
      sql: 'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      args: [hashedPassword, user.id],
    });

    res.json({ message: 'Password reset successfully! You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

module.exports = router;
