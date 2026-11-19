import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import { createApiApp } from './server/app.js';

async function startServer() {
  const app = createApiApp();

  // Frontend Vite middleware (dev) or static dist serving (production)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use('/server.js', (_req, res) => { res.sendStatus(404); });
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
  app.listen(PORT, host, () => {
    console.log(`SAMT Event Platform listening on http://${host}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
