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

// Basic app setup
const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*', // allow all for now (you can restrict later)
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Environment config
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Debug logs (helps in Render)
console.log("🔥 Server file started");
console.log("MONGO_URI:", MONGO_URI ? "FOUND" : "MISSING");

// Socket connection
io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

// Attach io + logger
app.set('io', io);
app.set('logger', makeLogger({ io }));

// Request logging
app.use(async (req, res, next) => {
  const logger = req.app.get('logger');
  const startedAt = Date.now();

  res.on('finish', async () => {
    await logger.info(
      'API',
      `${req.method} ${req.originalUrl} -> ${res.statusCode}`,
      {
        meta: { ms: Date.now() - startedAt },
      }
    );
  });

  next();
});

// Health check route
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running ✅' });
});

// Routes
app.use('/api', apiRoutes);

// MongoDB connection + server start
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');

    // Initialize socket + cron jobs
    initSocket(io, { logger: app.get('logger') });
    initCron({ logger: app.get('logger') });

    // Start server (IMPORTANT: only this, no app.listen)
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });