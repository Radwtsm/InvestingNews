import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDB, getPortfolio, getAllTrades, getRecentNews } from './server/database';
import { startEngine } from './server/engine';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // Initialize DB and Trading Engine
  initDB();
  startEngine();

  // API Routes
  app.get('/api/portfolio', (req, res) => {
      res.json(getPortfolio());
  });

  app.get('/api/trades', (req, res) => {
      res.json(getAllTrades());
  });

  app.get('/api/news', (req, res) => {
      res.json(getRecentNews());
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
