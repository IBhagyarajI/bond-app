const express = require("express");
const router = express.Router();
const { db, getBondId } = require("../db");

// Lazy-load Gemini so a missing key gives a clear error
function getGenAI() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY is not set in environment variables. Add it on Render.");
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  return new GoogleGenerativeAI(key);
}

async function askGemini(prompt) {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ── Health check for AI ──────────────────────────────────────────────────────
router.get("/health", async (req, res) => {
  try {
    const key = process.env.GOOGLE_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: "GOOGLE_API_KEY not set on Render" });
    const text = await askGemini("Say exactly: AI is working");
    res.json({ ok: true, response: text });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Daily check-in ───────────────────────────────────────────────────────────
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

Today's check-in:
Mood: ${moodLabels[mood] || mood}/5
Message: "${message || "No message"}"

Write a warm, personal response (2-3 short paragraphs max) that:
1. Acknowledges their mood genuinely and specifically
2. Says something meaningful about their friendship journey
3. Gives one small, actionable suggestion to connect with ${friend ? friend.name : "their friend"} today

Be human, warm, and avoid generic advice.`;

    const aiText = await askGemini(prompt);

    if (user.friend_id) {
      const bondId = getBondId(user.id, user.friend_id);
      db.prepare("INSERT INTO checkins (bond_id, created_by, mood, message, ai_response) VALUES (?, ?, ?, ?, ?)")
        .run(bondId, req.userId, mood, message || null, aiText);
    }

    res.json({ response: aiText });
  } catch (err) {
    console.error("Checkin AI error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Support mode ─────────────────────────────────────────────────────────────
router.post("/support", async (req, res) => {
  try {
    const { situation, friend_name } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    let friend = null;
    if (user.friend_id) friend = db.prepare("SELECT * FROM users WHERE id = ?").get(user.friend_id);
    const name = friend_name || (friend ? friend.name : "your friend");

    const prompt = `You are a compassionate friendship advisor for the app "Bond".

${user.name} wants to support their close friend ${name} who is going through:
"${situation}"

Give 4-5 specific, actionable ways ${user.name} can show up for ${name} right now.
Format as a simple numbered list. Be specific, warm, and practical.
Include both immediate actions and longer-term gestures. Avoid clichés.`;

    const aiText = await askGemini(prompt);
    res.json({ response: aiText });
  } catch (err) {
    console.error("Support AI error:", err.message);
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

    const prompt = `You are the AI of the app "Bond" — a friendship companion.

${user.name} and ${friend.name}'s friendship data:
- Bonded for: ${bondDays} days
- Memories captured: ${memories.length}
- Bucket list items: ${bucket.length} total, ${bucket.filter(b => b.completed).length} completed
- Average mood: ${avgMood || "N/A"}/5
- Recent memories: ${memories.slice(0, 3).map(m => m.title).join(", ") || "none yet"}

Write a beautiful, poetic 2-3 sentence "Friendship Insight" — a snapshot of what makes this bond special.
Then add 2 quick "This week, try:" suggestions specific to their data.
Be genuinely warm and personal, not generic.`;

    const aiText = await askGemini(prompt);
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
    console.error("Insights AI error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
