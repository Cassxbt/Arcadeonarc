import { randomUUID } from 'crypto';
import { createServerClient } from './supabase-server';

export const GAME_TYPES = ['dice', 'wheel', 'tower', 'crash', 'laser'] as const;
export const ROUND_STATUSES = ['active', 'won', 'lost', 'cashed_out', 'expired', 'cancelled'] as const;
export const TERMINAL_ROUND_STATUSES = ['won', 'lost', 'cashed_out', 'expired', 'cancelled'] as const;

export type GameType = (typeof GAME_TYPES)[number];
export type RoundStatus = (typeof ROUND_STATUSES)[number];
export type TerminalRoundStatus = (typeof TERMINAL_ROUND_STATUSES)[number];
export type JsonObject = Record<string, unknown>;

export type GameRoundRecord = {
    id: string;
    wallet_address: string;
    game: GameType;
    bet_amount: number;
    nonce: string;
    status: RoundStatus;
    state_json: JsonObject;
    result_json: JsonObject;
    version: number;
    expires_at: string;
    finalized_at: string | null;
    created_at: string;
    updated_at: string;
};

type RoundStateLike = Pick<GameRoundRecord, 'status' | 'expires_at'>;

export type StartGameRoundInput = {
    walletAddress: string;
    game: GameType;
    betAmount: number;
    nonce?: string;
    stateJson?: JsonObject;
    ttlMs?: number;
    expiresAt?: string;
};

export type FinalizeGameRoundInput = {
    walletAddress: string;
    roundId: string;
    expectedVersion: number;
    status: TerminalRoundStatus;
    payout: number;
    multiplier: number;
    resultJson?: JsonObject;
};

export type GameRoundRpcResult = {
    success: boolean;
    error?: string;
    round?: GameRoundRecord;
    new_balance?: number;
    available?: number;
    required?: number;
    streak?: number;
    won?: boolean;
};

const DEFAULT_ROUND_TTL_MS = 5 * 60 * 1000;
const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function isGameType(value: unknown): value is GameType {
    return typeof value === 'string' && GAME_TYPES.includes(value as GameType);
}

export function normalizeWalletAddress(walletAddress: string): string {
    if (!WALLET_REGEX.test(walletAddress)) {
        throw new Error('Invalid wallet address');
    }

    return walletAddress.toLowerCase();
}

export function createRoundNonce(): string {
    return randomUUID();
}

export function buildRoundExpiry(ttlMs = DEFAULT_ROUND_TTL_MS, now = new Date()): string {
    return new Date(now.getTime() + ttlMs).toISOString();
}

export function isTerminalRoundStatus(status: RoundStatus): status is TerminalRoundStatus {
    return TERMINAL_ROUND_STATUSES.includes(status as TerminalRoundStatus);
}

export function isActiveRound(round: RoundStateLike, now = new Date()): boolean {
    return round.status === 'active' && new Date(round.expires_at).getTime() > now.getTime();
}

export function canTransitionRound(from: RoundStatus, to: RoundStatus): boolean {
    return from === 'active' && isTerminalRoundStatus(to);
}

export function nextRoundVersion(version: number): number {
    return version + 1;
}

export async function startGameRound(input: StartGameRoundInput): Promise<GameRoundRpcResult> {
    const wallet = normalizeWalletAddress(input.walletAddress);
    const nonce = input.nonce ?? createRoundNonce();
    const expiresAt = input.expiresAt ?? buildRoundExpiry(input.ttlMs);
    const supabase = createServerClient();

    const { data, error } = await supabase.rpc('start_game_round_atomic', {
        p_wallet: wallet,
        p_game: input.game,
        p_bet_amount: input.betAmount,
        p_nonce: nonce,
        p_state_json: input.stateJson ?? {},
        p_expires_at: expiresAt,
    });

    if (error) {
        throw error;
    }

    return data as GameRoundRpcResult;
}

export async function finalizeGameRound(input: FinalizeGameRoundInput): Promise<GameRoundRpcResult> {
    const wallet = normalizeWalletAddress(input.walletAddress);
    const supabase = createServerClient();

    const { data, error } = await supabase.rpc('finalize_game_round_atomic', {
        p_round_id: input.roundId,
        p_wallet: wallet,
        p_expected_version: input.expectedVersion,
        p_status: input.status,
        p_payout: input.payout,
        p_multiplier: input.multiplier,
        p_result_json: input.resultJson ?? {},
    });

    if (error) {
        throw error;
    }

    return data as GameRoundRpcResult;
}

export async function getGameRoundForWallet(walletAddress: string, roundId: string): Promise<GameRoundRecord | null> {
    const wallet = normalizeWalletAddress(walletAddress);
    const supabase = createServerClient();

    const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('id', roundId)
        .eq('wallet_address', wallet)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return (data as GameRoundRecord | null) ?? null;
}

export async function getBlockingGameRoundForWalletGame(
    walletAddress: string,
    game: GameType
): Promise<GameRoundRecord | null> {
    const wallet = normalizeWalletAddress(walletAddress);
    const supabase = createServerClient();

    const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('wallet_address', wallet)
        .eq('game', game)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return (data as GameRoundRecord | null) ?? null;
}

export async function updateActiveGameRoundState(
    walletAddress: string,
    roundId: string,
    expectedVersion: number,
    stateJson: JsonObject
): Promise<GameRoundRecord | null> {
    const wallet = normalizeWalletAddress(walletAddress);
    const supabase = createServerClient();

    const { data, error } = await supabase
        .from('game_rounds')
        .update({
            state_json: stateJson,
            version: nextRoundVersion(expectedVersion),
            updated_at: new Date().toISOString(),
        })
        .eq('id', roundId)
        .eq('wallet_address', wallet)
        .eq('status', 'active')
        .eq('version', expectedVersion)
        .select('*')
        .maybeSingle();

    if (error) {
        throw error;
    }

    return (data as GameRoundRecord | null) ?? null;
}
