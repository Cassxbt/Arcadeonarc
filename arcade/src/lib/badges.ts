import { SupabaseClient } from '@supabase/supabase-js';

export type BadgeType = 'rising_star' | 'veteran' | 'elite' | 'champion' | 'whale' | 'loyalist' | 'high_roller';

export interface BadgeDefinition {
    id: BadgeType;
    name: string;
    description: string;
    icon: string;
    condition: (stats: UserStats) => boolean;
}

export interface UserStats {
    wins: number;
    gamesPlayed: number;
    totalWon: number;
    xp: number;
    streak: number;
    maxBet: number;
}

export const BADGE_DEFINITIONS: Record<BadgeType, BadgeDefinition> = {
    rising_star: {
        id: 'rising_star',
        name: 'Rising Star',
        description: 'Win 10 games',
        icon: '🌟',
        condition: (stats) => stats.wins >= 10
    },
    veteran: {
        id: 'veteran',
        name: 'Veteran',
        description: 'Play 100 games',
        icon: '🛡️',
        condition: (stats) => stats.gamesPlayed >= 100
    },
    elite: {
        id: 'elite',
        name: 'Elite',
        description: 'Win 100 games',
        icon: '⚔️',
        condition: (stats) => stats.wins >= 100
    },
    champion: {
        id: 'champion',
        name: 'Champion',
        description: 'Earn 5,000 XP',
        icon: '👑',
        condition: (stats) => stats.xp >= 5000
    },
    whale: {
        id: 'whale',
        name: 'Whale',
        description: 'Win over $1,000 total',
        icon: '🐋',
        condition: (stats) => stats.totalWon >= 1000
    },
    loyalist: {
        id: 'loyalist',
        name: 'Loyalist',
        description: 'Reach a 7-day streak',
        icon: '🔥',
        condition: (stats) => stats.streak >= 7
    },
    high_roller: {
        id: 'high_roller',
        name: 'High Roller',
        description: 'Place a bet of $50 or more',
        icon: '💎',
        condition: (stats) => stats.maxBet >= 50
    }
};

export async function checkAndAwardBadges(supabase: SupabaseClient, wallet: string) {
    try {
        // 1. Fetch aggregated stats for the user
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('lifetime_xp, current_streak')
            .eq('wallet_address', wallet)
            .single();

        if (userError || !userData) throw userError;

        const { data: sessionStats, error: sessionError } = await supabase
            .from('game_sessions')
            .select('won, payout, bet_amount')
            .eq('wallet_address', wallet);

        if (sessionError) throw sessionError;

        // Calculate stats
        const wins = sessionStats?.filter(s => s.won).length || 0;
        const gamesPlayed = sessionStats?.length || 0;
        const totalWon = sessionStats?.reduce((sum, s) => sum + (s.payout || 0), 0) || 0;
        const maxBet = Math.max(...(sessionStats?.map(s => s.bet_amount) || [0]));

        const currentStats: UserStats = {
            wins,
            gamesPlayed,
            totalWon,
            xp: userData.lifetime_xp || 0,
            streak: userData.current_streak || 0,
            maxBet
        };

        // 2. Fetch existing badges
        const { data: existingBadges, error: badgeError } = await supabase
            .from('badges')
            .select('badge_type')
            .eq('wallet_address', wallet);

        if (badgeError) throw badgeError;

        const ownedBadgeTypes = new Set(existingBadges?.map(b => b.badge_type) || []);

        // 3. Check for new badges
        const newBadges: BadgeType[] = [];

        for (const [type, def] of Object.entries(BADGE_DEFINITIONS)) {
            const badgeType = type as BadgeType;
            if (!ownedBadgeTypes.has(badgeType)) {
                if (def.condition(currentStats)) {
                    newBadges.push(badgeType);
                }
            }
        }

        // 4. Award new badges
        if (newBadges.length > 0) {
            const inserts = newBadges.map(type => ({
                wallet_address: wallet,
                badge_type: type
            }));

            const { error: insertError } = await supabase
                .from('badges')
                .insert(inserts);

            if (insertError) {
                console.error('Error awarding badges:', insertError);
            }
        }

    } catch (error) {
        console.error('Error in checkAndAwardBadges:', error);
    }
}
