const express = require("express");
const router  = express.Router();
const { client, getBondId } = require("../db");
const { notifyMemoryAdded } = require("../notifications");

router.get("/", async (req, res) => {
  try {
    const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = userRes.rows[0];
    if (!user?.friend_id) return res.status(400).json({ error: "Not bonded yet" });
    const bondId = getBondId(Number(user.id), Number(user.friend_id));
    const result = await client.execute({
      sql:  `SELECT m.*, u.name as creator_name, u.avatar_color as creator_color
             FROM memories m JOIN users u ON m.created_by = u.id
             WHERE m.bond_id = ? ORDER BY m.memory_date DESC, m.created_at DESC`,
      args: [bondId],
    });
    const memories = result.rows.map(m => ({
      ...m,
      images: (() => { try { return JSON.parse(m.images || '[]') } catch { return [] } })(),
      media:  (() => { try { return JSON.parse(m.media  || '[]') } catch { return [] } })(),
    }));
    res.json(memories);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  try {
    const { title, description, images, media, memory_date, emoji } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = userRes.rows[0];
    if (!user?.friend_id) return res.status(400).json({ error: "Not bonded yet" });
    const bondId = getBondId(Number(user.id), Number(user.friend_id));
    const imagesArr = Array.isArray(images) ? images.slice(0, 6) : [];
    const mediaArr  = Array.isArray(media)  ? media.slice(0, 6)  :
                      (typeof media === 'string' ? JSON.parse(media || '[]') : []);
    const result = await client.execute({
      sql:  `INSERT INTO memories (bond_id, created_by, title, description, image_url, images, media, memory_date, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [bondId, req.userId, title, description || null, imagesArr[0] || null,
             JSON.stringify(imagesArr), JSON.stringify(mediaArr),
             memory_date || new Date().toISOString().split("T")[0], emoji || "✨"],
    });
    const mem = await client.execute({
      sql:  `SELECT m.*, u.name as creator_name, u.avatar_color as creator_color FROM memories m JOIN users u ON m.created_by = u.id WHERE m.id = ?`,
      args: [Number(result.lastInsertRowid)],
    });
    const row = mem.rows[0];
    // Send notification to friend (non-blocking)
    notifyMemoryAdded(client, req.userId, title).catch(() => {});
    res.json({
      ...row,
      images: (() => { try { return JSON.parse(row.images || '[]') } catch { return [] } })(),
      media:  (() => { try { return JSON.parse(row.media  || '[]') } catch { return [] } })(),
    });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const memRes = await client.execute({ sql: "SELECT * FROM memories WHERE id = ?", args: [req.params.id] });
    const memory = memRes.rows[0];
    if (!memory) return res.status(404).json({ error: "Not found" });
    if (Number(memory.created_by) !== req.userId) return res.status(403).json({ error: "Not your memory" });
    await client.execute({ sql: "DELETE FROM memories WHERE id = ?", args: [req.params.id] });
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
