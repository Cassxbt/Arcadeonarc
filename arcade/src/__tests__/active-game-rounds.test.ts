import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRoundRecord } from '@/lib/game-rounds';

const mocks = vi.hoisted(() => ({
    redisGet: vi.fn(),
    redisSet: vi.fn(),
    redisDel: vi.fn(),
    getGameRoundForWallet: vi.fn(),
    startGameRound: vi.fn(),
    updateActiveGameRoundState: vi.fn(),
    finalizeGameRound: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
    redis: {
        get: mocks.redisGet,
        set: mocks.redisSet,
        del: mocks.redisDel,
    },
}));

vi.mock('@/lib/game-rounds', async () => {
    const actual = await vi.importActual<typeof import('@/lib/game-rounds')>('@/lib/game-rounds');
    return {
        ...actual,
        getGameRoundForWallet: mocks.getGameRoundForWallet,
        startGameRound: mocks.startGameRound,
        updateActiveGameRoundState: mocks.updateActiveGameRoundState,
        finalizeGameRound: mocks.finalizeGameRound,
    };
});

const wallet = '0x1111111111111111111111111111111111111111';

function activeRound(overrides: Partial<GameRoundRecord> = {}): GameRoundRecord {
    return {
        id: 'round-1',
        wallet_address: wallet,
        game: 'tower',
        bet_amount: 10,
        nonce: 'nonce-1',
        status: 'active',
        state_json: { currentRow: 0 },
        result_json: {},
        version: 1,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        finalized_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    };
}

