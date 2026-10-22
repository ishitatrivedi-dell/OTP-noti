const nodemailer = require('nodemailer');

/**
 * Uses an Ethereal account for preview-only email unless Gmail is explicitly enabled.
 */
async function createTransporter() {
  const mode = (process.env.EMAIL_MODE || 'test').trim().toLowerCase();

  if (mode === 'test') {
    const account = await nodemailer.createTestAccount();
    console.log('📧 Email test mode enabled; messages will not be delivered to real inboxes.');
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: account.user, pass: account.pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  if (mode !== 'gmail') {
    throw new Error('EMAIL_MODE must be either "test" or "gmail".');
  }

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    throw new Error('EMAIL_MODE=gmail requires EMAIL_USER and EMAIL_PASS.');
  }

  console.log('📧 Creating Gmail transporter.');
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass: pass.replace(/\s/g, '') },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

let transporterPromise = null;

/**
 * Returns the cached transporter, or creates and caches one.
 */
async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = createTransporter().catch((error) => {
      transporterPromise = null;
      throw error;
    });
  }
  return transporterPromise;
}

/**
 * Sends an OTP email to the given address.
 * @param {string} toEmail - recipient email
 * @param {string} otp - 6-digit OTP string
 */
async function sendOtpEmail(toEmail, otp) {
  console.log('📤 Sending OTP email.');

  const transporter = await getTransporter();

  const isGmailMode = process.env.EMAIL_MODE?.trim().toLowerCase() === 'gmail';
  const fromAddress = isGmailMode
    ? `"Transparent Backend Visualizer" <${process.env.EMAIL_USER}>`
    : process.env.EMAIL_FROM || '"Transparent Backend Visualizer" <no-reply@example.com>';

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
    console.log(`✅ OTP email sent — Message ID: ${info.messageId}`);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`🔎 Preview test email: ${previewUrl}`);
    }
    return {
      success: true,
      message: previewUrl
        ? 'Test email sent. Open the preview link to view it.'
        : 'OTP sent successfully to your email.',
      testMode: Boolean(previewUrl),
      ...(previewUrl ? { previewUrl } : {}),
    };
  } catch (error) {
    transporterPromise = null;

    console.error('❌ Failed to send email:', error.message);

    if (error.code === 'EAUTH' && process.env.EMAIL_MODE?.trim().toLowerCase() === 'gmail') {
      throw new Error(
        'Gmail authentication failed. Ensure EMAIL_USER and EMAIL_PASS are correct and use a Gmail App Password.'
      );
    }
    if (error.code === 'ECONNECTION' || error.code === 'ENOTFOUND') {
      throw new Error('Could not connect to the email service. Check your network connection.');
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
    const transporter = await getTransporter();
    await transporter.verify();
    console.log('✅ Email connection test passed');
    return { success: true, message: 'Email connection successful' };
  } catch (error) {
    transporterPromise = null;
    console.error('❌ Email connection test failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendOtpEmail, testEmailConnection };
