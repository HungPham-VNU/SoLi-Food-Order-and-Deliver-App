/**
 * Test Push Notification Script
 *
 * Usage:
 * node scripts/test-push.js <FCM_TOKEN> [type]
 *
 * Types: delivered, new_order, cancelled, payment_failed
 */

const http = require('http');

const token = process.argv[2];
const typeArg = process.argv[3] || 'delivered';

if (!token) {
  console.error('\x1b[31mError: FCM Token is required.\x1b[0m');
  console.log('Usage: node scripts/test-push.js <FCM_TOKEN> [type]');
  process.exit(1);
}

const presets = {
  delivered: {
    title: 'Giao hàng thành công 🎉',
    body: 'Đơn hàng #ord-123 đã được giao. Chúc ngon miệng!',
    data: {
      type: 'order_delivered',
      orderId: 'ord-223',
      restaurantName: 'Phở Bà Châm',
    },
  },
  new_order: {
    title: 'Đơn hàng mới! 🔔',
    body: 'Bạn có một đơn hàng mới #ord-156 đang chờ xử lý.',
    data: {
      type: 'new_order_received',
      orderId: 'ord-156',
    },
  },
  cancelled: {
    title: 'Đơn hàng bị hủy ✕',
    body: 'Rất tiếc, đơn hàng #ord-780 đã bị hủy do nhà hàng hết món.',
    data: {
      type: 'order_cancelled',
      orderId: 'ord-742',
      reason: 'Hết món',
    },
  },
  payment_failed: {
    title: 'Thanh toán thất bại !',
    body: 'Giao dịch cho đơn hàng #ord-101 không thành công. Vui lòng thử lại.',
    data: {
      type: 'payment_failed',
      orderId: 'ord-102',
    },
  },
};

const payload = presets[typeArg] || presets.delivered;

const postData = JSON.stringify({
  token: token,
  title: payload.title,
  body: payload.body,
  data: payload.data,
});

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/notifications/test/push',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

console.log(
  `\x1b[36mSending ${typeArg} notification to token:\x1b[0m ${token.substring(0, 20)}...`,
);

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('\x1b[32m✔ Success! Notification sent.\x1b[0m');
    } else {
      console.error(`\x1b[31m✖ Failed with status ${res.statusCode}\x1b[0m`);
      console.log('Response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`\x1b[31m✖ Connection Error:\x1b[0m ${e.message}`);
  console.log('Ensure the gateway is running on http://localhost:8080');
});

req.write(postData);
req.end();
