const express = require("express");
const router = express.Router();
const { client, getBondId } = require("../db");

router.get("/", async (req, res) => {
  try {
    const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = userRes.rows[0];
    if (!user?.friend_id) return res.status(400).json({ error: "You are not bonded with anyone yet" });

    const bondId = getBondId(Number(user.id), Number(user.friend_id));
    const result = await client.execute({
      sql: `SELECT m.*, u.name as creator_name, u.avatar_color as creator_color
            FROM memories m JOIN users u ON m.created_by = u.id
            WHERE m.bond_id = ? ORDER BY m.memory_date DESC, m.created_at DESC`,
      args: [bondId]
    });
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, description, image_url, memory_date, emoji } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = userRes.rows[0];
    if (!user?.friend_id) return res.status(400).json({ error: "You are not bonded with anyone yet" });

    const bondId = getBondId(Number(user.id), Number(user.friend_id));
    const result = await client.execute({
      sql: `INSERT INTO memories (bond_id, created_by, title, description, image_url, memory_date, emoji)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [bondId, req.userId, title, description || null, image_url || null,
             memory_date || new Date().toISOString().split("T")[0], emoji || "✨"]
    });

    const mem = await client.execute({
      sql: `SELECT m.*, u.name as creator_name, u.avatar_color as creator_color
            FROM memories m JOIN users u ON m.created_by = u.id WHERE m.id = ?`,
      args: [Number(result.lastInsertRowid)]
    });
    res.json(mem.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const memRes = await client.execute({ sql: "SELECT * FROM memories WHERE id = ?", args: [req.params.id] });
    const memory = memRes.rows[0];
    if (!memory) return res.status(404).json({ error: "Memory not found" });
    if (Number(memory.created_by) !== req.userId) return res.status(403).json({ error: "You can only delete your own memories" });
    await client.execute({ sql: "DELETE FROM memories WHERE id = ?", args: [req.params.id] });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
