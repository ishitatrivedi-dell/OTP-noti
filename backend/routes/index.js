const express = require('express');
const authRoutes = require('./authRoutes');
const logRoutes = require('./logRoutes');
const notificationRoutes = require('./notificationRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/logs', logRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;

