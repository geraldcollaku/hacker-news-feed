require('dotenv').config();
const pool = require('./db');

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
  `);

  console.log('Migration complete');
  await pool.end();
}

migrate().catch((err) => { console.error(err); process.exit(1); });
