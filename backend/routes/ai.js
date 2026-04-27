const express = require("express");
const router = express.Router();
const { client, getBondId } = require("../db");

async function askGroq(prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set on Render");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.8
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${data?.error?.message}`);
  return data.choices?.[0]?.message?.content || "No response from AI";
}

router.post("/checkin", async (req, res) => {
  try {
    const { mood, message } = req.body;
    const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = userRes.rows[0];

    let friend = null, memoriesCount = 0, bucketCount = 0;
    if (user.friend_id) {
      const frRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [user.friend_id] });
      friend = frRes.rows[0];
      const bondId = getBondId(Number(user.id), Number(user.friend_id));
      const mc = await client.execute({ sql: "SELECT COUNT(*) as c FROM memories WHERE bond_id = ?", args: [bondId] });
      const bc = await client.execute({ sql: "SELECT COUNT(*) as c FROM bucket_list WHERE bond_id = ? AND completed = 1", args: [bondId] });
      memoriesCount = Number(mc.rows[0].c);
      bucketCount = Number(bc.rows[0].c);
    }

    const bondDays = user.bond_start_date
      ? Math.floor((new Date() - new Date(user.bond_start_date)) / (1000 * 60 * 60 * 24)) : 0;
    const moodLabels = ["","Really down","Not great","Okay","Pretty good","Amazing"];

    const prompt = `You are a warm, emotionally intelligent friendship companion for the app "Bond".
User: ${user.name}, Friend: ${friend ? friend.name : "not bonded yet"}
Bonded: ${bondDays} days, Memories: ${memoriesCount}, Bucket completed: ${bucketCount}
Mood today: ${moodLabels[mood] || mood}/5, Message: "${message || "No message"}"
Write a warm personal response in 2-3 short paragraphs: acknowledge their mood, say something meaningful about their friendship, give one small actionable suggestion to connect today.`;

    const aiText = await askGroq(prompt);

    if (user.friend_id) {
      const bondId = getBondId(Number(user.id), Number(user.friend_id));
      await client.execute({ sql: "INSERT INTO checkins (bond_id, created_by, mood, message, ai_response) VALUES (?, ?, ?, ?, ?)", args: [bondId, req.userId, mood, message || null, aiText] });
    }
    res.json({ response: aiText });
  } catch (err) {
    console.error("Checkin error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/support", async (req, res) => {
  try {
    const { situation, friend_name } = req.body;
    const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = userRes.rows[0];
    let friend = null;
    if (user.friend_id) {
      const fr = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [user.friend_id] });
      friend = fr.rows[0];
    }
    const name = friend_name || (friend ? friend.name : "your friend");
    const prompt = `You are a compassionate friendship advisor for "Bond".
${user.name} wants to support ${name} who is going through: "${situation}"
Give 4-5 specific, actionable numbered ways to show up. Be warm and practical. Avoid clichés.`;
    const aiText = await askGroq(prompt);
    res.json({ response: aiText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/insights", async (req, res) => {
  try {
    const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = userRes.rows[0];
    if (!user.friend_id) return res.status(400).json({ error: "Not bonded yet" });

    const frRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [user.friend_id] });
    const friend = frRes.rows[0];
    const bondId = getBondId(Number(user.id), Number(user.friend_id));
    const bondDays = user.bond_start_date
      ? Math.floor((new Date() - new Date(user.bond_start_date)) / (1000 * 60 * 60 * 24)) : 0;

    const mems = await client.execute({ sql: "SELECT * FROM memories WHERE bond_id = ? ORDER BY created_at DESC LIMIT 10", args: [bondId] });
    const buck = await client.execute({ sql: "SELECT * FROM bucket_list WHERE bond_id = ?", args: [bondId] });
    const checks = await client.execute({ sql: "SELECT * FROM checkins WHERE bond_id = ? ORDER BY created_at DESC LIMIT 10", args: [bondId] });

    const memories = mems.rows, bucket = buck.rows, checkins = checks.rows;
    const avgMood = checkins.length ? (checkins.reduce((s, c) => s + Number(c.mood), 0) / checkins.length).toFixed(1) : null;

    const prompt = `You are the AI of "Bond" — a friendship companion app.
${user.name} and ${friend.name} bonded for ${bondDays} days. ${memories.length} memories, ${bucket.filter(b => b.completed).length}/${bucket.length} bucket done, avg mood ${avgMood || "N/A"}/5.
Recent memories: ${memories.slice(0,3).map(m => m.title).join(", ") || "none yet"}.
Write a beautiful 2-3 sentence friendship insight, then add 2 "This week, try:" suggestions.`;

    const aiText = await askGroq(prompt);
    res.json({ response: aiText, stats: { bondDays, memoriesCount: memories.length, bucketCompleted: bucket.filter(b=>b.completed).length, bucketTotal: bucket.length, avgMood } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
