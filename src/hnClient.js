const fetch = require('node-fetch');
const cache = require('./cache');

const BASE_URL = 'https://hacker-news.firebaseio.com/v0';

async function getNewStoryIds() {
  const cached = cache.get('newstories');
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}/newstories.json`);
  if (!res.ok) throw new Error(`HN API error: ${res.status}`);

  const ids = await res.json();
  cache.set('newstories', ids, 5 * 60 * 1000); // 5 min TTL
  return ids;
}

async function getItem(storyId) {
  const cacheKey = `item:${storyId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}/item/${storyId}.json`);
  if (!res.ok) throw new Error(`HN API error: ${res.status}`);

  const item = await res.json();
  if (item) cache.set(cacheKey, item, 10 * 60 * 1000); // 10 min TTL
  return item;
}

module.exports = { getNewStoryIds, getItem };
