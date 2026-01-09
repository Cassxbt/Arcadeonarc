import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getVerifiedWallet } from '@/lib/verify-dynamic-jwt';

const MILESTONE_DEFINITIONS = {
    bronze: {
        id: 'bronze',
        title: 'Bronze Player',
        description: 'Play 10 games this week',
        requirement: { type: 'games_played', target: 10 },
        reward: 500,
        icon: 'Medal',
    },
    silver: {
        id: 'silver',
        title: 'Silver Player',
        description: 'Play 25 games this week',
        requirement: { type: 'games_played', target: 25 },
        reward: 1500,
        icon: 'Medal',
    },
    gold: {
        id: 'gold',
        title: 'Gold Player',
        description: 'Play 50 games this week',
        requirement: { type: 'games_played', target: 50 },
        reward: 3000,
        icon: 'Trophy',
    },
    diamond: {
        id: 'diamond',
        title: 'Diamond Champion',
        description: 'Win 20 games this week',
        requirement: { type: 'wins', target: 20 },
        reward: 5000,
        icon: 'Trophy',
    },
};

function getCurrentWeek(): { week: number; year: number } {
    const now = new Date();
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return { week, year };
}

export async function GET(request: NextRequest) {
    try {
        const wallet = await getVerifiedWallet(request);
        if (!wallet) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServerClient();
        const { week, year } = getCurrentWeek();

        const { data: weeklyGames, error: gamesError } = await supabase
            .from('game_sessions')
            .select('won')
            .eq('wallet_address', wallet)
            .eq('week_number', week)
            .eq('year', year);

        if (gamesError && gamesError.code !== 'PGRST116') {
            throw gamesError;
        }

        const gamesPlayed = weeklyGames?.length || 0;
        const wins = weeklyGames?.filter(g => g.won).length || 0;

        const { data: existingMilestones } = await supabase
            .from('milestones')
            .select('milestone_id, reward_claimed')
            .eq('wallet_address', wallet)
            .eq('week_number', week)
            .eq('year', year);

        const achievedMap = new Map(
            (existingMilestones || []).map(m => [m.milestone_id, m.reward_claimed])
        );

        const milestones = Object.values(MILESTONE_DEFINITIONS).map(def => {
            const progress = def.requirement.type === 'games_played' ? gamesPlayed : wins;
            const achieved = achievedMap.has(def.id);
            const claimed = achievedMap.get(def.id) || false;
            const completed = progress >= def.requirement.target;

            return {
                id: def.id,
                title: def.title,
                description: def.description,
                target: def.requirement.target,
                progress,
                reward: def.reward,
                icon: def.icon,
                achieved,
                claimed,
                completed: completed || achieved,
            };
        });

        return NextResponse.json({
            milestones,
            week,
            year,
            stats: { gamesPlayed, wins },
        });
    } catch (error) {
        console.error('Error fetching milestones:', error);
        return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const wallet = await getVerifiedWallet(request);
        if (!wallet) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { milestone_id } = body;

        if (!milestone_id || !MILESTONE_DEFINITIONS[milestone_id as keyof typeof MILESTONE_DEFINITIONS]) {
            return NextResponse.json({ error: 'Invalid milestone' }, { status: 400 });
        }

        const supabase = createServerClient();
        const { week, year } = getCurrentWeek();
        const definition = MILESTONE_DEFINITIONS[milestone_id as keyof typeof MILESTONE_DEFINITIONS];

        const { data: existing } = await supabase
            .from('milestones')
            .select('reward_claimed')
            .eq('wallet_address', wallet)
            .eq('week_number', week)
            .eq('year', year)
            .eq('milestone_id', milestone_id)
            .single();

        if (existing?.reward_claimed) {
            return NextResponse.json({ error: 'Already claimed' }, { status: 400 });
        }

        const { data: weeklyGames } = await supabase
            .from('game_sessions')
            .select('won')
            .eq('wallet_address', wallet)
            .eq('week_number', week)
            .eq('year', year);

        const gamesPlayed = weeklyGames?.length || 0;
        const wins = weeklyGames?.filter(g => g.won).length || 0;
        const progress = definition.requirement.type === 'games_played' ? gamesPlayed : wins;

        if (progress < definition.requirement.target) {
            return NextResponse.json({
                error: 'Milestone not yet achieved',
                current: progress,
                required: definition.requirement.target,
            }, { status: 400 });
        }

        await supabase.from('milestones').upsert({
            wallet_address: wallet,
            week_number: week,
            year: year,
            milestone_id: milestone_id,
            reward_claimed: true,
        }, { onConflict: 'wallet_address,week_number,year,milestone_id' });

        await supabase.rpc('increment_lifetime_xp', {
            p_wallet: wallet,
            p_amount: definition.reward,
        });

        return NextResponse.json({
            success: true,
            points: definition.reward,
            message: `${definition.title} claimed!`,
        });
    } catch (error) {
        console.error('Error claiming milestone:', error);
        return NextResponse.json({ error: 'Failed to claim milestone' }, { status: 500 });
    }
}
