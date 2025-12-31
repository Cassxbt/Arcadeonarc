import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || '0x96a6d7e2771e9f3e05fea88c2631f818e9e5d511b9e918088defac7f7af9c961';
const signer = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

/**
 * Dice Game API - Roll dice and get result with signature
 */
export async function POST(request: NextRequest) {
    try {
        const { userAddress, nonce, target, betUnder } = await request.json();

        if (!userAddress || nonce === undefined || target === undefined || betUnder === undefined) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Generate random result (1-100)
        const result = Math.floor(Math.random() * 100) + 1;

        // Create message hash (must match contract)
        const messageHash = keccak256(
            encodePacked(
                ['address', 'uint256', 'uint8', 'bool', 'uint8'],
                [userAddress as `0x${string}`, BigInt(nonce), target, betUnder, result]
            )
        );

        // Sign with Ethereum prefix
        const signature = await signer.signMessage({
            message: { raw: messageHash },
        });

        // Determine win
        const won = betUnder ? result < target : result > target;

        return NextResponse.json({
            result,
            won,
            signature,
        });
    } catch (error: any) {
        console.error('Dice API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
