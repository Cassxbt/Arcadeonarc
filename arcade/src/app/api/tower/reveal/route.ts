import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';
import { secureRandomInt } from '@/lib/random';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getSessionWallet } from '@/lib/session';
import { calculateTowerPayout } from '@/lib/game-logic';
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
import { GAME_CONFIG } from '@/lib/constants';

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
if (!SIGNER_PRIVATE_KEY) {
    throw new Error('SIGNER_PRIVATE_KEY environment variable is required');
}
const signer = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

const TOWER_PATTERN = GAME_CONFIG.TOWER_PATTERN;
const TOWER_ROWS = GAME_CONFIG.TOWER_ROWS;

type TowerState = {
    currentRow: number;
    revealedDeaths: Record<string, number>;
    selectedTiles: Record<string, number>;
};

function initialTowerState(): TowerState {
    return {
        currentRow: 0,
        revealedDeaths: {},
        selectedTiles: {},
    };
}

function readTowerState(round: GameRoundRecord): TowerState {
    const state = round.state_json as TowerState;
    return {
        currentRow: typeof state.currentRow === 'number' ? state.currentRow : 0,
        revealedDeaths: state.revealedDeaths ?? {},
        selectedTiles: state.selectedTiles ?? {},
    };
}

function buildTowerStartResponse(round: GameRoundRecord, resumed: boolean, newBalance?: number) {
    const state = readTowerState(round);
    return {
        roundId: round.id,
        version: round.version,
        currentRow: state.currentRow,
        state,
        betAmount: round.bet_amount,
        resumed,
        newBalance,
    };
}

function validateBetAmount(betAmount: unknown): betAmount is number {
    return typeof betAmount === 'number' && Number.isFinite(betAmount) && betAmount >= 0.5 && betAmount <= 100;
}

