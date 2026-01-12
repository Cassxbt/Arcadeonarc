'use client';

import { useCallback, useState } from 'react';
import { createPublicClient, http, parseUnits, formatUnits, encodeFunctionData, type WalletClient } from 'viem';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { arcTestnet, CONTRACTS } from './constants';
import { VAULT_ABI, ERC20_ABI } from './abi';

const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
});

async function withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
    baseDelay = 1000
): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (err) {
            lastError = err as Error;
            if (lastError.message?.includes('rejected') || lastError.message?.includes('denied')) {
                throw lastError;
            }
            if (attempt < maxAttempts) {
                await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt - 1)));
            }
        }
    }
    throw lastError;
}

/**
 * Hook for interacting with the ARCadeVault contract
 */
export function useVault() {
    const { primaryWallet } = useDynamicContext();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getWalletClient = useCallback(async (): Promise<WalletClient | null> => {
        if (!primaryWallet) return null;
        try {
            if ('getWalletClient' in primaryWallet) {
                return await (primaryWallet as unknown as { getWalletClient: () => Promise<WalletClient> }).getWalletClient();
            }
            return null;
        } catch (err) {
            console.error('Failed to get wallet client:', err);
            return null;
        }
    }, [primaryWallet]);

    /**
     * Get user's vault balance
     */
    const getVaultBalance = useCallback(async (address: `0x${string}`): Promise<number> => {
        try {
            const balance = await publicClient.readContract({
                address: CONTRACTS.ARCADE_VAULT,
                abi: VAULT_ABI,
                functionName: 'balances',
                args: [address],
            });
            return Number(formatUnits(balance as bigint, 6));
        } catch (err) {
            console.error('Failed to get vault balance:', err);
            return 0;
        }
    }, []);

    /**
     * Get user's wallet USDC balance
     */
    const getWalletBalance = useCallback(async (address: `0x${string}`): Promise<number> => {
        try {
            const balance = await publicClient.readContract({
                address: CONTRACTS.USDC,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [address],
            });
            return Number(formatUnits(balance as bigint, 6));
        } catch (err) {
            console.error('Failed to get wallet balance:', err);
            return 0;
        }
    }, []);

    /**
     * Check USDC allowance for vault
     */
    const getAllowance = useCallback(async (address: `0x${string}`): Promise<number> => {
        try {
            const allowance = await publicClient.readContract({
                address: CONTRACTS.USDC,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [address, CONTRACTS.ARCADE_VAULT],
            });
            return Number(formatUnits(allowance as bigint, 6));
        } catch (err) {
            console.error('Failed to get allowance:', err);
            return 0;
        }
    }, []);

    /**
     * Approve USDC spending for vault
     */
    const approveUsdc = useCallback(async (amount: number): Promise<boolean> => {
        if (!primaryWallet?.address) {
            setError('Wallet not connected');
            return false;
        }

        setIsLoading(true);
        setError(null);

        try {
            const walletClient = await getWalletClient();
            if (!walletClient) {
                setError('Could not get wallet client');
                return false;
            }

            const amountWei = parseUnits(amount.toString(), 6);

            const data = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [CONTRACTS.ARCADE_VAULT, amountWei],
            });

            const hash = await walletClient.sendTransaction({
                to: CONTRACTS.USDC,
                data,
                chain: arcTestnet,
                account: primaryWallet.address as `0x${string}`,
            });

            await publicClient.waitForTransactionReceipt({ hash });
            return true;
        } catch (err) {
            console.error('Approve failed:', err);
            setError(err instanceof Error ? err.message : 'Approval failed');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [primaryWallet, getWalletClient]);

    /**
     * Deposit USDC into vault
     */
    const deposit = useCallback(async (amount: number): Promise<boolean> => {
        if (!primaryWallet?.address) {
            setError('Wallet not connected');
            return false;
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log('[deposit] Starting deposit for:', primaryWallet.address, 'amount:', amount);

            const allowance = await getAllowance(primaryWallet.address as `0x${string}`);
            console.log('[deposit] Current allowance:', allowance);

            if (allowance < amount) {
                console.log('[deposit] Allowance insufficient, approving...');
                const approved = await approveUsdc(10000);
                if (!approved) {
                    console.log('[deposit] Approval failed');
                    return false;
                }
                console.log('[deposit] Approval succeeded');
            }

            console.log('[deposit] Getting wallet client...');
            const walletClient = await getWalletClient();
            if (!walletClient) {
                console.error('[deposit] Failed to get wallet client');
                setError('Could not get wallet client');
                return false;
            }
            console.log('[deposit] Wallet client acquired');

            const actualBalance = await getWalletBalance(primaryWallet.address as `0x${string}`);
            console.log('[deposit] Actual on-chain balance:', actualBalance, 'Trying to deposit:', amount);
            if (actualBalance < amount) {
                const errorMsg = `Insufficient balance: have ${actualBalance.toFixed(2)} USDC, need ${amount} USDC`;
                console.error('[deposit]', errorMsg);
                setError(errorMsg);
                return false;
            }

            const amountWei = parseUnits(amount.toString(), 6);

            const data = encodeFunctionData({
                abi: VAULT_ABI,
                functionName: 'deposit',
                args: [amountWei],
            });

            await withRetry(async () => {
                console.log('[deposit] Sending deposit transaction...');
                const hash = await walletClient.sendTransaction({
                    to: CONTRACTS.ARCADE_VAULT,
                    data,
                    chain: arcTestnet,
                    account: primaryWallet.address as `0x${string}`,
                });
                console.log('[deposit] Transaction sent:', hash);
                await publicClient.waitForTransactionReceipt({ hash });
                console.log('[deposit] Transaction confirmed');
            });
            return true;
        } catch (err) {
            console.error('Deposit failed:', err);
            setError(err instanceof Error ? err.message : 'Deposit failed');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [primaryWallet, getAllowance, approveUsdc, getWalletClient]);

    /**
     * Withdraw USDC from vault
     */
    const withdraw = useCallback(async (amount: number): Promise<boolean> => {
        if (!primaryWallet?.address) {
            setError('Wallet not connected');
            return false;
        }

        setIsLoading(true);
        setError(null);

        try {
            const walletClient = await getWalletClient();
            if (!walletClient) {
                setError('Could not get wallet client');
                return false;
            }

            const amountWei = parseUnits(amount.toString(), 6);

            const data = encodeFunctionData({
                abi: VAULT_ABI,
                functionName: 'withdraw',
                args: [amountWei],
            });

            await withRetry(async () => {
                const hash = await walletClient.sendTransaction({
                    to: CONTRACTS.ARCADE_VAULT,
                    data,
                    chain: arcTestnet,
                    account: primaryWallet.address as `0x${string}`,
                });
                await publicClient.waitForTransactionReceipt({ hash });
            });
            return true;
        } catch (err) {
            console.error('Withdraw failed:', err);
            setError(err instanceof Error ? err.message : 'Withdrawal failed');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [primaryWallet, getWalletClient]);

    return {
        getVaultBalance,
        getWalletBalance,
        getAllowance,
        approveUsdc,
        deposit,
        withdraw,
        isLoading,
        error,
    };
}
