'use client';

import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { DYNAMIC_ENVIRONMENT_ID } from './constants';

const evmNetworks = [
    {
        blockExplorerUrls: ['https://testnet.arcscan.app'],
        chainId: 5042002,
        chainName: 'Arc Testnet',
        iconUrls: ['https://arc.network/favicon.ico'],
        name: 'Arc Testnet',
        nativeCurrency: {
            decimals: 6,
            name: 'USDC',
            symbol: 'USDC',
        },
        networkId: 5042002,
        rpcUrls: ['https://rpc.testnet.arc.network'],
        vanityName: 'Arc Testnet',
    },
];

interface DynamicProviderProps {
    children: React.ReactNode;
}

export function DynamicProvider({ children }: DynamicProviderProps) {
    return (
        <DynamicContextProvider
            settings={{
                environmentId: DYNAMIC_ENVIRONMENT_ID,
                walletConnectors: [EthereumWalletConnectors],
                overrides: {
                    evmNetworks,
                },
                appName: 'ARCade',
                appLogoUrl: '/logo.png',
            }}
        >
            {children}
        </DynamicContextProvider>
    );
}
