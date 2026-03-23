const express = require('express');
const { listLogs, dailyActivity } = require('../controllers/logController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All log routes require authentication
router.use(authenticateToken);

router.get('/', listLogs);
router.get('/daily-activity', dailyActivity);

module.exports = router;

