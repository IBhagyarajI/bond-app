const rateLimit = require("express-rate-limit");

// ── Rate limiters ─────────────────────────────────────────────────────────────

// Auth endpoints — strict (login, register, forgot password)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

// AI endpoints — moderate (costs money to spam)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: "Too many AI requests. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

// General API — loose
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

// ── Input sanitiser ───────────────────────────────────────────────────────────
function sanitise(value, maxLength = 500) {
  if (typeof value !== "string") return value;
  return value.trim().slice(0, maxLength);
}

function validateAuth(req, res, next) {
  const { name, email, password } = req.body;

  if (email && (typeof email !== "string" || email.length > 200 || !email.includes("@")))
    return res.status(400).json({ error: "Invalid email address" });

  if (password && (typeof password !== "string" || password.length < 6 || password.length > 128))
    return res.status(400).json({ error: "Password must be 6–128 characters" });

  if (name && (typeof name !== "string" || name.trim().length === 0 || name.length > 60))
    return res.status(400).json({ error: "Name must be 1–60 characters" });

  // Sanitise in place
  if (req.body.email)    req.body.email    = sanitise(req.body.email, 200).toLowerCase();
  if (req.body.name)     req.body.name     = sanitise(req.body.name, 60);
  if (req.body.password) req.body.password = req.body.password.slice(0, 128);

  next();
}

function validateMemory(req, res, next) {
  const { title, description, emoji, memory_date } = req.body;
  if (!title || typeof title !== "string" || title.trim().length === 0)
    return res.status(400).json({ error: "Title is required" });
  if (title.length > 120)
    return res.status(400).json({ error: "Title must be under 120 characters" });
  if (description && description.length > 2000)
    return res.status(400).json({ error: "Description must be under 2000 characters" });

  req.body.title       = sanitise(title, 120);
  req.body.description = description ? sanitise(description, 2000) : "";
  req.body.emoji       = emoji ? sanitise(emoji, 10) : "✨";

  next();
}

function validateBucket(req, res, next) {
  const { title, description } = req.body;
  if (!title || typeof title !== "string" || title.trim().length === 0)
    return res.status(400).json({ error: "Title is required" });
  if (title.length > 200)
    return res.status(400).json({ error: "Title must be under 200 characters" });

  req.body.title       = sanitise(title, 200);
  req.body.description = description ? sanitise(description, 1000) : "";
  next();
}

function validateCheckin(req, res, next) {
  const { mood, message } = req.body;
  if (!mood || typeof mood !== "number" || mood < 1 || mood > 5)
    return res.status(400).json({ error: "Mood must be a number between 1 and 5" });
  req.body.message = message ? sanitise(message, 1000) : "";
  next();
}

module.exports = { authLimiter, aiLimiter, generalLimiter, validateAuth, validateMemory, validateBucket, validateCheckin };
