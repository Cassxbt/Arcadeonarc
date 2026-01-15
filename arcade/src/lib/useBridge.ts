'use client';

import { useState, useCallback } from 'react';
import { BridgeKit } from '@circle-fin/bridge-kit';
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { createPublicClient, http, formatUnits } from 'viem';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import {
    SOURCE_CHAINS,
    ARC_TESTNET_CONFIG,
    getSourceChainById,
    type SourceChainConfig,
} from './cctp-config';
import { ERC20_ABI } from './abi';

export type BridgeStep = 'idle' | 'bridging' | 'complete' | 'error';

export interface BridgeStepInfo {
    name: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    txHash?: string;
    explorerUrl?: string;
}

export interface UseBridgeReturn {
    bridge: (sourceChainId: string, amount: string) => Promise<boolean>;
    getSourceBalance: (chainId: string) => Promise<number>;
    isLoading: boolean;
    error: string | null;
    currentStep: BridgeStep;
    completedSteps: BridgeStepInfo[];
    sourceChains: SourceChainConfig[];
}

export function useBridge(): UseBridgeReturn {
    const { primaryWallet } = useDynamicContext();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState<BridgeStep>('idle');
    const [completedSteps, setCompletedSteps] = useState<BridgeStepInfo[]>([]);

    const getSourceBalance = useCallback(async (chainId: string): Promise<number> => {
        if (!primaryWallet?.address) return 0;

        const chainConfig = getSourceChainById(chainId);
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
            console.error('Failed to fetch source chain balance:', err);
            return 0;
        }
    }, [primaryWallet?.address]);

    const bridge = useCallback(async (sourceChainId: string, amount: string): Promise<boolean> => {
        if (!primaryWallet?.address) {
            setError('Wallet not connected');
            return false;
        }

        const chainConfig = getSourceChainById(sourceChainId);
        if (!chainConfig) {
            setError('Invalid source chain');
            return false;
        }

        setCompletedSteps([]);
        setIsLoading(true);
        setError(null);
        setCurrentStep('bridging');

        try {
            // Get the wallet's provider
            // Get the wallet's provider
            // Dynamic SDK v2/v3: primaryWallet has a connector property
            const wallet = primaryWallet as unknown as { connector: { getProvider?: () => Promise<unknown> } };

            if (!wallet.connector?.getProvider) {
                console.error('Wallet connector missing getProvider');
                throw new Error('Wallet does not support bridging (missing provider)');
            }

            const provider = await wallet.connector.getProvider();

            const kit = new BridgeKit();

            const adapter = await createViemAdapterFromProvider({
                provider: provider as Parameters<typeof createViemAdapterFromProvider>[0]['provider'],
            });

            const result = await kit.bridge({
                from: {
                    adapter,
                    chain: chainConfig.bridgeKitChain,
                },
                to: {
                    adapter,
                    chain: ARC_TESTNET_CONFIG.bridgeKitChain,
                },
                amount,
            });

            // Process steps from result
            interface BridgeResultStep {
                name: string;
                state: string;
                txHash?: string;
                explorerUrl?: string;
            }

            const processedSteps: BridgeStepInfo[] = (result.steps as BridgeResultStep[]).map((step) => ({
                name: step.name.charAt(0).toUpperCase() + step.name.slice(1),
                status: step.state === 'success' ? 'complete' : step.state === 'error' ? 'error' : 'pending',
                txHash: step.txHash,
                explorerUrl: step.explorerUrl,
            }));

            setCompletedSteps(processedSteps);

            if (result.state === 'success') {
                setCurrentStep('complete');
                return true;
            } else {
                setError('Bridge transfer failed');
                setCurrentStep('error');
                return false;
            }
        } catch (err) {
            console.error('Bridge error:', err);
            const message = err instanceof Error ? err.message : 'Bridge failed';

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
    }, [primaryWallet]);

    return {
        bridge,
        getSourceBalance,
        isLoading,
        error,
        currentStep,
        completedSteps,
        sourceChains: SOURCE_CHAINS,
    };
}