async function signReveal(wallet: string, nonce: number, row: number, deathTile: number) {
    const messageHash = keccak256(
        encodePacked(
            ['address', 'uint256', 'uint8', 'uint8'],
            [wallet as `0x${string}`, BigInt(nonce), row, deathTile]
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

            const startResult = await startActiveGameRound({
                walletAddress: wallet,
                game: 'tower',
                betAmount,
                stateJson: initialTowerState(),
                ttlMs: 15 * 60 * 1000,
            });

            if (!startResult.success || !startResult.round) {
                if (startResult.error === 'Active round already exists') {
                    const existingRound = await getBlockingActiveGameRoundForWalletGame(wallet, 'tower');
                    if (existingRound && isActiveRound(existingRound)) {
                        return NextResponse.json(buildTowerStartResponse(existingRound, true));
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
                                ...readTowerState(existingRound),
                                outcome: 'expired',
                                reason: 'stale_active_round_cleanup',
                            } satisfies JsonObject,
                        });

                        const retryResult = await startActiveGameRound({
                            walletAddress: wallet,
                            game: 'tower',
                            betAmount,
                            stateJson: initialTowerState(),
                            ttlMs: 15 * 60 * 1000,
                        });

                        if (retryResult.success && retryResult.round) {
                            return NextResponse.json(buildTowerStartResponse(retryResult.round, false, retryResult.new_balance));
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

            return NextResponse.json(buildTowerStartResponse(startResult.round, false, startResult.new_balance));
        }

        const { roundId, version } = body;
        if (!roundId || typeof version !== 'number') {
            return NextResponse.json({ error: 'Missing round parameters' }, { status: 400 });
        }

        const round = await getActiveGameRoundForWallet(wallet, roundId, version);
        if (!round || round.game !== 'tower' || !isActiveRound(round)) {
            return NextResponse.json({ error: 'Round not found' }, { status: 404 });
        }

        if (round.version !== version) {
            return NextResponse.json({ error: 'Round version mismatch' }, { status: 409 });
        }

        const state = readTowerState(round);

        if (action === 'reveal') {
            const { row, tileIndex } = body;

            if (!Number.isInteger(row) || row !== state.currentRow || row < 0 || row >= TOWER_ROWS) {
                return NextResponse.json({ error: 'Invalid row' }, { status: 400 });
            }

            const tilesInRow = TOWER_PATTERN[row];
            if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= tilesInRow) {
                return NextResponse.json({ error: 'Invalid tile' }, { status: 400 });
            }

            const deathTile = secureRandomInt(0, tilesInRow);
            const signatureNonce = Date.now();
            const signature = await signReveal(wallet, signatureNonce, row, deathTile);
            const nextState: TowerState = {
                currentRow: row + 1,
                revealedDeaths: { ...state.revealedDeaths, [row]: deathTile },
                selectedTiles: { ...state.selectedTiles, [row]: tileIndex },
            };

            if (deathTile === tileIndex) {
                const finalResult = await finalizeActiveGameRound({
                    walletAddress: wallet,
                    roundId,
                    expectedVersion: version,
                    status: 'lost',
                    payout: 0,
                    multiplier: 0,
                    resultJson: {
                        ...nextState,
                        row,
                        tileIndex,
                        deathTile,
                        outcome: 'loss',
                    } satisfies JsonObject,
                });

                if (!finalResult.success) {
                    return NextResponse.json({ error: finalResult.error ?? 'Failed to finalize round' }, { status: 409 });
                }

                return NextResponse.json({
                    outcome: 'loss',
                    deathTile,
                    row,
                    newBalance: finalResult.new_balance,
                    signatureNonce,
                    signature,
                });
            }

            if (row === TOWER_ROWS - 1) {
                const { payout, multiplier } = calculateTowerPayout(round.bet_amount, row);
                const finalResult = await finalizeActiveGameRound({
                    walletAddress: wallet,
                    roundId,
                    expectedVersion: version,
                    status: 'won',
                    payout,
                    multiplier,
                    resultJson: {
                        ...nextState,
                        row,
                        tileIndex,
                        deathTile,
                        outcome: 'win',
                    } satisfies JsonObject,
                });

                if (!finalResult.success) {
                    return NextResponse.json({ error: finalResult.error ?? 'Failed to finalize round' }, { status: 409 });
                }

                return NextResponse.json({
                    outcome: 'win',
                    deathTile,
                    row,
                    multiplier,
                    payout,
                    newBalance: finalResult.new_balance,
                    signatureNonce,
                    signature,
                });
            }

            const updatedRound = await updateActiveGameRoundStateHot(wallet, roundId, version, nextState);
            if (!updatedRound) {
                return NextResponse.json({ error: 'Round version mismatch' }, { status: 409 });
            }

            const { payout, multiplier } = calculateTowerPayout(round.bet_amount, row);
            return NextResponse.json({
                outcome: 'safe',
                deathTile,
                row,
                currentRow: nextState.currentRow,
                version: updatedRound.version,
                multiplier,
                payout,
                signatureNonce,
                signature,
            });
        }

        if (action === 'cashout') {
            const completedRow = state.currentRow - 1;
            if (completedRow < 0) {
                return NextResponse.json({ error: 'Cashout unavailable' }, { status: 400 });
            }

            const { payout, multiplier } = calculateTowerPayout(round.bet_amount, completedRow);
            const finalResult = await finalizeActiveGameRound({
                walletAddress: wallet,
                roundId,
                expectedVersion: version,
                status: 'won',
                payout,
                multiplier,
                resultJson: {
                    ...state,
                    row: completedRow,
                    outcome: 'win',
                } satisfies JsonObject,
            });

            if (!finalResult.success) {
                return NextResponse.json({ error: finalResult.error ?? 'Failed to finalize round' }, { status: 409 });
            }

            return NextResponse.json({
                outcome: 'win',
                row: completedRow,
                multiplier,
                payout,
                newBalance: finalResult.new_balance,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Tower API error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
