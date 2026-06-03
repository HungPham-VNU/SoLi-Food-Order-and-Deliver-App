/**
 * vnpay.service.spec.ts
 *
 * Unit tests for the security-critical VNPayService.
 * Verifies HMAC SHA512 signing/verification round-trip with a known fixed secret,
 * along with edge cases that have historically caused production bugs:
 *  - missing vnp_SecureHash → reject without DB writes
 *  - vnp_SecureHashType must be stripped before re-signing
 *  - signature mismatch → reject
 *  - response paid only when ResponseCode AND TransactionStatus = '00'
 *  - localhost IPs replaced with public dummy
 *  - URL-encoded query string structure
 */
import { VNPayService } from './vnpay.service';
import * as crypto from 'crypto';

const SECRET = 'TESTSECRETKEY1234567890';

function buildService(): VNPayService {
  const svc = new VNPayService({
    tmnCode: 'TESTTMN',
    hashSecret: SECRET,
    url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: 'https://soli.app/payment/return',
    sessionTimeoutSeconds: 1800,
  });
  svc.onModuleInit();
  return svc;
}

/**
 * Replicates the engine's buildHashData so tests can sign synthetic IPNs.
 * Mirrors PHP urlencode semantics (space → '+') as the production code does.
 */
function buildHashData(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map(
      (k) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`,
    )
    .join('&');
}

function sign(params: Record<string, string>): string {
  return crypto
    .createHmac('sha512', SECRET)
    .update(Buffer.from(buildHashData(params), 'utf-8'))
    .digest('hex');
}

describe('VNPayService', () => {
  let service: VNPayService;

  beforeEach(() => {
    service = buildService();
  });

  describe('buildPaymentUrl', () => {
    it('produces a URL containing required VNPay params and vnp_SecureHash', () => {
      const url = service.buildPaymentUrl({
        txnRef: 'tx-001',
        amount: 50_000,
        ipAddr: '1.2.3.4',
      });
      expect(url).toContain('vnp_TmnCode=TESTTMN');
      expect(url).toContain('vnp_Amount=5000000'); // 50_000 × 100
      expect(url).toContain('vnp_TxnRef=tx-001');
      expect(url).toContain('vnp_SecureHash=');
      expect(url.startsWith('https://sandbox.vnpayment.vn/')).toBe(true);
    });

    it('replaces localhost IPv4 with public dummy', () => {
      const url = service.buildPaymentUrl({
        txnRef: 'tx-1',
        amount: 50_000,
        ipAddr: '127.0.0.1',
      });
      expect(url).toContain('vnp_IpAddr=1.1.1.1');
      expect(url).not.toContain('127.0.0.1');
    });

    it('replaces IPv6 loopback with public dummy', () => {
      const url = service.buildPaymentUrl({
        txnRef: 'tx-1',
        amount: 50_000,
        ipAddr: '::1',
      });
      expect(url).toContain('vnp_IpAddr=1.1.1.1');
    });

    it('strips IPv4-mapped IPv6 prefix', () => {
      const url = service.buildPaymentUrl({
        txnRef: 'tx-1',
        amount: 50_000,
        ipAddr: '::ffff:8.8.8.8',
      });
      expect(url).toContain('vnp_IpAddr=8.8.8.8');
    });

    it('rejects non-positive payment amounts', () => {
      expect(() =>
        service.buildPaymentUrl({
          txnRef: 'tx-zero',
          amount: 0,
          ipAddr: '1.2.3.4',
        }),
      ).toThrow('positive integer VND');
    });
  });

  describe('verifyIpn', () => {
    const baseValid = {
      vnp_TmnCode: 'TESTTMN',
      vnp_Amount: '5000000',
      vnp_BankCode: 'NCB',
      vnp_OrderInfo: 'SoLi_Order_tx-1',
      vnp_PayDate: '20260615120000',
      vnp_ResponseCode: '00',
      vnp_TransactionNo: '14123456',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: 'tx-1',
    };

    it('returns valid=true and responsePaid=true on properly signed success', () => {
      const expectedHash = sign(baseValid);
      const result = service.verifyIpn({
        ...baseValid,
        vnp_SecureHash: expectedHash,
      });
      expect(result.valid).toBe(true);
      expect(result.responsePaid).toBe(true);
      expect(result.amount).toBe(50_000);
      expect(result.txnRef).toBe('tx-1');
      expect(result.providerTxnId).toBe('14123456');
    });

    it('strips vnp_SecureHashType before re-signing (does not break valid IPN)', () => {
      const expectedHash = sign(baseValid);
      const result = service.verifyIpn({
        ...baseValid,
        vnp_SecureHashType: 'HmacSHA512',
        vnp_SecureHash: expectedHash,
      });
      expect(result.valid).toBe(true);
    });

    it('rejects when vnp_SecureHash is missing', () => {
      const result = service.verifyIpn({ ...baseValid });
      expect(result.valid).toBe(false);
      expect(result.amount).toBe(0);
      expect(result.txnRef).toBe('');
      expect(result.providerTxnId).toBe('');
    });

    it('rejects when signature does not match', () => {
      const result = service.verifyIpn({
        ...baseValid,
        vnp_SecureHash: 'a'.repeat(128),
      });
      expect(result.valid).toBe(false);
      expect(result.responsePaid).toBe(false);
    });

    it('valid signature but ResponseCode != 00 → responsePaid=false', () => {
      const failed = { ...baseValid, vnp_ResponseCode: '24' };
      const result = service.verifyIpn({
        ...failed,
        vnp_SecureHash: sign(failed),
      });
      expect(result.valid).toBe(true);
      expect(result.responsePaid).toBe(false);
    });

    it('valid signature but TransactionStatus != 00 → responsePaid=false', () => {
      const failed = { ...baseValid, vnp_TransactionStatus: '02' };
      const result = service.verifyIpn({
        ...failed,
        vnp_SecureHash: sign(failed),
      });
      expect(result.valid).toBe(true);
      expect(result.responsePaid).toBe(false);
    });

    it('accepts uppercase hash (VNPay sometimes sends uppercase)', () => {
      const expectedHash = sign(baseValid).toUpperCase();
      const result = service.verifyIpn({
        ...baseValid,
        vnp_SecureHash: expectedHash,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('verifyReturn', () => {
    it('verifies signature without writing any state and returns code', () => {
      const params = {
        vnp_ResponseCode: '00',
        vnp_TxnRef: 'tx-1',
      };
      const result = service.verifyReturn({
        ...params,
        vnp_SecureHash: sign(params),
      });
      expect(result.valid).toBe(true);
      expect(result.code).toBe('00');
    });

    it('returns valid=false on missing hash with code passthrough', () => {
      const result = service.verifyReturn({ vnp_ResponseCode: '24' });
      expect(result.valid).toBe(false);
      expect(result.code).toBe('24');
    });
  });
});
