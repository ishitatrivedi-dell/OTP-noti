const express = require('express');
const { listLogs, dailyActivity } = require('../controllers/logController');

const router = express.Router();

router.get('/', listLogs);
router.get('/daily-activity', dailyActivity);

module.exports = router;

