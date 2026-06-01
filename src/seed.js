require('dotenv').config();
const pool = require('./db');

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
  'This changes how I think about the problem.',
  'Bookmarked. Will read properly later.',
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysBack = 30) {
  const now = Date.now();
  const offset = Math.floor(Math.random() * daysBack * 24 * 60 * 60 * 1000);
  return new Date(now - offset);
}

async function seed() {
  const { rows: stories } = await pool.query('SELECT id FROM stories');
  console.log(`Seeding comments for ${stories.length} stories...`);

  let commentId = 1;
  for (const story of stories) {
    const count = Math.floor(Math.random() * 5) + 1; // 1–5 comments per story
    for (let i = 0; i < count; i++) {
      const id = commentId++;
      await pool.query(
        `INSERT INTO comments (id, story_id, username, message, created_at, synced_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, story.id, randomItem(USERNAMES), randomItem(MESSAGES), randomDate()]
      );
    }
  }

  console.log('Seeding done.');
  await pool.end();
}

seed().catch((err) => { console.error(err); process.exit(1); });
