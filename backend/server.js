require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const jwt     = require("jsonwebtoken");
const bcrypt  = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { client, getBondId, initDB } = require("./db");
const {
  authLimiter, aiLimiter, generalLimiter,
  validateAuth, validateMemory, validateBucket, validateCheckin
} = require("./middleware");

const app        = express();
app.set('trust proxy', 1);
const PORT       = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "bond_secret_key";

if (!process.env.JWT_SECRET) console.warn("⚠️  JWT_SECRET not set — using default (unsafe in production)");
if (!process.env.GROQ_API_KEY) console.warn("⚠️  GROQ_API_KEY not set");

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (origin.startsWith("http://localhost")) return cb(null, true);
    if (origin.includes("vercel.app")) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));

// Apply general rate limit to everything
app.use(generalLimiter);

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

const AVATAR_COLORS = ["#e8b86d","#e87d6d","#6de8b8","#6d9ee8","#c46de8","#e86dc4","#8de86d","#e8d36d"];

// ── REGISTER ─────────────────────────────────────────────────────────────────
app.post("/api/auth/register", authLimiter, validateAuth, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields required" });

    const existing = await client.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] });
    if (existing.rows[0]) return res.status(409).json({ error: "Email already registered" });

    const hashed      = await bcrypt.hash(password, 12); // 12 rounds — stronger than 10
    const invite_code = uuidv4().slice(0, 8).toUpperCase();
    const avatar_color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const result = await client.execute({
      sql:  "INSERT INTO users (name, email, password, invite_code, avatar_color) VALUES (?, ?, ?, ?, ?)",
      args: [name, email, hashed, invite_code, avatar_color],
    });

    const token = jwt.sign({ id: Number(result.lastInsertRowid), name, email }, JWT_SECRET, { expiresIn: "90d" });
    res.json({ token, user: { id: Number(result.lastInsertRowid), name, email, invite_code, avatar_color, friend_id: null } });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
