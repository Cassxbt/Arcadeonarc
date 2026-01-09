import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';
import { secureRandomInt } from '@/lib/random';
import { redis, GAME_STATE_TTL } from '@/lib/redis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
if (!SIGNER_PRIVATE_KEY) {
    throw new Error('SIGNER_PRIVATE_KEY environment variable is required');
}
const signer = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

interface LaserGameState {
    currentTurn: number;
    destroyedColumns: number[];
    destroyedRows: number[];
}

export async function POST(request: NextRequest) {
    const clientIp = getClientIp(request);
    const { success: rateLimitOk } = await checkRateLimit(clientIp);
    if (!rateLimitOk) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { action, userAddress, nonce, turn, row, col } = body;

        if (!userAddress) {
            return NextResponse.json({ error: 'Missing userAddress' }, { status: 400 });
        }

        const gameKey = `laser:${userAddress.toLowerCase()}:${nonce}`;

        if (action === 'start') {
            await redis.set(gameKey, {
                currentTurn: 0,
                destroyedColumns: [],
                destroyedRows: [],
            } as LaserGameState, { ex: GAME_STATE_TTL });

            return NextResponse.json({
                success: true,
                gameId: gameKey,
            });
        }

        if (action === 'select') {
            const game = await redis.get<LaserGameState>(gameKey);
            if (!game) {
                return NextResponse.json({ error: 'Game not found or expired' }, { status: 404 });
            }

            const isColumnAttack = game.currentTurn % 2 === 0;

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

            const targetIndex = secureRandomInt(0, remainingTargets.length);
            const laserTarget = remainingTargets[targetIndex];

            const survived = isColumnAttack ? (col !== laserTarget) : (row !== laserTarget);

            if (isColumnAttack) {
                game.destroyedColumns.push(laserTarget);
            } else {
                game.destroyedRows.push(laserTarget);
            }
            game.currentTurn++;

            const addressForSigning = userAddress === 'demo'
                ? '0x0000000000000000000000000000000000000000'
                : userAddress;

            const messageHash = keccak256(
                encodePacked(
                    ['address', 'uint256', 'uint8', 'uint8'],
                    [addressForSigning as `0x${string}`, BigInt(nonce), game.currentTurn - 1, laserTarget]
                )
            );

            const signature = await signer.signMessage({
                message: { raw: messageHash },
            });

            if (!survived) {
                await redis.del(gameKey);
            } else {
                await redis.set(gameKey, game, { ex: GAME_STATE_TTL });
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
            const game = await redis.get<LaserGameState>(gameKey);
            if (!game) {
                return NextResponse.json({ error: 'Game not found or expired' }, { status: 404 });
            }

            const addressForSigningCashout = userAddress === 'demo'
                ? '0x0000000000000000000000000000000000000000'
                : userAddress;

            const messageHash = keccak256(
                encodePacked(
                    ['address', 'uint256', 'uint8', 'string'],
                    [addressForSigningCashout as `0x${string}`, BigInt(nonce), game.currentTurn, 'cashout']
                )
            );

            const signature = await signer.signMessage({
                message: { raw: messageHash },
            });

            await redis.del(gameKey);

            return NextResponse.json({
                success: true,
                finalTurn: game.currentTurn,
                signature,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Laser API error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
