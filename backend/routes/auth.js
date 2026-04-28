const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { client } = require("../db");

// Send email via Resend
async function sendResetEmail(toEmail, toName, resetUrl) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set on Render");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({
      from: "Bond App <onboarding@resend.dev>",
      to: [toEmail],
      subject: "Reset your Bond password 🔗",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h1 style="color:#e8b86d;font-size:28px;margin-bottom:4px;">🔗 Bond</h1>
          <p style="color:#333;font-size:15px;">Hi ${toName},</p>
          <p style="color:#555;line-height:1.7;font-size:15px;">
            Someone requested a password reset for your Bond account.
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
          <p style="color:#999;font-size:13px;">
            ⏱ This link expires in <strong>1 hour</strong>.<br/>
            If you didn't request this, just ignore this email — nothing will change.
          </p>
          <p style="color:#ccc;font-size:12px;border-top:1px solid #eee;padding-top:16px;margin-top:24px;">
            — The Bond App · Made with ♥ for close friendships
          </p>
        </div>
      `
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || data?.name || JSON.stringify(data));
  return data;
}

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const result = await client.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
    const user = result.rows[0];

    // Always say success — never reveal if email exists (security best practice)
    if (!user) return res.json({ message: "If that email exists, a reset link has been sent." });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await client.execute({ sql: "DELETE FROM password_resets WHERE email = ?", args: [email] });
    await client.execute({
      sql: "INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)",
      args: [email, token, expiresAt]
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

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
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and password required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const tokenRes = await client.execute({
      sql: "SELECT * FROM password_resets WHERE token = ? AND used = 0", args: [token]
    });
    const record = tokenRes.rows[0];
    if (!record) return res.status(400).json({ error: "Invalid or already used reset link" });
    if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: "Reset link expired. Please request a new one." });

    const hashed = await bcrypt.hash(password, 10);
    await client.execute({ sql: "UPDATE users SET password = ? WHERE email = ?", args: [hashed, record.email] });
    await client.execute({ sql: "UPDATE password_resets SET used = 1 WHERE token = ?", args: [token] });

    res.json({ message: "Password reset successfully! You can now log in." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/verify-reset-token ──────────────────────────────────────────
router.get("/verify-reset-token", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.json({ valid: false });
    const tokenRes = await client.execute({
      sql: "SELECT * FROM password_resets WHERE token = ? AND used = 0", args: [token]
    });
    const record = tokenRes.rows[0];
    if (!record || new Date(record.expires_at) < new Date()) return res.json({ valid: false });
    res.json({ valid: true });
  } catch (err) {
    res.status(500).json({ valid: false });
  }
});

module.exports = router;
