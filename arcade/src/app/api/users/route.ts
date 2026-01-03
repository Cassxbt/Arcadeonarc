import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

// GET /api/users?wallet=0x...
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet')?.toLowerCase();

    if (!wallet) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    try {
        const supabase = createServerClient();

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('wallet_address', wallet)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            throw error;
        }

        if (!user) {
            return NextResponse.json({ user: null, registered: false });
        }

        return NextResponse.json({ user, registered: true });
    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }
}

// POST /api/users - Register new user
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { wallet, username } = body;

        if (!wallet || !username) {
            return NextResponse.json({ error: 'Wallet and username required' }, { status: 400 });
        }

        const walletLower = wallet.toLowerCase();
        const usernameLower = username.toLowerCase();

        // Validate username format
        if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
            return NextResponse.json({
                error: 'Username must be 3-16 characters, alphanumeric and underscores only'
            }, { status: 400 });
        }

        const supabase = createServerClient();

        // Check if wallet already registered
        const { data: existingWallet } = await supabase
            .from('users')
            .select('wallet_address')
            .eq('wallet_address', walletLower)
            .single();

        if (existingWallet) {
            return NextResponse.json({ error: 'Wallet already registered' }, { status: 400 });
        }

        // Check if username is taken (case-insensitive)
        const { data: existingUsername } = await supabase
            .from('users')
            .select('wallet_address')
            .eq('username_lower', usernameLower)
            .single();

        if (existingUsername) {
            return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
        }

        // Create user
        const { data: newUser, error } = await supabase
            .from('users')
            .insert({
                wallet_address: walletLower,
                username_display: username,
                username_lower: usernameLower,
                username_changes_remaining: 1,
                lifetime_xp: 0,
                current_streak: 0,
                last_played_date: null,
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json({ user: newUser, success: true });
    } catch (error) {
        console.error('Error registering user:', error);
        return NextResponse.json({ error: 'Failed to register user' }, { status: 500 });
    }
}

// PATCH /api/users - Update username
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { wallet, username } = body;

        if (!wallet || !username) {
            return NextResponse.json({ error: 'Wallet and username required' }, { status: 400 });
        }

        const walletLower = wallet.toLowerCase();
        const usernameLower = username.toLowerCase();

        // Validate username format
        if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
            return NextResponse.json({
                error: 'Username must be 3-16 characters, alphanumeric and underscores only'
            }, { status: 400 });
        }

        const supabase = createServerClient();

        // Get current user
        const { data: currentUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('wallet_address', walletLower)
            .single();

        if (fetchError || !currentUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (currentUser.username_changes_remaining <= 0) {
            return NextResponse.json({ error: 'No username changes remaining' }, { status: 400 });
        }

        // Check if new username is taken
        const { data: existingUsername } = await supabase
            .from('users')
            .select('wallet_address')
            .eq('username_lower', usernameLower)
            .neq('wallet_address', walletLower)
            .single();

        if (existingUsername) {
            return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
        }

        // Update username
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({
                username_display: username,
                username_lower: usernameLower,
                username_changes_remaining: currentUser.username_changes_remaining - 1,
            })
            .eq('wallet_address', walletLower)
            .select()
            .single();

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ user: updatedUser, success: true });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}
