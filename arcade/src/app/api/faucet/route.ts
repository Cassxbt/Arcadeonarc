import { NextRequest, NextResponse } from 'next/server';

const CIRCLE_API_URL = 'https://api.circle.com/v1/faucet/drips';

const SUPPORTED_TESTNETS = [
    'ARC-TESTNET',
    'ETH-SEPOLIA',
    'BASE-SEPOLIA',
    'ARB-SEPOLIA',
    'OP-SEPOLIA',
    'AVAX-FUJI',
    'MATIC-AMOY',
] as const;

type SupportedTestnet = typeof SUPPORTED_TESTNETS[number];

interface FaucetRequest {
    address: string;
    blockchain: SupportedTestnet;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as FaucetRequest;
        const { address, blockchain } = body;

        if (!address || !blockchain) {
            return NextResponse.json(
                { error: 'Missing required fields: address and blockchain' },
                { status: 400 }
            );
        }

        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
            return NextResponse.json(
                { error: 'Invalid wallet address format' },
                { status: 400 }
            );
        }

        if (!SUPPORTED_TESTNETS.includes(blockchain)) {
            return NextResponse.json(
                { error: `Unsupported blockchain. Supported: ${SUPPORTED_TESTNETS.join(', ')}` },
                { status: 400 }
            );
        }

        const apiKey = process.env.CIRCLE_API_KEY;
        if (!apiKey) {
            console.error('[faucet] CIRCLE_API_KEY not configured');
            return NextResponse.json(
                { error: 'Faucet not configured' },
                { status: 500 }
            );
        }

        const response = await fetch(CIRCLE_API_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                address,
                blockchain,
                usdc: true,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[faucet] Circle API error:', data);

            if (response.status === 429 || data?.message?.includes('rate')) {
                return NextResponse.json(
                    { error: 'Rate limit exceeded. Try again in 24 hours.' },
                    { status: 429 }
                );
            }

            return NextResponse.json(
                { error: data?.message || 'Faucet request failed' },
                { status: response.status }
            );
        }

        return NextResponse.json({
            success: true,
            message: '10 USDC sent to your wallet!',
            blockchain,
            address,
        });

    } catch (error) {
        console.error('[faucet] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
