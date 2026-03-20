const { verifyToken } = require('../services/jwtService');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      message: 'Authentication required. Please login first.',
      code: 'AUTH_REQUIRED'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ 
      message: 'Invalid or expired token. Please login again.',
      code: 'TOKEN_INVALID'
    });
  }

  req.user = decoded;
  next();
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }

  next();
}

// Middleware to check if user is authenticated for protected routes
function isAuthenticated(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
}

module.exports = { requireAuth, optionalAuth, isAuthenticated };
