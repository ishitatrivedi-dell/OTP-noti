# 📧 Gmail Setup for Real Email Delivery

## 🔑 Step-by-Step Instructions

### 1. Enable 2-Step Verification
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Click **"Security"** on the left sidebar
3. Find **"2-Step Verification"** and click it
4. If not enabled, click **"Get Started"** and follow the setup

### 2. Generate App Password
1. Still in **Security** settings, scroll down to **"App passwords"**
2. Click **"App passwords"** (you may need to sign in again)
3. Under **"Select app"**, choose **"Mail"**
4. Under **"Select device"**, choose **"Other (Custom name)"**
5. Enter **"Transparent Backend Visualizer"** and click **"Generate"**
6. **Copy the 16-character password** (it will look like: `abcd efgh ijkl mnop`)

### 3. Configure Your .env File
1. Open `backend/.env` file
2. Replace the placeholder values:

```env
# Replace with your actual Gmail
EMAIL_USER=your-actual-email@gmail.com

# Replace with the 16-character App Password (include spaces!)
EMAIL_PASS=abcd efgh ijkl mnop
```

### 4. Restart the Backend Server
```bash
# Stop the current server (Ctrl+C)
# Then restart:
cd backend
npm start
```

## 🧪 Test Real Email Delivery

1. Open the app: http://localhost:5173
2. Enter **your real email address**
3. Click **"Send OTP"**
4. Check your **Gmail inbox** for the OTP email!
5. The email should arrive within seconds

## 📧 Email Template Features

Your real emails will include:
- 🎨 Professional gradient design
- 🔢 Large, readable OTP code
- ⏰ 5-minute expiration notice
- 🔒 Security warnings
- 📱 Mobile-responsive layout

## 🔧 Troubleshooting

### "Invalid credentials" error:
- Make sure you're using the **App Password**, not your regular password
- Include all spaces in the 16-character password
- Double-check your email address spelling

### "Connection timeout" error:
- Check your internet connection
- Try restarting the backend server
- Ensure Gmail SMTP isn't blocked by your firewall

### Email not arriving:
- Check your Gmail spam folder
- Verify the email address is correct
- Look for any error messages in the backend console

## 🎯 Success!

Once configured, you'll receive real OTP emails instead of preview links. The system will automatically detect your credentials and switch from test mode to production mode.

**Before**: "Check console for preview URL"
**After**: "OTP sent successfully to your email!"
