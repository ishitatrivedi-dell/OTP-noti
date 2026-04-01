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
const LOCAL_URI = 'mongodb://127.0.0.1:27017/transparent-backend-visualizer';

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
    await logger.info('API', `${req.method} ${req.originalUrl} → ${res.statusCode}`, {
      meta: { ms: Date.now() - startedAt },
    });
  });
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ message: '✅ Backend is running' }));

app.use('/api', apiRoutes);

// ─── Start ────────────────────────────────────────────────────────────────────
async function startServer() {
  // Try Atlas first, then local, then start without DB
  try {
    await mongoose.connect(ATLAS_URI);
    console.log('✅ Connected to MongoDB Atlas');
  } catch {
    console.log('⚠️  Atlas connection failed, trying local MongoDB...');
    try {
      await mongoose.connect(LOCAL_URI);
      console.log('✅ Connected to local MongoDB');
    } catch {
      console.log('⚠️  No MongoDB available — starting without database');
    }
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

startServer();