import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';
import { secureRandomInt } from '@/lib/random';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getSessionWallet } from '@/lib/session';
import { calculateWheelPayout } from '@/lib/game-logic';
import { finalizeGameRound, startGameRound } from '@/lib/game-rounds';

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
if (!SIGNER_PRIVATE_KEY) {
    throw new Error('SIGNER_PRIVATE_KEY environment variable is required');
}
const signer = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

export async function POST(request: NextRequest) {
    const clientIp = getClientIp(request);
    const { success: rateLimitOk } = await checkRateLimit(clientIp);
    if (!rateLimitOk) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const wallet = await getSessionWallet(request);
        if (!wallet) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { betAmount } = body;

        if (typeof betAmount !== 'number' || !Number.isFinite(betAmount)) {
            return NextResponse.json({ error: 'Invalid bet amount' }, { status: 400 });
        }

        if (betAmount < 0.5 || betAmount > 100) {
            return NextResponse.json({ error: 'Invalid bet amount' }, { status: 400 });
        }

        const segmentResult = secureRandomInt(0, 20);
        const { payout, multiplier, won } = calculateWheelPayout(betAmount, segmentResult);
        const nonce = crypto.randomUUID();

        const startResult = await startGameRound({
            walletAddress: wallet,
            game: 'wheel',
            betAmount,
            nonce,
            stateJson: { segment: segmentResult, multiplier },
            ttlMs: 30_000,
        });

        if (!startResult.success || !startResult.round) {
            const status = startResult.error === 'Insufficient balance' ? 400 : 409;
            return NextResponse.json({
                error: startResult.error ?? 'Failed to start round',
                available: startResult.available,
                required: startResult.required,
            }, { status });
        }

        const finalResult = await finalizeGameRound({
            walletAddress: wallet,
            roundId: startResult.round.id,
            expectedVersion: startResult.round.version,
            status: won ? 'won' : 'lost',
            payout,
            multiplier,
            resultJson: { segment: segmentResult, multiplier, payout },
        });

        if (!finalResult.success) {
            return NextResponse.json({
                error: finalResult.error ?? 'Failed to finalize round',
                roundId: startResult.round.id,
            }, { status: 409 });
        }

        const signatureNonce = Date.now();
        const messageHash = keccak256(
            encodePacked(
                ['address', 'uint256', 'uint8'],
                [wallet as `0x${string}`, BigInt(signatureNonce), segmentResult]
            )
        );

        const signature = await signer.signMessage({
            message: { raw: messageHash },
        });

        return NextResponse.json({
            segment: segmentResult,
            multiplier,
            payout,
            won,
            newBalance: finalResult.new_balance,
            roundId: startResult.round.id,
            signatureNonce,
            signature,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Wheel API error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
