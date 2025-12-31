import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || '0x96a6d7e2771e9f3e05fea88c2631f818e9e5d511b9e918088defac7f7af9c961';
const signer = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

// Store active games' crash points (in production, use Redis or DB)
const activeGames = new Map<string, { crashPoint: number; startTime: number }>();

/**
 * Cannon Crash API - Start a new game
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, userAddress, nonce, cashoutMultiplier } = body;

        if (!userAddress || nonce === undefined) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const gameKey = `${userAddress}-${nonce}`;

        if (action === 'start') {
            // Generate crash point using fair distribution
            // 10% chance of instant crash (1.00x)
            // Otherwise exponential distribution
            const random = Math.random();
            let crashPoint: number;

            if (random < 0.10) {
                crashPoint = 10000; // 1.00x in basis points
            } else {
                // Exponential distribution for other cases
                const e = 1 / (1 - random);
                crashPoint = Math.max(10000, Math.floor(e * 10000));
            }

            // Cap at 100x
            crashPoint = Math.min(crashPoint, 1000000);

            activeGames.set(gameKey, { crashPoint, startTime: Date.now() });

            return NextResponse.json({
                success: true,
                gameId: gameKey,
            });
        }

        if (action === 'cashout' || action === 'crash') {
            const game = activeGames.get(gameKey);

            if (!game) {
                return NextResponse.json({ error: 'Game not found' }, { status: 404 });
            }

            // Create message hash (must match contract)
            const messageHash = keccak256(
                encodePacked(
                    ['address', 'uint256', 'uint256'],
                    [userAddress as `0x${string}`, BigInt(nonce), BigInt(game.crashPoint)]
                )
            );

            // Sign with Ethereum prefix
            const signature = await signer.signMessage({
                message: { raw: messageHash },
            });

            // Clean up
            activeGames.delete(gameKey);

            // Determine if cashout was successful
            const success = action === 'cashout' &&
                cashoutMultiplier &&
                cashoutMultiplier <= game.crashPoint;

            return NextResponse.json({
                crashPoint: game.crashPoint,
                signature,
                success,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Crash API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
