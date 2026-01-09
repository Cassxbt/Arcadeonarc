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

        // Time calculations
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        const currentYear = now.getFullYear();

        let leaderboard: LeaderboardEntry[] = [];

        if (period === 'week') {
            const { data: weeklyGames, error: gamesError } = await supabase
                .from('game_sessions')
                .select('wallet_address, bet_amount, payout, won')
                .eq('week_number', currentWeek)
                .eq('year', currentYear);

            if (gamesError) throw gamesError;


            const weekStart = new Date(now);
            const dayOfWeek = weekStart.getDay() || 7; // 1-7 (Mon-Sun)
            weekStart.setDate(now.getDate() - dayOfWeek + 1); // Monday
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6); // Sunday

            const startDateStr = weekStart.toISOString().split('T')[0];
            const endDateStr = weekEnd.toISOString().split('T')[0];

            const { data: questRewards, error: questsError } = await supabase
                .from('daily_quests')
                .select('wallet_address, quest_id')
                .gte('quest_date', startDateStr)
                .lte('quest_date', endDateStr)
                .eq('reward_claimed', true);

            if (questsError) throw questsError;


            const { data: milestoneRewards, error: milestonesError } = await supabase
                .from('milestones')
                .select('wallet_address, milestone_id')
                .eq('week_number', currentWeek)
                .eq('year', currentYear)
                .eq('reward_claimed', true);

            if (milestonesError) throw milestonesError;


            const playerStats = new Map<string, {
                games_played: number;
                wins: number;
                total_won: number;
                quest_points: number;
                milestone_points: number;
            }>();


            const getStats = (wallet: string) => {
                const lowerWallet = wallet.toLowerCase();
                if (!playerStats.has(lowerWallet)) {
                    playerStats.set(lowerWallet, { games_played: 0, wins: 0, total_won: 0, quest_points: 0, milestone_points: 0 });
                }
                return playerStats.get(lowerWallet)!;
            };


            // Points formula from cron: games + (wins * 2) + sqrt(total_won)
            for (const game of weeklyGames || []) {
                const stats = getStats(game.wallet_address);
                stats.games_played++;
                if (game.won) stats.wins++;
                stats.total_won += Number(game.payout);
            }


            const QUEST_VALUES: Record<string, number> = {
                'play_3': 50,
                'win_1': 100,
                'try_2_games': 75,
                'completion_bonus': 200
            };

            for (const q of questRewards || []) {
                const stats = getStats(q.wallet_address);
                stats.quest_points += QUEST_VALUES[q.quest_id] || 0;
            }


            const MILESTONE_VALUES: Record<string, number> = {
                'bronze': 500,
                'silver': 1500,
                'gold': 3000,
                'diamond': 5000
            };

            for (const m of milestoneRewards || []) {
                const stats = getStats(m.wallet_address);
                stats.milestone_points += MILESTONE_VALUES[m.milestone_id] || 0;
            }


            const wallets = Array.from(playerStats.keys());
            if (wallets.length > 0) {
                const { data: users } = await supabase
                    .from('users')
                    .select('wallet_address, username_display, current_streak')
                    .in('wallet_address', wallets);

                const userMap = new Map(users?.map(u => [u.wallet_address.toLowerCase(), u]) || []);

                const entries = wallets
                    .map(wallet => {
                        const stats = playerStats.get(wallet)!;
                        const user = userMap.get(wallet);


                        // Calculate Activity Points
                        const activityPoints = stats.games_played + (stats.wins * 2) + Math.floor(Math.sqrt(stats.total_won));

                        // Total Weekly Points
                        // Note: Daily bonus (25pts) is not retrospectively trackable for "this week" easily without a log table,
                        // so we omit it for the weekly specific leaderboard to ensure accuracy of what we can prove.
                        const totalPoints = stats.quest_points + stats.milestone_points + activityPoints;

                        return {
                            wallet_address: wallet,
                            username: user?.username_display || wallet.slice(0, 6) + '...' + wallet.slice(-4),
                            points: totalPoints,
                            games_played: stats.games_played,
                            wins: stats.wins,
                            total_won: stats.total_won,
                            streak: user?.current_streak || 0
                        };
                    })
                    // Filter: Minimum 3 games required to appear
                    .filter(e => e.games_played >= 3)
                    // Sort: Points DESC, then Games DESC, then Wins DESC (Strict Tie-breaking)
                    .sort((a, b) => {
                        if (b.points !== a.points) return b.points - a.points;
                        if (b.games_played !== a.games_played) return b.games_played - a.games_played;
                        return b.wins - a.wins;
                    })
                    .slice(0, limit);

                // Assign Rank (1, 2, 3...)
                leaderboard = entries.map((entry, index) => ({
                    rank: index + 1,
                    ...entry
                }));
            }


        } else if (period === 'season') {
            const currentMonth = now.getMonth() + 1; // 1-12
            const startOfMonth = new Date(currentYear, now.getMonth(), 1).toISOString();
            const endOfMonth = new Date(currentYear, now.getMonth() + 1, 0).toISOString();

            const { data: distributions, error: distError } = await supabase
                .from('weekly_distributions')
                .select('wallet_address, points_received')
                .gte('distributed_at', startOfMonth)
                .lte('distributed_at', endOfMonth);

            if (distError) throw distError;


            const seasonalStats = new Map<string, number>(); // wallet -> total points

            for (const dist of distributions || []) {
                const current = seasonalStats.get(dist.wallet_address.toLowerCase()) || 0;
                seasonalStats.set(dist.wallet_address.toLowerCase(), current + dist.points_received);
            }

            const wallets = Array.from(seasonalStats.keys());
            if (wallets.length > 0) {
                const { data: users } = await supabase
                    .from('users')
                    .select('wallet_address, username_display, current_streak')
                    .in('wallet_address', wallets);

                const userMap = new Map(users?.map(u => [u.wallet_address.toLowerCase(), u]) || []);

                const entries = wallets
                    .map(wallet => {
                        const points = seasonalStats.get(wallet)!;
                        const user = userMap.get(wallet);
                        return {
                            wallet_address: wallet,
                            username: user?.username_display || wallet.slice(0, 6) + '...' + wallet.slice(-4),
                            points: points,
                            streak: user?.current_streak || 0,
                            // These stats aren't as relevant for 'Season' (which is just pool earnings), 
                            // but we fill them for type compatibility.
                            games_played: 0,
                            wins: 0,
                            total_won: 0
                        };
                    })
                    .sort((a, b) => b.points - a.points)
                    .slice(0, limit);

                leaderboard = entries.map((entry, index) => ({
                    rank: index + 1,
                    ...entry
                }));
            }


        } else {
            const { data: users, error } = await supabase
                .from('users')
                .select('wallet_address, username_display, lifetime_xp, current_streak, created_at')
                .order('lifetime_xp', { ascending: false })
                // Secondary sorts handled by application code because we need complex joins for stats
                .limit(limit * 2); // Fetch more to handle ties locally

            if (error) throw error;

            if (users && users.length > 0) {
                const wallets = users.map(u => u.wallet_address);


                // Fetch stats for tie-breaking (Games, Wins)
                const { data: allSessions } = await supabase
                    .from('game_sessions')
                    .select('wallet_address, won, payout')
                    .in('wallet_address', wallets);

                const statsMap = new Map<string, { games: number, wins: number, total_won: number }>();

                for (const s of allSessions || []) {
                    const stats = statsMap.get(s.wallet_address) || { games: 0, wins: 0, total_won: 0 };
                    stats.games++;
                    if (s.won) stats.wins++;
                    stats.total_won += Number(s.payout);
                    statsMap.set(s.wallet_address, stats);
                }

                const entries = users.map(user => {
                    const stats = statsMap.get(user.wallet_address) || { games: 0, wins: 0, total_won: 0 };
                    return {
                        wallet_address: user.wallet_address,
                        username: user.username_display,
                        points: user.lifetime_xp || 0,
                        streak: user.current_streak || 0,
                        games_played: stats.games,
                        wins: stats.wins,
                        total_won: stats.total_won,
                        created_at: new Date(user.created_at).getTime()
                    };
                });

                // Application-side sort with strict tie-breakers
                entries.sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points; // 1. Points
                    if (b.games_played !== a.games_played) return b.games_played - a.games_played; // 2. Games Played
                    if (b.wins !== a.wins) return b.wins - a.wins; // 3. Wins
                    return a.created_at - b.created_at; // 4. Seniority (Oldest first)
                });

                leaderboard = entries.slice(0, limit).map((entry, index) => ({
                    rank: index + 1,
                    username: entry.username,
                    wallet_address: entry.wallet_address,
                    points: entry.points,
                    games_played: entry.games_played,
                    wins: entry.wins,
                    total_won: entry.total_won,
                    streak: entry.streak
                }));
            }
        }

        return NextResponse.json({
            leaderboard,
            period,
            week: currentWeek,
            year: currentYear
        });

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
