const express = require('express');
const { getCurrentUser, updateProfile } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All user routes require authentication
router.use(authenticateToken);

router.get('/me', getCurrentUser);
router.put('/profile', updateProfile);

module.exports = router;
