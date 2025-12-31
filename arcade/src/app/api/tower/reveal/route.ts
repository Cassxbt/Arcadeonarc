import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked, toHex } from 'viem';

// Server signer private key (same as deployer for testnet)
// In production, use a separate secure key
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || '0x96a6d7e2771e9f3e05fea88c2631f818e9e5d511b9e918088defac7f7af9c961';
const signer = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

/**
 * Tower Game API - Get death tile position and signature for a row
 */
export async function POST(request: NextRequest) {
    try {
        const { userAddress, nonce, row, tilesInRow } = await request.json();

        if (!userAddress || nonce === undefined || row === undefined || !tilesInRow) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Generate random death tile position
        const deathTile = Math.floor(Math.random() * tilesInRow);

        // Create message hash (must match contract)
        const messageHash = keccak256(
            encodePacked(
                ['address', 'uint256', 'uint8', 'uint8'],
                [userAddress as `0x${string}`, BigInt(nonce), row, deathTile]
            )
        );

        // Sign with Ethereum prefix
        const signature = await signer.signMessage({
            message: { raw: messageHash },
        });

        return NextResponse.json({
            deathTile,
            signature,
            row,
        });
    } catch (error: any) {
        console.error('Tower API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
