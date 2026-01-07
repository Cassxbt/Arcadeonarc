/**
 * Client-side request signing using Web Crypto API.
 * Creates HMAC signatures to authenticate API requests.
 */

const API_SECRET = process.env.NEXT_PUBLIC_API_SIGNING_SECRET || 'dev-secret-change-in-production';

async function hmacSign(message: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export interface SignedRequest {
    payload: object;
    signature: string;
    timestamp: number;
}

export async function signRequest(payload: object): Promise<SignedRequest> {
    const timestamp = Date.now();
    const payloadWithTimestamp = { ...payload, timestamp };
    const payloadStr = JSON.stringify(payloadWithTimestamp);
    const signature = await hmacSign(payloadStr, API_SECRET);

    return {
        payload: payloadWithTimestamp,
        signature,
        timestamp,
    };
}
