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
    {
        blockExplorerUrls: ['https://sepolia.arbiscan.io'],
        chainId: 421614,
        chainName: 'Arbitrum Sepolia',
        iconUrls: ['https://app.dynamic.xyz/assets/networks/arbitrum.svg'],
        name: 'Arbitrum Sepolia',
        nativeCurrency: {
            decimals: 18,
            name: 'Sepolia ETH',
            symbol: 'ETH',
        },
        networkId: 421614,
        rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
        vanityName: 'Arbitrum Sepolia',
    },
    {
        blockExplorerUrls: ['https://sepolia.basescan.org'],
        chainId: 84532,
        chainName: 'Base Sepolia',
        iconUrls: ['https://app.dynamic.xyz/assets/networks/base.svg'],
        name: 'Base Sepolia',
        nativeCurrency: {
            decimals: 18,
            name: 'Sepolia ETH',
            symbol: 'ETH',
        },
        networkId: 84532,
        rpcUrls: ['https://base-sepolia-rpc.publicnode.com'],
        vanityName: 'Base Sepolia',
    },
    {
        blockExplorerUrls: ['https://sepolia-optimism.etherscan.io'],
        chainId: 11155420,
        chainName: 'OP Sepolia',
        iconUrls: ['https://app.dynamic.xyz/assets/networks/optimism.svg'],
        name: 'OP Sepolia',
        nativeCurrency: {
            decimals: 18,
            name: 'Sepolia ETH',
            symbol: 'ETH',
        },
        networkId: 11155420,
        rpcUrls: ['https://sepolia.optimism.io'],
        vanityName: 'OP Sepolia',
    },
    {
        blockExplorerUrls: ['https://sepolia.etherscan.io'],
        chainId: 11155111,
        chainName: 'Ethereum Sepolia',
        iconUrls: ['https://app.dynamic.xyz/assets/networks/eth.svg'],
        name: 'Ethereum Sepolia',
        nativeCurrency: {
            decimals: 18,
            name: 'Sepolia ETH',
            symbol: 'ETH',
        },
        networkId: 11155111,
        rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
        vanityName: 'Sepolia',
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
                appLogoUrl: 'https://arcadeonarc.fun/favicon.ico',
            }}
        >
            {children}
        </DynamicContextProvider>
    );
}
