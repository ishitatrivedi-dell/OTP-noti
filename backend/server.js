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

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Simple environment config (you can move to .env later)
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/transparent-backend-visualizer';

// Socket.io basic connection
io.on('connection', (socket) => {
  console.log('Client connected', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

// Attach io to app so it can be used in routes/services
app.set('io', io);
app.set('logger', makeLogger({ io }));

// Basic request logging (core visualization)
app.use(async (req, res, next) => {
  const logger = req.app.get('logger');
  const startedAt = Date.now();
  res.on('finish', async () => {
    await logger.info('API', `${req.method} ${req.originalUrl} -> ${res.statusCode}`, {
      meta: { ms: Date.now() - startedAt },
    });
  });
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running' });
});

app.use('/api', apiRoutes);

// Mongo connection and server start
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');

    // Init socket + cron after DB connects
    initSocket(io, { logger: app.get('logger') });
    initCron({ logger: app.get('logger') });

    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error', err);
  });