describe('active game round Redis cache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('returns active rounds from Redis without reading Supabase', async () => {
        const round = activeRound();
        mocks.redisGet.mockResolvedValue(round);
        const { getActiveGameRoundForWallet } = await import('@/lib/active-game-rounds');

        const result = await getActiveGameRoundForWallet(wallet, 'round-1');

        expect(result).toEqual(round);
        expect(mocks.redisGet).toHaveBeenCalledWith(`game-round:${wallet}:round-1`);
        expect(mocks.getGameRoundForWallet).not.toHaveBeenCalled();
    });

    it('falls back to Supabase on Redis miss and repopulates Redis', async () => {
        const round = activeRound();
        mocks.redisGet.mockResolvedValue(null);
        mocks.getGameRoundForWallet.mockResolvedValue(round);
        const { getActiveGameRoundForWallet } = await import('@/lib/active-game-rounds');

        const result = await getActiveGameRoundForWallet(wallet, 'round-1');

        expect(result).toEqual(round);
        expect(mocks.getGameRoundForWallet).toHaveBeenCalledWith(wallet, 'round-1');
        expect(mocks.redisSet).toHaveBeenCalledWith(`game-round:${wallet}:round-1`, round, expect.objectContaining({ ex: expect.any(Number) }));
    });

    it('falls back to Supabase when Redis is unavailable', async () => {
        const round = activeRound();
        mocks.redisGet.mockRejectedValue(new Error('redis unavailable'));
        mocks.getGameRoundForWallet.mockResolvedValue(round);
        const { getActiveGameRoundForWallet } = await import('@/lib/active-game-rounds');

        const result = await getActiveGameRoundForWallet(wallet, 'round-1');

        expect(result).toEqual(round);
        expect(mocks.getGameRoundForWallet).toHaveBeenCalledWith(wallet, 'round-1');
    });

    it('does not let a slow Redis read block active gameplay state', async () => {
        vi.useFakeTimers();
        const round = activeRound();
        mocks.redisGet.mockReturnValue(new Promise(() => undefined));
        mocks.getGameRoundForWallet.mockResolvedValue(round);
        const { getActiveGameRoundForWallet } = await import('@/lib/active-game-rounds');

        const resultPromise = getActiveGameRoundForWallet(wallet, 'round-1');

        await vi.advanceTimersByTimeAsync(151);

        await expect(resultPromise).resolves.toEqual(round);
        expect(mocks.getGameRoundForWallet).toHaveBeenCalledWith(wallet, 'round-1');
    });

    it('falls back to Supabase when the cached round version is stale', async () => {
        const staleRound = activeRound({ version: 1 });
        const currentRound = activeRound({ version: 2, state_json: { currentRow: 1 } });
        mocks.redisGet.mockResolvedValue(staleRound);
        mocks.getGameRoundForWallet.mockResolvedValue(currentRound);
        const { getActiveGameRoundForWallet } = await import('@/lib/active-game-rounds');

        const result = await getActiveGameRoundForWallet(wallet, 'round-1', 2);

        expect(result).toEqual(currentRound);
        expect(mocks.getGameRoundForWallet).toHaveBeenCalledWith(wallet, 'round-1');
    });

    it('caches newly started rounds', async () => {
        const round = activeRound();
        mocks.startGameRound.mockResolvedValue({ success: true, round, new_balance: 90 });
        const { startActiveGameRound } = await import('@/lib/active-game-rounds');

        const result = await startActiveGameRound({
            walletAddress: wallet,
            game: 'tower',
            betAmount: 10,
        });

        expect(result.round).toEqual(round);
        expect(mocks.redisSet).toHaveBeenCalledWith(`game-round:${wallet}:round-1`, round, expect.objectContaining({ ex: expect.any(Number) }));
    });

    it('does not let a slow Redis write block a successful round start', async () => {
        vi.useFakeTimers();
        const round = activeRound();
        mocks.startGameRound.mockResolvedValue({ success: true, round, new_balance: 90 });
        mocks.redisSet.mockReturnValue(new Promise(() => undefined));
        const { startActiveGameRound } = await import('@/lib/active-game-rounds');

        const resultPromise = startActiveGameRound({
            walletAddress: wallet,
            game: 'tower',
            betAmount: 10,
        });

        await vi.advanceTimersByTimeAsync(101);

        await expect(resultPromise).resolves.toEqual({ success: true, round, new_balance: 90 });
    });

    it('refreshes Redis after active state updates', async () => {
        const updated = activeRound({ version: 2, state_json: { currentRow: 1 } });
        mocks.updateActiveGameRoundState.mockResolvedValue(updated);
        const { updateActiveGameRoundStateHot } = await import('@/lib/active-game-rounds');

        const result = await updateActiveGameRoundStateHot(wallet, 'round-1', 1, { currentRow: 1 });

        expect(result).toEqual(updated);
        expect(mocks.redisSet).toHaveBeenCalledWith(`game-round:${wallet}:round-1`, updated, expect.objectContaining({ ex: expect.any(Number) }));
    });

    it('deletes Redis state after final settlement', async () => {
        mocks.finalizeGameRound.mockResolvedValue({ success: true, new_balance: 100 });
        const { finalizeActiveGameRound } = await import('@/lib/active-game-rounds');

        const result = await finalizeActiveGameRound({
            walletAddress: wallet,
            roundId: 'round-1',
            expectedVersion: 1,
            status: 'won',
            payout: 12,
            multiplier: 1.2,
        });

        expect(result.success).toBe(true);
        expect(mocks.redisDel).toHaveBeenCalledWith(`game-round:${wallet}:round-1`);
    });

    it('does not let a slow Redis delete block final settlement response', async () => {
        vi.useFakeTimers();
        mocks.finalizeGameRound.mockResolvedValue({ success: true, new_balance: 100 });
        mocks.redisDel.mockReturnValue(new Promise(() => undefined));
        const { finalizeActiveGameRound } = await import('@/lib/active-game-rounds');

        const resultPromise = finalizeActiveGameRound({
            walletAddress: wallet,
            roundId: 'round-1',
            expectedVersion: 1,
            status: 'won',
            payout: 12,
            multiplier: 1.2,
        });

        await vi.advanceTimersByTimeAsync(101);

        await expect(resultPromise).resolves.toEqual({ success: true, new_balance: 100 });
    });
});
