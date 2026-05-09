/**
 * Diagnostic script — tests:
 * 1. Service account can get an OAuth2 access token
 * 2. FCM HTTP v1 API returns meaningful response (even if permission denied)
 * Run: node test-fcm-auth.mjs
 */
import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'fs';
import https from 'https';

const KEY_PATH = './soli-food-delivery-FCM-key.json';
const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
const PROJECT_ID = key.project_id;
const CLIENT_EMAIL = key.client_email;

console.log(`\n--- FCM Auth Diagnostic ---`);
console.log(`Project ID  : ${PROJECT_ID}`);
console.log(`Client email: ${CLIENT_EMAIL}`);

// Step 1: Get access token
const auth = new GoogleAuth({
  credentials: key,
  scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
});

let accessToken;
try {
  accessToken = await auth.getAccessToken();
  console.log(`\n✅ OAuth2 token obtained: ${accessToken.substring(0, 40)}...`);
} catch (err) {
  console.error(`\n❌ OAuth2 token FAILED: ${err.message}`);
  console.error('This means the service account private key is invalid or the key is revoked.');
  process.exit(1);
}

// Step 2: Try a dry-run FCM send via REST API (validate:only mode)
// This checks if the service account HAS FCM permission without actually sending.
const DUMMY_TOKEN = 'dJUG-tG7LjFmYTVW2JP4-fake-for-validate-only';
const body = JSON.stringify({
  validate_only: true,
  message: {
    token: DUMMY_TOKEN,
    notification: { title: 'Diagnostic', body: 'FCM auth test' },
  },
});

const options = {
  hostname: 'fcm.googleapis.com',
  path: `/v1/projects/${PROJECT_ID}/messages:send`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

console.log(`\nTesting FCM HTTP v1 API (validate_only=true)...`);
console.log(`POST https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`);

const result = await new Promise((resolve, reject) => {
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve({ status: res.statusCode, body: data }));
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

console.log(`\nFCM API response status: ${result.status}`);
try {
  const parsed = JSON.parse(result.body);
  console.log(`FCM API response body:`, JSON.stringify(parsed, null, 2));

  if (result.status === 200) {
    console.log(`\n✅ FCM API permission CONFIRMED — service account CAN send messages!`);
    console.log(`(validate_only=true means no real message was sent)`);
  } else if (result.status === 403) {
    const errorCode = parsed.error?.status;
    const msg = parsed.error?.message;
    console.log(`\n❌ FCM API permission DENIED (403)`);
    console.log(`Error code   : ${errorCode}`);
    console.log(`Error message: ${msg}`);
    console.log(`\nFIX REQUIRED (choose one):`);
    console.log(`  1. Enable Firebase Cloud Messaging API:`);
    console.log(`     https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=${PROJECT_ID}`);
    console.log(`  2. Grant service account FCM Admin role:`);
    console.log(`     https://console.cloud.google.com/iam-admin/iam?project=${PROJECT_ID}`);
    console.log(`     Grant "${CLIENT_EMAIL}" the role "Firebase Cloud Messaging Admin"`);
    console.log(`  3. Use the default Firebase Admin SDK service account instead:`);
    console.log(`     Firebase Console → Project Settings → Service Accounts → Generate New Private Key`);
  } else if (result.status === 400) {
    console.log(`\n✅ FCM API accessible (400 = bad token format, expected for dummy token)`);
    console.log(`Service account HAS FCM permission — the issue is with the token itself.`);
  } else {
    console.log(`\n⚠️  Unexpected status. Check response body above.`);
  }
} catch {
  console.log('Raw response:', result.body);
}
