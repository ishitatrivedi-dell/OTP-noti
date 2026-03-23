const express = require('express');
const { getAuthStatus } = require('../controllers/authStatusController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Auth status routes use optional authentication
router.use(optionalAuth);

router.get('/status', getAuthStatus);

module.exports = router;
