const express = require('express');
const { getNewStoryIds, getItem } = require('../hnClient');

const router = express.Router();
const PAGE_SIZE = 10;

// GET /newstories?page=1
router.get('/newstories', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const ids = await getNewStoryIds();

    const totalItems = ids.length;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    const start = (page - 1) * PAGE_SIZE;
    const pageIds = ids.slice(start, start + PAGE_SIZE);

    res.json({
      page,
      totalPages,
      totalItems,
      pageSize: PAGE_SIZE,
      ids: pageIds,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /item/:storyId
router.get('/item/:storyId', async (req, res) => {
  try {
    const storyId = parseInt(req.params.storyId);
    if (isNaN(storyId)) return res.status(400).json({ error: 'Invalid story ID' });

    const item = await getItem(storyId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    res.json(item);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /story/:storyId/detail — story with top-level comments resolved
router.get('/story/:storyId/detail', async (req, res) => {
  try {
    const storyId = parseInt(req.params.storyId);
    if (isNaN(storyId)) return res.status(400).json({ error: 'Invalid story ID' });

    const story = await getItem(storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    const kidIds = story.kids || [];
    const rawComments = await Promise.all(kidIds.map((id) => getItem(id).catch(() => null)));

    const comments = rawComments
      .filter(Boolean)
      .map(({ id, by, text, time }) => ({
        id,
        message: text,
        created_at: new Date(time * 1000).toISOString(),
        author: { username: by },
      }));

    res.json({
      id: story.id,
      title: story.title,
      url: story.url,
      score: story.score,
      created_at: new Date(story.time * 1000).toISOString(),
      author: { username: story.by },
      comments,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
