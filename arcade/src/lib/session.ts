import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SIGNER_PRIVATE_KEY;
if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
}

const secret = new TextEncoder().encode(SESSION_SECRET);
const SESSION_COOKIE_NAME = 'arcade_session';
const SESSION_DURATION = 24 * 60 * 60; // 24 hours in seconds

export interface SessionPayload {
    wallet: string;
    iat: number;
    exp: number;
}

/**
 * Create a session token for authenticated wallet
 */
export async function createSessionToken(wallet: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const token = await new SignJWT({ wallet: wallet.toLowerCase() })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(now)
        .setExpirationTime(now + SESSION_DURATION)
        .sign(secret);

    return token;
}

/**
 * Verify and decode a session token
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, secret);
        return payload as unknown as SessionPayload;
    } catch {
        return null;
    }
}

/**
 * Get wallet address from request session cookie
 * Returns null if not authenticated
 */
export async function getSessionWallet(request: Request): Promise<string | null> {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookies = Object.fromEntries(
        cookieHeader.split('; ').map(c => {
            const [key, ...val] = c.split('=');
            return [key, val.join('=')];
        })
    );

    const token = cookies[SESSION_COOKIE_NAME];
    if (!token) return null;

    const payload = await verifySessionToken(token);
    return payload?.wallet || null;
}

/**
 * Set session cookie in response
 */
export function createSessionCookie(token: string): string {
    const maxAge = SESSION_DURATION;
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

/**
 * Create cookie to clear the session
 */
export function clearSessionCookie(): string {
    return `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Generate a random challenge for wallet signing
 */
export function generateChallenge(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `arcade-auth-${timestamp}-${random}`;
}

/**
 * Create the message that wallet will sign
 */
export function createSignMessage(challenge: string): string {
    return `Verify wallet ownership for ARCade gaming session. No gas required.\n\nChallenge: ${challenge}`;
}
