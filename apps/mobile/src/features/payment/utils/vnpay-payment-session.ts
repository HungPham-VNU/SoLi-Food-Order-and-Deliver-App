import * as WebBrowser from 'expo-web-browser';

/**
 * The deep-link path that both the API's /payments/vnpay/mobile-return endpoint
 * and Expo's openAuthSessionAsync intercept URL must agree on.
 *
 * IMPORTANT: We deliberately use the production app scheme (uitfood://) here
 * instead of Linking.createURL(), which would produce exp://... in Expo Go.
 * The API always redirects to uitfood://payment/vnpay-return?...params, so the
 * intercept URL passed to openAuthSessionAsync must use the same scheme, otherwise
 * the in-app browser never detects the redirect and stays open.
 *
 * In development with Expo Go: the custom scheme still works because
 * Expo Go registers the uitfood:// scheme on the device via app.json.
 */
const VNPAY_RETURN_DEEP_LINK = 'uitfood://payment/vnpay-return';
export const VNPAY_STATUS_ROUTE = '/(customer)/payment/vnpay-return';

export interface VNPayPaymentSessionResult {
  type: string;
  url?: string;
  params: Record<string, string>;
}

export function getVNPayRedirectUrl(): string {
  return VNPAY_RETURN_DEEP_LINK;
}

export function parseVNPayReturnUrl(url?: string): Record<string, string> {
  if (!url) return {};

  try {
    const parsed = new URL(url);
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
}

export function extractVNPayTxnRef(paymentUrl?: string | null): string {
  if (!paymentUrl) return '';

  try {
    return new URL(paymentUrl).searchParams.get('vnp_TxnRef') ?? '';
  } catch {
    const match = /[?&]vnp_TxnRef=([^&]+)/.exec(paymentUrl);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  }
}

export async function openVNPayPaymentSession(
  paymentUrl: string,
): Promise<VNPayPaymentSessionResult> {
  const result = await WebBrowser.openAuthSessionAsync(
    paymentUrl,
    getVNPayRedirectUrl(),
  );

  if (result.type === 'success') {
    return {
      type: result.type,
      url: result.url,
      params: parseVNPayReturnUrl(result.url),
    };
  }

  return {
    type: result.type,
    params: {},
  };
}

export function buildVNPayStatusRouteParams(input: {
  orderId?: string;
  paymentUrl?: string | null;
  fallbackStatus?: string;
  session?: VNPayPaymentSessionResult;
  browserResult?: string;
}): Record<string, string> {
  const sessionParams = input.session?.params ?? {};
  const txnRef =
    sessionParams['txnRef'] || extractVNPayTxnRef(input.paymentUrl);
  const browserResult = input.session?.type ?? input.browserResult;

  return compactParams({
    orderId: sessionParams['orderId'] || input.orderId,
    txnRef,
    status: sessionParams['status'] || input.fallbackStatus,
    signatureValid: sessionParams['signatureValid'],
    vnpResponseCode: sessionParams['vnpResponseCode'],
    browserResult,
  });
}

function compactParams(
  params: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && entry[1].length > 0,
    ),
  );
}
