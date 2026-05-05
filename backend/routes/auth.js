const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const crypto  = require("crypto");
const nodemailer = require("nodemailer");
const { client } = require("../db");

// ── Gmail transporter ─────────────────────────────────────────────────────────
function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("GMAIL_USER or GMAIL_APP_PASSWORD not set on Render");
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

async function sendResetEmail(toEmail, toName, resetUrl) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from:    `"Bond App 🔗" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: "Reset your Bond password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d0d14;border-radius:16px;">
        <h1 style="color:#e8b86d;font-size:28px;margin-bottom:4px;">🔗 Bond</h1>
        <p style="color:#ccc;font-size:15px;">Hi ${toName},</p>
        <p style="color:#aaa;line-height:1.7;font-size:14px;">
          Someone requested a password reset for your Bond account.<br/>
          Click the button below to set a new password.
        </p>
        <div style="margin:28px 0;">
          <a href="${resetUrl}"
             style="display:inline-block;padding:14px 32px;background:#e8b86d;
                    color:#0d0d14;border-radius:50px;text-decoration:none;
                    font-weight:bold;font-size:15px;">
            Reset My Password
          </a>
        </div>
        <p style="color:#666;font-size:13px;">
          ⏱ This link expires in <strong>1 hour</strong>.<br/>
          If you didn't request this, just ignore this email.
        </p>
        <p style="color:#444;font-size:12px;border-top:1px solid #222;padding-top:16px;margin-top:24px;">
          — The Bond App · Made with ♥ for close friendships
        </p>
      </div>
    `,
  });
}

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ error: "Email is required" });

    const result = await client.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
    const user   = result.rows[0];

    // Always return success — never reveal if email exists (security)
    if (!user) return res.json({ message: "If that email exists, a reset link has been sent." });

    const token     = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await client.execute({ sql: "DELETE FROM password_resets WHERE email = ?", args: [email] });
    await client.execute({
      sql:  "INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)",
      args: [email, token, expiresAt],
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl    = `${frontendUrl}/reset-password?token=${token}`;

    await sendResetEmail(email, user.name, resetUrl);
    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ error: "Could not send email: " + err.message });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const token    = String(req.body.token || "");
    const password = String(req.body.password || "");
    if (!token || !password) return res.status(400).json({ error: "Token and password required" });
    if (password.length < 6)  return res.status(400).json({ error: "Password must be at least 6 characters" });

    const tokenRes = await client.execute({
      sql:  "SELECT * FROM password_resets WHERE token = ? AND used = 0",
      args: [token],
    });
    const record = tokenRes.rows[0];
    if (!record) return res.status(400).json({ error: "Invalid or already used reset link" });
    if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: "Reset link expired. Please request a new one." });

    const hashed = await bcrypt.hash(password, 12);
    await client.execute({ sql: "UPDATE users SET password = ? WHERE email = ?", args: [hashed, record.email] });
    await client.execute({ sql: "UPDATE password_resets SET used = 1 WHERE token = ?", args: [token] });

    res.json({ message: "Password reset successfully! You can now log in." });
  } catch (err) {
    console.error("Reset error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/verify-reset-token ──────────────────────────────────────────
router.get("/verify-reset-token", async (req, res) => {
  try {
    const token = String(req.query.token || "");
    if (!token) return res.json({ valid: false });
    const tokenRes = await client.execute({
      sql:  "SELECT * FROM password_resets WHERE token = ? AND used = 0",
      args: [token],
    });
    const record = tokenRes.rows[0];
    if (!record || new Date(record.expires_at) < new Date()) return res.json({ valid: false });
    res.json({ valid: true });
  } catch {
    res.json({ valid: false });
  }
});

module.exports = router;
