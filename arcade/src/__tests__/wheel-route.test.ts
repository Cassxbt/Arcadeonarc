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

vi.mock('viem/accounts', () => ({
    privateKeyToAccount: vi.fn(() => ({
        signMessage: mocks.signMessage,
    })),
}));

function createJsonRequest(body: unknown) {
    return new Request('http://localhost/api/wheel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function loadPostHandler() {
    process.env.SIGNER_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
    vi.resetModules();
    const route = await import('@/app/api/wheel/route');
    return route.POST;
}

describe('/api/wheel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getClientIp.mockReturnValue('127.0.0.1');
        mocks.checkRateLimit.mockResolvedValue({ success: true });
        mocks.secureRandomInt.mockReturnValue(3);
        mocks.signMessage.mockResolvedValue('0xsigned');
    });

    it('rejects unauthenticated spins', async () => {
        mocks.getSessionWallet.mockResolvedValue(null);
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ betAmount: 10 }) as never);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
        expect(mocks.startGameRound).not.toHaveBeenCalled();
    });

    it('rejects invalid bet amounts before starting a round', async () => {
        mocks.getSessionWallet.mockResolvedValue('0x1111111111111111111111111111111111111111');
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ betAmount: 0.1 }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('Invalid bet amount');
        expect(mocks.startGameRound).not.toHaveBeenCalled();
    });

    it('starts and finalizes a wheel round using the server result', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        mocks.startGameRound.mockResolvedValue({
            success: true,
            round: {
                id: 'round-1',
                version: 1,
            },
            new_balance: 90,
        });
        mocks.finalizeGameRound.mockResolvedValue({
            success: true,
            new_balance: 103,
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ betAmount: 10 }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            segment: 3,
            multiplier: 1.3,
            payout: 13,
            won: true,
            newBalance: 103,
            roundId: 'round-1',
            signatureNonce: expect.any(Number),
            signature: '0xsigned',
        });
        expect(mocks.startGameRound).toHaveBeenCalledWith(expect.objectContaining({
            walletAddress: wallet,
            game: 'wheel',
            betAmount: 10,
            stateJson: { segment: 3, multiplier: 1.3 },
        }));
        expect(mocks.finalizeGameRound).toHaveBeenCalledWith({
            walletAddress: wallet,
            roundId: 'round-1',
            expectedVersion: 1,
            status: 'won',
            payout: 13,
            multiplier: 1.3,
            resultJson: { segment: 3, multiplier: 1.3, payout: 13 },
        });
    });

    it('returns insufficient balance details from round start failures', async () => {
        mocks.getSessionWallet.mockResolvedValue('0x1111111111111111111111111111111111111111');
        mocks.startGameRound.mockResolvedValue({
            success: false,
            error: 'Insufficient balance',
            available: 2,
            required: 10,
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ betAmount: 10 }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({
            error: 'Insufficient balance',
            available: 2,
            required: 10,
        });
        expect(mocks.finalizeGameRound).not.toHaveBeenCalled();
    });

    it('returns a conflict if finalization fails after the round starts', async () => {
        mocks.getSessionWallet.mockResolvedValue('0x1111111111111111111111111111111111111111');
        mocks.startGameRound.mockResolvedValue({
            success: true,
            round: {
                id: 'round-1',
                version: 1,
            },
        });
        mocks.finalizeGameRound.mockResolvedValue({
            success: false,
            error: 'Round version mismatch',
        });
        const POST = await loadPostHandler();

        const response = await POST(createJsonRequest({ betAmount: 10 }) as never);
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body).toEqual({
            error: 'Round version mismatch',
            roundId: 'round-1',
        });
    });
});
