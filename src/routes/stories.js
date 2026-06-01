const express = require('express');
const pool = require('../db');

const router = express.Router();
const PAGE_SIZE = 10;

const USERNAMES = ['alice', 'bob', 'carol', 'dave', 'eve', 'frank', 'grace', 'hank'];
const MESSAGES = [
  'Great article, thanks for sharing!',
  'I disagree with the premise here.',
  'This is exactly what I needed to read today.',
  'Has anyone tried implementing this in production?',
  'The benchmarks seem off to me.',
  'Fascinating approach. Wonder how it scales.',
  'I wrote something similar last year but never published it.',
  'The second paragraph is the key insight.',
  'Would love to see a follow-up post.',
  'Classic HN thread. Everyone arguing about the wrong thing.',
];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomDate() { return new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)); }

// POST /seed — seeds random comments for all stories (one-time use)
router.post('/seed', async (req, res) => {
  const { rows: stories } = await pool.query('SELECT id FROM stories');
  let inserted = 0;
  for (const story of stories) {
    const count = Math.floor(Math.random() * 5) + 1;
    for (let i = 0; i < count; i++) {
      const id = story.id * 10 + i + 1;
      await pool.query(
        `INSERT INTO comments (id, story_id, username, message, created_at, synced_at)
         VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (id) DO NOTHING`,
        [id, story.id, randomItem(USERNAMES), randomItem(MESSAGES), randomDate()]
      );
      inserted++;
    }
  }
  res.json({ seeded: inserted, stories: stories.length });
});

// GET /newstories?page=1
router.get('/newstories', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        'SELECT id FROM stories ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [PAGE_SIZE, offset]
      ),
      pool.query('SELECT COUNT(*) FROM stories'),
    ]);

    const totalItems = parseInt(countRows[0].count);
    res.json({
      page,
      totalPages: Math.ceil(totalItems / PAGE_SIZE),
      totalItems,
      pageSize: PAGE_SIZE,
      ids: rows.map((r) => r.id),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /item/:storyId — HN-compatible shape for StoryItemMapper
router.get('/item/:storyId', async (req, res) => {
  try {
    const storyId = parseInt(req.params.storyId);
    if (isNaN(storyId)) return res.status(400).json({ error: 'Invalid story ID' });

    const [storyResult, commentsResult] = await Promise.all([
      pool.query('SELECT * FROM stories WHERE id = $1', [storyId]),
      pool.query('SELECT id FROM comments WHERE story_id = $1 ORDER BY created_at ASC', [storyId]),
    ]);

    if (!storyResult.rows.length) return res.status(404).json({ error: 'Item not found' });

    const s = storyResult.rows[0];
    const kids = commentsResult.rows.map((c) => c.id);

    res.json({
      id: s.id,
      title: s.title,
      url: s.url,
      by: s.username,
      score: s.score,
      time: Math.floor(new Date(s.created_at).getTime() / 1000),
      descendants: kids.length,
      kids,
      type: 'story',
      image: `https://picsum.photos/seed/${s.id}/600/400`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /story/:storyId/comments
router.get('/story/:storyId/comments', async (req, res) => {
  try {
    const storyId = parseInt(req.params.storyId);
    if (isNaN(storyId)) return res.status(400).json({ error: 'Invalid story ID' });

    const { rows } = await pool.query(
      'SELECT id, message, created_at, username FROM comments WHERE story_id = $1 ORDER BY created_at ASC',
      [storyId]
    );

    res.json(rows.map((c) => ({
      id: c.id,
      message: c.message,
      created_at: new Date(c.created_at).toISOString(),
      author: { username: c.username },
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /story/:storyId/detail
router.get('/story/:storyId/detail', async (req, res) => {
  try {
    const storyId = parseInt(req.params.storyId);
    if (isNaN(storyId)) return res.status(400).json({ error: 'Invalid story ID' });

    const [storyResult, commentsResult] = await Promise.all([
      pool.query('SELECT * FROM stories WHERE id = $1', [storyId]),
      pool.query(
        'SELECT * FROM comments WHERE story_id = $1 ORDER BY created_at ASC',
        [storyId]
      ),
    ]);

    if (!storyResult.rows.length) return res.status(404).json({ error: 'Story not found' });

    const s = storyResult.rows[0];
    const comments = commentsResult.rows.map((c) => ({
      id: c.id,
      message: c.message,
      created_at: c.created_at,
      author: { username: c.username },
    }));

    res.json({
      id: s.id,
      title: s.title,
      url: s.url,
      score: s.score,
      created_at: s.created_at,
      author: { username: s.username },
      comments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
