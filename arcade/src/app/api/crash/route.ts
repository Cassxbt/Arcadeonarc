import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';
import { secureRandomFloat } from '@/lib/random';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getSessionWallet } from '@/lib/session';
import { calculateCrashPayout } from '@/lib/game-logic';
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
} from '@/lib/active-game-rounds';

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
if (!SIGNER_PRIVATE_KEY) {
    throw new Error('SIGNER_PRIVATE_KEY environment variable is required');
}
const signer = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

interface CrashGameState {
    crashPoint: number;
    startTime: number;
    crashTime: number; // When crash will occur (for timing verification)
}

const CASHOUT_CLOCK_TOLERANCE_BPS = 200;

function validateBetAmount(betAmount: unknown): betAmount is number {
    return typeof betAmount === 'number' && Number.isFinite(betAmount) && betAmount >= 0.5 && betAmount <= 100;
}

function validateMultiplier(multiplier: unknown): multiplier is number {
    return typeof multiplier === 'number' && Number.isInteger(multiplier) && multiplier >= 10000;
}

function generateCrashPoint(): number {
    const random = secureRandomFloat();
    const instantCrashRate = 0.10;
    const targetRtpTotal = 0.95;

    if (random < instantCrashRate) {
        return 10000;
    }

    const normalizedRandom = (random - instantCrashRate) / (1 - instantCrashRate);
    const rtp = targetRtpTotal / (1 - instantCrashRate);
    const result = rtp / normalizedRandom;
    const crashPoint = Math.max(10000, Math.floor(result * 10000));

    return Math.min(crashPoint, 1000000);
}

function buildCrashState(): CrashGameState {
    const crashPoint = generateCrashPoint();
    const crashMultiplier = crashPoint / 10000;
    const crashTimeOffset = Math.log(crashMultiplier) / (10 * Math.log(1.06)) * 1000;
    const startTime = Date.now();

    return {
        crashPoint,
        startTime,
        crashTime: startTime + crashTimeOffset,
    };
}

function calculateServerMultiplierBps(startTime: number, now = Date.now()): number {
    const elapsedSeconds = Math.max(0, now - startTime) / 1000;
    return Math.max(10000, Math.floor(Math.pow(1.06, elapsedSeconds * 10) * 10000));
}

function hasCrashed(game: CrashGameState, now = Date.now()): boolean {
    return now >= game.crashTime || calculateServerMultiplierBps(game.startTime, now) >= game.crashPoint;
}

function readCrashState(round: GameRoundRecord): CrashGameState {
    const state = round.state_json as Partial<CrashGameState>;
    if (
        typeof state.crashPoint !== 'number' ||
        typeof state.startTime !== 'number' ||
        typeof state.crashTime !== 'number'
    ) {
        throw new Error('Invalid crash round state');
    }

    return {
        crashPoint: state.crashPoint,
        startTime: state.startTime,
        crashTime: state.crashTime,
    };
}

function buildCrashStartResponse(round: GameRoundRecord, state: CrashGameState, resumed: boolean, newBalance?: number) {
    return {
        roundId: round.id,
        version: round.version,
        startedAt: state.startTime,
        serverTime: Date.now(),
        betAmount: round.bet_amount,
        resumed,
        newBalance,
    };
}

function buildFinalizedCrashResponse(round: GameRoundRecord) {
    const state = readCrashState(round);
    const result = round.result_json as Partial<CrashGameState> & {
        cashoutMultiplier?: number;
        outcome?: string;
    };

    const crashPoint = typeof result.crashPoint === 'number' ? result.crashPoint : state.crashPoint;
    const cashoutMultiplier = typeof result.cashoutMultiplier === 'number' ? result.cashoutMultiplier : 0;
    const payout = cashoutMultiplier > 0
        ? calculateCrashPayout(round.bet_amount, cashoutMultiplier, crashPoint)
        : { payout: 0, multiplier: 0, won: false };

    return {
        finalized: true,
        success: payout.won,
        crashed: !payout.won,
        crashPoint,
        payout: payout.payout,
        multiplier: payout.multiplier,
        outcome: result.outcome ?? round.status,
    };
}

