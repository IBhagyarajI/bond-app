const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { db } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "bond_secret_key_change_in_production";

const AVATAR_COLORS = [
  "#e8b86d", "#e87d6d", "#6de8b8", "#6d9ee8", "#c46de8",
  "#e86dc4", "#8de86d", "#e8d36d"
];

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields are required" });

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing)
      return res.status(409).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const invite_code = uuidv4().slice(0, 8).toUpperCase();
    const avatar_color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const result = db
      .prepare("INSERT INTO users (name, email, password, invite_code, avatar_color) VALUES (?, ?, ?, ?, ?)")
      .run(name, email, hashed, invite_code, avatar_color);

    const token = jwt.sign({ id: result.lastInsertRowid, name, email }, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      token,
      user: { id: result.lastInsertRowid, name, email, invite_code, avatar_color, friend_id: null }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    // Get friend info if bonded
    let friend = null;
    if (user.friend_id) {
      friend = db.prepare("SELECT id, name, email, avatar_color FROM users WHERE id = ?").get(user.friend_id);
    }

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        invite_code: user.invite_code, avatar_color: user.avatar_color,
        friend_id: user.friend_id, bond_start_date: user.bond_start_date,
        friend
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Connect with friend using invite code
router.post("/connect", (req, res) => {
  try {
    const { invite_code } = req.body;
    const userId = req.userId;

    const currentUser = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (currentUser.friend_id)
      return res.status(400).json({ error: "You are already bonded with someone" });

    const friend = db.prepare("SELECT * FROM users WHERE invite_code = ?").get(invite_code);
    if (!friend) return res.status(404).json({ error: "Invalid invite code" });
    if (friend.id === userId) return res.status(400).json({ error: "You cannot bond with yourself" });
    if (friend.friend_id) return res.status(400).json({ error: "This person is already bonded with someone" });

    const bondDate = new Date().toISOString().split("T")[0];

    db.prepare("UPDATE users SET friend_id = ?, bond_start_date = ? WHERE id = ?").run(friend.id, bondDate, userId);
    db.prepare("UPDATE users SET friend_id = ?, bond_start_date = ? WHERE id = ?").run(userId, bondDate, friend.id);

    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

    res.json({
      message: "Bonded successfully!",
      user: {
        id: updatedUser.id, name: updatedUser.name, email: updatedUser.email,
        invite_code: updatedUser.invite_code, avatar_color: updatedUser.avatar_color,
        friend_id: updatedUser.friend_id, bond_start_date: updatedUser.bond_start_date,
        friend: { id: friend.id, name: friend.name, email: friend.email, avatar_color: friend.avatar_color }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get current user
router.get("/me", (req, res) => {
  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let friend = null;
    if (user.friend_id) {
      friend = db.prepare("SELECT id, name, email, avatar_color FROM users WHERE id = ?").get(user.friend_id);
    }

    res.json({
      id: user.id, name: user.name, email: user.email,
      invite_code: user.invite_code, avatar_color: user.avatar_color,
      friend_id: user.friend_id, bond_start_date: user.bond_start_date,
      friend
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
