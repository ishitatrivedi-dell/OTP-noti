const express = require('express');
const authRoutes = require('./authRoutes');
const logRoutes = require('./logRoutes');
const notificationRoutes = require('./notificationRoutes');
const userRoutes = require('./userRoutes');
const exportRoutes = require('./exportRoutes');
const authStatusRoutes = require('./authStatusRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/logs', logRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);
router.use('/export', exportRoutes);
router.use('/auth-status', authStatusRoutes);

module.exports = router;

