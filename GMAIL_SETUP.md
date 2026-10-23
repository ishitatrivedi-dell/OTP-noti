# Gmail setup for real OTP email delivery

The app defaults to `EMAIL_MODE=test`, which uses Ethereal preview emails only.
To deliver OTPs to real inboxes, configure Gmail explicitly:

1. Enable 2-Step Verification on your Google account.
2. Create an App Password under Google Account → Security → App passwords.
3. Edit `backend/.env`:

   ```env
   EMAIL_MODE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-character-app-password
   ```

   `EMAIL_PASS` must be a Google App Password, not your regular account
   password. Whitespace in the value is stripped automatically. Gmail sends
   from the configured `EMAIL_USER` address.
4. Restart the backend and send an OTP to an inbox you can check.

If email delivery fails, the backend reports an error and the OTP request will
not report success. Check the backend console and confirm the Gmail credentials
and network connection. For the Ethereal preview workflow and MongoDB setup,
see [EMAIL_SETUP.md](./EMAIL_SETUP.md).
