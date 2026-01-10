

import { jwtVerify, createRemoteJWKSet } from 'jose';
import { DYNAMIC_ENVIRONMENT_ID } from './constants';

const JWKS_URL = `https://app.dynamic.xyz/api/v0/sdk/${DYNAMIC_ENVIRONMENT_ID}/.well-known/jwks`;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
    if (!jwks) {
        jwks = createRemoteJWKSet(new URL(JWKS_URL));
    }
    return jwks;
}

interface DynamicJWTPayload {
    sub: string;
    email?: string;
    verified_credentials?: Array<{
        address?: string;
        chain?: string;
        wallet_name?: string;
        wallet_provider?: string;
        format?: string;
    }>;
    iat: number;
    exp: number;
    iss: string;
    aud: string;
}

/**
 * Verify a Dynamic JWT token and extract wallet address
 * Returns the wallet address if valid, null otherwise
 */
export async function verifyDynamicJWT(token: string): Promise<{ wallet: string; userId: string } | null> {
    try {
        const { payload } = await jwtVerify(token, getJWKS());

        const dynamicPayload = payload as unknown as DynamicJWTPayload;
        const credentials = dynamicPayload.verified_credentials || [];

        const walletCredential =
            credentials.find((cred) => cred.address && cred.wallet_provider === 'embeddedWallet') ||
            credentials.find((cred) => cred.address && cred.format === 'blockchain') ||
            credentials.find((cred) => cred.address);

        if (!walletCredential?.address) {
            return null;
        }

        return {
            wallet: walletCredential.address.toLowerCase(),
            userId: dynamicPayload.sub,
        };
    } catch (error) {
        console.error('JWT verification failed:', error);
        return null;
    }
}

/**
 * Extract JWT from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.slice(7);
}

/**
 * Get verified wallet from request Authorization header
 */
export async function getVerifiedWallet(request: Request): Promise<string | null> {
    const authHeader = request.headers.get('Authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
        return null;
    }

    const verified = await verifyDynamicJWT(token);
    return verified?.wallet || null;
}
