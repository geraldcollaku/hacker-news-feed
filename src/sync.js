const cron = require('node-cron');
const { getNewStoryIds, getItem } = require('./hnClient');
const pool = require('./db');
const { ensureCommentsForStory } = require('./seedComments');

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

// Sync the newest stories. `limit` bounds how many to process (kept small for
// serverless time limits); `withComments` controls the slow comment backfill,
// which can be skipped so a single run fits inside a function timeout.
async function syncStories({ limit = 100, withComments = true } = {}) {
  console.log(`[sync] Starting at ${new Date().toISOString()} (limit=${limit}, withComments=${withComments})`);
  let processed = 0;
  const ids = await getNewStoryIds();
  const batch = ids.slice(0, limit);

  for (const id of batch) {
    const item = await getItem(id).catch(() => null);
    if (!item || item.type !== 'story') continue;

    await upsertStory(item);
    processed++;

    if (withComments) {
      if (item.kids?.length) {
        await upsertComments(item.id, item.kids);
      }
      // Guarantee every story has at least 10 comments
      await ensureCommentsForStory(item.id);
    }
  }
  console.log(`[sync] Done — ${processed} stories processed`);
  return { processed };
}

// Long-running (local / container) mode: sync now, then every 5 minutes.
function startSync() {
  syncStories().catch((err) => console.error('[sync] Error:', err.message));
  cron.schedule('*/5 * * * *', () =>
    syncStories().catch((err) => console.error('[sync] Error:', err.message))
  );
}

module.exports = { startSync, syncStories };
