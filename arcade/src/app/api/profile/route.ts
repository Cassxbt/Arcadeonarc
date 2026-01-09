import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { BADGE_DEFINITIONS, BadgeType } from '@/lib/badges';

// GET /api/profile?wallet=0x...
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet')?.toLowerCase();

    if (!wallet) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    try {
        const supabase = createServerClient();

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('wallet_address', wallet)
            .single();

        if (userError) throw userError;

        const { data: badgesData, error: badgesError } = await supabase
            .from('badges')
            .select('badge_type, earned_at')
            .eq('wallet_address', wallet);

        if (badgesError) throw badgesError;

        const badges = badgesData?.map(b => ({
            ...BADGE_DEFINITIONS[b.badge_type as BadgeType],
            earned_at: b.earned_at
        })) || [];

        const { data: sessions, error: sessionError } = await supabase
            .from('game_sessions')
            .select('game, payout, bet_amount, won')
            .eq('wallet_address', wallet);

        if (sessionError) throw sessionError;

        let totalGames = 0;
        let totalWins = 0;
        let totalWagered = 0;
        let totalWon = 0;
        const gameCounts: Record<string, number> = {};

        sessions?.forEach(session => {
            totalGames++;
            if (session.won) totalWins++;
            totalWagered += session.bet_amount;
            totalWon += Number(session.payout);
            gameCounts[session.game] = (gameCounts[session.game] || 0) + 1;
        });

        let favoriteGame = null;
        let maxCount = 0;
        for (const [game, count] of Object.entries(gameCounts)) {
            if (count > maxCount) {
                maxCount = count;
                favoriteGame = {
                    game,
                    count,
                    percentage: totalGames > 0 ? Math.round((count / totalGames) * 100) : 0
                };
            }
        }

        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        const currentYear = now.getFullYear();

        const { data: weeklyData, error: weeklyError } = await supabase
            .from('game_sessions')
            .select('won, payout, bet_amount')
            .eq('week_number', currentWeek)
            .eq('year', currentYear)
            .eq('wallet_address', wallet);

        if (weeklyError) throw weeklyError;

        // Calculate weekly points: (Wins + USDC/10 + Games) * Streak Multiplier
        let weeklyWins = 0;
        let weeklyUsdc = 0;
        let weeklyGames = 0;

        weeklyData?.forEach(s => {
            weeklyGames++;
            if (s.won) weeklyWins++;
            weeklyUsdc += Number(s.payout);
        });

        const streak = user.current_streak || 0;
        const streakMultiplier = Math.min(1.0 + (streak - 1) * 0.15, 2.0);
        const rawPoints = weeklyWins + (weeklyUsdc / 10) + weeklyGames;
        const weeklyPoints = Math.round(rawPoints * (streak > 0 ? streakMultiplier : 1));

        return NextResponse.json({
            user: {
                wallet_address: user.wallet_address,
                username: user.username_display,
                lifetime_xp: user.lifetime_xp,
                current_streak: user.current_streak,
                created_at: user.created_at
            },
            badges,
            gameStats: {
                totalGames,
                totalWins,
                winRate: totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0,
                totalWagered,
                totalWon,
            },
            favoriteGame,
            weeklyPoints
        });

    } catch (error) {
        console.error('Error fetching profile:', error);
        return NextResponse.json({ error: 'Failed to fetch profile data' }, { status: 500 });
    }
}
