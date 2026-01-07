import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';

// Server signer private key - MUST be set in environment variables
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
if (!SIGNER_PRIVATE_KEY) {
    throw new Error('SIGNER_PRIVATE_KEY environment variable is required');
}
const signer = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

// Store active games (in production, use Redis or DB)
const activeGames = new Map<string, {
    currentTurn: number;
    destroyedColumns: number[];
    destroyedRows: number[];
}>();

/**
 * Gridy Laser API
 * Handles: start, select, cashout
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, userAddress, nonce, turn, row, col } = body;

        if (!userAddress) {
            return NextResponse.json({ error: 'Missing userAddress' }, { status: 400 });
        }

        const gameKey = `${userAddress}-${nonce}`;

        if (action === 'start') {
            // Initialize new game
            activeGames.set(gameKey, {
                currentTurn: 0,
                destroyedColumns: [],
                destroyedRows: [],
            });

            return NextResponse.json({
                success: true,
                gameId: gameKey,
            });
        }

        if (action === 'select') {
            const game = activeGames.get(gameKey);
            if (!game) {
                return NextResponse.json({ error: 'Game not found' }, { status: 404 });
            }

            const isColumnAttack = game.currentTurn % 2 === 0;

            // Get remaining valid targets
            const remainingTargets: number[] = [];
            if (isColumnAttack) {
                for (let i = 0; i < 10; i++) {
                    if (!game.destroyedColumns.includes(i)) {
                        remainingTargets.push(i);
                    }
                }
            } else {
                for (let i = 0; i < 10; i++) {
                    if (!game.destroyedRows.includes(i)) {
                        remainingTargets.push(i);
                    }
                }
            }

            // Generate random laser target
            const laserTarget = remainingTargets[Math.floor(Math.random() * remainingTargets.length)];

            // Check if player survives
            const survived = isColumnAttack ? (col !== laserTarget) : (row !== laserTarget);

            // Update game state
            if (isColumnAttack) {
                game.destroyedColumns.push(laserTarget);
            } else {
                game.destroyedRows.push(laserTarget);
            }
            game.currentTurn++;

            // Create signature for on-chain verification
            const messageHash = keccak256(
                encodePacked(
                    ['address', 'uint256', 'uint8', 'uint8'],
                    [userAddress as `0x${string}`, BigInt(nonce), game.currentTurn - 1, laserTarget]
                )
            );

            const signature = await signer.signMessage({
                message: { raw: messageHash },
            });

            // Clean up if player got lasered
            if (!survived) {
                activeGames.delete(gameKey);
            }

            return NextResponse.json({
                laserTarget,
                isColumnAttack,
                survived,
                currentTurn: game.currentTurn,
                signature,
            });
        }

        if (action === 'cashout') {
            const game = activeGames.get(gameKey);
            if (!game) {
                return NextResponse.json({ error: 'Game not found' }, { status: 404 });
            }

            // Create cashout signature
            const messageHash = keccak256(
                encodePacked(
                    ['address', 'uint256', 'uint8', 'string'],
                    [userAddress as `0x${string}`, BigInt(nonce), game.currentTurn, 'cashout']
                )
            );

            const signature = await signer.signMessage({
                message: { raw: messageHash },
            });

            // Clean up
            activeGames.delete(gameKey);

            return NextResponse.json({
                success: true,
                finalTurn: game.currentTurn,
                signature,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Laser API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
