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
export async function POST(request: NextRequest) {
    const clientIp = getClientIp(request);
    const { success: rateLimitOk } = await checkRateLimit(clientIp);
    if (!rateLimitOk) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const { userAddress, nonce, row, tilesInRow } = await request.json();

        if (!userAddress || nonce === undefined || row === undefined || !tilesInRow) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const deathTile = secureRandomInt(0, tilesInRow);

        const messageHash = keccak256(
            encodePacked(
                ['address', 'uint256', 'uint8', 'uint8'],
                [userAddress as `0x${string}`, BigInt(nonce), row, deathTile]
            )
        );

        const signature = await signer.signMessage({
            message: { raw: messageHash },
        });

        return NextResponse.json({
            deathTile,
            signature,
            row,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Tower API error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
