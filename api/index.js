// Vercel serverless entry point. The Express app is a valid (req, res) handler,
// so exporting it lets Vercel route every request through it.
module.exports = require('../src/index.js');
