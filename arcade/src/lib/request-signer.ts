import { createHmac } from 'crypto';

const API_SECRET = process.env.API_SIGNING_SECRET || 'dev-secret-change-in-production';

interface SignedPayload {
    payload: string;
    signature: string;
    timestamp: number;
}

/**
 * Creates HMAC-SHA256 signature for API request authentication.
 */
export function signPayload(payload: object): SignedPayload {
    const timestamp = Date.now();
    const payloadStr = JSON.stringify({ ...payload, timestamp });
    const signature = createHmac('sha256', API_SECRET)
        .update(payloadStr)
        .digest('hex');

    return { payload: payloadStr, signature, timestamp };
}

/**
 * Verifies HMAC signature and checks timestamp freshness (5 minute window).
 */
export function verifySignature(
    payload: string,
    signature: string,
    timestamp: number
): { valid: boolean; reason?: string } {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    if (now - timestamp > maxAge) {
        return { valid: false, reason: 'Request expired' };
    }

    const expected = createHmac('sha256', API_SECRET)
        .update(payload)
        .digest('hex');

    if (signature !== expected) {
        return { valid: false, reason: 'Invalid signature' };
    }

    return { valid: true };
}
