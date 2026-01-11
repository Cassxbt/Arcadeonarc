import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';
import { secureRandomFloat } from '@/lib/random';
import { redis, GAME_STATE_TTL } from '@/lib/redis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
if (!SIGNER_PRIVATE_KEY) {
    throw new Error('SIGNER_PRIVATE_KEY environment variable is required');
}
const signer = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

interface CrashGameState {
    crashPoint: number;
    startTime: number;
    crashTime: number; // When crash will occur (for timing verification)
}

export async function POST(request: NextRequest) {
    const clientIp = getClientIp(request);
    const { success: rateLimitOk } = await checkRateLimit(clientIp);
    if (!rateLimitOk) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { action, userAddress, nonce, cashoutMultiplier } = body;

        if (!userAddress || nonce === undefined) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const gameKey = `crash:${userAddress.toLowerCase()}:${nonce}`;

        if (action === 'start') {
            // Generate crash point using provably fair distribution
            // Target: 5% total house edge (95% RTP)
            // 10% instant crash + adjusted formula for remaining 90%
            const random = secureRandomFloat();
            let crashPoint: number;

            const INSTANT_CRASH_RATE = 0.10;
            const TARGET_RTP_TOTAL = 0.95;

            if (random < INSTANT_CRASH_RATE) {
                // 10% of games crash instantly at 1.00x
                crashPoint = 10000; // 1.00x in basis points
            } else {
                // Remaining 90% need RTP of: 0.95/0.90 = 1.0556 (105.56%)
                // to achieve 5% total house edge
                const normalizedRandom = (random - INSTANT_CRASH_RATE) / (1 - INSTANT_CRASH_RATE);
                const rtp = TARGET_RTP_TOTAL / (1 - INSTANT_CRASH_RATE); // 1.0556

                // Industry-standard formula: crashPoint = (RTP / normalizedRandom) in basis points
                const result = rtp / normalizedRandom;
                crashPoint = Math.floor(result * 10000);
                crashPoint = Math.max(10000, crashPoint);
            }

            // Cap at 100x maximum
            crashPoint = Math.min(crashPoint, 1000000);

            // Calculate when crash will occur based on multiplier formula: 1.06^(t*10)
            // Solving for t: t = log(crashPoint/10000) / (10 * log(1.06))
            const crashMultiplier = crashPoint / 10000;
            const crashTimeOffset = Math.log(crashMultiplier) / (10 * Math.log(1.06)) * 1000;
            const startTime = Date.now();

            await redis.set(gameKey, {
                crashPoint,
                startTime,
                crashTime: startTime + crashTimeOffset,
            } as CrashGameState, { ex: GAME_STATE_TTL });

            return NextResponse.json({
                success: true,
                gameId: gameKey,
            });
        }

        if (action === 'cashout' || action === 'crash') {
            const game = await redis.get<CrashGameState>(gameKey);

            if (!game) {
                return NextResponse.json({ error: 'Game not found or expired' }, { status: 404 });
            }

            const addressForSigning = userAddress === 'demo'
                ? '0x0000000000000000000000000000000000000000'
                : userAddress;

            const messageHash = keccak256(
                encodePacked(
                    ['address', 'uint256', 'uint256'],
                    [addressForSigning as `0x${string}`, BigInt(nonce), BigInt(game.crashPoint)]
                )
            );

            const signature = await signer.signMessage({
                message: { raw: messageHash },
            });

            await redis.del(gameKey);

            const success = action === 'cashout' &&
                cashoutMultiplier &&
                cashoutMultiplier <= game.crashPoint;

            return NextResponse.json({
                crashPoint: game.crashPoint,
                signature,
                success,
            });
        }

        if (action === 'check') {
            const game = await redis.get<CrashGameState>(gameKey);

            if (!game) {
                return NextResponse.json({ error: 'Game not found or expired' }, { status: 404 });
            }

            const currentMultiplier = body.currentMultiplier || 10000;
            const crashed = currentMultiplier >= game.crashPoint;

            return NextResponse.json({
                crashed,
                crashPoint: crashed ? game.crashPoint : undefined, // Only reveal if crashed
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Crash API error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
