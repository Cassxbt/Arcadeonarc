import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSessionWallet: vi.fn(),
    checkRateLimit: vi.fn(),
    getClientIp: vi.fn(),
    secureRandomFloat: vi.fn(),
    startGameRound: vi.fn(),
    getBlockingGameRoundForWalletGame: vi.fn(),
    finalizeGameRound: vi.fn(),
    getGameRoundForWallet: vi.fn(),
    isActiveRound: vi.fn(),
    signMessage: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
    getSessionWallet: mocks.getSessionWallet,
}));

vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: mocks.checkRateLimit,
    getClientIp: mocks.getClientIp,
}));

vi.mock('@/lib/random', () => ({
    secureRandomFloat: mocks.secureRandomFloat,
}));

vi.mock('@/lib/game-rounds', () => ({
    isActiveRound: mocks.isActiveRound,
}));

vi.mock('@/lib/active-game-rounds', () => ({
    startActiveGameRound: mocks.startGameRound,
    finalizeActiveGameRound: mocks.finalizeGameRound,
    getBlockingActiveGameRoundForWalletGame: mocks.getBlockingGameRoundForWalletGame,
    getActiveGameRoundForWallet: mocks.getGameRoundForWallet,
}));

vi.mock('viem/accounts', () => ({
    privateKeyToAccount: vi.fn(() => ({
        signMessage: mocks.signMessage,
    })),
}));

