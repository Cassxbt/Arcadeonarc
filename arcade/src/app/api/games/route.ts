import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { calculateServerPayout } from '@/lib/game-logic';
import { getSessionWallet } from '@/lib/session';
import { updateQuestProgress } from '@/lib/quest-progress';

export async function POST(request: NextRequest) {
    const clientIp = getClientIp(request);
    const { success: rateLimitOk } = await checkRateLimit(clientIp);
    if (!rateLimitOk) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        // SECURITY: Get wallet from verified session, not from request body
        const wallet = await getSessionWallet(request);
        if (!wallet) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { game, bet_amount, game_params } = body;

        if (!game || bet_amount === undefined || !game_params) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!['dice', 'tower', 'crash', 'wheel', 'laser'].includes(game)) {
            return NextResponse.json({ error: 'Invalid game type' }, { status: 400 });
        }

        if (bet_amount < 0.5 || bet_amount > 100) {
            return NextResponse.json({ error: 'Invalid bet amount' }, { status: 400 });
        }

        // SECURITY FIX: Calculate payout server-side instead of trusting client
        let serverCalculated: { payout: number; multiplier: number; won: boolean };
        try {
            serverCalculated = calculateServerPayout(game, bet_amount, game_params);
        } catch (err) {
            console.error('Payout calculation failed:', err);
            return NextResponse.json({ error: 'Invalid game parameters' }, { status: 400 });
        }

        const { payout, multiplier, won } = serverCalculated;

        const supabase = createServerClient();

        const { data, error } = await supabase.rpc('place_bet_atomic', {
            p_wallet: wallet,
            p_bet_amount: bet_amount,
            p_payout: payout,
            p_game: game,
            p_multiplier: multiplier
        });

        if (error) {
            console.error('Atomic bet failed:', error);
            return NextResponse.json({ error: 'Database operation failed' }, { status: 500 });
        }

        const result = data as { success: boolean; error?: string; new_balance?: number; streak?: number; won?: boolean; available?: number; required?: number };

        if (!result.success) {
            const status = result.error === 'Insufficient balance' ? 400 : 500;
            return NextResponse.json({
                error: result.error,
                available: result.available,
                required: result.required
            }, { status });
        }

        // Update quest progress (non-blocking)
        updateQuestProgress(wallet, { game, won, bet_amount }).catch(err => {
            console.error('Quest progress update failed:', err);
        });

        return NextResponse.json({
            success: true,
            newBalance: result.new_balance,
            streak: result.streak,
            won: won,
            payout: payout,
            multiplier: multiplier
        });
    } catch (error) {
        console.error('Error recording game:', error);
        return NextResponse.json({ error: 'Failed to record game' }, { status: 500 });
    }
}


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

        if (error) throw error;

        return NextResponse.json({ games });
    } catch (error) {
        console.error('Error fetching games:', error);
        return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
    }
}
