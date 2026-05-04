import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSessionWallet: vi.fn(),
    checkRateLimit: vi.fn(),
    getClientIp: vi.fn(),
    secureRandomInt: vi.fn(),
    startGameRound: vi.fn(),
    getBlockingGameRoundForWalletGame: vi.fn(),
    finalizeGameRound: vi.fn(),
    getGameRoundForWallet: vi.fn(),
    updateActiveGameRoundState: vi.fn(),
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
    secureRandomInt: mocks.secureRandomInt,
}));

vi.mock('@/lib/game-rounds', () => ({
    isActiveRound: mocks.isActiveRound,
}));

vi.mock('@/lib/active-game-rounds', () => ({
    startActiveGameRound: mocks.startGameRound,
    finalizeActiveGameRound: mocks.finalizeGameRound,
    getBlockingActiveGameRoundForWalletGame: mocks.getBlockingGameRoundForWalletGame,
    getActiveGameRoundForWallet: mocks.getGameRoundForWallet,
    updateActiveGameRoundStateHot: mocks.updateActiveGameRoundState,
}));

vi.mock('viem/accounts', () => ({
    privateKeyToAccount: vi.fn(() => ({
        signMessage: mocks.signMessage,
    })),
}));

function createJsonRequest(body: unknown) {
    return new Request('http://localhost/api/laser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function loadPostHandler() {
    process.env.SIGNER_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
    vi.resetModules();
    const route = await import('@/app/api/laser/route');
    return route.POST;
}

describe('/api/laser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getClientIp.mockReturnValue('127.0.0.1');
        mocks.checkRateLimit.mockResolvedValue({ success: true });
        mocks.secureRandomInt.mockReturnValue(4);
        mocks.isActiveRound.mockReturnValue(true);
        mocks.signMessage.mockResolvedValue('0xsigned');
    });

    it('starts a durable laser round', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.startGameRound.mockResolvedValue({
            success: true,
            round: {
                id: 'round-1',
                bet_amount: 10,
                version: 1,
                state_json: {
                    currentTurn: 0,
                    columnsRemaining: 10,
                    rowsRemaining: 10,
                    destroyedColumns: [],
                    destroyedRows: [],
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
            currentTurn: 0,
            columnsRemaining: 10,
            rowsRemaining: 10,
            state: {
                currentTurn: 0,
                columnsRemaining: 10,
                rowsRemaining: 10,
                destroyedColumns: [],
                destroyedRows: [],
            },
            betAmount: 10,
            resumed: false,
            newBalance: 90,
        });
        expect(mocks.startGameRound).toHaveBeenCalledWith(expect.objectContaining({
            walletAddress: wallet,
            game: 'laser',
            betAmount: 10,
            stateJson: {
                currentTurn: 0,
                columnsRemaining: 10,
                rowsRemaining: 10,
                destroyedColumns: [],
                destroyedRows: [],
            },
        }));
    });

    it('resumes an existing active laser round instead of leaving the client blocked', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.startGameRound.mockResolvedValue({
            success: false,
            error: 'Active round already exists',
        });
        mocks.getBlockingGameRoundForWalletGame.mockResolvedValue({
            id: 'round-existing',
            wallet_address: wallet,
            game: 'laser',
            bet_amount: 5,
            status: 'active',
            version: 4,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            state_json: {
                currentTurn: 1,
                columnsRemaining: 9,
                rowsRemaining: 10,
                destroyedColumns: [4],
                destroyedRows: [],
            },
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ action: 'start', betAmount: 10 }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            roundId: 'round-existing',
            version: 4,
            currentTurn: 1,
            columnsRemaining: 9,
            rowsRemaining: 10,
            state: {
                currentTurn: 1,
                columnsRemaining: 9,
                rowsRemaining: 10,
                destroyedColumns: [4],
                destroyedRows: [],
            },
            betAmount: 5,
            resumed: true,
        });
        expect(mocks.getBlockingGameRoundForWalletGame).toHaveBeenCalledWith(wallet, 'laser');
        expect(mocks.finalizeGameRound).not.toHaveBeenCalled();
    });

    it('expires a stale laser blocker and retries the start once', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.isActiveRound.mockReturnValue(false);
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
                    state_json: {
                        currentTurn: 0,
                        columnsRemaining: 10,
                        rowsRemaining: 10,
                        destroyedColumns: [],
                        destroyedRows: [],
                    },
                },
                new_balance: 90,
            });
        mocks.getBlockingGameRoundForWalletGame.mockResolvedValue({
            id: 'round-stale',
            wallet_address: wallet,
            game: 'laser',
            bet_amount: 5,
            status: 'active',
            version: 2,
            expires_at: new Date(Date.now() - 60_000).toISOString(),
            state_json: {
                currentTurn: 1,
                columnsRemaining: 9,
                rowsRemaining: 10,
                destroyedColumns: [4],
                destroyedRows: [],
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
            status: 'expired',
            payout: 0,
            multiplier: 0,
            resultJson: expect.objectContaining({
                outcome: 'expired',
                reason: 'stale_active_round_cleanup',
            }),
        });
        expect(mocks.startGameRound).toHaveBeenCalledTimes(2);
    });

    it('rejects selections that do not match the current grid', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: wallet,
            game: 'laser',
            bet_amount: 10,
            status: 'active',
            version: 1,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            state_json: {
                currentTurn: 0,
                columnsRemaining: 10,
                rowsRemaining: 10,
                destroyedColumns: [],
                destroyedRows: [],
            },
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({
            action: 'select',
            roundId: 'round-1',
            version: 1,
            row: 10,
            col: 0,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('Invalid cell');
        expect(mocks.updateActiveGameRoundState).not.toHaveBeenCalled();
        expect(mocks.finalizeGameRound).not.toHaveBeenCalled();
    });

    it('advances state after a survived laser turn', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.secureRandomInt.mockReturnValue(4);
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: wallet,
            game: 'laser',
            bet_amount: 10,
            status: 'active',
            version: 1,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            state_json: {
                currentTurn: 0,
                columnsRemaining: 10,
                rowsRemaining: 10,
                destroyedColumns: [],
                destroyedRows: [],
            },
        });
        mocks.updateActiveGameRoundState.mockResolvedValue({
            id: 'round-1',
            version: 2,
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({
            action: 'select',
            roundId: 'round-1',
            version: 1,
            row: 0,
            col: 0,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual(expect.objectContaining({
            outcome: 'safe',
            laserTarget: 4,
            isColumnAttack: true,
            survived: true,
            currentTurn: 1,
            columnsRemaining: 9,
            rowsRemaining: 10,
            version: 2,
            signature: '0xsigned',
        }));
        expect(mocks.updateActiveGameRoundState).toHaveBeenCalledWith(
            wallet,
            'round-1',
            1,
            {
                currentTurn: 1,
                columnsRemaining: 9,
                rowsRemaining: 10,
                destroyedColumns: [4],
                destroyedRows: [],
            }
        );
    });

    it('finalizes a loss when the player is hit', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.secureRandomInt.mockReturnValue(0);
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: wallet,
            game: 'laser',
            bet_amount: 10,
            status: 'active',
            version: 1,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            state_json: {
                currentTurn: 0,
                columnsRemaining: 10,
                rowsRemaining: 10,
                destroyedColumns: [],
                destroyedRows: [],
            },
        });
        mocks.finalizeGameRound.mockResolvedValue({
            success: true,
            new_balance: 90,
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({
            action: 'select',
            roundId: 'round-1',
            version: 1,
            row: 0,
            col: 0,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.outcome).toBe('loss');
        expect(body.survived).toBe(false);
        expect(mocks.finalizeGameRound).toHaveBeenCalledWith({
            walletAddress: wallet,
            roundId: 'round-1',
            expectedVersion: 1,
            status: 'lost',
            payout: 0,
            multiplier: 0,
            resultJson: expect.objectContaining({
                outcome: 'loss',
                survivedTurns: 0,
                laserTarget: 0,
            }),
        });
    });

    it('cashouts using the current survived turns', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: wallet,
            game: 'laser',
            bet_amount: 10,
            status: 'active',
            version: 2,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            state_json: {
                currentTurn: 1,
                columnsRemaining: 9,
                rowsRemaining: 10,
                destroyedColumns: [4],
                destroyedRows: [],
            },
        });
        mocks.finalizeGameRound.mockResolvedValue({
            success: true,
            new_balance: 100.6667,
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({
            action: 'cashout',
            roundId: 'round-1',
            version: 2,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.outcome).toBe('win');
        expect(body.finalTurn).toBe(1);
        expect(body.payout).toBeCloseTo(10.6667);
        expect(body.multiplier).toBeCloseTo(1.0667);
        expect(mocks.finalizeGameRound).toHaveBeenCalledWith({
            walletAddress: wallet,
            roundId: 'round-1',
            expectedVersion: 2,
            status: 'won',
            payout: expect.closeTo(10.6667),
            multiplier: expect.closeTo(1.0667),
            resultJson: expect.objectContaining({
                outcome: 'cashout',
                survivedTurns: 1,
            }),
        });
    });
});
