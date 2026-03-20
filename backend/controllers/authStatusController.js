async function getAuthStatus(req, res) {
  const logger = req.app.get('logger');
  
  try {
    if (req.isAuthenticated && req.user) {
      await logger.info('AUTH_CHECK', 'User is authenticated', {
        userId: req.user.id,
        meta: { email: req.user.email }
      });
      
      return res.json({
        authenticated: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          isVerified: req.user.isVerified
        }
      });
    } else {
      await logger.info('AUTH_CHECK', 'User is not authenticated');
      
      return res.json({
        authenticated: false,
        user: null
      });
    }
  } catch (error) {
    console.error('Auth status check error:', error);
    await logger?.info('ERROR', 'Auth status check failed', {
      meta: { error: String(error) }
    });
    
    return res.status(500).json({
      authenticated: false,
      user: null,
      error: 'Authentication check failed'
    });
  }
}

module.exports = { getAuthStatus };
