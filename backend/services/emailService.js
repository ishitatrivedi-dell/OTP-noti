const nodemailer = require('nodemailer');

/**
 * Creates a Gmail transporter using env credentials.
 * Returns null if credentials are missing.
 */
function createGmailTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.error('❌ EMAIL_USER or EMAIL_PASS is not set in environment variables.');
    return null;
  }

  console.log('📧 Creating Gmail transporter for:', user);

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

// Module-level transporter cache
let emailTransporter = null;

/**
 * Returns the cached transporter, or creates a new one.
 * Resets cache if transporter is null so it can retry.
 */
function getTransporter() {
  if (!emailTransporter) {
    emailTransporter = createGmailTransporter();
  }
  return emailTransporter;
}

/**
 * Sends an OTP email to the given address.
 * @param {string} toEmail - recipient email
 * @param {string} otp - 6-digit OTP string
 */
async function sendOtpEmail(toEmail, otp) {
  console.log(`📤 Sending OTP email to: ${toEmail}`);

  const transporter = getTransporter();

  if (!transporter) {
    throw new Error(
      'Email service is not configured. Set EMAIL_USER and EMAIL_PASS environment variables.'
    );
  }

  const fromAddress =
    process.env.EMAIL_FROM ||
    `"Transparent Backend Visualizer" <${process.env.EMAIL_USER}>`;

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: 'Your OTP Code – Transparent Backend Visualizer',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">Transparent Backend Visualizer</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your One-Time Password</p>
        </div>

        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0; text-align: center;">
          <h2 style="margin: 0 0 10px 0; color: #333;">Your OTP Code</h2>
          <div style="background: white; border: 2px dashed #667eea; padding: 20px; border-radius: 8px; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea;">${otp}</span>
          </div>
          <p style="margin: 20px 0 0 0; color: #666;">This code expires in <strong>5 minutes</strong>.</p>
        </div>

        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>Security Notice:</strong> Never share this OTP with anyone.
            If you did not request this code, please ignore this email.
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>This is an automated message from Transparent Backend Visualizer</p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${toEmail} — Message ID: ${info.messageId}`);
    return {
      success: true,
      message: 'OTP sent successfully to your email.',
    };
  } catch (error) {
    // Reset transporter cache so next request gets a fresh one
    emailTransporter = null;

    console.error('❌ Failed to send email:', error.message);

    if (error.code === 'EAUTH') {
      throw new Error(
        'Gmail authentication failed. Ensure EMAIL_USER and EMAIL_PASS are correct and the App Password has no spaces.'
      );
    }
    if (error.code === 'ECONNECTION' || error.code === 'ENOTFOUND') {
      throw new Error('Could not connect to Gmail SMTP. Check your network connection.');
    }
    if (error.code === 'ETIMEDOUT') {
      throw new Error('Email sending timed out. Please try again.');
    }

    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Verifies the Gmail SMTP connection without sending a mail.
 */
async function testEmailConnection() {
  try {
    console.log('🧪 Testing email connection...');
    const transporter = getTransporter();
    if (!transporter) {
      return { success: false, error: 'No transporter — EMAIL_USER or EMAIL_PASS missing.' };
    }
    await transporter.verify();
    console.log('✅ Email connection test passed');
    return { success: true, message: 'Email connection successful' };
  } catch (error) {
    // Reset so next call retries
    emailTransporter = null;
    console.error('❌ Email connection test failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendOtpEmail, testEmailConnection };
