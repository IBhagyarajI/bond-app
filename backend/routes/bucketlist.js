const express = require("express");
const router  = express.Router();
const { client, getBondId } = require("../db");
const { notifyBucketComplete } = require("../notifications");

router.get("/", async (req, res) => {
  try {
    const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = userRes.rows[0];
    if (!user?.friend_id) return res.status(400).json({ error: "Not bonded yet" });
    const bondId = getBondId(Number(user.id), Number(user.friend_id));
    const result = await client.execute({
      sql:  `SELECT b.*, u.name as creator_name, u.avatar_color as creator_color FROM bucket_list b JOIN users u ON b.created_by = u.id WHERE b.bond_id = ? ORDER BY b.completed ASC, b.created_at DESC`,
      args: [bondId],
    });
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = userRes.rows[0];
    if (!user?.friend_id) return res.status(400).json({ error: "Not bonded yet" });
    const bondId = getBondId(Number(user.id), Number(user.friend_id));
    const result = await client.execute({
      sql:  `INSERT INTO bucket_list (bond_id, created_by, title, description, category) VALUES (?, ?, ?, ?, ?)`,
      args: [bondId, req.userId, title, description || null, category || "adventure"],
    });
    const item = await client.execute({
      sql:  `SELECT b.*, u.name as creator_name, u.avatar_color as creator_color FROM bucket_list b JOIN users u ON b.created_by = u.id WHERE b.id = ?`,
      args: [Number(result.lastInsertRowid)],
    });
    res.json(item.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id/complete", async (req, res) => {
  try {
    const itemRes = await client.execute({ sql: "SELECT * FROM bucket_list WHERE id = ?", args: [req.params.id] });
    const item = itemRes.rows[0];
    if (!item) return res.status(404).json({ error: "Not found" });
    const now = new Date().toISOString();
    await client.execute({ sql: "UPDATE bucket_list SET completed = 1, completed_at = ? WHERE id = ?", args: [now, req.params.id] });
    const updated = await client.execute({
      sql:  `SELECT b.*, u.name as creator_name, u.avatar_color as creator_color FROM bucket_list b JOIN users u ON b.created_by = u.id WHERE b.id = ?`,
      args: [req.params.id],
    });
    // Notify friend
    notifyBucketComplete(client, req.userId, item.title).catch(() => {});
    res.json(updated.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await client.execute({ sql: "DELETE FROM bucket_list WHERE id = ?", args: [req.params.id] });
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
