import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';
import { logger } from '@/lib/logger';

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
if (!SIGNER_PRIVATE_KEY) {
    throw new Error('SIGNER_PRIVATE_KEY environment variable is required');
}

const signer = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

export async function POST(request: NextRequest) {
    try {
        const { userAddress, nonce, target, betUnder } = await request.json();

        if (!userAddress || nonce === undefined || target === undefined || betUnder === undefined) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const result = Math.floor(Math.random() * 100) + 1;

        const messageHash = keccak256(
            encodePacked(
                ['address', 'uint256', 'uint8', 'bool', 'uint8'],
                [userAddress as `0x${string}`, BigInt(nonce), target, betUnder, result]
            )
        );

        const signature = await signer.signMessage({
            message: { raw: messageHash },
        });

        const won = betUnder ? result < target : result > target;

        return NextResponse.json({ result, won, signature });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Dice roll failed', { error: message });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
