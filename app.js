const btn = document.getElementById('testBtn');
const msg = document.getElementById('message');
const chkHome = document.getElementById('chkHome');
const chkSupport = document.getElementById('chkSupport');
const chkPerm = document.getElementById('chkPerm');

const DELAY_SECONDS = 15;

const isStandalone =
  window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

const supported =
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function show(text, type) {
  msg.textContent = text;
  msg.className = 'message' + (type ? ' ' + type : '');
}

function setCheck(el, text, good) {
  el.textContent = text;
  el.className = good ? 'yes' : 'no';
}

function updateChecks() {
  setCheck(chkHome, isStandalone ? 'Yes' : 'No', isStandalone);
  setCheck(chkSupport, supported ? 'Yes' : 'No', supported);
  const perm = 'Notification' in window ? Notification.permission : 'n/a';
  setCheck(chkPerm, perm, perm === 'granted');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Register the service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    show('Could not start the service worker: ' + err.message, 'bad');
  });
}

updateChecks();

if (!isStandalone) {
  show('Step 1: add this app to your Home Screen, then open it from there.', 'bad');
} else if (!supported) {
  show('This iPhone or iOS version does not support web notifications. You need iOS 16.4 or newer.', 'bad');
}

async function getSubscription() {
  const reg = await navigator.serviceWorker.ready;

  const res = await fetch('/api/vapid-public-key');
  const { key } = await res.json();

  let sub = await reg.pushManager.getSubscription();

  // If the server's key changed, the old subscription no longer works.
  if (sub && localStorage.getItem('vapidKey') !== key) {
    await sub.unsubscribe();
    sub = null;
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    localStorage.setItem('vapidKey', key);
  }
  return sub;
}

function countdown(seconds) {
  let left = seconds;
  show('Sent! Lock your iPhone NOW (press the side button). Notification in ' + left + ' seconds…', 'ok');
  const timer = setInterval(() => {
    left -= 1;
    if (left > 0) {
      show('Lock your iPhone NOW. Notification in ' + left + ' seconds…', 'ok');
    } else {
      clearInterval(timer);
      show('It should have arrived. Did you see "Test Alert" on the lock screen?', 'ok');
      btn.disabled = false;
    }
  }, 1000);
}

btn.addEventListener('click', async () => {
  if (!isStandalone) {
    show('Open this app from the Home Screen icon first (see the instructions).', 'bad');
    return;
  }
  if (!supported) {
    show('Web notifications are not supported here. You need iOS 16.4 or newer.', 'bad');
    return;
  }

  btn.disabled = true;

  try {
    // iOS only allows the permission question right after a tap, so do it first.
    const permission = await Notification.requestPermission();
    updateChecks();
    if (permission !== 'granted') {
      show('Notifications are blocked. Go to Settings > Notifications > Alert Test and turn them on.', 'bad');
      btn.disabled = false;
      return;
    }

    show('Setting things up…');
    const subscription = await getSubscription();

    const res = await fetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, delaySeconds: DELAY_SECONDS }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Server error');

    countdown(DELAY_SECONDS);
  } catch (err) {
    show('Something went wrong: ' + err.message, 'bad');
    btn.disabled = false;
  }
});
