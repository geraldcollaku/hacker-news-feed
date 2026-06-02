const express = require('express');
const pool = require('../db');
const { ensureCommentsForAllStories } = require('../seedComments');

const router = express.Router();
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// POST /seed — backfills every story to 10 comments (idempotent)
router.post('/seed', async (req, res) => {
  const result = await ensureCommentsForAllStories();
  res.json(result);
});

// GET /newstories?after_id=<id>&limit=<n> — keyset pagination
//
// Stories are ordered newest-first by the composite key (created_at, id); id
// breaks created_at ties so the order is total and stable. The cursor is the
// last id of the previous page: we look up its (created_at, id) and return the
// rows strictly "after" it. This avoids OFFSET's drift when rows are inserted.
router.get('/newstories', async (req, res) => {
  try {
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit) || DEFAULT_LIMIT));

    let afterId = null;
    if (req.query.after_id != null) {
      afterId = parseInt(req.query.after_id);
      if (Number.isNaN(afterId)) return res.status(400).json({ error: 'Invalid after_id' });
    }

    // Fetch limit + 1 to detect whether a further page exists.
    const { rows } = await pool.query(
      `WITH cursor AS (
         SELECT created_at, id FROM stories WHERE id = $1
       )
       SELECT id FROM stories
       WHERE $1::int IS NULL
          OR (created_at, id) < (SELECT created_at, id FROM cursor)
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [afterId, limit + 1]
    );

    const hasMore = rows.length > limit;
    const ids = (hasMore ? rows.slice(0, limit) : rows).map((r) => r.id);

    res.json({
      ids,
      nextCursor: hasMore ? ids[ids.length - 1] : null,
      hasMore,
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
