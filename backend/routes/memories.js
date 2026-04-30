const express = require("express");
const router = express.Router();
const { client, getBondId } = require("../db");

// GET all memories for a bond
router.get("/", async (req, res) => {
  try {
    const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = userRes.rows[0];
    if (!user?.friend_id) return res.status(400).json({ error: "Not bonded yet" });

    const bondId = getBondId(Number(user.id), Number(user.friend_id));
    const result = await client.execute({
      sql: `SELECT m.*, u.name as creator_name, u.avatar_color as creator_color
            FROM memories m JOIN users u ON m.created_by = u.id
            WHERE m.bond_id = ? ORDER BY m.memory_date DESC, m.created_at DESC`,
      args: [bondId]
    });

    // Parse images and media JSON for every memory
    const memories = result.rows.map(m => ({
      ...m,
      images: (() => { try { return JSON.parse(m.images || '[]') } catch { return [] } })(),
      media:  (() => { try { return JSON.parse(m.media  || '[]') } catch { return [] } })()
    }));

    res.json(memories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST — add a new memory
router.post("/", async (req, res) => {
  try {
    const { title, description, images, media, memory_date, emoji } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = userRes.rows[0];
    if (!user?.friend_id) return res.status(400).json({ error: "Not bonded yet" });

    const bondId = getBondId(Number(user.id), Number(user.friend_id));

    // images = array of URLs, media = array of {url, type} objects
    const imagesArr = Array.isArray(images) ? images.slice(0, 6) : [];
    const mediaArr  = Array.isArray(media)  ? media.slice(0, 6)  :
                      (typeof media === 'string' ? JSON.parse(media || '[]') : []);

    const imagesJson = JSON.stringify(imagesArr);
    const mediaJson  = JSON.stringify(mediaArr);
    const firstImage = imagesArr[0] || null;

    const result = await client.execute({
      sql: `INSERT INTO memories
              (bond_id, created_by, title, description, image_url, images, media, memory_date, emoji)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        bondId, req.userId, title, description || null,
        firstImage, imagesJson, mediaJson,
        memory_date || new Date().toISOString().split("T")[0],
        emoji || "✨"
      ]
    });

    const mem = await client.execute({
      sql: `SELECT m.*, u.name as creator_name, u.avatar_color as creator_color
            FROM memories m JOIN users u ON m.created_by = u.id WHERE m.id = ?`,
      args: [Number(result.lastInsertRowid)]
    });

    const row = mem.rows[0];
    res.json({
      ...row,
      images: (() => { try { return JSON.parse(row.images || '[]') } catch { return [] } })(),
      media:  (() => { try { return JSON.parse(row.media  || '[]') } catch { return [] } })()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE a memory
router.delete("/:id", async (req, res) => {
  try {
    const memRes = await client.execute({ sql: "SELECT * FROM memories WHERE id = ?", args: [req.params.id] });
    const memory = memRes.rows[0];
    if (!memory) return res.status(404).json({ error: "Memory not found" });
    if (Number(memory.created_by) !== req.userId)
      return res.status(403).json({ error: "Can only delete your own memories" });
    await client.execute({ sql: "DELETE FROM memories WHERE id = ?", args: [req.params.id] });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
