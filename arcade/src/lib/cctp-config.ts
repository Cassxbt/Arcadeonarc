import { defineChain } from 'viem';
import { BridgeChain } from '@circle-fin/bridge-kit';

export const CCTP_DOMAINS = {
    ETHEREUM_SEPOLIA: 0,
    BASE_SEPOLIA: 6,
    ARC_TESTNET: 26,
} as const;

export const ethereumSepolia = defineChain({
    id: 11155111,
    name: 'Ethereum Sepolia',
    nativeCurrency: {
        decimals: 18,
        name: 'Sepolia Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: {
            http: [
                'https://ethereum-sepolia-rpc.publicnode.com',
                'https://1rpc.io/sepolia',
                'https://sepolia.drpc.org',
                'https://rpc.sepolia.org',
            ],
        },
    },
    blockExplorers: {
        default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
    },
    testnet: true,
});

export const baseSepolia = defineChain({
    id: 84532,
    name: 'Base Sepolia',
    nativeCurrency: {
        decimals: 18,
        name: 'Sepolia Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: {
            http: ['https://sepolia.base.org'],
        },
    },
    blockExplorers: {
        default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
    },
    testnet: true,
});

export interface SourceChainConfig {
    id: string;
    name: string;
    chainId: number;
    domain: number;
    usdc: `0x${string}`;
    bridgeKitChain: BridgeChain;
    chain: ReturnType<typeof defineChain>;
    explorer: string;
    logo: string;
}

export const SOURCE_CHAINS: SourceChainConfig[] = [
    {
        id: 'ethereum_sepolia',
        name: 'Ethereum Sepolia',
        chainId: 11155111,
        domain: CCTP_DOMAINS.ETHEREUM_SEPOLIA,
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        bridgeKitChain: BridgeChain.Ethereum_Sepolia,
        chain: ethereumSepolia,
        explorer: 'https://sepolia.etherscan.io',
        logo: '/chains/ethereum.svg',
    },
    {
        id: 'base_sepolia',
        name: 'Base Sepolia',
        chainId: 84532,
        domain: CCTP_DOMAINS.BASE_SEPOLIA,
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        bridgeKitChain: BridgeChain.Base_Sepolia,
        chain: baseSepolia,
        explorer: 'https://sepolia.basescan.org',
        logo: '/chains/base.svg',
    },
];

export const ARC_TESTNET_CONFIG = {
    bridgeKitChain: BridgeChain.Arc_Testnet,
    domain: CCTP_DOMAINS.ARC_TESTNET,
    usdc: '0x3600000000000000000000000000000000000000' as `0x${string}`,
    explorer: 'https://testnet.arcscan.app',
};

export const CCTP_CONTRACTS = {
    TOKEN_MESSENGER_V2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`,
    MESSAGE_TRANSMITTER_V2: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as `0x${string}`,
};

export const IRIS_API = {
    SANDBOX: 'https://iris-api-sandbox.circle.com',
    PRODUCTION: 'https://iris-api.circle.com',
};

export function getSourceChainById(id: string): SourceChainConfig | undefined {
    return SOURCE_CHAINS.find((chain) => chain.id === id);
}

export function getExplorerTxUrl(explorer: string, txHash: string): string {
    return `${explorer}/tx/${txHash}`;
}
