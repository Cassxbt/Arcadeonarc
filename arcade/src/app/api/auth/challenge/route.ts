import { NextRequest, NextResponse } from 'next/server';
import { generateChallenge, createSignMessage } from '@/lib/session';
import { storeAuthChallenge } from '@/lib/auth-challenges';

export async function POST(request: NextRequest) {
    try {
        const { wallet } = await request.json();

        if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
        }

        const walletLower = wallet.toLowerCase();
        const challenge = generateChallenge();
        const message = createSignMessage(challenge);

        await storeAuthChallenge(walletLower, challenge);

        return NextResponse.json({ challenge, message });
    } catch (error) {
        console.error('Challenge generation error:', error);
        return NextResponse.json({ error: 'Failed to generate challenge' }, { status: 500 });
    }
}
