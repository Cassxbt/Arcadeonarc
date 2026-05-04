import { createHash } from 'crypto';
import { createServerClient } from './supabase-server';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function hashChallenge(challenge: string): Promise<string> {
    return createHash('sha256').update(challenge).digest('hex');
}

export function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt).getTime() <= Date.now();
}

export async function storeAuthChallenge(wallet: string, challenge: string): Promise<void> {
    const supabase = createServerClient();
    const walletLower = wallet.toLowerCase();
    const challengeHash = await hashChallenge(challenge);
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

    const { error } = await supabase.from('auth_challenges').upsert({
        wallet_address: walletLower,
        challenge_hash: challengeHash,
        expires_at: expiresAt,
    });

    if (error) {
        throw error;
    }
}

export async function consumeAuthChallenge(wallet: string, challenge: string): Promise<boolean> {
    const supabase = createServerClient();
    const walletLower = wallet.toLowerCase();
    const challengeHash = await hashChallenge(challenge);

    const { data, error } = await supabase
        .from('auth_challenges')
        .select('challenge_hash, expires_at')
        .eq('wallet_address', walletLower)
        .single();

    if (error || !data || isExpired(data.expires_at) || data.challenge_hash !== challengeHash) {
        return false;
    }

    await supabase
        .from('auth_challenges')
        .delete()
        .eq('wallet_address', walletLower);

    return true;
}
