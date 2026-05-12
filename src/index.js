const express = require('express');
const storiesRouter = require('./routes/stories');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/v0', storiesRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`Hacker News Feed API running on http://localhost:${PORT}`);
});
