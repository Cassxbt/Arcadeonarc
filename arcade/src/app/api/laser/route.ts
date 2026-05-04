import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';
import { secureRandomInt } from '@/lib/random';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getSessionWallet } from '@/lib/session';
import { calculateLaserPayout } from '@/lib/game-logic';
import {
    isActiveRound,
    type GameRoundRecord,
    type JsonObject,
} from '@/lib/game-rounds';
import {
    finalizeActiveGameRound,
    getBlockingActiveGameRoundForWalletGame,
    getActiveGameRoundForWallet,
    startActiveGameRound,
    updateActiveGameRoundStateHot,
} from '@/lib/active-game-rounds';

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
if (!SIGNER_PRIVATE_KEY) {
    throw new Error('SIGNER_PRIVATE_KEY environment variable is required');
}
const signer = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

interface LaserGameState {
    currentTurn: number;
    columnsRemaining: number;
    rowsRemaining: number;
    destroyedColumns: number[];
    destroyedRows: number[];
}

function initialLaserState(): LaserGameState {
    return {
        currentTurn: 0,
        columnsRemaining: 10,
        rowsRemaining: 10,
        destroyedColumns: [],
        destroyedRows: [],
    };
}

function readLaserState(round: GameRoundRecord): LaserGameState {
    const state = round.state_json as Partial<LaserGameState>;
    return {
        currentTurn: typeof state.currentTurn === 'number' ? state.currentTurn : 0,
        columnsRemaining: typeof state.columnsRemaining === 'number' ? state.columnsRemaining : 10,
        rowsRemaining: typeof state.rowsRemaining === 'number' ? state.rowsRemaining : 10,
        destroyedColumns: Array.isArray(state.destroyedColumns) ? state.destroyedColumns : [],
        destroyedRows: Array.isArray(state.destroyedRows) ? state.destroyedRows : [],
    };
}

function buildLaserStartResponse(round: GameRoundRecord, resumed: boolean, newBalance?: number) {
    const state = readLaserState(round);
    return {
        roundId: round.id,
        version: round.version,
        currentTurn: state.currentTurn,
        columnsRemaining: state.columnsRemaining,
        rowsRemaining: state.rowsRemaining,
        state,
        betAmount: round.bet_amount,
        resumed,
        newBalance,
    };
}

function validateBetAmount(betAmount: unknown): betAmount is number {
    return typeof betAmount === 'number' && Number.isFinite(betAmount) && betAmount >= 0.5 && betAmount <= 100;
}

function validateCell(row: unknown, col: unknown, state: LaserGameState): row is number {
    return (
        typeof row === 'number' &&
        typeof col === 'number' &&
        Number.isInteger(row) &&
        Number.isInteger(col) &&
        row >= 0 &&
        row < state.rowsRemaining &&
        col >= 0 &&
        col < state.columnsRemaining
    );
}

async function signLaserTurn(wallet: string, nonce: number, turn: number, laserTarget: number) {
    const messageHash = keccak256(
        encodePacked(
            ['address', 'uint256', 'uint8', 'uint8'],
            [wallet as `0x${string}`, BigInt(nonce), turn, laserTarget]
        )
    );

    return signer.signMessage({
        message: { raw: messageHash },
    });
}

