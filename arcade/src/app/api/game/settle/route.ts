import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet, CONTRACTS } from '@/lib/constants';
import { VAULT_ABI } from '@/lib/abi';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSessionWallet } from '@/lib/session';

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;

if (!SIGNER_PRIVATE_KEY) {
    throw new Error('SIGNER_PRIVATE_KEY environment variable is required');
}

const signerAccount = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
});

const walletClient = createWalletClient({
    chain: arcTestnet,
    transport: http(),
    account: signerAccount,
});

function getClientIp(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
}


export async function POST(request: NextRequest) {
    const clientIp = getClientIp(request);

    const { success: rateLimitOk } = await checkRateLimit(clientIp);
    if (!rateLimitOk) {
        logger.warn('Rate limit exceeded', { ip: clientIp });
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const authenticatedWallet = await getSessionWallet(request);
    if (!authenticatedWallet) {
        logger.warn('Unauthorized settlement attempt', { ip: clientIp });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { userAddress, betAmount, payout, game, won } = body;

        if (!userAddress || betAmount === undefined || payout === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
            return NextResponse.json(
                { error: 'Invalid address format' },
                { status: 400 }
            );
        }

        if (userAddress.toLowerCase() !== authenticatedWallet.toLowerCase()) {
            logger.warn('Settlement authorization mismatch', {
                authenticated: authenticatedWallet,
                target: userAddress,
                ip: clientIp
            });
            return NextResponse.json(
                { error: 'Forbidden' },
                { status: 403 }
            );
        }

        if (betAmount <= 0 || payout < 0) {
            return NextResponse.json(
                { error: 'Invalid bet or payout amount' },
                { status: 400 }
            );
        }

        const betAmountWei = parseUnits(betAmount.toString(), 6);
        const payoutWei = parseUnits(payout.toString(), 6);

        logger.info('Processing settlement', { userAddress, betAmount, payout, game, won });

        const isAuthorized = await publicClient.readContract({
            address: CONTRACTS.ARCADE_VAULT,
            abi: VAULT_ABI,
            functionName: 'authorizedGames',
            args: [signerAccount.address],
        });

        if (!isAuthorized) {
            logger.error('Signer not authorized', { signer: signerAccount.address });
            return NextResponse.json(
                { error: 'Signer not authorized on vault' },
                { status: 403 }
            );
        }

        const userBalance = await publicClient.readContract({
            address: CONTRACTS.ARCADE_VAULT,
            abi: VAULT_ABI,
            functionName: 'balances',
            args: [userAddress as `0x${string}`],
        });

        if (userBalance < betAmountWei) {
            return NextResponse.json(
                { error: 'Insufficient vault balance' },
                { status: 400 }
            );
        }

        const placeBetHash = await walletClient.writeContract({
            address: CONTRACTS.ARCADE_VAULT,
            abi: VAULT_ABI,
            functionName: 'placeBet',
            args: [userAddress as `0x${string}`, betAmountWei],
        });

        const placeBetReceipt = await publicClient.waitForTransactionReceipt({ hash: placeBetHash });

        if (placeBetReceipt.status !== 'success') {
            logger.error('placeBet reverted', { txHash: placeBetHash });
            return NextResponse.json(
                { error: 'Failed to place bet', txHash: placeBetHash },
                { status: 500 }
            );
        }

        logger.debug('placeBet confirmed', { txHash: placeBetHash });

        const settleBetHash = await walletClient.writeContract({
            address: CONTRACTS.ARCADE_VAULT,
            abi: VAULT_ABI,
            functionName: 'settleBet',
            args: [userAddress as `0x${string}`, betAmountWei, payoutWei],
        });

        const settleBetReceipt = await publicClient.waitForTransactionReceipt({ hash: settleBetHash });

        if (settleBetReceipt.status === 'success') {
            logger.info('Settlement complete', {
                block: Number(settleBetReceipt.blockNumber),
                userAddress,
                betAmount,
                payout
            });
            return NextResponse.json({
                success: true,
                placeBetTxHash: placeBetHash,
                settleBetTxHash: settleBetHash,
                blockNumber: Number(settleBetReceipt.blockNumber),
                userAddress,
                betAmount,
                payout,
                won,
            });
        } else {
            logger.error('settleBet reverted', { txHash: settleBetHash });
            return NextResponse.json(
                { error: 'Settlement reverted', txHash: settleBetHash },
                { status: 500 }
            );
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Settlement failed', { error: message });

        if (message.includes('InsufficientBalance')) {
            return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
        }
        if (message.includes('UnauthorizedGame')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        if (message.includes('BetTooSmall')) {
            return NextResponse.json({ error: 'Bet below minimum' }, { status: 400 });
        }
        if (message.includes('BetTooLarge')) {
            return NextResponse.json({ error: 'Bet above maximum' }, { status: 400 });
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
