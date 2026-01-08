'use client';

import { createPublicClient, webSocket, http } from 'viem';
import { arcTestnet, CONTRACTS } from './constants';
import { VAULT_ABI } from './abi';

type BalanceCallback = (newBalance: bigint) => void;

const WS_URL = arcTestnet.rpcUrls.default.webSocket?.[0];

export function subscribeToBalanceChanges(
    userAddress: `0x${string}`,
    onBalanceChange: BalanceCallback
): () => void {
    if (!WS_URL) {
        console.warn('No WebSocket URL available, falling back to polling');
        return () => { };
    }

    try {
        const wsClient = createPublicClient({
            chain: arcTestnet,
            transport: webSocket(WS_URL),
        });

        const unwatchDeposit = wsClient.watchContractEvent({
            address: CONTRACTS.ARCADE_VAULT,
            abi: VAULT_ABI,
            eventName: 'Deposited',
            args: { user: userAddress },
            onLogs: async () => {
                const balance = await fetchBalance(userAddress);
                onBalanceChange(balance);
            },
        });

        const unwatchWithdraw = wsClient.watchContractEvent({
            address: CONTRACTS.ARCADE_VAULT,
            abi: VAULT_ABI,
            eventName: 'Withdrawn',
            args: { user: userAddress },
            onLogs: async () => {
                const balance = await fetchBalance(userAddress);
                onBalanceChange(balance);
            },
        });

        const unwatchSettled = wsClient.watchContractEvent({
            address: CONTRACTS.ARCADE_VAULT,
            abi: VAULT_ABI,
            eventName: 'BetSettled',
            args: { user: userAddress },
            onLogs: async () => {
                const balance = await fetchBalance(userAddress);
                onBalanceChange(balance);
            },
        });

        return () => {
            unwatchDeposit();
            unwatchWithdraw();
            unwatchSettled();
        };
    } catch (error) {
        console.error('Failed to setup WebSocket subscription:', error);
        return () => { };
    }
}

const httpClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
});

async function fetchBalance(userAddress: `0x${string}`): Promise<bigint> {
    try {
        const balance = await httpClient.readContract({
            address: CONTRACTS.ARCADE_VAULT,
            abi: VAULT_ABI,
            functionName: 'balances',
            args: [userAddress],
        });
        return balance as bigint;
    } catch {
        return BigInt(0);
    }
}
