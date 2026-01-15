import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

const POOL_SIZE = 50000;
const MIN_PARTICIPANTS = 3; // Minimum players needed to distribute

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        console.error('CRON_SECRET not configured');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('Unauthorized cron attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = createServerClient();
        const { week, year } = getPreviousWeek();

        const { data: existingDistribution } = await supabase
            .from('weekly_distributions')
            .select('id')
            .eq('week_number', week)
            .eq('year', year)
            .limit(1);

        if (existingDistribution && existingDistribution.length > 0) {
            return NextResponse.json({
                success: false,
                message: `Week ${week} of ${year} already distributed`,
            });
        }

        const { data: weeklyGames, error: gamesError } = await supabase
            .from('game_sessions')
            .select('wallet_address, payout, won, bet_amount')
            .eq('week_number', week)
            .eq('year', year);

        if (gamesError) {
            throw gamesError;
        }

        if (!weeklyGames || weeklyGames.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'No games played during this week',
            });
        }

        const playerStats = aggregatePlayerStats(weeklyGames);

        if (playerStats.size < MIN_PARTICIPANTS) {
            return NextResponse.json({
                success: false,
                message: `Need at least ${MIN_PARTICIPANTS} participants, only ${playerStats.size} found`,
            });
        }

        let totalPoints = 0;
        for (const stats of playerStats.values()) {
            totalPoints += stats.points;
        }

        if (totalPoints === 0) {
            return NextResponse.json({
                success: false,
                message: 'No points earned this week',
            });
        }

        const distributions: Array<{
            wallet: string;
            points: number;
            share: number;
            reward: number;
        }> = [];

        for (const [wallet, stats] of playerStats) {
            const share = stats.points / totalPoints;
            const reward = Math.round(share * POOL_SIZE);

            if (reward > 0) {
                await supabase.from('weekly_distributions').insert({
                    week_number: week,
                    year: year,
                    wallet_address: wallet,
                    points_earned: stats.points,
                    pool_share: share,
                    points_received: reward,
                });

                await supabase.rpc('increment_lifetime_xp', {
                    p_wallet: wallet,
                    p_amount: reward,
                });

                distributions.push({
                    wallet: wallet.slice(0, 8) + '...',
                    points: stats.points,
                    share: Math.round(share * 10000) / 100, // Percentage
                    reward,
                });
            }
        }

        console.log(`Weekly distribution complete: ${distributions.length} players, ${POOL_SIZE} points`);

        return NextResponse.json({
            success: true,
            week,
            year,
            totalParticipants: distributions.length,
            totalPointsEarned: totalPoints,
            poolDistributed: POOL_SIZE,
            distributions,
        });
    } catch (error) {
        console.error('Weekly distribution error:', error);
        return NextResponse.json({ error: 'Distribution failed' }, { status: 500 });
    }
}

function getPreviousWeek(): { week: number; year: number } {
    const now = new Date();
    const prevMonday = new Date(now);
    prevMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7);

    const year = prevMonday.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((prevMonday.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);

    return { week, year };
}

interface PlayerStats {
    points: number;
    gamesPlayed: number;
    wins: number;
    totalWon: number;
}

function aggregatePlayerStats(
    games: Array<{ wallet_address: string; payout: number; won: boolean; bet_amount: number }>
): Map<string, PlayerStats> {
    const stats = new Map<string, PlayerStats>();

    for (const game of games) {
        const existing = stats.get(game.wallet_address) || {
            points: 0,
            gamesPlayed: 0,
            wins: 0,
            totalWon: 0,
        };

        existing.gamesPlayed += 1;
        if (game.won) {
            existing.wins += 1;
            existing.totalWon += game.payout;
        }

        existing.points = existing.gamesPlayed + (existing.wins * 2) + Math.floor(Math.sqrt(existing.totalWon));

        stats.set(game.wallet_address, existing);
    }

    return stats;
}