app.post("/api/auth/login", authLimiter, validateAuth, async (req, res) => {
  try {
    const { email, password, remember } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const result = await client.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
    const user = result.rows[0];
    // Don't reveal if email exists — same error for both cases
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    let friend = null;
    if (user.friend_id) {
      const fr = await client.execute({ sql: "SELECT id, name, email, avatar_color FROM users WHERE id = ?", args: [user.friend_id] });
      friend = fr.rows[0] || null;
    }

    const expiresIn = remember === false ? "1d" : "90d";
    const token = jwt.sign({ id: Number(user.id), name: user.name, email: user.email }, JWT_SECRET, { expiresIn });

    res.json({
      token,
      user: {
        id: Number(user.id), name: user.name, email: user.email,
        invite_code: user.invite_code, avatar_color: user.avatar_color,
        friend_id: user.friend_id, bond_start_date: user.bond_start_date, friend,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET ME ────────────────────────────────────────────────────────────────────
app.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    const result = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    let friend = null;
    if (user.friend_id) {
      const fr = await client.execute({ sql: "SELECT id, name, email, avatar_color FROM users WHERE id = ?", args: [user.friend_id] });
      friend = fr.rows[0] || null;
    }
    res.json({ id: Number(user.id), name: user.name, email: user.email, invite_code: user.invite_code, avatar_color: user.avatar_color, friend_id: user.friend_id, bond_start_date: user.bond_start_date, friend });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── CONNECT FRIEND ────────────────────────────────────────────────────────────
app.post("/api/auth/connect", authenticate, async (req, res) => {
  try {
    const invite_code = String(req.body.invite_code || "").toUpperCase().trim().slice(0, 8);
    if (invite_code.length !== 8) return res.status(400).json({ error: "Invalid invite code format" });

    const curRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const currentUser = curRes.rows[0];
    if (currentUser.friend_id) return res.status(400).json({ error: "Already bonded" });

    const frRes = await client.execute({ sql: "SELECT * FROM users WHERE invite_code = ?", args: [invite_code] });
    const friend = frRes.rows[0];
    if (!friend) return res.status(404).json({ error: "Invalid invite code" });
    if (Number(friend.id) === req.userId) return res.status(400).json({ error: "Cannot bond with yourself" });
    if (friend.friend_id) return res.status(400).json({ error: "This person is already bonded" });

    const bondDate = new Date().toISOString().split("T")[0];
    await client.execute({ sql: "UPDATE users SET friend_id = ?, bond_start_date = ? WHERE id = ?", args: [friend.id, bondDate, req.userId] });
    await client.execute({ sql: "UPDATE users SET friend_id = ?, bond_start_date = ? WHERE id = ?", args: [req.userId, bondDate, friend.id] });

    const updated = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const u = updated.rows[0];
    res.json({
      message: "Bonded!",
      user: { id: Number(u.id), name: u.name, email: u.email, invite_code: u.invite_code, avatar_color: u.avatar_color, friend_id: u.friend_id, bond_start_date: u.bond_start_date, friend: { id: Number(friend.id), name: friend.name, email: friend.email, avatar_color: friend.avatar_color } },
    });
  } catch (err) {
    console.error("Connect error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ── PASSWORD RESET ROUTES ─────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use('/api/users', require('./routes/users'));

// ── AI HEALTH (public) ────────────────────────────────────────────────────────
app.get("/api/ai/health", async (req, res) => {
  try {
    const key = process.env.GROQ_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: "GROQ_API_KEY not set" });
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: "Say: AI is working" }], max_tokens: 20 }),
    });
    const d = await r.json();
    if (!r.ok) return res.status(500).json({ ok: false, error: d?.error?.message });
    res.json({ ok: true, response: d.choices?.[0]?.message?.content });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── ADMIN ROUTES ──────────────────────────────────────────────────────────────
app.post("/api/admin/clear-all", async (req, res) => {
  try {
    const { secret } = req.body;
    if (!secret || secret !== process.env.ADMIN_SECRET)
      return res.status(403).json({ error: "Forbidden" });
    await client.execute({ sql: "DELETE FROM checkins",        args: [] });
    await client.execute({ sql: "DELETE FROM memories",        args: [] });
    await client.execute({ sql: "DELETE FROM bucket_list",     args: [] });
    await client.execute({ sql: "DELETE FROM password_resets", args: [] });
    await client.execute({ sql: "UPDATE users SET friend_id = NULL, bond_start_date = NULL", args: [] });
    res.json({ message: "All data cleared." });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/admin/delete-user", async (req, res) => {
  try {
    const { secret, email } = req.body;
    if (!secret || secret !== process.env.ADMIN_SECRET)
      return res.status(403).json({ error: "Forbidden" });
    const sanitisedEmail = String(email || "").toLowerCase().trim().slice(0, 200);
    const userRes = await client.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [sanitisedEmail] });
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.friend_id)
      await client.execute({ sql: "UPDATE users SET friend_id = NULL, bond_start_date = NULL WHERE id = ?", args: [user.friend_id] });
    await client.execute({ sql: "DELETE FROM users WHERE id = ?",             args: [user.id] });
    await client.execute({ sql: "DELETE FROM password_resets WHERE email = ?", args: [sanitisedEmail] });
    res.json({ message: `User ${sanitisedEmail} deleted.` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── FEATURE ROUTES ────────────────────────────────────────────────────────────
app.use("/api/memories", authenticate, require("./routes/memories"));
app.use("/api/bucket",   authenticate, require("./routes/bucketlist"));
app.use("/api/ai",       authenticate, aiLimiter, require("./routes/ai"));

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", app: "Bond API" }));

// ── 404 — always JSON ─────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Not found: " + req.method + " " + req.path }));

// ── GLOBAL ERROR HANDLER ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ── START ─────────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => console.log(`🔗 Bond API running on http://localhost:${PORT}`));
}).catch(err => {
  console.error("Failed to init DB:", err);
  process.exit(1);
});
