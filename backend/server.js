require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const authRoutes = require("./routes/auth");
const memoriesRoutes = require("./routes/memories");
const bucketRoutes = require("./routes/bucketlist");
const aiRoutes = require("./routes/ai");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "bond_secret_key_change_in_production";

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// Auth middleware
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Public auth routes (no token needed)
app.post("/api/auth/register", (req, res, next) => {
  req.url = "/register"; authRoutes(req, res, next);
});
app.post("/api/auth/login", (req, res, next) => {
  req.url = "/login"; authRoutes(req, res, next);
});

// Protected routes
app.use("/api/auth", authenticate, authRoutes);
app.use("/api/memories", authenticate, memoriesRoutes);
app.use("/api/bucket", authenticate, bucketRoutes);
app.use("/api/ai", authenticate, aiRoutes);

// Health check
app.get("/health", (req, res) => res.json({ status: "ok", app: "Bond API" }));

app.listen(PORT, () => {
  console.log(`🔗 Bond API running on http://localhost:${PORT}`);
});
