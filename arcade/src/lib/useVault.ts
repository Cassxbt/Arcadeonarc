'use client';

import { useCallback, useState } from 'react';
import { createPublicClient, http, parseUnits, formatUnits, type WalletClient } from 'viem';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { arcTestnet, CONTRACTS } from './constants';
import { VAULT_ABI, ERC20_ABI } from './abi';

// Create public client for read operations
const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
});

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
            // Dynamic SDK exposes getWalletClient on the connector
            const connector = primaryWallet.connector;
            if (connector && 'getWalletClient' in connector) {
                return await (connector as any).getWalletClient();
            }

            // Fallback: try to get signer and construct client
            if ('getSigner' in primaryWallet) {
                const signer = await (primaryWallet as any).getSigner();
                // Return the signer which should be compatible with viem
                return signer;
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
        } catch (err: any) {
            console.error('Approve failed:', err);
            setError(err.message || 'Approval failed');
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

            const hash = await walletClient.writeContract({
                address: CONTRACTS.ARCADE_VAULT,
                abi: VAULT_ABI,
                functionName: 'deposit',
                args: [amountWei],
                chain: arcTestnet,
                account: primaryWallet.address as `0x${string}`,
            });

            await publicClient.waitForTransactionReceipt({ hash });
            return true;
        } catch (err: any) {
            console.error('Deposit failed:', err);
            setError(err.message || 'Deposit failed');
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

            const hash = await walletClient.writeContract({
                address: CONTRACTS.ARCADE_VAULT,
                abi: VAULT_ABI,
                functionName: 'withdraw',
                args: [amountWei],
                chain: arcTestnet,
                account: primaryWallet.address as `0x${string}`,
            });

            await publicClient.waitForTransactionReceipt({ hash });
            return true;
        } catch (err: any) {
            console.error('Withdraw failed:', err);
            setError(err.message || 'Withdrawal failed');
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
