const express = require('express');
const router = express.Router();
const { client } = require('../db');

async function generateHabits({ gender, age_range, goals, focus_areas }) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', max_tokens: 800,
        messages: [{ role: 'user', content: `You are a glow up coach. Create 10 personalized daily habits for:
- Gender: ${gender}
- Age: ${age_range}
- Focus areas: ${Array.isArray(focus_areas) ? focus_areas.join(', ') : focus_areas}
- Goal: ${goals}
Return ONLY a valid JSON array, no markdown, no explanation:
[{"name":"short actionable habit","category":"physical|mental|appearance|growth|mindfulness","icon":"emoji"}]` }]
      })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '[]';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    throw new Error('bad');
  } catch {
    return [
      { name: 'Drink 8 glasses of water', category: 'physical', icon: '💧' },
      { name: '30 min workout', category: 'physical', icon: '💪' },
      { name: 'Morning skincare routine', category: 'appearance', icon: '🧴' },
      { name: '10 min meditation', category: 'mindfulness', icon: '🧘' },
      { name: 'Read 20 pages', category: 'growth', icon: '📚' },
      { name: '7-8 hours of sleep', category: 'physical', icon: '😴' },
      { name: 'No phone first hour of day', category: 'mental', icon: '🚫' },
      { name: 'Journal 5 minutes', category: 'mental', icon: '✍️' },
      { name: 'Eat a healthy meal', category: 'physical', icon: '🥗' },
      { name: 'Evening walk or stretch', category: 'physical', icon: '🚶' },
    ];
  }
}

function calculateStreak(dates) {
  if (!dates.length) return 0;
  const sorted = [...new Set(dates)].sort().reverse();
  let streak = 0;
  let current = new Date().toISOString().slice(0, 10);
  for (const date of sorted) {
    if (date === current) {
      streak++;
      const d = new Date(current);
      d.setDate(d.getDate() - 1);
      current = d.toISOString().slice(0, 10);
    } else break;
  }
  return streak;
}

router.get('/profile', async (req, res) => {
  try {
    const profile = await client.execute({ sql: 'SELECT * FROM glowup_profile WHERE user_id = ?', args: [req.userId] });
    const habits = await client.execute({ sql: 'SELECT * FROM glowup_habits WHERE user_id = ? AND active = 1 ORDER BY category, id', args: [req.userId] });
    res.json({ profile: profile.rows[0] || null, habits: habits.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/setup', async (req, res) => {
  try {
    const { gender, age_range, goals, focus_areas } = req.body;
    const habits = await generateHabits({ gender, age_range, goals, focus_areas });
    await client.execute({
      sql: `INSERT INTO glowup_profile (user_id, gender, age_range, goals, focus_areas, setup_complete)
            VALUES (?, ?, ?, ?, ?, 1)
            ON CONFLICT(user_id) DO UPDATE SET gender=excluded.gender, age_range=excluded.age_range,
            goals=excluded.goals, focus_areas=excluded.focus_areas, setup_complete=1`,
      args: [req.userId, gender, age_range, goals, JSON.stringify(focus_areas)]
    });
    await client.execute({ sql: 'DELETE FROM glowup_habits WHERE user_id = ?', args: [req.userId] });
    for (const h of habits) {
      await client.execute({ sql: 'INSERT INTO glowup_habits (user_id, name, category, icon) VALUES (?, ?, ?, ?)', args: [req.userId, h.name, h.category, h.icon] });
    }
    const saved = await client.execute({ sql: 'SELECT * FROM glowup_habits WHERE user_id = ? AND active = 1', args: [req.userId] });
    res.json({ ok: true, habits: saved.rows });
  } catch (err) { console.error('setup:', err); res.status(500).json({ error: err.message }); }
});

router.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const habits = await client.execute({ sql: 'SELECT * FROM glowup_habits WHERE user_id = ? AND active = 1 ORDER BY category', args: [req.userId] });
    const logs = await client.execute({ sql: 'SELECT * FROM glowup_logs WHERE user_id = ? AND date = ?', args: [req.userId, today] });
    const completedIds = new Set(logs.rows.filter(l => l.completed).map(l => Number(l.habit_id)));
    res.json({
      habits: habits.rows.map(h => ({ ...h, completed: completedIds.has(Number(h.id)) })),
      date: today,
      completion: habits.rows.length ? Math.round((completedIds.size / habits.rows.length) * 100) : 0
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/log', async (req, res) => {
  try {
    const { habit_id, completed } = req.body;
    const date = new Date().toISOString().slice(0, 10);
    await client.execute({
      sql: `INSERT INTO glowup_logs (user_id, habit_id, date, completed) VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, habit_id, date) DO UPDATE SET completed = excluded.completed`,
      args: [req.userId, habit_id, date, completed ? 1 : 0]
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const habits = await client.execute({ sql: 'SELECT * FROM glowup_habits WHERE user_id = ? AND active = 1', args: [req.userId] });
    const logs = await client.execute({ sql: 'SELECT habit_id, date FROM glowup_logs WHERE user_id = ? AND completed = 1', args: [req.userId] });
    const habitDates = {};
    for (const log of logs.rows) {
      const hid = Number(log.habit_id);
      if (!habitDates[hid]) habitDates[hid] = [];
      habitDates[hid].push(log.date);
    }
    const habitsWithStreak = habits.rows.map(h => ({
      ...h, streak: calculateStreak(habitDates[Number(h.id)] || []), total: (habitDates[Number(h.id)] || []).length
    }));
    const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const recentCount = logs.rows.filter(l => l.date >= thirtyAgo).length;
    const maxPossible = habits.rows.length * 30;
    const score = maxPossible > 0 ? Math.min(100, Math.round((recentCount / maxPossible) * 100)) : 0;
    res.json({ habits: habitsWithStreak, score });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/posts', async (req, res) => {
  try {
    const userRes = await client.execute({ sql: 'SELECT friend_id FROM users WHERE id = ?', args: [req.userId] });
    const friendId = userRes.rows[0]?.friend_id;
    const ids = [req.userId, friendId].filter(Boolean);
    const placeholders = ids.map(() => '?').join(',');
    const posts = await client.execute({
      sql: `SELECT p.*, u.name as author_name, u.photo_url as author_photo, u.avatar_color
            FROM glowup_posts p JOIN users u ON p.user_id = u.id
            WHERE p.user_id IN (${placeholders}) ORDER BY p.created_at DESC LIMIT 50`,
      args: ids
    });
    res.json(posts.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/posts', async (req, res) => {
  try {
    const { title, content, image_url } = req.body;
    if (!content && !image_url) return res.status(400).json({ error: 'Content required' });
    await client.execute({ sql: 'INSERT INTO glowup_posts (user_id, title, content, image_url) VALUES (?, ?, ?, ?)', args: [req.userId, title || null, content || null, image_url || null] });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/posts/:id', async (req, res) => {
  try {
    await client.execute({ sql: 'DELETE FROM glowup_posts WHERE id = ? AND user_id = ?', args: [req.params.id, req.userId] });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
