'use client';

import { useCallback, useState } from 'react';
import { createPublicClient, createWalletClient, custom, http, parseUnits, formatUnits, type WalletClient } from 'viem';
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

    /**
     * Get wallet client from Dynamic SDK
     */
    const getWalletClient = useCallback(async (): Promise<WalletClient | null> => {
        if (!primaryWallet) return null;

        try {
            if (typeof primaryWallet.getWalletClient === 'function') {
                const client = await primaryWallet.getWalletClient();

                if (!client) {
                    console.error('getWalletClient returned null or undefined');
                    return null;
                }

                if (typeof client.writeContract !== 'function') {
                    console.error('Wallet client missing writeContract method');
                    return null;
                }

                return client as WalletClient;
            }

            const connector = primaryWallet.connector;
            if (!connector) {
                console.error('No connector available on primaryWallet');
                return null;
            }

            if (typeof connector.getProvider === 'function') {
                const provider = await connector.getProvider();

                if (!provider) {
                    console.error('getProvider returned null');
                    return null;
                }

                if (typeof provider.request !== 'function') {
                    console.error('Provider missing request method (not EIP-1193 compliant)');
                    return null;
                }

                const chainId = await provider.request({ method: 'eth_chainId' });
                const currentChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;

                if (currentChainId !== arcTestnet.id) {
                    console.warn(`Wallet on wrong chain: ${currentChainId}, expected: ${arcTestnet.id}`);
                }

                return createWalletClient({
                    account: primaryWallet.address as `0x${string}`,
                    chain: arcTestnet,
                    transport: custom(provider)
                });
            }

            console.error('No method available to get wallet client');
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

            const hash = await walletClient.writeContract({
                address: CONTRACTS.USDC,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [CONTRACTS.ARCADE_VAULT, amountWei],
                chain: arcTestnet,
                account: primaryWallet.address as `0x${string}`,
            });

            // Wait for confirmation
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
            // Check allowance first
            const allowance = await getAllowance(primaryWallet.address as `0x${string}`);
            if (allowance < amount) {
                // Approve max
                const approved = await approveUsdc(10000);
                if (!approved) return false;
            }

            const walletClient = await getWalletClient();
            if (!walletClient) {
                setError('Could not get wallet client');
                return false;
            }

            const amountWei = parseUnits(amount.toString(), 6);

            await withRetry(async () => {
                const hash = await walletClient.writeContract({
                    address: CONTRACTS.ARCADE_VAULT,
                    abi: VAULT_ABI,
                    functionName: 'deposit',
                    args: [amountWei],
                    chain: arcTestnet,
                    account: primaryWallet.address as `0x${string}`,
                });
                await publicClient.waitForTransactionReceipt({ hash });
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

            await withRetry(async () => {
                const hash = await walletClient.writeContract({
                    address: CONTRACTS.ARCADE_VAULT,
                    abi: VAULT_ABI,
                    functionName: 'withdraw',
                    args: [amountWei],
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