function createJsonRequest(body: unknown) {
    return new Request('http://localhost/api/crash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function loadPostHandler() {
    process.env.SIGNER_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
    vi.resetModules();
    const route = await import('@/app/api/crash/route');
    return route.POST;
}

describe('/api/crash', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getClientIp.mockReturnValue('127.0.0.1');
        mocks.checkRateLimit.mockResolvedValue({ success: true });
        mocks.secureRandomFloat.mockReturnValue(0.5);
        mocks.isActiveRound.mockReturnValue(true);
        mocks.signMessage.mockResolvedValue('0xsigned');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rejects unauthenticated crash starts', async () => {
        mocks.getSessionWallet.mockResolvedValue(null);
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ action: 'start', betAmount: 10 }) as never);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
        expect(mocks.startGameRound).not.toHaveBeenCalled();
    });

    it('starts a durable crash round with server-generated crash state', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.startGameRound.mockResolvedValue({
            success: true,
            round: {
                id: 'round-1',
                bet_amount: 10,
                version: 1,
                state_json: {
                    crashPoint: 25000,
                    startTime: 1_800_000_000_000,
                    crashTime: 1_800_000_005_000,
                },
            },
            new_balance: 90,
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ action: 'start', betAmount: 10 }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            roundId: 'round-1',
            version: 1,
            startedAt: expect.any(Number),
            serverTime: expect.any(Number),
            betAmount: 10,
            resumed: false,
            newBalance: 90,
        });
        expect(mocks.startGameRound).toHaveBeenCalledWith(expect.objectContaining({
            walletAddress: wallet,
            game: 'crash',
            betAmount: 10,
            stateJson: expect.objectContaining({
                crashPoint: expect.any(Number),
                startTime: expect.any(Number),
                crashTime: expect.any(Number),
            }),
        }));
    });

    it('resumes an existing active crash round instead of leaving the client blocked', async () => {
        const startedAt = 1_800_000_000_000;
        const wallet = '0x1111111111111111111111111111111111111111';
        vi.spyOn(Date, 'now').mockReturnValue(startedAt + 500);
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.startGameRound.mockResolvedValue({
            success: false,
            error: 'Active round already exists',
        });
        mocks.getBlockingGameRoundForWalletGame.mockResolvedValue({
            id: 'round-existing',
            wallet_address: wallet,
            game: 'crash',
            bet_amount: 5,
            status: 'active',
            version: 2,
            expires_at: new Date(startedAt + 60_000).toISOString(),
            state_json: {
                crashPoint: 25000,
                startTime: startedAt,
                crashTime: startedAt + 5_000,
            },
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ action: 'start', betAmount: 10 }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            roundId: 'round-existing',
            version: 2,
            startedAt,
            serverTime: startedAt + 500,
            betAmount: 5,
            resumed: true,
        });
        expect(mocks.getBlockingGameRoundForWalletGame).toHaveBeenCalledWith(wallet, 'crash');
        expect(mocks.finalizeGameRound).not.toHaveBeenCalled();
    });

    it('settles a stale crashed blocker and retries the start once', async () => {
        const startedAt = 1_800_000_000_000;
        const wallet = '0x1111111111111111111111111111111111111111';
        vi.spyOn(Date, 'now').mockReturnValue(startedAt + 6_000);
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.startGameRound
            .mockResolvedValueOnce({
                success: false,
                error: 'Active round already exists',
            })
            .mockResolvedValueOnce({
                success: true,
                round: {
                    id: 'round-new',
                    bet_amount: 10,
                    version: 1,
                },
                new_balance: 90,
            });
        mocks.getBlockingGameRoundForWalletGame.mockResolvedValue({
            id: 'round-stale',
            wallet_address: wallet,
            game: 'crash',
            bet_amount: 5,
            status: 'active',
            version: 2,
            expires_at: new Date(startedAt + 60_000).toISOString(),
            state_json: {
                crashPoint: 15000,
                startTime: startedAt,
                crashTime: startedAt + 1_000,
            },
        });
        mocks.finalizeGameRound.mockResolvedValue({ success: true });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ action: 'start', betAmount: 10 }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual(expect.objectContaining({
            roundId: 'round-new',
            resumed: false,
            newBalance: 90,
        }));
        expect(mocks.finalizeGameRound).toHaveBeenCalledWith({
            walletAddress: wallet,
            roundId: 'round-stale',
            expectedVersion: 2,
            status: 'lost',
            payout: 0,
            multiplier: 0,
            resultJson: expect.objectContaining({
                outcome: 'loss',
                reason: 'stale_crashed_round_cleanup',
            }),
        });
        expect(mocks.startGameRound).toHaveBeenCalledTimes(2);
    });

    it('does not reveal the crash point before the multiplier reaches it', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: wallet,
            game: 'crash',
            bet_amount: 10,
            status: 'active',
            version: 1,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            state_json: {
                crashPoint: 25000,
                startTime: Date.now(),
                crashTime: Date.now() + 5_000,
            },
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({
            action: 'check',
            roundId: 'round-1',
            version: 1,
            currentMultiplier: 20000,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ crashed: false });
        expect(mocks.finalizeGameRound).not.toHaveBeenCalled();
    });

    it('finalizes a crash loss once the multiplier reaches the crash point', async () => {
        const startedAt = 1_800_000_000_000;
        const wallet = '0x1111111111111111111111111111111111111111';
        vi.spyOn(Date, 'now').mockReturnValue(startedAt + 6_000);
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: wallet,
            game: 'crash',
            bet_amount: 10,
            status: 'active',
            version: 1,
            expires_at: new Date(startedAt + 60_000).toISOString(),
            state_json: {
                crashPoint: 25000,
                startTime: startedAt,
                crashTime: startedAt + 5_000,
            },
        });
        mocks.finalizeGameRound.mockResolvedValue({
            success: true,
            new_balance: 90,
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({
            action: 'check',
            roundId: 'round-1',
            version: 1,
            currentMultiplier: 26000,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.crashed).toBe(true);
        expect(body.crashPoint).toBe(25000);
        expect(mocks.finalizeGameRound).toHaveBeenCalledWith({
            walletAddress: wallet,
            roundId: 'round-1',
            expectedVersion: 1,
            status: 'lost',
            payout: 0,
            multiplier: 0,
            resultJson: expect.objectContaining({
                crashPoint: 25000,
                cashoutMultiplier: 0,
                outcome: 'loss',
            }),
        });
    });

    it('returns finalized crash state when cashout races a crash check', async () => {
        const startedAt = 1_800_000_000_000;
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.isActiveRound.mockReturnValue(false);
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: wallet,
            game: 'crash',
            bet_amount: 10,
            status: 'lost',
            version: 2,
            expires_at: new Date(startedAt + 60_000).toISOString(),
            state_json: {
                crashPoint: 15000,
                startTime: startedAt,
                crashTime: startedAt + 1_000,
            },
            result_json: {
                crashPoint: 15000,
                cashoutMultiplier: 0,
                outcome: 'loss',
            },
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({
            action: 'cashout',
            roundId: 'round-1',
            version: 1,
            cashoutMultiplier: 11000,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            finalized: true,
            success: false,
            crashed: true,
            crashPoint: 15000,
            payout: 0,
            multiplier: 0,
            outcome: 'loss',
        });
        expect(mocks.finalizeGameRound).not.toHaveBeenCalled();
    });

    it('cashouts a live round using the server crash point', async () => {
        const startedAt = 1_800_000_000_000;
        const wallet = '0x1111111111111111111111111111111111111111';
        vi.spyOn(Date, 'now').mockReturnValue(startedAt + 1_350);
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: wallet,
            game: 'crash',
            bet_amount: 10,
            status: 'active',
            version: 1,
            expires_at: new Date(startedAt + 60_000).toISOString(),
            state_json: {
                crashPoint: 25000,
                startTime: startedAt,
                crashTime: startedAt + 1_572,
            },
        });
        mocks.finalizeGameRound.mockResolvedValue({
            success: true,
            new_balance: 111,
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({
            action: 'cashout',
            roundId: 'round-1',
            version: 1,
            cashoutMultiplier: 21000,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.crashPoint).toBe(25000);
        expect(body.payout).toBe(21);
        expect(body.multiplier).toBe(2.1);
        expect(body.newBalance).toBe(111);
        expect(body.signature).toBe('0xsigned');
        expect(mocks.finalizeGameRound).toHaveBeenCalledWith({
            walletAddress: wallet,
            roundId: 'round-1',
            expectedVersion: 1,
            status: 'won',
            payout: 21,
            multiplier: 2.1,
            resultJson: expect.objectContaining({
                crashPoint: 25000,
                cashoutMultiplier: 21000,
                outcome: 'cashout',
            }),
        });
    });

    it('rejects cashout multipliers above the server elapsed multiplier', async () => {
        const startedAt = 1_800_000_000_000;
        const wallet = '0x1111111111111111111111111111111111111111';
        vi.spyOn(Date, 'now').mockReturnValue(startedAt + 1_000);
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: wallet,
            game: 'crash',
            bet_amount: 10,
            status: 'active',
            version: 1,
            expires_at: new Date(startedAt + 60_000).toISOString(),
            state_json: {
                crashPoint: 50000,
                startTime: startedAt,
                crashTime: startedAt + 30_000,
            },
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({
            action: 'cashout',
            roundId: 'round-1',
            version: 1,
            cashoutMultiplier: 25000,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('Cashout multiplier is ahead of server time');
        expect(mocks.finalizeGameRound).not.toHaveBeenCalled();
    });

    it('finalizes a cashout attempt after crash time as a loss', async () => {
        const startedAt = 1_800_000_000_000;
        const wallet = '0x1111111111111111111111111111111111111111';
        vi.spyOn(Date, 'now').mockReturnValue(startedAt + 3_000);
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: wallet,
            game: 'crash',
            bet_amount: 10,
            status: 'active',
            version: 1,
            expires_at: new Date(startedAt + 60_000).toISOString(),
            state_json: {
                crashPoint: 15000,
                startTime: startedAt,
                crashTime: startedAt + 1_000,
            },
        });
        mocks.finalizeGameRound.mockResolvedValue({
            success: true,
            new_balance: 90,
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({
            action: 'cashout',
            roundId: 'round-1',
            version: 1,
            cashoutMultiplier: 11000,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(false);
        expect(body.crashPoint).toBe(15000);
        expect(body.payout).toBe(0);
        expect(mocks.finalizeGameRound).toHaveBeenCalledWith({
            walletAddress: wallet,
            roundId: 'round-1',
            expectedVersion: 1,
            status: 'lost',
            payout: 0,
            multiplier: 0,
            resultJson: expect.objectContaining({
                crashPoint: 15000,
                cashoutMultiplier: 11000,
                outcome: 'loss',
                reason: 'crashed',
            }),
        });
    });
});
