'use client';

import { useState, useCallback } from 'react';
import { BridgeKit } from '@circle-fin/bridge-kit';
import { EthereumSepolia, BaseSepolia, ArcTestnet } from '@circle-fin/bridge-kit/chains';
import { ViemAdapter } from '@circle-fin/adapter-viem-v2';
import { createPublicClient, http, formatUnits, type WalletClient } from 'viem';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import {
    SOURCE_CHAINS,
    ARC_TESTNET_CONFIG,
    getSourceChainById,
    type SourceChainConfig,
} from './cctp-config';
import { ERC20_ABI } from './abi';
import { arcTestnet } from './constants';

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

    const switchToChain = useCallback(async (chainId: number): Promise<boolean> => {
        if (!primaryWallet) return false;
        try {
            // Try using Dynamic's switchNetwork if available
            if ('switchNetwork' in primaryWallet) {
                await (primaryWallet as unknown as { switchNetwork: (chainId: number) => Promise<void> }).switchNetwork(chainId);
                return true;
            }

            // Fallback: use wallet client to request chain switch
            const walletClient = await getWalletClient();
            if (walletClient) {
                await walletClient.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${chainId.toString(16)}` }],
                });
                return true;
            }
            return false;
        } catch (err) {
            console.error('Failed to switch network:', err);
            // If chain not added, we might need to add it first
            return false;
        }
    }, [primaryWallet, getWalletClient]);

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
            // Get the wallet client from Dynamic SDK
            const walletClient = await getWalletClient();
            if (!walletClient) {
                throw new Error('Could not get wallet client. Please reconnect your wallet.');
            }

            // Switch to source chain for the bridge transaction
            console.log('[bridge] Switching to source chain:', chainConfig.name);
            const switched = await switchToChain(chainConfig.chainId);
            if (!switched) {
                console.warn('[bridge] Could not switch network automatically');
            }

            // Create the adapter with factory functions
            // ViemAdapter expects getPublicClient, getWalletClient and capabilities
            const adapter = new ViemAdapter({
                getPublicClient: ({ chain }) => createPublicClient({
                    chain,
                    transport: http(),
                }),
                getWalletClient: ({ chain }) => ({
                    ...walletClient,
                    chain,
                }) as typeof walletClient,
            }, {
                addressContext: 'user-controlled',
                supportedChains: [EthereumSepolia, BaseSepolia, ArcTestnet],
            });

            const kit = new BridgeKit();

            console.log('[bridge] Starting bridge from', chainConfig.name, 'to Arc Testnet, amount:', amount);

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
                // Switch back to Arc Testnet
                await switchToChain(arcTestnet.id);
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
    }, [primaryWallet, getWalletClient, switchToChain]);

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
