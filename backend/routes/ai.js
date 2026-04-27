const express = require("express");
const router = express.Router();
const { db, getBondId } = require("../db");

// Call Groq API directly via fetch — free, fast, no quota issues
async function askGroq(prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set on Render. Get one free at console.groq.com");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.8
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Groq error ${res.status}: ${data?.error?.message || JSON.stringify(data)}`);
  }
  return data.choices?.[0]?.message?.content || "No response from AI";
}

// ── Daily check-in ────────────────────────────────────────────────────────────
router.post("/checkin", async (req, res) => {
  try {
    const { mood, message } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);

    let friend = null, memoriesCount = 0, bucketCount = 0;
    if (user.friend_id) {
      friend = db.prepare("SELECT * FROM users WHERE id = ?").get(user.friend_id);
      const bondId = getBondId(user.id, user.friend_id);
      memoriesCount = db.prepare("SELECT COUNT(*) as c FROM memories WHERE bond_id = ?").get(bondId).c;
      bucketCount   = db.prepare("SELECT COUNT(*) as c FROM bucket_list WHERE bond_id = ? AND completed = 1").get(bondId).c;
    }

    const bondDays = user.bond_start_date
      ? Math.floor((new Date() - new Date(user.bond_start_date)) / (1000 * 60 * 60 * 24))
      : 0;

    const moodLabels = ["", "Really down", "Not great", "Okay", "Pretty good", "Amazing"];
    const prompt = `You are a warm, emotionally intelligent friendship companion for the app "Bond".
User: ${user.name}
Their friend: ${friend ? friend.name : "not bonded yet"}
Bond duration: ${bondDays} days
Memories together: ${memoriesCount}
Bucket list completed: ${bucketCount}
Today's mood: ${moodLabels[mood] || mood}/5
Message: "${message || "No message"}"
Write a warm, personal response in 2-3 short paragraphs that acknowledges their mood genuinely, says something meaningful about their friendship journey, and gives one small actionable suggestion to connect today. Be human and avoid generic advice.`;

    const aiText = await askGroq(prompt);

    if (user.friend_id) {
      const bondId = getBondId(user.id, user.friend_id);
      db.prepare("INSERT INTO checkins (bond_id, created_by, mood, message, ai_response) VALUES (?, ?, ?, ?, ?)")
        .run(bondId, req.userId, mood, message || null, aiText);
    }

    res.json({ response: aiText });
  } catch (err) {
    console.error("Checkin error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Support mode ──────────────────────────────────────────────────────────────
router.post("/support", async (req, res) => {
  try {
    const { situation, friend_name } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    let friend = null;
    if (user.friend_id) friend = db.prepare("SELECT * FROM users WHERE id = ?").get(user.friend_id);
    const name = friend_name || (friend ? friend.name : "your friend");

    const prompt = `You are a compassionate friendship advisor for the app "Bond".
${user.name} wants to support their close friend ${name} who is going through: "${situation}"
Give 4-5 specific, actionable, numbered ways ${user.name} can show up for ${name} right now.
Be specific, warm, and practical. Avoid clichés.`;

    const aiText = await askGroq(prompt);
    res.json({ response: aiText });
  } catch (err) {
    console.error("Support error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Bond insights ─────────────────────────────────────────────────────────────
router.get("/insights", async (req, res) => {
  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    if (!user.friend_id) return res.status(400).json({ error: "Not bonded yet" });

    const friend   = db.prepare("SELECT * FROM users WHERE id = ?").get(user.friend_id);
    const bondId   = getBondId(user.id, user.friend_id);
    const bondDays = user.bond_start_date
      ? Math.floor((new Date() - new Date(user.bond_start_date)) / (1000 * 60 * 60 * 24))
      : 0;

    const memories = db.prepare("SELECT * FROM memories WHERE bond_id = ? ORDER BY created_at DESC LIMIT 10").all(bondId);
    const bucket   = db.prepare("SELECT * FROM bucket_list WHERE bond_id = ?").all(bondId);
    const checkins = db.prepare("SELECT * FROM checkins WHERE bond_id = ? ORDER BY created_at DESC LIMIT 10").all(bondId);
    const avgMood  = checkins.length
      ? (checkins.reduce((s, c) => s + c.mood, 0) / checkins.length).toFixed(1)
      : null;

    const prompt = `You are the AI of "Bond" — a friendship companion app.
${user.name} and ${friend.name} have been bonded for ${bondDays} days.
They have ${memories.length} memories, ${bucket.filter(b => b.completed).length} of ${bucket.length} bucket items done, average mood ${avgMood || "N/A"}/5.
Recent memories: ${memories.slice(0, 3).map(m => m.title).join(", ") || "none yet"}.
Write a beautiful 2-3 sentence friendship insight about what makes this bond special, then add 2 "This week, try:" suggestions. Be warm and personal.`;

    const aiText = await askGroq(prompt);
    res.json({
      response: aiText,
      stats: {
        bondDays,
        memoriesCount: memories.length,
        bucketCompleted: bucket.filter(b => b.completed).length,
        bucketTotal: bucket.length,
        avgMood
      }
    });
  } catch (err) {
    console.error("Insights error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
