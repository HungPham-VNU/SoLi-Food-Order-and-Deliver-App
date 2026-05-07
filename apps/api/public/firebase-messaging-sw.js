/**
 * firebase-messaging-sw.js
 *
 * Firebase Cloud Messaging Service Worker
 *
 * WHY THIS FILE EXISTS:
 *   Firebase Messaging requires a service worker to handle push notifications
 *   when the web app is in the background (tab hidden, minimised, or closed).
 *   When the app is in the foreground, the onMessage() listener in the main
 *   thread handles messages instead. This service worker only runs for
 *   background messages.
 *
 * SCOPE:
 *   This file MUST be served from the root of the origin (/firebase-messaging-sw.js).
 *   The default service worker scope is the directory containing the SW file,
 *   so serving from / gives it control over the entire origin — required by FCM
 *   to deliver push events to any page at this origin.
 *
 * FIREBASE SDK VERSION:
 *   Must match (or be compatible with) the version used in the main app.
 *   We pin to 10.14.1 here to match fcm-test.html. Update both together.
 *
 * LOCAL DEVELOPMENT:
 *   Service workers require HTTPS or localhost. This file works on localhost
 *   without any special configuration. Do NOT attempt to use it on a non-HTTPS
 *   remote host — the browser will refuse to register the service worker.
 *
 * BROWSER SUPPORT:
 *   Chrome, Edge, Firefox (v63+), Safari (v16.4+ on iOS/macOS).
 *   Safari requires explicit permission request via Notification.requestPermission().
 */

// ---------------------------------------------------------------------------
// Firebase SDK import using the compat CDN build for service worker context.
//
// The modular (@firebase/app-compat) package is required because service
// workers do not support ES module imports in all browsers yet.
// ---------------------------------------------------------------------------
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// ---------------------------------------------------------------------------
// Firebase project configuration
//
// These values are safe to expose in client-side/service-worker code.
// They identify the Firebase project but are not authentication credentials.
// The server-side service account key is what must be kept secret.
// ---------------------------------------------------------------------------
firebase.initializeApp({
  apiKey:            'AIzaSyCnWC2VZnrfct6EvdVCcdlG-OUOabgS1dY',
  authDomain:        'soli-food-delivery.firebaseapp.com',
  projectId:         'soli-food-delivery',
  storageBucket:     'soli-food-delivery.firebasestorage.app',
  messagingSenderId: '344352194360',
  appId:             '1:344352194360:web:11b0603425d85663fd4bcd',
});

const messaging = firebase.messaging();

// ---------------------------------------------------------------------------
// Background message handler
//
// This handler fires when a push notification arrives and the web app is
// NOT currently in the foreground (tab hidden, minimised, or closed entirely).
//
// When the tab IS in the foreground, FCM routes the message to the onMessage()
// listener registered in the main thread (see fcm-test.html) instead — this
// handler is NOT called in that case.
//
// The handler below explicitly constructs a native browser notification via
// self.registration.showNotification(). Without this, FCM's default behaviour
// varies by browser: Chrome may show a notification automatically when the
// message has a `notification` payload; Firefox may not. Being explicit ensures
// consistent behaviour across all supported browsers.
// ---------------------------------------------------------------------------
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const title = payload.notification?.title ?? 'SoLi Notification';
  const body  = payload.notification?.body  ?? '';

  const options = {
    body,
    // icon: '/icons/notification-icon.png',  // add when app icons are ready
    badge: '/icons/badge-icon.png',           // optional — shown on Android
    data: payload.data ?? {},                 // forwarded to notificationclick handler
    // tag: payload.data?.notificationId,    // uncomment to collapse duplicate notifs
  };

  self.registration.showNotification(title, options);
});

// ---------------------------------------------------------------------------
// Notification click handler
//
// Fires when the user taps/clicks a background notification displayed by the
// service worker above. Opens (or focuses) the app window and closes the
// notification.
//
// payload.data can carry a `url` key for deep-linking directly to the relevant
// order page. Add this to the FCM data payload from NotificationService when
// needed.
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If the app is already open in a tab, focus it and navigate to the target URL
        for (const client of windowClients) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              client.navigate(targetUrl);
            }
            return;
          }
        }
        // No existing tab found — open a new one
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});
