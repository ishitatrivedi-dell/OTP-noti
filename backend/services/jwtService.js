const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function generateUserToken(user) {
  return generateToken({
    id: user._id,
    email: user.email,
    isVerified: user.isVerified
  });
}

module.exports = {
  generateToken,
  verifyToken,
  generateUserToken,
  JWT_SECRET
};
