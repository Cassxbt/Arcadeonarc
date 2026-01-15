'use client';

import { useState, useCallback } from 'react';
import { BridgeKit } from '@circle-fin/bridge-kit';
import { createAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { createPublicClient, http, formatUnits } from 'viem';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isEthereumWallet } from '@dynamic-labs/ethereum';
import {
    SOURCE_CHAINS,
    ARC_TESTNET_CONFIG,
    getSourceChainById,
    type SourceChainConfig,
} from './cctp-config';
import { ERC20_ABI } from './abi';
import { arcTestnet } from './constants';

// EIP-1193 Provider type
type EIP1193Provider = {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

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

    const getProvider = useCallback(async (): Promise<EIP1193Provider | null> => {
        if (!primaryWallet) {
            console.log('[bridge] No primary wallet');
            return null;
        }

        try {
            if (!isEthereumWallet(primaryWallet)) {
                console.log('[bridge] Wallet is not an Ethereum wallet');
                return null;
            }

            const walletClient = await primaryWallet.getWalletClient();
            console.log('[bridge] Got wallet client:', !!walletClient);

            if (walletClient) {
                const transport = walletClient.transport as { value?: { provider?: EIP1193Provider } };
                if (transport?.value?.provider) {
                    console.log('[bridge] Got provider from wallet client transport');
                    return transport.value.provider;
                }

                if ('request' in walletClient && typeof walletClient.request === 'function') {
                    console.log('[bridge] Using wallet client as provider');
                    return walletClient as unknown as EIP1193Provider;
                }
            }

            if (typeof window !== 'undefined' && window.ethereum) {
                console.log('[bridge] Falling back to window.ethereum');
                return window.ethereum as EIP1193Provider;
            }

            console.log('[bridge] No provider found');
            return null;
        } catch (err) {
            console.error('[bridge] Failed to get provider:', err);
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

            // Fallback: use provider to request chain switch
            const provider = await getProvider();
            if (provider) {
                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${chainId.toString(16)}` }],
                });
                return true;
            }
            return false;
        } catch (err) {
            console.error('Failed to switch network:', err);
            return false;
        }
    }, [primaryWallet, getProvider]);

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
            const provider = await getProvider();
            if (!provider) {
                throw new Error('Could not get wallet provider. Please reconnect your wallet.');
            }

            // Switch to source chain for the bridge transaction
            console.log('[bridge] Switching to source chain:', chainConfig.name);
            const switched = await switchToChain(chainConfig.chainId);
            if (!switched) {
                console.warn('[bridge] Could not switch network automatically');
            }

            console.log('[bridge] Creating adapter from provider');
            const adapter = await createAdapterFromProvider({
                provider: provider as Parameters<typeof createAdapterFromProvider>[0]['provider'],
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
    }, [primaryWallet, getProvider, switchToChain]);

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
