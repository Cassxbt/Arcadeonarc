import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';

// Server signer private key - MUST be set in environment variables
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

/**
 * Wheel Game API - Spin the wheel
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userAddress, nonce } = body;

        if (!userAddress || nonce === undefined) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Generate random segment (0-19)
        const segmentResult = Math.floor(Math.random() * 20);
        const multiplier = SEGMENT_MULTIPLIERS[segmentResult];

        // Create message hash (must match contract)
        const messageHash = keccak256(
            encodePacked(
                ['address', 'uint256', 'uint8'],
                [userAddress as `0x${string}`, BigInt(nonce), segmentResult]
            )
        );

        // Sign with Ethereum prefix
        const signature = await signer.signMessage({
            message: { raw: messageHash },
        });

        return NextResponse.json({
            segment: segmentResult,
            multiplier,
            signature,
        });
    } catch (error: any) {
        console.error('Wheel API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
