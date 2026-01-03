import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

// POST /api/games - Record a game session
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { wallet, game, bet_amount, payout, multiplier, won, tx_hash } = body;

        if (!wallet || !game || bet_amount === undefined || payout === undefined || won === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const walletLower = wallet.toLowerCase();

        // Validate game type
        if (!['dice', 'tower', 'crash'].includes(game)) {
            return NextResponse.json({ error: 'Invalid game type' }, { status: 400 });
        }

        const supabase = createServerClient();

        // Check if user exists
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('wallet_address', walletLower)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not registered' }, { status: 400 });
        }

        // Get current week and year
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        const year = now.getFullYear();

        // Update streak
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
        let newStreak = user.current_streak;

        if (user.last_played_date !== today) {
            // Check if played yesterday
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (user.last_played_date === yesterdayStr) {
                // Consecutive day - increment streak
                newStreak = user.current_streak + 1;
            } else if (!user.last_played_date) {
                // First time playing
                newStreak = 1;
            } else {
                // Streak broken - reset to 1
                newStreak = 1;
            }

            // Update user's streak and last played date
            await supabase
                .from('users')
                .update({
                    current_streak: newStreak,
                    last_played_date: today,
                })
                .eq('wallet_address', walletLower);
        }

        // Record the game session
        const { data: session, error: sessionError } = await supabase
            .from('game_sessions')
            .insert({
                wallet_address: walletLower,
                game,
                bet_amount,
                payout,
                multiplier: multiplier || 0,
                won,
                tx_hash: tx_hash || null,
                week_number: weekNumber,
                year,
            })
            .select()
            .single();

        if (sessionError) {
            throw sessionError;
        }

        return NextResponse.json({
            success: true,
            session,
            streak: newStreak,
        });
    } catch (error) {
        console.error('Error recording game:', error);
        return NextResponse.json({ error: 'Failed to record game' }, { status: 500 });
    }
}

// GET /api/games?wallet=0x...&limit=10 - Get recent games for a user
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet')?.toLowerCase();
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!wallet) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    try {
        const supabase = createServerClient();

        const { data: games, error } = await supabase
            .from('game_sessions')
            .select('*')
            .eq('wallet_address', wallet)
            .order('played_at', { ascending: false })
            .limit(Math.min(limit, 50));

        if (error) {
            throw error;
        }

        return NextResponse.json({ games });
    } catch (error) {
        console.error('Error fetching games:', error);
        return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
    }
}
