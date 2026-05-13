const express = require('express');
const pool = require('../db');

const router = express.Router();
const PAGE_SIZE = 10;

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

// GET /item/:storyId
router.get('/item/:storyId', async (req, res) => {
  try {
    const storyId = parseInt(req.params.storyId);
    if (isNaN(storyId)) return res.status(400).json({ error: 'Invalid story ID' });

    const { rows } = await pool.query('SELECT * FROM stories WHERE id = $1', [storyId]);
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });

    const s = rows[0];
    res.json({
      id: s.id,
      title: s.title,
      url: s.url,
      score: s.score,
      username: s.username,
      created_at: s.created_at,
    });
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
