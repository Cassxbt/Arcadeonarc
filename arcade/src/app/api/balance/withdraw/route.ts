import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getSessionWallet } from '@/lib/session';

export async function POST(request: NextRequest) {
    const clientIp = getClientIp(request);
    const { success: rateLimitOk } = await checkRateLimit(clientIp);
    if (!rateLimitOk) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        // SECURITY: Get wallet from verified session
        const wallet = await getSessionWallet(request);
        if (!wallet) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { amount } = await request.json();

        if (typeof amount !== 'number' || amount <= 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
        }

        const supabase = createServerClient();

        const { data, error } = await supabase.rpc('reserve_withdrawal', {
            p_wallet: wallet,
            p_amount: amount
        });

        if (error) {
            console.error('Withdrawal reservation failed:', error);
            return NextResponse.json({ error: 'Failed to process withdrawal' }, { status: 500 });
        }

        const result = data as { success: boolean; error?: string; available?: number; reserved?: number };

        if (!result.success) {
            return NextResponse.json({
                error: result.error,
                available: result.available
            }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            reserved: result.reserved
        });
    } catch (error) {
        console.error('Withdrawal validation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const clientIp = getClientIp(request);
    const { success: rateLimitOk } = await checkRateLimit(clientIp);
    if (!rateLimitOk) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        // SECURITY: Get wallet from verified session
        const wallet = await getSessionWallet(request);
        if (!wallet) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { amount, action } = await request.json();

        const supabase = createServerClient();

        if (action === 'confirm') {
            const { error } = await supabase.rpc('confirm_withdrawal', {
                p_wallet: wallet,
                p_amount: amount
            });
            if (error) throw error;
            return NextResponse.json({ success: true, confirmed: true });
        }

        const { error } = await supabase.rpc('cancel_withdrawal', {
            p_wallet: wallet,
            p_amount: amount
        });
        if (error) throw error;
        return NextResponse.json({ success: true, cancelled: true });
    } catch (error) {
        console.error('Withdrawal action error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
