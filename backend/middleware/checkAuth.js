const { verifyToken } = require('../services/jwtService');

// Global middleware to check authentication status
function checkAuthentication(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  // Attach authentication status to request
  req.isAuthenticated = false;
  req.user = null;
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.isAuthenticated = true;
      req.user = decoded;
    }
  }
  
  next();
}

module.exports = { checkAuthentication };
