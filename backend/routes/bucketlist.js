const express = require("express");
const router = express.Router();
const { db, getBondId } = require("../db");

router.get("/", (req, res) => {
  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    if (!user.friend_id)
      return res.status(400).json({ error: "You are not bonded with anyone yet" });

    const bondId = getBondId(user.id, user.friend_id);
    const items = db
      .prepare(`SELECT b.*, u.name as creator_name, u.avatar_color as creator_color
                FROM bucket_list b JOIN users u ON b.created_by = u.id
                WHERE b.bond_id = ? ORDER BY b.completed ASC, b.created_at DESC`)
      .all(bondId);

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    if (!user.friend_id)
      return res.status(400).json({ error: "You are not bonded with anyone yet" });

    const bondId = getBondId(user.id, user.friend_id);
    const result = db
      .prepare(`INSERT INTO bucket_list (bond_id, created_by, title, description, category)
                VALUES (?, ?, ?, ?, ?)`)
      .run(bondId, req.userId, title, description || null, category || "adventure");

    const item = db.prepare(`SELECT b.*, u.name as creator_name, u.avatar_color as creator_color
                             FROM bucket_list b JOIN users u ON b.created_by = u.id
                             WHERE b.id = ?`).get(result.lastInsertRowid);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/complete", (req, res) => {
  try {
    const item = db.prepare("SELECT * FROM bucket_list WHERE id = ?").get(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found" });

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    const bondId = getBondId(user.id, user.friend_id);
    if (item.bond_id !== bondId)
      return res.status(403).json({ error: "Not your bucket list" });

    const now = new Date().toISOString();
    db.prepare("UPDATE bucket_list SET completed = 1, completed_at = ? WHERE id = ?")
      .run(now, req.params.id);

    const updated = db.prepare(`SELECT b.*, u.name as creator_name, u.avatar_color as creator_color
                                FROM bucket_list b JOIN users u ON b.created_by = u.id
                                WHERE b.id = ?`).get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", (req, res) => {
  try {
    const item = db.prepare("SELECT * FROM bucket_list WHERE id = ?").get(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found" });

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    const bondId = getBondId(user.id, user.friend_id);
    if (item.bond_id !== bondId)
      return res.status(403).json({ error: "Not your bucket list" });

    db.prepare("DELETE FROM bucket_list WHERE id = ?").run(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
