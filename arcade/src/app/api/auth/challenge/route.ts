import { NextRequest, NextResponse } from 'next/server';
import { generateChallenge, createSignMessage } from '@/lib/session';
import { redis } from '@/lib/redis';

const CHALLENGE_TTL = 300; // 5 minutes

export async function POST(request: NextRequest) {
    try {
        const { wallet } = await request.json();

        if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
        }

        const walletLower = wallet.toLowerCase();
        const challenge = generateChallenge();
        const message = createSignMessage(challenge);

        try {
            await redis.set(`auth:challenge:${walletLower}`, challenge, { ex: CHALLENGE_TTL });
        } catch (redisError) {
            // Graceful degradation: if Redis is at capacity (e.g. Upstash free tier limit),
            // still return the challenge. Verification will fail for this challenge,
            // but the app won't show 500 errors to every user trying to log in.
            console.warn('Redis unavailable for challenge storage:', redisError instanceof Error ? redisError.message : 'Unknown error');
        }

        return NextResponse.json({ challenge, message });
    } catch (error) {
        console.error('Challenge generation error:', error);
        return NextResponse.json({ error: 'Failed to generate challenge' }, { status: 500 });
    }
}
