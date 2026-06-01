const pool = require('./db');

const COMMENTS_PER_STORY = 10;

const USERNAMES = ['alice', 'bob', 'carol', 'dave', 'eve', 'frank', 'grace', 'hank'];
const MESSAGES = [
  'Great article, thanks for sharing!',
  'I disagree with the premise here.',
  'This is exactly what I needed to read today.',
  'Has anyone tried implementing this in production?',
  'The benchmarks seem off to me.',
  'Fascinating approach. Wonder how it scales.',
  'I wrote something similar last year but never published it.',
  'The second paragraph is the key insight.',
  'Would love to see a follow-up post.',
  'Classic HN thread. Everyone arguing about the wrong thing.',
];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomDate() { return new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)); }

// Ensures a story has 10 synthetic comments. Deterministic ids (storyId*10 + 0..9)
// keep it idempotent — re-running never creates duplicates. storyId*10 stays within
// PostgreSQL INTEGER range and never collides with real HN comment ids.
async function ensureCommentsForStory(storyId) {
  for (let i = 0; i < COMMENTS_PER_STORY; i++) {
    await pool.query(
      `INSERT INTO comments (id, story_id, username, message, created_at, synced_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (id) DO NOTHING`,
      [storyId * 10 + i, storyId, randomItem(USERNAMES), randomItem(MESSAGES), randomDate()]
    );
  }
}

async function ensureCommentsForAllStories() {
  const { rows: stories } = await pool.query('SELECT id FROM stories');
  for (const story of stories) {
    await ensureCommentsForStory(story.id);
  }
  return { stories: stories.length, commentsPerStory: COMMENTS_PER_STORY };
}

module.exports = { ensureCommentsForStory, ensureCommentsForAllStories, COMMENTS_PER_STORY };
