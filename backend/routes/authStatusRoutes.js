const express = require('express');
const { getAuthStatus } = require('../controllers/authStatusController');

const router = express.Router();

router.get('/status', getAuthStatus);

module.exports = router;
