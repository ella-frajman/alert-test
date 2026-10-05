// Very small server. It does 3 things:
// 1. Serves the web app files in the "public" folder.
// 2. Gives the app its public "VAPID" key (needed for Web Push).
// 3. When asked, sends a push notification to the iPhone after a short delay.

const express = require('express');
const webpush = require('web-push');
const path = require('path');

const app = express();
app.use(express.json());

// --- VAPID keys (the "ID card" of this server for Web Push) ---
let publicKey = process.env.VAPID_PUBLIC_KEY;
let privateKey = process.env.VAPID_PRIVATE_KEY;

if (!publicKey || !privateKey) {
  const keys = webpush.generateVAPIDKeys();
  publicKey = keys.publicKey;
  privateKey = keys.privateKey;
  console.log('No VAPID keys were set, so temporary keys were created.');
  console.log('That is fine for this test.');
}

const subject = process.env.VAPID_SUBJECT || 'mailto:student@example.com';
webpush.setVapidDetails(subject, publicKey, privateKey);

// --- Serve the app files ---
app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders(res, filePath) {
      // Always re-check the service worker and manifest so updates arrive fast
      if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// --- Give the app the public key ---
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ key: publicKey });
});

// --- Send a test notification after a delay ---
app.post('/api/test', (req, res) => {
  const { subscription, delaySeconds } = req.body || {};

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ ok: false, error: 'Missing subscription.' });
  }

  const delay = Math.min(Math.max(Number(delaySeconds) || 15, 0), 60);

  const payload = JSON.stringify({
    title: 'Test Alert',
    body: 'This is a visual alert for our accessibility project.',
  });

  setTimeout(() => {
    webpush
      .sendNotification(subscription, payload, { TTL: 60, urgency: 'high' })
      .then(() => console.log('Push sent OK.'))
      .catch((err) =>
        console.log('Push FAILED:', err.statusCode, err.body || err.message)
      );
  }, delay * 1000);

  res.json({ ok: true, delaySeconds: delay });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server running on port ' + port));
