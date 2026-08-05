import crypto from 'crypto';

const BASE   = 'https://api.paystack.co';
const SECRET = process.env.PAYSTACK_SECRET_KEY ?? '';

export interface PaystackVerifyResult {
  ok:        boolean;
  paid:      boolean;
  amount:    number | null; // kobo
  email:     string | null;
  reference: string;
  message:   string;
}

export interface PaystackInitResult {
  ok:                boolean;
  authorization_url: string | null;
  access_code:       string | null;
  reference:         string | null;
  message:           string;
}

async function paystackFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization:   `Bearer ${SECRET}`,
      'Content-Type':  'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
  return res.json() as Promise<Record<string, unknown>>;
}

export async function verifyPaystackPayment(
  reference: string,
): Promise<PaystackVerifyResult> {
  try {
    const data = await paystackFetch(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );

    const isSuccess = data.status === true;
    const tx  = (data.data as any) ?? {};
    const paid = isSuccess && tx.status === 'success';

    return {
      ok:        isSuccess,
      paid,
      amount:    typeof tx.amount === 'number' ? tx.amount : null,
      email:     tx.customer?.email ?? null,
      reference,
      message:   paid
        ? 'Payment verified successfully.'
        : (data.message as string | undefined) ?? 'Payment could not be verified.',
    };
  } catch (err) {
    console.error('[paystack] verifyPayment error', err);
    return {
      ok:        false,
      paid:      false,
      amount:    null,
      email:     null,
      reference,
      message:   'Paystack verification request failed.',
    };
  }
}

export async function initializePaystackPayment(params: {
  email:     string;
  amount:    number;             // kobo
  reference: string;
  metadata?: Record<string, unknown>;
  callback_url?: string;
}): Promise<PaystackInitResult> {
  try {
    const data = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body:   JSON.stringify(params),
    });
    const d = (data.data as any) ?? {};
    return {
      ok:                data.status === true,
      authorization_url: d.authorization_url ?? null,
      access_code:       d.access_code       ?? null,
      reference:         d.reference         ?? null,
      message:           (data.message as string | undefined) ?? '',
    };
  } catch (err) {
    console.error('[paystack] initializePayment error', err);
    return {
      ok:                false,
      authorization_url: null,
      access_code:       null,
      reference:         null,
      message:           'Paystack initialisation request failed.',
    };
  }
}

/**
 * Validate that a webhook request really came from Paystack.
 * Compare X-Paystack-Signature header against HMAC-SHA512 of the raw body.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  if (!SECRET || !signature) return false;
  const expected = crypto
    .createHmac('sha512', SECRET)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
