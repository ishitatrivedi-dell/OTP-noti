const express = require('express');
const { exportLogs } = require('../controllers/exportController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All export routes require authentication
router.use(authenticateToken);

router.get('/logs', exportLogs);

module.exports = router;
