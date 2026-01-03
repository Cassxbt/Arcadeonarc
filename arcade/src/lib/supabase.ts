'use client';

import { createBrowserClient } from '@supabase/ssr';

// Create Supabase client for browser use
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// Singleton client for convenience
let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
    if (!client) {
        client = createClient();
    }
    return client;
}

// Database types
export interface User {
    wallet_address: string;
    username_display: string;
    username_lower: string;
    username_changes_remaining: number;
    lifetime_xp: number;
    current_streak: number;
    last_played_date: string | null;
    created_at: string;
}

export interface GameSession {
    id: string;
    wallet_address: string;
    game: 'dice' | 'tower' | 'crash';
    bet_amount: number;
    payout: number;
    multiplier: number;
    won: boolean;
    tx_hash: string | null;
    played_at: string;
    week_number: number;
    year: number;
}

export interface WeeklyPoints {
    id: string;
    wallet_address: string;
    week_number: number;
    year: number;
    points_earned: number;
    games_played: number;
    wins: number;
    usdc_won: number;
    streak_at_distribution: number;
    calculated_at: string;
}

export interface Badge {
    id: string;
    wallet_address: string;
    badge_type: 'champion' | 'elite' | 'pro' | 'rising_star' | 'veteran';
    season_id: string;
    earned_at: string;
}
