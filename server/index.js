import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import aiRouter from './routes/ai.js';
import rplRouter from './routes/rpl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const requestedPort = Number(process.env.PORT);
const PORT = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 8787;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api', aiRouter);
app.use('/api/rpl', rplRouter);

// Serve the built frontend in production (npm run build && npm start)
const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`[AI StudyMate] API server listening on http://localhost:${PORT}`);
});
