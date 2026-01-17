import { BridgeChain } from '@circle-fin/bridge-kit';
import { type Chain } from 'viem';
import {
    ethereumSepolia,
    baseSepolia,
    avalancheFuji,
    hyperEvmTestnet,
    seiAtlantic,
} from './cctp-config';

export const GATEWAY_DOMAINS = {
    ETHEREUM_SEPOLIA: 0,
    AVALANCHE_FUJI: 1,
    BASE_SEPOLIA: 6,
    SEI_ATLANTIC: 16,
    HYPEREVM_TESTNET: 19,
    ARC_TESTNET: 26,
} as const;

export const GATEWAY_API = {
    SANDBOX: 'https://gateway-api-sandbox.circle.com',
    PRODUCTION: 'https://gateway-api.circle.com',
};

export interface GatewayChainConfig {
    id: string;
    name: string;
    chainId: number;
    domain: number;
    usdc: `0x${string}`;
    gatewayWallet: `0x${string}`;
    bridgeKitChain: BridgeChain;
    chain: Chain;
    explorer: string;
    logo: string;
    supportsGateway: boolean;
}

/**
 * Chains that support Gateway (subset of CCTP chains)
 * Gateway supports: Arc, Avalanche, Base, Ethereum, HyperEVM, Sei, Sonic, World Chain
 * Not supported on Gateway: Arbitrum, Optimism, Polygon, Linea, Codex, etc.
 */
export const GATEWAY_CHAINS: GatewayChainConfig[] = [
    {
        id: 'ethereum_sepolia',
        name: 'Ethereum Sepolia',
        chainId: 11155111,
        domain: GATEWAY_DOMAINS.ETHEREUM_SEPOLIA,
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        gatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
        bridgeKitChain: BridgeChain.Ethereum_Sepolia,
        chain: ethereumSepolia,
        explorer: 'https://sepolia.etherscan.io',
        logo: '/chains/ethereum.svg',
        supportsGateway: true,
    },
    {
        id: 'base_sepolia',
        name: 'Base Sepolia',
        chainId: 84532,
        domain: GATEWAY_DOMAINS.BASE_SEPOLIA,
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        gatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
        bridgeKitChain: BridgeChain.Base_Sepolia,
        chain: baseSepolia,
        explorer: 'https://sepolia.basescan.org',
        logo: '/chains/base.svg',
        supportsGateway: true,
    },
    {
        id: 'avalanche_fuji',
        name: 'Avalanche Fuji',
        chainId: 43113,
        domain: GATEWAY_DOMAINS.AVALANCHE_FUJI,
        usdc: '0x5425890298aed601595a70AB815c96711a31Bc65',
        gatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
        bridgeKitChain: BridgeChain.Avalanche_Fuji,
        chain: avalancheFuji,
        explorer: 'https://testnet.snowtrace.io',
        logo: '/chains/avalanche.svg',
        supportsGateway: true,
    },
    {
        id: 'hyperevm_testnet',
        name: 'HyperEVM',
        chainId: 998,
        domain: GATEWAY_DOMAINS.HYPEREVM_TESTNET,
        usdc: '0x2B3370eE501B4a559b57D449569354196457D8Ab',
        gatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
        bridgeKitChain: BridgeChain.HyperEVM_Testnet,
        chain: hyperEvmTestnet,
        explorer: 'https://testnet.purrsec.com',
        logo: '/chains/hyperevm.svg',
        supportsGateway: true,
    },
    {
        id: 'sei_atlantic',
        name: 'Sei Atlantic',
        chainId: 1328,
        domain: GATEWAY_DOMAINS.SEI_ATLANTIC,
        usdc: '0x4fCF1784B31630811181f670Aea7A7bEF803eaED',
        gatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
        bridgeKitChain: BridgeChain.Sei_Testnet,
        chain: seiAtlantic,
        explorer: 'https://seitrace.com',
        logo: '/chains/sei.svg',
        supportsGateway: true,
    },
];

export const ARC_GATEWAY_CONFIG = {
    domain: GATEWAY_DOMAINS.ARC_TESTNET,
    usdc: '0x3600000000000000000000000000000000000000' as `0x${string}`,
    gatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9' as `0x${string}`,
    explorer: 'https://testnet.arcscan.app',
};

export function getGatewayChainById(id: string): GatewayChainConfig | undefined {
    return GATEWAY_CHAINS.find((chain) => chain.id === id);
}

export function isGatewaySupported(chainId: string): boolean {
    const chain = getGatewayChainById(chainId);
    return chain?.supportsGateway ?? false;
}