async function signLaserCashout(wallet: string, nonce: number, turn: number) {
    const messageHash = keccak256(
        encodePacked(
            ['address', 'uint256', 'uint8', 'string'],
            [wallet as `0x${string}`, BigInt(nonce), turn, 'cashout']
        )
    );

    return signer.signMessage({
        message: { raw: messageHash },
    });
}

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
        const { action } = body;

        if (action === 'start') {
            const { betAmount } = body;
            if (!validateBetAmount(betAmount)) {
                return NextResponse.json({ error: 'Invalid bet amount' }, { status: 400 });
            }

            const state = initialLaserState();
            const startResult = await startActiveGameRound({
                walletAddress: wallet,
                game: 'laser',
                betAmount,
                stateJson: state as unknown as JsonObject,
                ttlMs: 15 * 60 * 1000,
            });

            if (!startResult.success || !startResult.round) {
                if (startResult.error === 'Active round already exists') {
                    const existingRound = await getBlockingActiveGameRoundForWalletGame(wallet, 'laser');
                    if (existingRound && isActiveRound(existingRound)) {
                        return NextResponse.json(buildLaserStartResponse(existingRound, true));
                    }
                    if (existingRound) {
                        await finalizeActiveGameRound({
                            walletAddress: wallet,
                            roundId: existingRound.id,
                            expectedVersion: existingRound.version,
                            status: 'expired',
                            payout: 0,
                            multiplier: 0,
                            resultJson: {
                                ...readLaserState(existingRound),
                                outcome: 'expired',
                                reason: 'stale_active_round_cleanup',
                            } satisfies JsonObject,
                        });

                        const retryResult = await startActiveGameRound({
                            walletAddress: wallet,
                            game: 'laser',
                            betAmount,
                            stateJson: initialLaserState() as unknown as JsonObject,
                            ttlMs: 15 * 60 * 1000,
                        });

                        if (retryResult.success && retryResult.round) {
                            return NextResponse.json(buildLaserStartResponse(retryResult.round, false, retryResult.new_balance));
                        }
                    }
                }

                const status = startResult.error === 'Insufficient balance' ? 400 : 409;
                return NextResponse.json({
                    error: startResult.error ?? 'Failed to start round',
                    available: startResult.available,
                    required: startResult.required,
                }, { status });
            }

            return NextResponse.json(buildLaserStartResponse(startResult.round, false, startResult.new_balance));
        }

        const { roundId, version } = body;
        if (!roundId || typeof version !== 'number') {
            return NextResponse.json({ error: 'Missing round parameters' }, { status: 400 });
        }

        const round = await getActiveGameRoundForWallet(wallet, roundId, version);
        if (!round || round.game !== 'laser' || !isActiveRound(round)) {
            return NextResponse.json({ error: 'Round not found' }, { status: 404 });
        }

        if (round.version !== version) {
            return NextResponse.json({ error: 'Round version mismatch' }, { status: 409 });
        }

        const game = readLaserState(round);

        if (action === 'select') {
            const { row, col } = body;
            if (!validateCell(row, col, game)) {
                return NextResponse.json({ error: 'Invalid cell' }, { status: 400 });
            }
            const selectedRow = row;
            const selectedCol = col as number;

            const isColumnAttack = game.currentTurn % 2 === 0;
            const remaining = isColumnAttack ? game.columnsRemaining : game.rowsRemaining;
            const laserTarget = secureRandomInt(0, remaining);
            const survived = isColumnAttack ? (selectedCol !== laserTarget) : (selectedRow !== laserTarget);
            const signatureNonce = Date.now();
            const signature = await signLaserTurn(wallet, signatureNonce, game.currentTurn, laserTarget);
            const nextState: LaserGameState = {
                currentTurn: game.currentTurn + 1,
                columnsRemaining: isColumnAttack ? game.columnsRemaining - 1 : game.columnsRemaining,
                rowsRemaining: isColumnAttack ? game.rowsRemaining : game.rowsRemaining - 1,
                destroyedColumns: isColumnAttack ? [...game.destroyedColumns, laserTarget] : game.destroyedColumns,
                destroyedRows: isColumnAttack ? game.destroyedRows : [...game.destroyedRows, laserTarget],
            };

            if (!survived) {
                const finalResult = await finalizeActiveGameRound({
                    walletAddress: wallet,
                    roundId,
                    expectedVersion: version,
                    status: 'lost',
                    payout: 0,
                    multiplier: 0,
                    resultJson: {
                        ...nextState,
                        outcome: 'loss',
                        survivedTurns: game.currentTurn,
                        row: selectedRow,
                        col: selectedCol,
                        laserTarget,
                        isColumnAttack,
                    } satisfies JsonObject,
                });

                if (!finalResult.success) {
                    return NextResponse.json({ error: finalResult.error ?? 'Failed to finalize round' }, { status: 409 });
                }

                return NextResponse.json({
                    outcome: 'loss',
                    laserTarget,
                    isColumnAttack,
                    survived: false,
                    currentTurn: game.currentTurn,
                    newBalance: finalResult.new_balance,
                    signatureNonce,
                    signature,
                });
            }

            if (nextState.currentTurn >= 18) {
                const { payout, multiplier } = calculateLaserPayout(round.bet_amount, nextState.currentTurn);
                const finalResult = await finalizeActiveGameRound({
                    walletAddress: wallet,
                    roundId,
                    expectedVersion: version,
                    status: 'won',
                    payout,
                    multiplier,
                    resultJson: {
                        ...nextState,
                        outcome: 'win',
                        survivedTurns: nextState.currentTurn,
                        row: selectedRow,
                        col: selectedCol,
                        laserTarget,
                        isColumnAttack,
                    } satisfies JsonObject,
                });

                if (!finalResult.success) {
                    return NextResponse.json({ error: finalResult.error ?? 'Failed to finalize round' }, { status: 409 });
                }

                return NextResponse.json({
                    outcome: 'win',
                    laserTarget,
                    isColumnAttack,
                    survived: true,
                    currentTurn: nextState.currentTurn,
                    columnsRemaining: nextState.columnsRemaining,
                    rowsRemaining: nextState.rowsRemaining,
                    payout,
                    multiplier,
                    newBalance: finalResult.new_balance,
                    signatureNonce,
                    signature,
                });
            }

            const updatedRound = await updateActiveGameRoundStateHot(wallet, roundId, version, nextState as unknown as JsonObject);
            if (!updatedRound) {
                return NextResponse.json({ error: 'Round version mismatch' }, { status: 409 });
            }

            return NextResponse.json({
                outcome: 'safe',
                laserTarget,
                isColumnAttack,
                survived: true,
                currentTurn: nextState.currentTurn,
                columnsRemaining: nextState.columnsRemaining,
                rowsRemaining: nextState.rowsRemaining,
                version: updatedRound.version,
                signatureNonce,
                signature,
            });
        }

        if (action === 'cashout') {
            if (game.currentTurn === 0) {
                return NextResponse.json({ error: 'Cashout unavailable' }, { status: 400 });
            }

            const { payout, multiplier } = calculateLaserPayout(round.bet_amount, game.currentTurn);
            const signatureNonce = Date.now();
            const signature = await signLaserCashout(wallet, signatureNonce, game.currentTurn);
            const finalResult = await finalizeActiveGameRound({
                walletAddress: wallet,
                roundId,
                expectedVersion: version,
                status: 'won',
                payout,
                multiplier,
                resultJson: {
                    ...game,
                    outcome: 'cashout',
                    survivedTurns: game.currentTurn,
                } satisfies JsonObject,
            });

            if (!finalResult.success) {
                return NextResponse.json({ error: finalResult.error ?? 'Failed to finalize round' }, { status: 409 });
            }

            return NextResponse.json({
                outcome: 'win',
                finalTurn: game.currentTurn,
                payout,
                multiplier,
                newBalance: finalResult.new_balance,
                signatureNonce,
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
