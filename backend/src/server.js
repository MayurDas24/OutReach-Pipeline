require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config/env');
const logger = require('./config/logger');
const pipelineRoutes = require('./middleware/pipelineRoutes');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: config.FRONTEND_URL,
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) }
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/pipeline', pipelineRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    env: config.NODE_ENV,
    ts: new Date().toISOString()
  });
});

// Serve React build in production
if (config.NODE_ENV === 'production') {
  const frontendBuild = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(err.status ?? 500).json({
    success: false,
    error: config.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(config.PORT, 10);
app.listen(PORT, () => {
  logger.info(`
  ╔══════════════════════════════════════════════╗
  ║   Outreach Pipeline Server — Running         ║
  ║   Port:  ${PORT}                               ║
  ║   Env:   ${config.NODE_ENV.padEnd(10)}                     ║
  ║   DryRun: ${config.DRY_RUN}                          ║
  ╚══════════════════════════════════════════════╝`);
});

module.exports = app;
