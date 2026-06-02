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

async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

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

  startSync();

  app.listen(PORT, () => {
    console.log(`Hacker News Feed API running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => { console.error(err); process.exit(1); });
