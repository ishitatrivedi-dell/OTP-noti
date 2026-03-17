function initSocket(io, { logger }) {
  io.on('connection', async (socket) => {
    console.log('Client connected', socket.id);
    await logger?.info('SOCKET', 'Client connected', { meta: { socketId: socket.id } });

    socket.on('user-action', async (payload) => {
      // Optional channel for frontend to send "user actions"
      await logger?.info('USER_ACTION', payload?.action || 'User action', { meta: payload || null });
      io.emit('user-action', { ...(payload || {}), timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', async () => {
      console.log('Client disconnected', socket.id);
      await logger?.info('SOCKET', 'Client disconnected', { meta: { socketId: socket.id } });
    });
  });
}

module.exports = { initSocket };

