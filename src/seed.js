require('dotenv').config();
const pool = require('./db');
const { ensureCommentsForAllStories } = require('./seedComments');

async function seed() {
  const result = await ensureCommentsForAllStories();
  console.log(`Ensured ${result.commentsPerStory} comments for ${result.stories} stories.`);
  await pool.end();
}

seed().catch((err) => { console.error(err); process.exit(1); });
