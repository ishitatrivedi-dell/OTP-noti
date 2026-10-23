# Email and local development setup

OTP emails have two modes. The default `test` mode uses Ethereal: messages are
not delivered to real inboxes, but the backend logs a preview URL and the login
page shows the same link after requesting an OTP. Set `EMAIL_MODE=test` in
`backend/.env` (or omit `EMAIL_MODE`) for development.

## Start the application

1. Start MongoDB locally, or set `MONGO_URI` in `backend/.env` to a reachable
   MongoDB deployment. The backend tries `MONGO_URI` first and then
   `LOCAL_MONGO_URI` (defaulting to local MongoDB). Both URIs must include
   credentials if their MongoDB servers require authentication. The backend
   verifies that it can read the logs collection and exits with a clear error
   if neither connection works. MongoDB is required for OTP, user,
   notification, and log storage.
2. Copy `backend/.env.example` to `backend/.env` and adjust the server and
   database settings.
3. Start the backend:

   ```bash
   cd backend
   npm install
   npm start
   ```

4. In another terminal, start the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Open the Vite URL, enter an email address, and choose **Send OTP**. In test
   mode, open the preview link shown by the page or backend console, then enter
   the code from the preview email.

Ethereal account creation requires an internet connection. If the service
cannot be reached, the OTP request returns an error; the app does not silently
pretend that an email was sent.

## Send real email through Gmail

1. Enable 2-Step Verification for your Google account.
2. Create a Google App Password for Mail.
3. In `backend/.env`, set `EMAIL_MODE=gmail`, `EMAIL_USER` to the Gmail address,
   and `EMAIL_PASS` to the App Password. Spaces in the password are removed.
   Gmail sends from the configured `EMAIL_USER` address.
4. Restart the backend and verify delivery to an inbox you control.

Example:

```env
EMAIL_MODE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password
```

Never commit `backend/.env` or use your regular Google account password.
OTP codes expire after five minutes.

For an authenticated local MongoDB, configure a URI like
`mongodb://username:password@127.0.0.1:27017/transparent-backend-visualizer?authSource=admin`
as `LOCAL_MONGO_URI`. URL-encode reserved characters in the username or password.
If the configured Atlas URI reports `querySrv ENOTFOUND`, check the cluster
hostname, DNS/internet connectivity, and Atlas network access configuration.
