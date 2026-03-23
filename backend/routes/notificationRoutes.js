const express = require('express');
const { listNotifications } = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All notification routes require authentication
router.use(authenticateToken);

router.get('/', listNotifications);

module.exports = router;

