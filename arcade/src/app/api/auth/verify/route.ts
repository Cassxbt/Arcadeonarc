import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { createSessionToken, createSessionCookie, createSignMessage } from '@/lib/session';
import { consumeAuthChallenge } from '@/lib/auth-challenges';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    const clientIp = getClientIp(request);
    const { success: rateLimitOk } = await checkRateLimit(clientIp);
    if (!rateLimitOk) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const { wallet, signature, challenge } = await request.json();

        if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
        }

        if (!signature) {
            return NextResponse.json({ error: 'Signature required' }, { status: 400 });
        }

        if (!challenge || typeof challenge !== 'string') {
            return NextResponse.json({ error: 'Challenge required' }, { status: 400 });
        }

        const walletLower = wallet.toLowerCase();

        const challengeOk = await consumeAuthChallenge(walletLower, challenge);
        if (!challengeOk) {
            return NextResponse.json({ error: 'Challenge expired or not found' }, { status: 400 });
        }

        // Verify the signature
        const message = createSignMessage(challenge);
        const isValid = await verifyMessage({
            address: wallet as `0x${string}`,
            message,
            signature: signature as `0x${string}`,
        });

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const token = await createSessionToken(walletLower);
        const cookie = createSessionCookie(token);

        const response = NextResponse.json({ success: true, wallet: walletLower });
        response.headers.set('Set-Cookie', cookie);

        return response;
    } catch (error) {
        console.error('Auth verification error:', error);
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }
}
