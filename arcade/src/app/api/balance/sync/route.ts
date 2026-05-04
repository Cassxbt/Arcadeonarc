import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet, CONTRACTS } from '@/lib/constants';
import { VAULT_ABI } from '@/lib/abi';
import { createServerClient } from '@/lib/supabase-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getSessionWallet } from '@/lib/session';

const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
});

/**
 * POST /api/balance/sync
 * Sync vault balance to server balance after a deposit.
 * Called after on-chain deposit transaction is confirmed.
 */
export async function POST(request: NextRequest) {
    const clientIp = getClientIp(request);
    const { success: rateLimitOk } = await checkRateLimit(clientIp);
    if (!rateLimitOk) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const wallet = await getSessionWallet(request);
        if (!wallet) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const vaultBalance = await publicClient.readContract({
            address: CONTRACTS.ARCADE_VAULT,
            abi: VAULT_ABI,
            functionName: 'balances',
            args: [wallet as `0x${string}`],
        });

        const balanceNumber = Number(formatUnits(vaultBalance as bigint, 6));

        const supabase = createServerClient();

        // Update server balance to match vault
        const { error } = await supabase
            .from('users')
            .update({ server_balance: balanceNumber })
            .eq('wallet_address', wallet);

        if (error) {
            console.error('Failed to sync balance:', error);
            return NextResponse.json({ error: 'Failed to sync balance' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            balance: balanceNumber,
        });
    } catch (error) {
        console.error('Balance sync error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
