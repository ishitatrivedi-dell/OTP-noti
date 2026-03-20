const express = require('express');
const { exportLogs } = require('../controllers/exportController');

const router = express.Router();

router.get('/logs', exportLogs);

module.exports = router;
