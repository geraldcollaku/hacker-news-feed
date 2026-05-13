const cron = require('node-cron');
const { getNewStoryIds, getItem } = require('./hnClient');
const pool = require('./db');

async function upsertStory(item) {
  await pool.query(
    `INSERT INTO stories (id, title, url, score, username, created_at, synced_at)
     VALUES ($1, $2, $3, $4, $5, to_timestamp($6), NOW())
     ON CONFLICT (id) DO UPDATE SET
       score     = EXCLUDED.score,
       synced_at = NOW()`,
    [item.id, item.title, item.url, item.score, item.by, item.time]
  );
}

async function upsertComments(storyId, kidIds) {
  const results = await Promise.all(kidIds.map((id) => getItem(id).catch(() => null)));
  const valid = results.filter((c) => c && c.text);

  for (const c of valid) {
    await pool.query(
      `INSERT INTO comments (id, story_id, username, message, created_at, synced_at)
       VALUES ($1, $2, $3, $4, to_timestamp($5), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [c.id, storyId, c.by, c.text, c.time]
    );
  }
}

async function syncStories() {
  console.log(`[sync] Starting at ${new Date().toISOString()}`);
  try {
    const ids = await getNewStoryIds();
    const batch = ids.slice(0, 100); // sync top 100 newest

    for (const id of batch) {
      const item = await getItem(id).catch(() => null);
      if (!item || item.type !== 'story') continue;

      await upsertStory(item);

      if (item.kids?.length) {
        await upsertComments(item.id, item.kids);
      }
    }
    console.log(`[sync] Done — ${batch.length} stories processed`);
  } catch (err) {
    console.error('[sync] Error:', err.message);
  }
}

function startSync() {
  syncStories(); // run immediately on startup
  cron.schedule('*/5 * * * *', syncStories); // then every 5 minutes
}

module.exports = { startSync };
