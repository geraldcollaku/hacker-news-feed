require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

// Managed Postgres (Neon, etc.) requires SSL; local dev does not. Key SSL off the
// host rather than NODE_ENV so a missing NODE_ENV can't silently break TLS.
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString || '');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

module.exports = pool;
