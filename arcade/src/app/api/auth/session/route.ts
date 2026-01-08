import { NextRequest, NextResponse } from 'next/server';
import { getSessionWallet, clearSessionCookie } from '@/lib/session';

export async function GET(request: NextRequest) {
    try {
        const wallet = await getSessionWallet(request);

        if (!wallet) {
            return NextResponse.json({ authenticated: false });
        }

        return NextResponse.json({ authenticated: true, wallet });
    } catch (error) {
        console.error('Session check error:', error);
        return NextResponse.json({ authenticated: false });
    }
}

export async function DELETE() {
    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', clearSessionCookie());
    return response;
}
