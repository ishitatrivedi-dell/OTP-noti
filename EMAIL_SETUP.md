# Email Setup Instructions for OTP System

## 📧 Overview

The application now sends actual emails instead of simulated console output. You have two options:

1. **Test Mode (Default)**: Uses Ethereal test emails (preview only)
2. **Production Mode**: Uses real Gmail SMTP

---

## 🧪 Test Mode (Default - No Setup Required)

The application automatically uses test mode if no email credentials are provided:

- Emails are **not actually sent** to real addresses
- You get a **preview URL** in the console to view the email
- Perfect for development and testing

**What happens in test mode:**
1. Enter your email in the app
2. Click "Send OTP"
3. Check the backend console for a preview URL
4. Click the URL to see your OTP email

---

## 📧 Production Mode (Real Emails)

### Option 1: Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Google Account
2. **Generate an App Password**:
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Security → 2-Step Verification → App passwords
   - Select "Mail" and generate a 16-character password
3. **Create `.env` file** in the `backend` directory:

```bash
cp .env.example .env
```

4. **Edit `.env`** with your credentials:

```env
# Your Gmail address
EMAIL_USER=your-email@gmail.com

# Your 16-character App Password (NOT your regular password)
EMAIL_PASS=abcd efgh ijkl mnop

# Optional: Custom from address
EMAIL_FROM="Transparent Backend Visualizer" <noreply@tbv.com>

# Server and DB settings
PORT=5001
MONGO_URI=mongodb://127.0.0.1:27017/transparent-backend-visualizer
```

5. **Restart the backend server**:

```bash
cd backend
npm start
```

### Option 2: Other Email Services

You can modify `backend/services/emailService.js` to use:
- Outlook/Hotmail
- SendGrid
- Mailgun
- AWS SES
- Any SMTP service

---

## 🔍 Testing the Email System

### Test Mode Testing:
1. Start the backend: `npm start`
2. Open the frontend: `http://localhost:5173`
3. Enter any email address
4. Click "Send OTP"
5. Check the backend console for the preview URL
6. Click the URL to see your OTP email

### Production Mode Testing:
1. Set up your `.env` file with real credentials
2. Restart the backend
3. Enter your real email address
4. Click "Send OTP"
5. Check your email inbox for the OTP

---

## 🐛 Troubleshooting

### Gmail Issues:
- **"Invalid credentials"**: Make sure you're using an App Password, not your regular password
- **"Less secure app access"**: You need 2FA + App Password, not the "less secure apps" setting
- **"Connection timeout"**: Check your internet connection and firewall

### General Issues:
- **Check the backend console** for detailed error messages
- **Ensure `.env` file** is in the correct location (`backend/` directory)
- **Restart the server** after changing `.env` file

### Test Mode Issues:
- If Ethereal fails to create test account, the app will fall back to console simulation
- Check the console for the test account credentials and preview URL

---

## 📝 Email Template Features

The email template includes:
- **Professional design** with gradient header
- **Large, readable OTP code**
- **Security notice** about OTP usage
- **Expiration information** (5 minutes)
- **Responsive design** for mobile devices

---

## 🔒 Security Notes

- **Never commit your `.env` file** to version control
- **Use App Passwords** instead of regular passwords
- **Consider using email services** like SendGrid for production
- **OTP expires in 5 minutes** for security
- **Only one active OTP per email** at any time

---

## 📞 Support

If you encounter issues:
1. Check the backend console logs
2. Verify your `.env` configuration
3. Ensure MongoDB is running
4. Test with the test mode first
