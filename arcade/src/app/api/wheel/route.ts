import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';
import { secureRandomInt } from '@/lib/random';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
if (!SIGNER_PRIVATE_KEY) {
    throw new Error('SIGNER_PRIVATE_KEY environment variable is required');
}
const signer = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

// Segment configuration (must match contract)
const SEGMENT_MULTIPLIERS = [
    0, 15000, 18000, 15000, 0,      // 0-4
    20000, 15000, 30000, 18000, 15000, // 5-9
    0, 15000, 20000, 18000, 50000,  // 10-14
    15000, 0, 20000, 30000, 18000   // 15-19
];

export async function POST(request: NextRequest) {
    const clientIp = getClientIp(request);
    const { success: rateLimitOk } = await checkRateLimit(clientIp);
    if (!rateLimitOk) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { userAddress, nonce } = body;

        if (!userAddress || nonce === undefined) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const segmentResult = secureRandomInt(0, 20);
        const multiplier = SEGMENT_MULTIPLIERS[segmentResult];

        const addressForSigning = userAddress === 'demo'
            ? '0x0000000000000000000000000000000000000000'
            : userAddress;

        const messageHash = keccak256(
            encodePacked(
                ['address', 'uint256', 'uint8'],
                [addressForSigning as `0x${string}`, BigInt(nonce), segmentResult]
            )
        );

        const signature = await signer.signMessage({
            message: { raw: messageHash },
        });

        return NextResponse.json({
            segment: segmentResult,
            multiplier,
            signature,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Wheel API error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
