'use client';

import { useState, useCallback } from 'react';
import { createPublicClient, http, formatUnits, parseUnits, type WalletClient } from 'viem';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isEthereumWallet } from '@dynamic-labs/ethereum';
import {
    GATEWAY_CHAINS,
    ARC_GATEWAY_CONFIG,
    getGatewayChainById,
    type GatewayChainConfig,
} from './gateway-config';
import { ERC20_ABI } from './abi';
import { arcTestnet } from './constants';

const GATEWAY_WALLET_ABI = [
    {
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [],
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
] as const;

export type GatewayStep = 'idle' | 'approving' | 'depositing' | 'complete' | 'error';

export interface GatewayStepInfo {
    name: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    txHash?: string;
    explorerUrl?: string;
}

export interface UseGatewayReturn {
    deposit: (sourceChainId: string, amount: string) => Promise<boolean>;
    getSourceBalance: (chainId: string) => Promise<number>;
    getGatewayBalance: (chainId: string) => Promise<number>;
    isLoading: boolean;
    error: string | null;
    currentStep: GatewayStep;
    completedSteps: GatewayStepInfo[];
    gatewayChains: GatewayChainConfig[];
}

export function useGateway(): UseGatewayReturn {
    const { primaryWallet } = useDynamicContext();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState<GatewayStep>('idle');
    const [completedSteps, setCompletedSteps] = useState<GatewayStepInfo[]>([]);

    const getSourceBalance = useCallback(async (chainId: string): Promise<number> => {
        if (!primaryWallet?.address) return 0;

        const chainConfig = getGatewayChainById(chainId);
        if (!chainConfig) return 0;

        try {
            const client = createPublicClient({
                chain: chainConfig.chain,
                transport: http(),
            });

            const balance = await client.readContract({
                address: chainConfig.usdc,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [primaryWallet.address as `0x${string}`],
            });

            return Number(formatUnits(balance as bigint, 6));
        } catch (err) {
            console.error('[gateway] Failed to fetch source balance:', err);
            return 0;
        }
    }, [primaryWallet?.address]);

    const getGatewayBalance = useCallback(async (chainId: string): Promise<number> => {
        if (!primaryWallet?.address) return 0;

        const chainConfig = getGatewayChainById(chainId);
        if (!chainConfig) return 0;

        try {
            const client = createPublicClient({
                chain: chainConfig.chain,
                transport: http(),
            });

            const balance = await client.readContract({
                address: chainConfig.gatewayWallet,
                abi: GATEWAY_WALLET_ABI,
                functionName: 'balanceOf',
                args: [primaryWallet.address as `0x${string}`],
            });

            return Number(formatUnits(balance as bigint, 6));
        } catch (err) {
            console.error('[gateway] Failed to fetch gateway balance:', err);
            return 0;
        }
    }, [primaryWallet?.address]);

    const getWalletClient = useCallback(async (): Promise<WalletClient | null> => {
        if (!primaryWallet) return null;
        try {
            if (!isEthereumWallet(primaryWallet)) return null;
            return await primaryWallet.getWalletClient();
        } catch (err) {
            console.error('[gateway] Failed to get wallet client:', err);
            return null;
        }
    }, [primaryWallet]);

    const switchToChain = useCallback(async (chainId: number): Promise<boolean> => {
        if (!primaryWallet) return false;
        try {
            if ('switchNetwork' in primaryWallet) {
                await (primaryWallet as unknown as { switchNetwork: (chainId: number) => Promise<void> }).switchNetwork(chainId);
                return true;
            }
            return false;
        } catch (err) {
            console.error('[gateway] Failed to switch network:', err);
            return false;
        }
    }, [primaryWallet]);

    const deposit = useCallback(async (sourceChainId: string, amount: string): Promise<boolean> => {
        if (!primaryWallet?.address) {
            setError('Wallet not connected');
            return false;
        }

        const chainConfig = getGatewayChainById(sourceChainId);
        if (!chainConfig) {
            setError('Invalid source chain');
            return false;
        }

        setCompletedSteps([]);
        setIsLoading(true);
        setError(null);
        setCurrentStep('approving');

        try {
            const switched = await switchToChain(chainConfig.chainId);
            if (!switched) {
                throw new Error(`Could not switch to ${chainConfig.name}`);
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            const walletClient = await getWalletClient();
            if (!walletClient) {
                throw new Error('Could not get wallet client');
            }

            const userAddress = primaryWallet.address as `0x${string}`;
            const amountBigInt = parseUnits(amount, 6);

            setCompletedSteps([
                { name: 'Approve USDC', status: 'active' },
                { name: 'Deposit to Gateway', status: 'pending' },
            ]);

            const approvalHash = await walletClient.writeContract({
                address: chainConfig.usdc,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [chainConfig.gatewayWallet, amountBigInt],
                account: userAddress,
                chain: walletClient.chain,
            });

            const publicClient = createPublicClient({
                chain: walletClient.chain!,
                transport: http(),
            });

            await publicClient.waitForTransactionReceipt({ hash: approvalHash });

            setCompletedSteps([
                { name: 'Approve USDC', status: 'complete', txHash: approvalHash, explorerUrl: `${chainConfig.explorer}/tx/${approvalHash}` },
                { name: 'Deposit to Gateway', status: 'active' },
            ]);

            setCurrentStep('depositing');

            const depositHash = await walletClient.writeContract({
                address: chainConfig.gatewayWallet,
                abi: GATEWAY_WALLET_ABI,
                functionName: 'deposit',
                args: [amountBigInt],
                account: userAddress,
                chain: walletClient.chain,
            });

            await publicClient.waitForTransactionReceipt({ hash: depositHash });

            setCompletedSteps([
                { name: 'Approve USDC', status: 'complete', txHash: approvalHash, explorerUrl: `${chainConfig.explorer}/tx/${approvalHash}` },
                { name: 'Deposit to Gateway', status: 'complete', txHash: depositHash, explorerUrl: `${chainConfig.explorer}/tx/${depositHash}` },
            ]);

            setCurrentStep('complete');
            await switchToChain(arcTestnet.id);
            return true;

        } catch (err) {
            console.error('[gateway] Deposit error:', err);
            const message = err instanceof Error ? err.message : 'Deposit failed';

            if (message.includes('rejected') || message.includes('denied')) {
                setError('Transaction rejected by user');
            } else if (message.includes('insufficient')) {
                setError('Insufficient balance');
            } else {
                setError(message);
            }

            setCurrentStep('error');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [primaryWallet, getWalletClient, switchToChain]);

    return {
        deposit,
        getSourceBalance,
        getGatewayBalance,
        isLoading,
        error,
        currentStep,
        completedSteps,
        gatewayChains: GATEWAY_CHAINS,
    };
}
