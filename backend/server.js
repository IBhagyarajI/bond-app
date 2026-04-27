require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { db } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "bond_secret_key_change_in_production";

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000"
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.startsWith("http://localhost")) return callback(null, true);
    if (origin.includes("vercel.app")) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json());

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

// PUBLIC: Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields are required" });
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const hashed = await bcrypt.hash(password, 10);
    const invite_code = uuidv4().slice(0, 8).toUpperCase();
    const avatar_color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const result = db
      .prepare("INSERT INTO users (name, email, password, invite_code, avatar_color) VALUES (?, ?, ?, ?, ?)")
      .run(name, email, hashed, invite_code, avatar_color);
    const token = jwt.sign({ id: result.lastInsertRowid, name, email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: result.lastInsertRowid, name, email, invite_code, avatar_color, friend_id: null } });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

// PUBLIC: Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    let friend = null;
    if (user.friend_id)
      friend = db.prepare("SELECT id, name, email, avatar_color FROM users WHERE id = ?").get(user.friend_id);
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, invite_code: user.invite_code, avatar_color: user.avatar_color, friend_id: user.friend_id, bond_start_date: user.bond_start_date, friend } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

// PROTECTED: Get current user
app.get("/api/auth/me", authenticate, (req, res) => {
  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    let friend = null;
    if (user.friend_id)
      friend = db.prepare("SELECT id, name, email, avatar_color FROM users WHERE id = ?").get(user.friend_id);
    res.json({ id: user.id, name: user.name, email: user.email, invite_code: user.invite_code, avatar_color: user.avatar_color, friend_id: user.friend_id, bond_start_date: user.bond_start_date, friend });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// PROTECTED: Connect with friend
app.post("/api/auth/connect", authenticate, (req, res) => {
  try {
    const { invite_code } = req.body;
    const currentUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    if (currentUser.friend_id) return res.status(400).json({ error: "You are already bonded with someone" });
    const friend = db.prepare("SELECT * FROM users WHERE invite_code = ?").get(invite_code);
    if (!friend) return res.status(404).json({ error: "Invalid invite code" });
    if (friend.id === req.userId) return res.status(400).json({ error: "You cannot bond with yourself" });
    if (friend.friend_id) return res.status(400).json({ error: "This person is already bonded" });
    const bondDate = new Date().toISOString().split("T")[0];
    db.prepare("UPDATE users SET friend_id = ?, bond_start_date = ? WHERE id = ?").run(friend.id, bondDate, req.userId);
    db.prepare("UPDATE users SET friend_id = ?, bond_start_date = ? WHERE id = ?").run(req.userId, bondDate, friend.id);
    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    res.json({ message: "Bonded!", user: { id: updated.id, name: updated.name, email: updated.email, invite_code: updated.invite_code, avatar_color: updated.avatar_color, friend_id: updated.friend_id, bond_start_date: updated.bond_start_date, friend: { id: friend.id, name: friend.name, email: friend.email, avatar_color: friend.avatar_color } } });
  } catch (err) {
    console.error("Connect error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Feature routes
app.use("/api/memories", authenticate, require("./routes/memories"));
app.use("/api/bucket",   authenticate, require("./routes/bucketlist"));
// Public AI health check (Groq)
app.get("/api/ai/health", async (req, res) => {
  try {
    const key = process.env.GROQ_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: "GROQ_API_KEY not set on Render" });
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model: "llama3-8b-8192", messages: [{ role: "user", content: "Say exactly three words: AI is working" }], max_tokens: 20 })
    });
    const d = await r.json();
    if (!r.ok) return res.status(500).json({ ok: false, error: d?.error?.message });
    res.json({ ok: true, response: d.choices?.[0]?.message?.content });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
app.use("/api/ai",       authenticate, require("./routes/ai"));

// Health check (public)
app.get("/health", (req, res) => res.json({ status: "ok" }));


app.listen(PORT, () => console.log(`🔗 Bond API running on http://localhost:${PORT}`));
