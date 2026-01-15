'use client';

import { useState, useCallback } from 'react';
import { BridgeKit } from '@circle-fin/bridge-kit';
import { createAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { createPublicClient, http, formatUnits, type WalletClient, type Chain } from 'viem';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isEthereumWallet } from '@dynamic-labs/ethereum';
import {
    SOURCE_CHAINS,
    ARC_TESTNET_CONFIG,
    getSourceChainById,
    type SourceChainConfig,
    ethereumSepolia,
    baseSepolia,
} from './cctp-config';
import { ERC20_ABI } from './abi';
import { arcTestnet } from './constants';

type EIP1193Provider = {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const SUPPORTED_CHAINS: Chain[] = [ethereumSepolia, baseSepolia, arcTestnet];

function createEmbeddedWalletProvider(
    userAddress: `0x${string}`,
    walletClient: WalletClient
): EIP1193Provider {
    let currentChainId: number = ethereumSepolia.id;

    return {
        async request({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
            console.log('[embedded-provider]', method, params);

            // Account methods - return known address
            if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
                return [userAddress];
            }

            // Chain ID - return current chain
            if (method === 'eth_chainId') {
                return `0x${currentChainId.toString(16)}`;
            }

            // Switch chain - update current chain ID
            if (method === 'wallet_switchEthereumChain') {
                const chainIdHex = (params as [{ chainId: string }])?.[0]?.chainId;
                if (chainIdHex) {
                    currentChainId = parseInt(chainIdHex, 16);
                    console.log('[embedded-provider] Switched to chain:', currentChainId);
                }
                return null;
            }

            // Get the current chain for transaction context
            const currentChain = SUPPORTED_CHAINS.find(c => c.id === currentChainId) || ethereumSepolia;

            // Handle eth_sendTransaction with proper chain context
            if (method === 'eth_sendTransaction') {
                console.log('[embedded-provider] Sending transaction on chain:', currentChain.name);
                const txParams = (params as [{ to: string; data?: string; value?: string; gas?: string }])?.[0];
                if (!txParams) {
                    throw new Error('Invalid transaction parameters');
                }

                // Use walletClient.sendTransaction with explicit chain
                const hash = await walletClient.sendTransaction({
                    account: userAddress,
                    chain: currentChain,
                    to: txParams.to as `0x${string}`,
                    data: txParams.data as `0x${string}` | undefined,
                    value: txParams.value ? BigInt(txParams.value) : undefined,
                    gas: txParams.gas ? BigInt(txParams.gas) : undefined,
                });
                return hash;
            }

            // Other signing methods - forward to Dynamic wallet client
            const signingMethods = [
                'eth_signTransaction',
                'personal_sign',
                'eth_sign',
                'eth_signTypedData',
                'eth_signTypedData_v4',
            ];

            if (signingMethods.includes(method)) {
                console.log('[embedded-provider] Forwarding signing method to wallet client');
                return walletClient.request({ method, params } as Parameters<typeof walletClient.request>[0]);
            }

            // Read methods - forward to public RPC
            const publicClient = createPublicClient({
                chain: currentChain,
                transport: http(),
            });

            console.log('[embedded-provider] Forwarding read method to RPC:', currentChain.name);
            return publicClient.request({ method, params } as Parameters<typeof publicClient.request>[0]);
        }
    };
}

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

    const isEmbeddedWallet = useCallback((): boolean => {
        if (!primaryWallet) return false;
        const connector = primaryWallet.connector as { isEmbeddedWallet?: boolean } | undefined;
        return connector?.isEmbeddedWallet === true;
    }, [primaryWallet]);

    const getWalletClient = useCallback(async (): Promise<WalletClient | null> => {
        if (!primaryWallet) return null;
        try {
            if (!isEthereumWallet(primaryWallet)) return null;
            return await primaryWallet.getWalletClient();
        } catch (err) {
            console.error('[bridge] Failed to get wallet client:', err);
            return null;
        }
    }, [primaryWallet]);

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

            if (isEmbeddedWallet()) {
                console.log('[bridge] Embedded wallet detected - will use custom provider');
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
    }, [primaryWallet, isEmbeddedWallet]);

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
            const embedded = isEmbeddedWallet();
            console.log('[bridge] Wallet type:', embedded ? 'embedded' : 'external');

            let provider: EIP1193Provider;

            if (embedded) {
                const walletClient = await getWalletClient();
                if (!walletClient) {
                    throw new Error('Could not get wallet client. Please reconnect your wallet.');
                }

                console.log('[bridge] Creating embedded wallet provider');
                const userAddress = primaryWallet!.address as `0x${string}`;
                provider = createEmbeddedWalletProvider(userAddress, walletClient);
            } else {
                const externalProvider = await getProvider();
                if (!externalProvider) {
                    throw new Error('Could not get wallet provider. Please reconnect your wallet.');
                }

                console.log('[bridge] Switching to source chain:', chainConfig.name);
                const switched = await switchToChain(chainConfig.chainId);
                if (!switched) {
                    console.warn('[bridge] Could not switch network automatically');
                }

                provider = externalProvider;
            }

            console.log('[bridge] Creating adapter from provider');
            const adapter = await createAdapterFromProvider({
                provider: provider as Parameters<typeof createAdapterFromProvider>[0]['provider'],
            });

            const kit = new BridgeKit();

            console.log('[bridge] Starting bridge from', chainConfig.name, 'to Arc Testnet, amount:', amount);

            const result = await kit.bridge({
                from: {
                    adapter: adapter as Parameters<typeof kit.bridge>[0]['from']['adapter'],
                    chain: chainConfig.bridgeKitChain,
                },
                to: {
                    adapter: adapter as Parameters<typeof kit.bridge>[0]['to']['adapter'],
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
    }, [primaryWallet, getProvider, getWalletClient, isEmbeddedWallet, switchToChain]);

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
