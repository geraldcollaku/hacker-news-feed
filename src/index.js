require('dotenv').config();
const express = require('express');
const pool = require('./db');
const { startSync, syncStories } = require('./sync');
const storiesRouter = require('./routes/stories');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Liveness check — must not depend on the database so the service stays "up"
// even when the DB is unreachable. Defined before the schema middleware.
app.get('/health', (_, res) => res.json({ status: 'ok' }));

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stories (
      id         INTEGER PRIMARY KEY,
      title      TEXT,
      url        TEXT,
      score      INTEGER,
      username   TEXT,
      created_at TIMESTAMPTZ,
      synced_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS comments (
      id         INTEGER PRIMARY KEY,
      story_id   INTEGER REFERENCES stories(id) ON DELETE CASCADE,
      username   TEXT,
      message    TEXT,
      created_at TIMESTAMPTZ,
      synced_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS comments_story_id_idx ON comments(story_id);
    CREATE INDEX IF NOT EXISTS stories_keyset_idx ON stories(created_at DESC, id DESC);
  `);
}

// In serverless there is no boot step, so the schema is ensured lazily on the
// first DB-touching request and memoized per warm instance.
let schemaReady;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = migrate().catch((err) => {
      schemaReady = undefined; // allow a retry on the next request
      throw err;
    });
  }
  return schemaReady;
}

app.use(async (req, res, next) => {
  try {
    await ensureSchema();
    next();
  } catch (err) {
    res.status(503).json({ error: 'Database unavailable', detail: err.message });
  }
});

// Triggered by Vercel Cron (or manually). Bounded so it fits a function timeout.
// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
app.get('/internal/sync', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 25));
  const withComments = req.query.comments === 'true';

  try {
    const result = await syncStories({ limit, withComments });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/v0', storiesRouter);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Long-running mode (local dev / container host): start the server and the
// in-process cron sync. Skipped under serverless, where the app is exported as
// a handler and sync is driven by an external scheduler.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Hacker News Feed API running on http://localhost:${PORT}`);
    ensureSchema()
      .then(() => startSync())
      .catch((err) => console.error('[db] Init failed:', err.message));
  });
}

module.exports = app;
