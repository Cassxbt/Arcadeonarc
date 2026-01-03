import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

interface LeaderboardEntry {
    rank: number;
    username: string;
    wallet_address: string;
    points: number;
    games_played: number;
    wins: number;
    total_won: number;
    streak: number;
}

// GET /api/leaderboard?period=week|season|alltime&limit=50
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'week';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    try {
        const supabase = createServerClient();

        // Get current week/year
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        let leaderboard: LeaderboardEntry[] = [];

        if (period === 'week') {
            // This week's activity - aggregate from game_sessions
            const { data: weeklyData, error } = await supabase
                .from('game_sessions')
                .select(`
                    wallet_address,
                    bet_amount,
                    payout,
                    won
                `)
                .eq('week_number', currentWeek)
                .eq('year', currentYear);

            if (error) throw error;

            // Aggregate by wallet
            const aggregated = new Map<string, {
                games_played: number;
                wins: number;
                total_won: number;
            }>();

            for (const session of weeklyData || []) {
                const current = aggregated.get(session.wallet_address) || {
                    games_played: 0,
                    wins: 0,
                    total_won: 0,
                };
                current.games_played++;
                if (session.won) current.wins++;
                current.total_won += Number(session.payout);
                aggregated.set(session.wallet_address, current);
            }

            // Get usernames for these wallets
            const wallets = Array.from(aggregated.keys());
            if (wallets.length > 0) {
                const { data: users } = await supabase
                    .from('users')
                    .select('wallet_address, username_display, current_streak')
                    .in('wallet_address', wallets);

                const userMap = new Map(users?.map(u => [u.wallet_address, u]) || []);

                // Calculate points and build leaderboard
                const entries = wallets
                    .filter(wallet => aggregated.get(wallet)!.games_played >= 3) // Minimum 3 games
                    .map(wallet => {
                        const stats = aggregated.get(wallet)!;
                        const user = userMap.get(wallet);
                        const streak = user?.current_streak || 0;
                        const streakMultiplier = Math.min(1.0 + (streak - 1) * 0.15, 2.0);

                        // Points formula: (wins + usdc/10 + games) * streak_multiplier
                        const rawPoints = stats.wins + (stats.total_won / 10) + stats.games_played;
                        const points = Math.round(rawPoints * (streak > 0 ? streakMultiplier : 1));

                        return {
                            wallet_address: wallet,
                            username: user?.username_display || wallet.slice(0, 6) + '...' + wallet.slice(-4),
                            points,
                            games_played: stats.games_played,
                            wins: stats.wins,
                            total_won: stats.total_won,
                            streak,
                        };
                    })
                    .sort((a, b) => b.points - a.points)
                    .slice(0, limit);

                leaderboard = entries.map((entry, index) => ({
                    rank: index + 1,
                    ...entry,
                }));
            }
        } else if (period === 'season') {
            // Current month - get from weekly_points table
            // For now, aggregate current month's game sessions
            const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
            const endOfMonth = new Date(currentYear, currentMonth, 0);

            const { data: monthlyData, error } = await supabase
                .from('game_sessions')
                .select('wallet_address, payout, won')
                .gte('played_at', startOfMonth.toISOString())
                .lte('played_at', endOfMonth.toISOString());

            if (error) throw error;

            // Similar aggregation as weekly
            const aggregated = new Map<string, { games_played: number; wins: number; total_won: number }>();

            for (const session of monthlyData || []) {
                const current = aggregated.get(session.wallet_address) || { games_played: 0, wins: 0, total_won: 0 };
                current.games_played++;
                if (session.won) current.wins++;
                current.total_won += Number(session.payout);
                aggregated.set(session.wallet_address, current);
            }

            const wallets = Array.from(aggregated.keys());
            if (wallets.length > 0) {
                const { data: users } = await supabase
                    .from('users')
                    .select('wallet_address, username_display, current_streak, lifetime_xp')
                    .in('wallet_address', wallets);

                const userMap = new Map(users?.map(u => [u.wallet_address, u]) || []);

                const entries = wallets
                    .filter(wallet => aggregated.get(wallet)!.games_played >= 3)
                    .map(wallet => {
                        const stats = aggregated.get(wallet)!;
                        const user = userMap.get(wallet);
                        const rawPoints = stats.wins + (stats.total_won / 10) + stats.games_played;

                        return {
                            wallet_address: wallet,
                            username: user?.username_display || wallet.slice(0, 6) + '...' + wallet.slice(-4),
                            points: Math.round(rawPoints),
                            games_played: stats.games_played,
                            wins: stats.wins,
                            total_won: stats.total_won,
                            streak: user?.current_streak || 0,
                        };
                    })
                    .sort((a, b) => b.points - a.points)
                    .slice(0, limit);

                leaderboard = entries.map((entry, index) => ({
                    rank: index + 1,
                    ...entry,
                }));
            }
        } else {
            // All-time - use lifetime_xp from users table
            const { data: users, error } = await supabase
                .from('users')
                .select('wallet_address, username_display, lifetime_xp, current_streak')
                .order('lifetime_xp', { ascending: false })
                .limit(limit);

            if (error) throw error;

            // Get game stats for these users
            const wallets = users?.map(u => u.wallet_address) || [];

            let gameStats = new Map<string, { games_played: number; wins: number; total_won: number }>();

            if (wallets.length > 0) {
                const { data: sessions } = await supabase
                    .from('game_sessions')
                    .select('wallet_address, payout, won')
                    .in('wallet_address', wallets);

                for (const session of sessions || []) {
                    const current = gameStats.get(session.wallet_address) || { games_played: 0, wins: 0, total_won: 0 };
                    current.games_played++;
                    if (session.won) current.wins++;
                    current.total_won += Number(session.payout);
                    gameStats.set(session.wallet_address, current);
                }
            }

            leaderboard = (users || []).map((user, index) => {
                const stats = gameStats.get(user.wallet_address) || { games_played: 0, wins: 0, total_won: 0 };
                return {
                    rank: index + 1,
                    wallet_address: user.wallet_address,
                    username: user.username_display,
                    points: Number(user.lifetime_xp),
                    games_played: stats.games_played,
                    wins: stats.wins,
                    total_won: stats.total_won,
                    streak: user.current_streak,
                };
            });
        }

        return NextResponse.json({
            leaderboard,
            period,
            week: currentWeek,
            year: currentYear,
            month: currentMonth,
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
