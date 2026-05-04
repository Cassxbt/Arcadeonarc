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
    return new Request('http://localhost/api/tower/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function loadPostHandler() {
    process.env.SIGNER_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
    vi.resetModules();
    const route = await import('@/app/api/tower/reveal/route');
    return route.POST;
}

describe('/api/tower/reveal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getClientIp.mockReturnValue('127.0.0.1');
        mocks.checkRateLimit.mockResolvedValue({ success: true });
        mocks.secureRandomInt.mockReturnValue(3);
        mocks.isActiveRound.mockReturnValue(true);
        mocks.signMessage.mockResolvedValue('0xsigned');
    });

    it('starts a durable tower round', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.startGameRound.mockResolvedValue({
            success: true,
            round: {
                id: 'round-1',
                bet_amount: 10,
                version: 1,
                state_json: {
                    currentRow: 0,
                    revealedDeaths: {},
                    selectedTiles: {},
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
            currentRow: 0,
            state: {
                currentRow: 0,
                revealedDeaths: {},
                selectedTiles: {},
            },
            betAmount: 10,
            resumed: false,
            newBalance: 90,
        });
        expect(mocks.startGameRound).toHaveBeenCalledWith(expect.objectContaining({
            walletAddress: wallet,
            game: 'tower',
            betAmount: 10,
            stateJson: {
                currentRow: 0,
                revealedDeaths: {},
                selectedTiles: {},
            },
        }));
    });

    it('resumes an existing active tower round instead of leaving the client blocked', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.startGameRound.mockResolvedValue({
            success: false,
            error: 'Active round already exists',
        });
        mocks.getBlockingGameRoundForWalletGame.mockResolvedValue({
            id: 'round-existing',
            wallet_address: wallet,
            game: 'tower',
            bet_amount: 5,
            status: 'active',
            version: 3,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            state_json: {
                currentRow: 1,
                revealedDeaths: { 0: 3 },
                selectedTiles: { 0: 0 },
            },
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ action: 'start', betAmount: 10 }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            roundId: 'round-existing',
            version: 3,
            currentRow: 1,
            state: {
                currentRow: 1,
                revealedDeaths: { 0: 3 },
                selectedTiles: { 0: 0 },
            },
            betAmount: 5,
            resumed: true,
        });
        expect(mocks.getBlockingGameRoundForWalletGame).toHaveBeenCalledWith(wallet, 'tower');
        expect(mocks.finalizeGameRound).not.toHaveBeenCalled();
    });

    it('expires a stale tower blocker and retries the start once', async () => {
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
                        currentRow: 0,
                        revealedDeaths: {},
                        selectedTiles: {},
                    },
                },
                new_balance: 90,
            });
        mocks.getBlockingGameRoundForWalletGame.mockResolvedValue({
            id: 'round-stale',
            wallet_address: wallet,
            game: 'tower',
            bet_amount: 5,
            status: 'active',
            version: 2,
            expires_at: new Date(Date.now() - 60_000).toISOString(),
            state_json: {
                currentRow: 1,
                revealedDeaths: { 0: 3 },
                selectedTiles: { 0: 0 },
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

    it('rejects reveal attempts that skip the current row', async () => {
        mocks.getSessionWallet.mockResolvedValue('0x1111111111111111111111111111111111111111');
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: '0x1111111111111111111111111111111111111111',
            game: 'tower',
            bet_amount: 10,
            status: 'active',
            version: 1,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            state_json: {
                currentRow: 0,
                revealedDeaths: {},
                selectedTiles: {},
            },
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({
            action: 'reveal',
            roundId: 'round-1',
            version: 1,
            row: 1,
            tileIndex: 0,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('Invalid row');
        expect(mocks.updateActiveGameRoundState).not.toHaveBeenCalled();
        expect(mocks.finalizeGameRound).not.toHaveBeenCalled();
    });

    it('advances the round after a safe reveal', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.secureRandomInt.mockReturnValue(3);
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: wallet,
            game: 'tower',
            bet_amount: 10,
            status: 'active',
            version: 1,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            state_json: {
                currentRow: 0,
                revealedDeaths: {},
                selectedTiles: {},
            },
        });
        mocks.updateActiveGameRoundState.mockResolvedValue({
            id: 'round-1',
            version: 2,
            state_json: {
                currentRow: 1,
                revealedDeaths: { 0: 3 },
                selectedTiles: { 0: 0 },
            },
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({
            action: 'reveal',
            roundId: 'round-1',
            version: 1,
            row: 0,
            tileIndex: 0,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.outcome).toBe('safe');
        expect(body.deathTile).toBe(3);
        expect(body.currentRow).toBe(1);
        expect(body.version).toBe(2);
        expect(body.multiplier).toBeCloseTo(1.05);
        expect(mocks.updateActiveGameRoundState).toHaveBeenCalledWith(
            wallet,
            'round-1',
            1,
            {
                currentRow: 1,
                revealedDeaths: { 0: 3 },
                selectedTiles: { 0: 0 },
            }
        );
    });

    it('finalizes a loss when the selected tile is the death tile', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.secureRandomInt.mockReturnValue(0);
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: wallet,
            game: 'tower',
            bet_amount: 10,
            status: 'active',
            version: 1,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            state_json: {
                currentRow: 0,
                revealedDeaths: {},
                selectedTiles: {},
            },
        });
        mocks.finalizeGameRound.mockResolvedValue({
            success: true,
            new_balance: 90,
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({
            action: 'reveal',
            roundId: 'round-1',
            version: 1,
            row: 0,
            tileIndex: 0,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.outcome).toBe('loss');
        expect(body.deathTile).toBe(0);
        expect(mocks.finalizeGameRound).toHaveBeenCalledWith({
            walletAddress: wallet,
            roundId: 'round-1',
            expectedVersion: 1,
            status: 'lost',
            payout: 0,
            multiplier: 0,
            resultJson: expect.objectContaining({
                row: 0,
                tileIndex: 0,
                deathTile: 0,
                outcome: 'loss',
            }),
        });
    });

    it('cashouts using the last completed row', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.getGameRoundForWallet.mockResolvedValue({
            id: 'round-1',
            wallet_address: wallet,
            game: 'tower',
            bet_amount: 10,
            status: 'active',
            version: 2,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            state_json: {
                currentRow: 1,
                revealedDeaths: { 0: 3 },
                selectedTiles: { 0: 0 },
            },
        });
        mocks.finalizeGameRound.mockResolvedValue({
            success: true,
            new_balance: 100.5,
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
        expect(body.multiplier).toBeCloseTo(1.05);
        expect(body.payout).toBeCloseTo(10.5);
        expect(mocks.finalizeGameRound).toHaveBeenCalledWith({
            walletAddress: wallet,
            roundId: 'round-1',
            expectedVersion: 2,
            status: 'won',
            payout: expect.closeTo(10.5),
            multiplier: expect.closeTo(1.05),
            resultJson: expect.objectContaining({
                row: 0,
                outcome: 'win',
            }),
        });
    });
});
