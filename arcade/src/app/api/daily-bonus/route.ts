import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getSessionWallet } from '@/lib/session';

const DAILY_BONUS_POINTS = 25;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet')?.toLowerCase();

    if (!wallet) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    try {
        const supabase = createServerClient();
        const today = new Date().toISOString().split('T')[0];

        const { data: user, error } = await supabase
            .from('users')
            .select('last_login_bonus_date, daily_points_balance')
            .eq('wallet_address', wallet)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (!user) {
            return NextResponse.json({
                claimedToday: false,
                todayPoints: 0,
                lastClaimDate: null,
                bonusAmount: DAILY_BONUS_POINTS,
            });
        }

        const claimedToday = user.last_login_bonus_date === today;

        return NextResponse.json({
            claimedToday,
            todayPoints: claimedToday ? DAILY_BONUS_POINTS : 0,
            lastClaimDate: user.last_login_bonus_date,
            bonusAmount: DAILY_BONUS_POINTS,
            totalDailyPoints: user.daily_points_balance || 0,
        });
    } catch (error) {
        console.error('Error checking daily bonus:', error);
        return NextResponse.json({ error: 'Failed to check daily bonus' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Get wallet from verified session
        const wallet = await getSessionWallet(request);
        if (!wallet) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServerClient();
        const today = new Date().toISOString().split('T')[0];

        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('last_login_bonus_date, daily_points_balance, lifetime_xp')
            .eq('wallet_address', wallet)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError;
        }

        if (!user) {
            return NextResponse.json({
                claimed: false,
                message: 'User not found. Please register first.',
            });
        }

        if (user.last_login_bonus_date === today) {
            return NextResponse.json({
                claimed: false,
                message: 'Daily bonus already claimed today',
                nextBonusIn: getTimeUntilMidnight(),
            });
        }

        const newDailyPoints = (user.daily_points_balance || 0) + DAILY_BONUS_POINTS;
        const newLifetimeXp = (user.lifetime_xp || 0) + DAILY_BONUS_POINTS;

        const { error: updateError } = await supabase
            .from('users')
            .update({
                last_login_bonus_date: today,
                daily_points_balance: newDailyPoints,
                lifetime_xp: newLifetimeXp,
            })
            .eq('wallet_address', wallet);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({
            claimed: true,
            points: DAILY_BONUS_POINTS,
            totalDailyPoints: newDailyPoints,
            message: 'Daily bonus claimed successfully!',
        });
    } catch (error) {
        console.error('Error claiming daily bonus:', error);
        return NextResponse.json({ error: 'Failed to claim daily bonus' }, { status: 500 });
    }
}

function getTimeUntilMidnight(): string {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
}
