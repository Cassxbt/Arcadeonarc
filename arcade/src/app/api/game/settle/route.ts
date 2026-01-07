import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet, CONTRACTS } from '@/lib/constants';
import { VAULT_ABI } from '@/lib/abi';

// Server signer private key - MUST be set in environment variables
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
if (!SIGNER_PRIVATE_KEY) {
    throw new Error('SIGNER_PRIVATE_KEY environment variable is required');
}
const signerAccount = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);

// Create clients
const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
});

const walletClient = createWalletClient({
    chain: arcTestnet,
    transport: http(),
    account: signerAccount,
});

/**
 * Game Settlement API
 * 
 * This endpoint is called after each game to settle bets on-chain.
 * The signer wallet must be authorized on the vault contract.
 * 
 * Flow:
 * 1. Frontend plays game (instant, no tx)
 * 2. Frontend calls this API with result
 * 3. Backend calls vault.placeBet() to deduct bet
 * 4. Backend calls vault.settleBet() to credit winnings or take house cut
 * 5. Frontend refreshes balance
 * 
 * This atomic operation ensures the bet is properly deducted and settled in one go.
 */
export async function POST(request: NextRequest) {
    try {
        const {
            userAddress,
            betAmount,
            payout,
            game,
            won
        } = await request.json();

        // Validate required fields
        if (!userAddress || betAmount === undefined || payout === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: userAddress, betAmount, payout' },
                { status: 400 }
            );
        }

        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
            return NextResponse.json(
                { error: 'Invalid wallet address format' },
                { status: 400 }
            );
        }

        // Validate amounts
        if (betAmount <= 0) {
            return NextResponse.json(
                { error: 'Bet amount must be positive' },
                { status: 400 }
            );
        }

        if (payout < 0) {
            return NextResponse.json(
                { error: 'Payout cannot be negative' },
                { status: 400 }
            );
        }

        // Convert to USDC decimals (6)
        const betAmountWei = parseUnits(betAmount.toString(), 6);
        const payoutWei = parseUnits(payout.toString(), 6);

        console.log(`[Settle] User: ${userAddress}, Bet: ${betAmount}, Payout: ${payout}, Game: ${game}, Won: ${won}`);

        // Check if signer is authorized on vault
        const isAuthorized = await publicClient.readContract({
            address: CONTRACTS.ARCADE_VAULT,
            abi: VAULT_ABI,
            functionName: 'authorizedGames',
            args: [signerAccount.address],
        });

        if (!isAuthorized) {
            console.error(`[Settle] Signer ${signerAccount.address} is NOT authorized on vault`);
            return NextResponse.json(
                {
                    error: 'Signer not authorized on vault',
                    signerAddress: signerAccount.address,
                    hint: 'Call vault.setGameAuthorization(signerAddress, true) from the vault owner'
                },
                { status: 403 }
            );
        }

        // Check user has sufficient balance before proceeding
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

        // Step 1: Call placeBet to deduct the bet amount from user
        console.log(`[Settle] Step 1: Placing bet of ${betAmount} USDC`);
        const placeBetHash = await walletClient.writeContract({
            address: CONTRACTS.ARCADE_VAULT,
            abi: VAULT_ABI,
            functionName: 'placeBet',
            args: [userAddress as `0x${string}`, betAmountWei],
        });

        // Wait for placeBet confirmation
        const placeBetReceipt = await publicClient.waitForTransactionReceipt({ hash: placeBetHash });

        if (placeBetReceipt.status !== 'success') {
            console.error(`[Settle] placeBet reverted: ${placeBetHash}`);
            return NextResponse.json(
                { error: 'Failed to place bet', txHash: placeBetHash },
                { status: 500 }
            );
        }

        console.log(`[Settle] placeBet confirmed: ${placeBetHash}`);

        // Step 2: Call settleBet to credit winnings or take house cut
        console.log(`[Settle] Step 2: Settling with payout ${payout} USDC`);
        const settleBetHash = await walletClient.writeContract({
            address: CONTRACTS.ARCADE_VAULT,
            abi: VAULT_ABI,
            functionName: 'settleBet',
            args: [userAddress as `0x${string}`, betAmountWei, payoutWei],
        });

        // Wait for settleBet confirmation
        const settleBetReceipt = await publicClient.waitForTransactionReceipt({ hash: settleBetHash });

        if (settleBetReceipt.status === 'success') {
            console.log(`[Settle] Settlement complete. Block: ${settleBetReceipt.blockNumber}`);
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
            console.error(`[Settle] settleBet reverted: ${settleBetHash}`);
            return NextResponse.json(
                { error: 'Settlement transaction reverted', txHash: settleBetHash },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('[Settle] Error:', error);

        // Handle specific error cases
        if (error.message?.includes('InsufficientBalance')) {
            return NextResponse.json(
                { error: 'User has insufficient balance in vault' },
                { status: 400 }
            );
        }

        if (error.message?.includes('UnauthorizedGame')) {
            return NextResponse.json(
                {
                    error: 'Signer not authorized to settle bets',
                    signerAddress: signerAccount.address,
                },
                { status: 403 }
            );
        }

        if (error.message?.includes('BetTooSmall')) {
            return NextResponse.json(
                { error: 'Bet amount below minimum (0.5 USDC)' },
                { status: 400 }
            );
        }

        if (error.message?.includes('BetTooLarge')) {
            return NextResponse.json(
                { error: 'Bet amount above maximum (100 USDC)' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: error.message || 'Settlement failed' },
            { status: 500 }
        );
    }
}
