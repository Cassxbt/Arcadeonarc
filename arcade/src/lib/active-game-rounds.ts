import { redis } from './redis';
import {
    finalizeGameRound,
    getBlockingGameRoundForWalletGame,
    getGameRoundForWallet,
    isActiveRound,
    normalizeWalletAddress,
    startGameRound,
    updateActiveGameRoundState,
    type FinalizeGameRoundInput,
    type GameRoundRecord,
    type GameRoundRpcResult,
    type JsonObject,
    type StartGameRoundInput,
    type GameType,
} from './game-rounds';

const MIN_CACHE_TTL_SECONDS = 1;
const REDIS_READ_TIMEOUT_MS = 150;
const REDIS_WRITE_TIMEOUT_MS = 100;

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T | null> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            operation,
            new Promise<null>(resolve => {
                timeoutId = setTimeout(() => resolve(null), timeoutMs);
            }),
        ]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

function getRoundCacheKey(walletAddress: string, roundId: string): string {
    return `game-round:${normalizeWalletAddress(walletAddress)}:${roundId}`;
}

function getRoundCacheTtlSeconds(round: GameRoundRecord): number {
    const remainingMs = new Date(round.expires_at).getTime() - Date.now();
    return Math.max(MIN_CACHE_TTL_SECONDS, Math.ceil(remainingMs / 1000));
}

async function cacheActiveRound(round: GameRoundRecord): Promise<void> {
    if (!isActiveRound(round)) return;

    try {
        await withTimeout(
            redis.set(
                getRoundCacheKey(round.wallet_address, round.id),
                round,
                { ex: getRoundCacheTtlSeconds(round) }
            ),
            REDIS_WRITE_TIMEOUT_MS
        );
    } catch {
        // Redis accelerates live state. Supabase remains the durable fallback.
    }
}

async function deleteCachedRound(walletAddress: string, roundId: string): Promise<void> {
    try {
        await withTimeout(redis.del(getRoundCacheKey(walletAddress, roundId)), REDIS_WRITE_TIMEOUT_MS);
    } catch {
        // Final settlement already happened in Supabase; stale cache expires by TTL.
    }
}

export async function getActiveGameRoundForWallet(
    walletAddress: string,
    roundId: string,
    expectedVersion?: number
): Promise<GameRoundRecord | null> {
    const wallet = normalizeWalletAddress(walletAddress);
    const cacheKey = getRoundCacheKey(wallet, roundId);

    try {
        const cachedRound = await withTimeout(redis.get<GameRoundRecord>(cacheKey), REDIS_READ_TIMEOUT_MS);
        if (cachedRound && cachedRound.wallet_address === wallet && cachedRound.id === roundId && isActiveRound(cachedRound)) {
            if (expectedVersion === undefined || cachedRound.version === expectedVersion) {
                return cachedRound;
            }
            if (cachedRound.version < expectedVersion) {
                await deleteCachedRound(wallet, roundId);
            }
        }
        if (cachedRound && (!isActiveRound(cachedRound) || cachedRound.wallet_address !== wallet || cachedRound.id !== roundId)) {
            await deleteCachedRound(wallet, roundId);
        }
    } catch {
        // Fall through to Supabase.
    }

    const round = await getGameRoundForWallet(wallet, roundId);
    if (round && isActiveRound(round)) {
        await cacheActiveRound(round);
    }

    return round;
}

export async function getBlockingActiveGameRoundForWalletGame(
    walletAddress: string,
    game: GameType
): Promise<GameRoundRecord | null> {
    const round = await getBlockingGameRoundForWalletGame(walletAddress, game);
    if (round && isActiveRound(round)) {
        await cacheActiveRound(round);
    }
    return round;
}

export async function startActiveGameRound(input: StartGameRoundInput): Promise<GameRoundRpcResult> {
    const result = await startGameRound(input);
    if (result.success && result.round) {
        await cacheActiveRound(result.round);
    }
    return result;
}

export async function updateActiveGameRoundStateHot(
    walletAddress: string,
    roundId: string,
    expectedVersion: number,
    stateJson: JsonObject
): Promise<GameRoundRecord | null> {
    const updatedRound = await updateActiveGameRoundState(walletAddress, roundId, expectedVersion, stateJson);
    if (updatedRound) {
        await cacheActiveRound(updatedRound);
    }
    return updatedRound;
}

export async function finalizeActiveGameRound(input: FinalizeGameRoundInput): Promise<GameRoundRpcResult> {
    const result = await finalizeGameRound(input);
    if (result.success) {
        await deleteCachedRound(input.walletAddress, input.roundId);
    }
    return result;
}
