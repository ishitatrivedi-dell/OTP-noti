const nodemailer = require('nodemailer');

// For development, you can use Ethereal test account
let isTestMode = false;

async function createTestAccount() {
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log('📧 Test email account created:');
    console.log('   Email:', testAccount.user);
    console.log('   Password:', testAccount.pass);
    console.log('   Preview URL: https://ethereal.email/messages');
    
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } catch (error) {
    console.error('Failed to create test email account:', error);
    return null;
  }
}

// Initialize transporter (use test account for development if no real credentials)
async function initTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('⚠️  No email credentials found, using test account (emails will be previewable but not sent)');
    isTestMode = true;
    return await createTestAccount();
  }
  
  // Create Gmail transporter with environment credentials
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

let emailTransporter = null;

async function getEmailTransporter() {
  if (!emailTransporter) {
    emailTransporter = await initTransporter();
  }
  return emailTransporter;
}

async function sendOtpEmail(email, otp) {
  const transporter = await getEmailTransporter();
  
  if (!transporter) {
    throw new Error('Failed to initialize email transporter');
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Transparent Backend Visualizer" <noreply@tbv.com>',
    to: email,
    subject: 'Your OTP Code - Transparent Backend Visualizer',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">Transparent Backend Visualizer</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your One-Time Password</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0; text-align: center;">
          <h2 style="margin: 0 0 10px 0; color: #333;">Your OTP Code</h2>
          <div style="background: white; border: 2px dashed #667eea; padding: 20px; border-radius: 8px; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #667eea;">${otp}</span>
          </div>
          <p style="margin: 20px 0 0 0; color: #666;">This code will expire in 5 minutes</p>
        </div>
        
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>Security Notice:</strong> Never share this OTP with anyone. If you didn't request this code, please ignore this email.
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
    
    if (isTestMode) {
      console.log('📧 Test email sent! Preview URL:', nodemailer.getTestMessageUrl(info));
      return {
        success: true,
        testMode: true,
        previewUrl: nodemailer.getTestMessageUrl(info),
        message: 'OTP sent (test mode). Check console for preview URL.'
      };
    } else {
      console.log('✅ Email sent successfully to:', email);
      return {
        success: true,
        testMode: false,
        message: 'OTP sent successfully to your email.'
      };
    }
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

module.exports = {
  sendOtpEmail,
  getEmailTransporter,
  isTestMode: () => isTestMode,
};
