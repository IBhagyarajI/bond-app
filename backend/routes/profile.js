const express = require("express");
const router  = express.Router();
const { client } = require("../db");
const { notifyProfileUpdate } = require("../notifications");

async function updateProfile(req, res) {
  try {
    const updates = [];
    const args    = [];
    const { name, photo_url, url, push_token } = req.body;
    const photoVal = photo_url !== undefined ? photo_url : url;
    let photoUpdated = false;

    if (name !== undefined) {
      const clean = String(name).trim().slice(0, 60);
      if (!clean) return res.status(400).json({ error: "Name cannot be empty" });
      updates.push("name = ?");
      args.push(clean);
    }
    if (photoVal !== undefined) {
      updates.push("photo_url = ?");
      args.push(photoVal || null);
      photoUpdated = !!photoVal;
    }
    if (push_token !== undefined) {
      updates.push("push_token = ?");
      args.push(push_token);
    }
    if (updates.length === 0)
      return res.status(400).json({ error: "Nothing to update" });

    args.push(req.userId);
    await client.execute({ sql: `UPDATE users SET ${updates.join(", ")} WHERE id = ?`, args });

    const result = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user   = result.rows[0];
    let friend   = null;
    if (user.friend_id) {
      const fr = await client.execute({ sql: "SELECT id, name, email, avatar_color, photo_url FROM users WHERE id = ?", args: [user.friend_id] });
      friend = fr.rows[0] || null;
    }

    // Notify friend if photo was updated
    if (photoUpdated) {
      notifyProfileUpdate(client, req.userId).catch(() => {});
    }

    res.json({
      id: Number(user.id), name: user.name, email: user.email,
      invite_code: user.invite_code, avatar_color: user.avatar_color,
      photo_url: user.photo_url || null,
      friend_id: user.friend_id, bond_start_date: user.bond_start_date, friend,
    });
  } catch (err) {
    console.error("Update profile error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

router.patch("/update-profile",    updateProfile);
router.post("/upload-profile-pic", updateProfile);
router.patch("/update-name",       updateProfile);

module.exports = router;
