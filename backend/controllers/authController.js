const User = require('../models/User');
const OTP = require('../models/OTP');
const Notification = require('../models/Notification');
const { generateSixDigitOtp, otpExpiryDate } = require('../services/otp');
const { sendOtpEmail } = require('../services/emailService');
const { generateUserToken } = require('../services/jwtService');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * POST /api/auth/send-otp
 * Body: { email: string }
 */
async function sendOtp(req, res) {
  const io = req.app.get('io');
  const logger = req.app.get('logger');

  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    logger && await logger.info('API_CALL', 'POST /api/auth/send-otp');

    const otp = generateSixDigitOtp();
    const expiresAt = otpExpiryDate(5);

    logger && await logger.info('OTP_GENERATE', 'Generated OTP');

    // Replace any existing OTP for this email
    await OTP.deleteMany({ email });
    logger && await logger.info('DB_OP', 'Cleared existing OTPs');

    await OTP.create({ email, otp, expiresAt });
    logger && await logger.info('DB_OP', 'Stored new OTP', { meta: { expiresAt } });

    // Send email
    logger && await logger.info('EMAIL_SEND', 'Sending OTP email');
    let emailResult;
    try {
      emailResult = await sendOtpEmail(email, otp);
      logger && await logger.info('EMAIL_SENT', 'OTP email sent');
    } catch (emailError) {
      logger && await logger.info('EMAIL_SEND_FAILED', 'OTP email delivery failed', {
        meta: { code: emailError.code || 'DELIVERY_FAILED' },
      });
      throw emailError;
    }

    if (io) {
      io.emit('user-action', { action: 'OTP_SENT', timestamp: new Date().toISOString() });
    }

    return res.json({
      message: emailResult.message,
      testMode: emailResult.testMode,
      ...(emailResult.previewUrl ? { previewUrl: emailResult.previewUrl } : {}),
    });

  } catch (err) {
    console.error('❌ sendOtp error:', err.message);
    logger && await logger.info('ERROR', 'OTP request failed', { meta: { code: err.code || 'REQUEST_FAILED' } });
    return res.status(500).json({ message: err.message || 'Failed to send OTP. Please try again.' });
  }
}

/**
 * POST /api/auth/verify-otp
 * Body: { email: string, otp: string }
 */
async function verifyOtp(req, res) {
  const io = req.app.get('io');
  const logger = req.app.get('logger');

  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    logger && await logger.info('API_CALL', 'POST /api/auth/verify-otp');

    const otpDoc = await OTP.findOne({ email, otp });
    logger && await logger.info('DB_OP', 'Lookup OTP', { meta: { found: Boolean(otpDoc) } });

    if (!otpDoc) {
      logger && await logger.info('OTP_VERIFY_FAILED', 'OTP verification failed');
      return res.status(401).json({ message: 'Invalid OTP. Please request a new one.' });
    }
    if (otpDoc.expiresAt.getTime() < Date.now()) {
      logger && await logger.info('OTP_EXPIRED', 'Expired OTP verification attempted');
      return res.status(401).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Upsert user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email, isVerified: true });
      logger && await logger.info('DB_OP', 'Created user', { userId: user._id });
    } else if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
      logger && await logger.info('DB_OP', 'Marked user verified', { userId: user._id });
    }

    // Clean up OTP
    await OTP.deleteMany({ email });
    logger && await logger.info('DB_OP', 'Deleted used OTPs', { userId: user._id });

    // Welcome notification
    const notification = await Notification.create({
      userId: String(user._id),
      message: 'OTP verified successfully. Welcome!',
      read: false,
      createdAt: new Date(),
    });
    io?.emit('notification-update', {
      _id: String(notification._id),
      userId: notification.userId,
      message: notification.message,
      read: notification.read,
      createdAt: notification.createdAt,
    });

    logger && await logger.info('OTP_VERIFY', 'OTP verified successfully', { userId: user._id });

    const token = generateUserToken(user);
    logger && await logger.info('JWT_GENERATED', 'JWT created', { userId: user._id });

    return res.json({
      message: 'OTP verified successfully.',
      token,
      user: { id: String(user._id), email: user.email, isVerified: user.isVerified },
    });

  } catch (err) {
    console.error('❌ verifyOtp error:', err.message);
    logger && await logger.info('ERROR', 'OTP verification request failed', { meta: { code: err.code || 'VERIFY_FAILED' } });
    return res.status(500).json({ message: 'Internal server error. Please try again.' });
  }
}

module.exports = { sendOtp, verifyOtp };
