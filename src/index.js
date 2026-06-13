require('dotenv').config();
const express = require('express');
const pool = require('./db');
const { startSync } = require('./sync');
const storiesRouter = require('./routes/stories');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/v0', storiesRouter);
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

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

// Bring the database online without blocking startup. Retries with backoff so a
// temporarily-unreachable or recently-recreated database recovers on its own.
async function initDatabase({ retries = 10, delayMs = 5000 } = {}) {
  if (!process.env.DATABASE_URL) {
    console.error('[db] DATABASE_URL is not set; API is up but data routes will fail until it is configured.');
    return;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await migrate();
      console.log('[db] Schema ready.');
      startSync();
      return;
    } catch (err) {
      console.error(`[db] Init failed (attempt ${attempt}/${retries}): ${err.message}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  console.error('[db] Could not initialize after retries; API stays up, data routes will return errors until the database is reachable.');
}

// Start listening first so /health passes and the service stays available even
// when the database is down. Database setup happens in the background.
app.listen(PORT, () => {
  console.log(`Hacker News Feed API running on http://localhost:${PORT}`);
  initDatabase();
});
