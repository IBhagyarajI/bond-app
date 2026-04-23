const express = require("express");
const router = express.Router();
const { db, getBondId } = require("../db");

// Get all memories for a bond
router.get("/", (req, res) => {
  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    if (!user.friend_id)
      return res.status(400).json({ error: "You are not bonded with anyone yet" });

    const bondId = getBondId(user.id, user.friend_id);
    const memories = db
      .prepare(`SELECT m.*, u.name as creator_name, u.avatar_color as creator_color
                FROM memories m JOIN users u ON m.created_by = u.id
                WHERE m.bond_id = ? ORDER BY m.memory_date DESC, m.created_at DESC`)
      .all(bondId);

    res.json(memories);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Add a memory
router.post("/", (req, res) => {
  try {
    const { title, description, image_url, memory_date, emoji } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    if (!user.friend_id)
      return res.status(400).json({ error: "You are not bonded with anyone yet" });

    const bondId = getBondId(user.id, user.friend_id);
    const result = db
      .prepare(`INSERT INTO memories (bond_id, created_by, title, description, image_url, memory_date, emoji)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(bondId, req.userId, title, description || null, image_url || null,
           memory_date || new Date().toISOString().split("T")[0], emoji || "✨");

    const memory = db.prepare(`SELECT m.*, u.name as creator_name, u.avatar_color as creator_color
                               FROM memories m JOIN users u ON m.created_by = u.id
                               WHERE m.id = ?`).get(result.lastInsertRowid);
    res.json(memory);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a memory
router.delete("/:id", (req, res) => {
  try {
    const memory = db.prepare("SELECT * FROM memories WHERE id = ?").get(req.params.id);
    if (!memory) return res.status(404).json({ error: "Memory not found" });
    if (memory.created_by !== req.userId)
      return res.status(403).json({ error: "You can only delete your own memories" });

    db.prepare("DELETE FROM memories WHERE id = ?").run(req.params.id);
    res.json({ message: "Memory deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