async function signCrash(wallet: string, nonce: number, crashPoint: number) {
    const messageHash = keccak256(
        encodePacked(
            ['address', 'uint256', 'uint256'],
            [wallet as `0x${string}`, BigInt(nonce), BigInt(crashPoint)]
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

            const state = buildCrashState();
            const startResult = await startActiveGameRound({
                walletAddress: wallet,
                game: 'crash',
                betAmount,
                stateJson: state as unknown as JsonObject,
                ttlMs: 5 * 60 * 1000,
            });

            if (!startResult.success || !startResult.round) {
                if (startResult.error === 'Active round already exists') {
                    const existingRound = await getBlockingActiveGameRoundForWalletGame(wallet, 'crash');
                    if (existingRound && isActiveRound(existingRound)) {
                        const existingState = readCrashState(existingRound);
                        if (!hasCrashed(existingState)) {
                            return NextResponse.json(buildCrashStartResponse(existingRound, existingState, true));
                        }

                        await finalizeActiveGameRound({
                            walletAddress: wallet,
                            roundId: existingRound.id,
                            expectedVersion: existingRound.version,
                            status: 'lost',
                            payout: 0,
                            multiplier: 0,
                            resultJson: {
                                ...existingState,
                                cashoutMultiplier: 0,
                                outcome: 'loss',
                                reason: 'stale_crashed_round_cleanup',
                            } satisfies JsonObject,
                        });
                    } else if (existingRound) {
                        await finalizeActiveGameRound({
                            walletAddress: wallet,
                            roundId: existingRound.id,
                            expectedVersion: existingRound.version,
                            status: 'expired',
                            payout: 0,
                            multiplier: 0,
                            resultJson: {
                                ...readCrashState(existingRound),
                                cashoutMultiplier: 0,
                                outcome: 'expired',
                                reason: 'stale_active_round_cleanup',
                            } satisfies JsonObject,
                        });
                    }

                    if (existingRound) {
                        const retryState = buildCrashState();
                        const retryResult = await startActiveGameRound({
                            walletAddress: wallet,
                            game: 'crash',
                            betAmount,
                            stateJson: retryState as unknown as JsonObject,
                            ttlMs: 5 * 60 * 1000,
                        });

                        if (retryResult.success && retryResult.round) {
                            return NextResponse.json(buildCrashStartResponse(retryResult.round, retryState, false, retryResult.new_balance));
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

            return NextResponse.json(buildCrashStartResponse(startResult.round, state, false, startResult.new_balance));
        }

        const { roundId, version } = body;
        if (!roundId || typeof version !== 'number') {
            return NextResponse.json({ error: 'Missing round parameters' }, { status: 400 });
        }

        const round = await getActiveGameRoundForWallet(wallet, roundId, version);
        if (!round || round.game !== 'crash') {
            return NextResponse.json({ error: 'Round not found' }, { status: 404 });
        }

        if (!isActiveRound(round)) {
            return NextResponse.json(buildFinalizedCrashResponse(round));
        }

        if (round.version !== version) {
            return NextResponse.json({ error: 'Round version mismatch' }, { status: 409 });
        }

        const game = readCrashState(round);

        if (action === 'cashout') {
            const { cashoutMultiplier } = body;
            if (!validateMultiplier(cashoutMultiplier)) {
                return NextResponse.json({ error: 'Invalid cashout multiplier' }, { status: 400 });
            }

            const signatureNonce = Date.now();
            const signature = await signCrash(wallet, signatureNonce, game.crashPoint);

            if (hasCrashed(game, signatureNonce)) {
                const finalResult = await finalizeActiveGameRound({
                    walletAddress: wallet,
                    roundId,
                    expectedVersion: version,
                    status: 'lost',
                    payout: 0,
                    multiplier: 0,
                    resultJson: {
                        ...game,
                        crashPoint: game.crashPoint,
                        cashoutMultiplier,
                        outcome: 'loss',
                        reason: 'crashed',
                    } satisfies JsonObject,
                });

                if (!finalResult.success) {
                    if (finalResult.error === 'Round already finalized' && finalResult.round?.game === 'crash') {
                        return NextResponse.json(buildFinalizedCrashResponse(finalResult.round));
                    }

                    return NextResponse.json({ error: finalResult.error ?? 'Failed to finalize round' }, { status: 409 });
                }

                return NextResponse.json({
                    crashPoint: game.crashPoint,
                    signatureNonce,
                    signature,
                    success: false,
                    payout: 0,
                    multiplier: 0,
                    newBalance: finalResult.new_balance,
                });
            }

            const serverMultiplier = calculateServerMultiplierBps(game.startTime, signatureNonce);
            if (cashoutMultiplier > serverMultiplier + CASHOUT_CLOCK_TOLERANCE_BPS) {
                return NextResponse.json({ error: 'Cashout multiplier is ahead of server time' }, { status: 400 });
            }

            const result = calculateCrashPayout(round.bet_amount, cashoutMultiplier, game.crashPoint);
            const finalResult = await finalizeActiveGameRound({
                walletAddress: wallet,
                roundId,
                expectedVersion: version,
                status: result.won ? 'won' : 'lost',
                payout: result.payout,
                multiplier: result.multiplier,
                resultJson: {
                    ...game,
                    crashPoint: game.crashPoint,
                    cashoutMultiplier,
                    outcome: result.won ? 'cashout' : 'loss',
                } satisfies JsonObject,
            });

            if (!finalResult.success) {
                if (finalResult.error === 'Round already finalized' && finalResult.round?.game === 'crash') {
                    return NextResponse.json(buildFinalizedCrashResponse(finalResult.round));
                }

                return NextResponse.json({ error: finalResult.error ?? 'Failed to finalize round' }, { status: 409 });
            }

            return NextResponse.json({
                crashPoint: game.crashPoint,
                signatureNonce,
                signature,
                success: result.won,
                payout: result.payout,
                multiplier: result.multiplier,
                newBalance: finalResult.new_balance,
            });
        }

        if (action === 'check') {
            const currentMultiplier = body.currentMultiplier ?? 10000;
            if (!validateMultiplier(currentMultiplier)) {
                return NextResponse.json({ error: 'Invalid multiplier' }, { status: 400 });
            }

            if (!hasCrashed(game)) {
                return NextResponse.json({ crashed: false });
            }

            const signatureNonce = Date.now();
            const signature = await signCrash(wallet, signatureNonce, game.crashPoint);
            const finalResult = await finalizeActiveGameRound({
                walletAddress: wallet,
                roundId,
                expectedVersion: version,
                status: 'lost',
                payout: 0,
                multiplier: 0,
                resultJson: {
                    ...game,
                    crashPoint: game.crashPoint,
                    cashoutMultiplier: 0,
                    outcome: 'loss',
                } satisfies JsonObject,
            });

            if (!finalResult.success) {
                if (finalResult.error === 'Round already finalized' && finalResult.round?.game === 'crash') {
                    return NextResponse.json(buildFinalizedCrashResponse(finalResult.round));
                }

                return NextResponse.json({ error: finalResult.error ?? 'Failed to finalize round' }, { status: 409 });
            }

            return NextResponse.json({
                crashed: true,
                crashPoint: game.crashPoint,
                signatureNonce,
                signature,
                newBalance: finalResult.new_balance,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Crash API error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
