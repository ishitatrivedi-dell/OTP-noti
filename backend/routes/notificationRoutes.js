const express = require('express');
const { listNotifications } = require('../controllers/notificationController');

const router = express.Router();

router.get('/', listNotifications);

module.exports = router;

