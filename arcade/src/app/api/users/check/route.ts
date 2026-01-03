import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

// GET /api/users/check?username=...
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');

    if (!username) {
        return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    // Validate format
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
        return NextResponse.json({
            available: false,
            error: 'Invalid username format'
        });
    }

    try {
        const supabase = createServerClient();
        const usernameLower = username.toLowerCase();

        const { data: existing } = await supabase
            .from('users')
            .select('wallet_address')
            .eq('username_lower', usernameLower)
            .single();

        return NextResponse.json({
            available: !existing,
            username: username
        });
    } catch (error) {
        console.error('Error checking username:', error);
        return NextResponse.json({ error: 'Failed to check username' }, { status: 500 });
    }
}
