require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const apiRoutes = require('./routes');
const { makeLogger } = require('./services/logger');
const { initSocket } = require('./socket/initSocket');
const { initCron } = require('./cron/initCron');

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
const ATLAS_URI = process.env.MONGO_URI || '';
const LOCAL_URI = process.env.LOCAL_MONGO_URI || '';

console.log('🔥 Server starting...');
console.log('📦 MONGO_URI:', ATLAS_URI ? 'FOUND' : 'MISSING');
console.log('📧 EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
console.log('🔑 EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');

// ─── Socket ───────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  socket.on('disconnect', () => console.log('🔌 Client disconnected:', socket.id));
});

// ─── App Context ──────────────────────────────────────────────────────────────
app.set('io', io);
app.set('logger', makeLogger({ io }));

// ─── Request Logger ───────────────────────────────────────────────────────────
app.use(async (req, res, next) => {
  const logger = req.app.get('logger');
  const startedAt = Date.now();
  res.on('finish', async () => {
    if (req.path === '/api/metrics/overview' || req.path === '/api/health') return;

    try {
      const endpoint = req.path;
      const message = `${req.method} ${endpoint} → ${res.statusCode}`;
      await logger.info('API', message, {
        meta: {
          method: req.method,
          endpoint,
          statusCode: res.statusCode,
          ms: Date.now() - startedAt,
        },
      });
    } catch (error) {
      console.error(`❌ Failed to persist API request log: ${error.message}`);
    }
  });
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ message: '✅ Backend is running' }));

app.use('/api', apiRoutes);

// ─── Start ────────────────────────────────────────────────────────────────────
async function startServer() {
  const candidates = [
    ...(ATLAS_URI ? [{ uri: ATLAS_URI, label: 'configured MongoDB' }] : []),
    { uri: LOCAL_URI, label: 'local MongoDB' },
  ].filter((candidate, index, all) =>
    all.findIndex((item) => item.uri === candidate.uri) === index
  );
  const failures = [];

  for (const candidate of candidates) {
    try {
      await mongoose.connect(candidate.uri);
      await mongoose.connection.db.collection('logs').findOne({}, { projection: { _id: 1 } });
      console.log(`✅ Connected to ${candidate.label}`);
      break;
    } catch (error) {
      failures.push(`${candidate.label}: ${error.message}`);
      console.error(`⚠️  Could not use ${candidate.label}: ${error.message}`);
      await mongoose.disconnect();
    }
  }

  if (mongoose.connection.readyState !== 1) {
    throw new Error(
      `MongoDB is required to run this application. Configure valid database access in MONGO_URI or LOCAL_MONGO_URI.\n${failures.join('\n')}`
    );
  }

  initSocket(io, { logger: app.get('logger') });
  initCron({ logger: app.get('logger') });

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Kill the process and retry.`);
      process.exit(1);
    } else {
      throw err;
    }
  });
}

startServer().catch((error) => {
  console.error(`❌ Backend startup failed: ${error.message}`);
  process.exit(1);
});