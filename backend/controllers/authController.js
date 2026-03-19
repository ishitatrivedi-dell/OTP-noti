const User = require('../models/User');
const OTP = require('../models/OTP');
const Notification = require('../models/Notification');
const { generateSixDigitOtp, otpExpiryDate } = require('../services/otp');
const { sendOtpEmail } = require('../services/emailService');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function sendOtp(req, res) {
  const io = req.app.get('io');
  const logger = req.app.get('logger');

  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ message: 'Email is required' });

    await logger.info('API_CALL', 'POST /api/auth/send-otp', { meta: { email } });

    const otp = generateSixDigitOtp();
    const expiresAt = otpExpiryDate(5);

    await logger.info('OTP_GENERATE', 'Generated OTP', { meta: { email } });

    // Keep only one active OTP per email
    await OTP.deleteMany({ email });
    await logger.info('DB_OP', 'Deleted existing OTP(s)', { meta: { email, collection: 'OTP' } });

    await OTP.create({ email, otp, expiresAt });
    await logger.info('DB_OP', 'Stored OTP in DB', { meta: { email, collection: 'OTP', expiresAt } });

    // Send actual email
    await logger.info('EMAIL_SEND', 'Sending OTP email', { meta: { email } });
    const emailResult = await sendOtpEmail(email, otp);
    await logger.info('EMAIL_SENT', 'OTP email sent successfully', { 
      meta: { email, testMode: emailResult.testMode, previewUrl: emailResult.previewUrl } 
    });

    if (io) io.emit('user-action', { action: 'OTP_SENT', email, timestamp: new Date().toISOString() });

    return res.json({ 
      message: emailResult.message,
      testMode: emailResult.testMode,
      previewUrl: emailResult.previewUrl
    });
  } catch (err) {
    console.error(err);
    await req.app.get('logger')?.info('ERROR', 'sendOtp failed', { meta: { error: String(err) } });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function verifyOtp(req, res) {
  const logger = req.app.get('logger');

  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    if (!email || !otp) return res.status(400).json({ message: 'Email and otp are required' });

    await logger.info('API_CALL', 'POST /api/auth/verify-otp', { meta: { email } });

    const otpDoc = await OTP.findOne({ email, otp });
    await logger.info('DB_OP', 'Lookup OTP', { meta: { email, collection: 'OTP', found: Boolean(otpDoc) } });

    if (!otpDoc) return res.status(401).json({ message: 'Invalid OTP' });
    if (otpDoc.expiresAt.getTime() < Date.now()) return res.status(401).json({ message: 'OTP expired' });

    let user = await User.findOne({ email });
    await logger.info('DB_OP', 'Lookup user', { meta: { email, collection: 'User', found: Boolean(user) } });

    if (!user) {
      user = await User.create({ email, isVerified: true });
      await logger.info('DB_OP', 'Created user', { userId: user._id, meta: { email, collection: 'User' } });
    } else if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
      await logger.info('DB_OP', 'Updated user isVerified=true', { userId: user._id, meta: { email, collection: 'User' } });
    }

    await OTP.deleteMany({ email });
    await logger.info('DB_OP', 'Deleted OTP(s) after verification', { userId: user._id, meta: { email, collection: 'OTP' } });

    // Create a sample notification
    await Notification.create({
      userId: String(user._id),
      message: 'OTP verified successfully. Welcome!',
      read: false,
      createdAt: new Date(),
    });
    await logger.info('DB_OP', 'Created notification', { userId: user._id, meta: { collection: 'Notification' } });

    await logger.info('OTP_VERIFY', 'OTP verified', { userId: user._id, meta: { email } });

    return res.json({
      message: 'OTP verified',
      user: { id: String(user._id), email: user.email, isVerified: user.isVerified },
    });
  } catch (err) {
    console.error(err);
    await req.app.get('logger')?.info('ERROR', 'verifyOtp failed', { meta: { error: String(err) } });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { sendOtp, verifyOtp };

