import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSessionWallet: vi.fn(),
    checkRateLimit: vi.fn(),
    getClientIp: vi.fn(),
    secureRandomInt: vi.fn(),
    startGameRound: vi.fn(),
    finalizeGameRound: vi.fn(),
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
    startGameRound: mocks.startGameRound,
    finalizeGameRound: mocks.finalizeGameRound,
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}));

vi.mock('viem/accounts', () => ({
    privateKeyToAccount: vi.fn(() => ({
        signMessage: mocks.signMessage,
    })),
}));

function createJsonRequest(body: unknown) {
    return new Request('http://localhost/api/dice/roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function loadPostHandler() {
    process.env.SIGNER_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
    vi.resetModules();
    const route = await import('@/app/api/dice/roll/route');
    return route.POST;
}

describe('/api/dice/roll', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getClientIp.mockReturnValue('127.0.0.1');
        mocks.checkRateLimit.mockResolvedValue({ success: true });
        mocks.secureRandomInt.mockReturnValue(20);
        mocks.signMessage.mockResolvedValue('0xsigned');
    });

    it('rejects unauthenticated rolls', async () => {
        mocks.getSessionWallet.mockResolvedValue(null);
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ betAmount: 10, target: 50, betUnder: true }) as never);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
        expect(mocks.startGameRound).not.toHaveBeenCalled();
    });

    it('rejects invalid dice targets before starting a round', async () => {
        mocks.getSessionWallet.mockResolvedValue('0x1111111111111111111111111111111111111111');
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ betAmount: 10, target: 1, betUnder: true }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('Invalid target');
        expect(mocks.startGameRound).not.toHaveBeenCalled();
    });

    it('starts and finalizes a winning dice round from the server result', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.startGameRound.mockResolvedValue({
            success: true,
            round: {
                id: 'round-1',
                version: 1,
            },
        });
        mocks.finalizeGameRound.mockResolvedValue({
            success: true,
            new_balance: 108.367,
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ betAmount: 10, target: 50, betUnder: true }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.result).toBe(20);
        expect(body.won).toBe(true);
        expect(body.multiplier).toBe(1.8367);
        expect(body.payout).toBeCloseTo(18.367);
        expect(body.newBalance).toBe(108.367);
        expect(body.roundId).toBe('round-1');
        expect(body.signature).toBe('0xsigned');
        expect(mocks.startGameRound).toHaveBeenCalledWith(expect.objectContaining({
            walletAddress: wallet,
            game: 'dice',
            betAmount: 10,
            stateJson: { target: 50, betUnder: true, result: 20 },
        }));
        expect(mocks.finalizeGameRound).toHaveBeenCalledWith({
            walletAddress: wallet,
            roundId: 'round-1',
            expectedVersion: 1,
            status: 'won',
            payout: expect.closeTo(18.367),
            multiplier: 1.8367,
            resultJson: { target: 50, betUnder: true, result: 20, payout: expect.closeTo(18.367) },
        });
    });

    it('finalizes losing dice rounds without payout', async () => {
        mocks.getSessionWallet.mockResolvedValue('0x1111111111111111111111111111111111111111');
        mocks.secureRandomInt.mockReturnValue(80);
        mocks.startGameRound.mockResolvedValue({
            success: true,
            round: {
                id: 'round-1',
                version: 1,
            },
        });
        mocks.finalizeGameRound.mockResolvedValue({
            success: true,
            new_balance: 90,
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ betAmount: 10, target: 50, betUnder: true }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.won).toBe(false);
        expect(body.payout).toBe(0);
        expect(mocks.finalizeGameRound).toHaveBeenCalledWith(expect.objectContaining({
            status: 'lost',
            payout: 0,
            multiplier: 0,
        }));
    });
});
