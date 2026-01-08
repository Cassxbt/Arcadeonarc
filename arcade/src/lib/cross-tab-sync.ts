'use client';

const BALANCE_CHANNEL = 'arcade_balance_sync';

interface BalanceMessage {
    type: 'BALANCE_UPDATE';
    balance: number;
    timestamp: number;
}

export function broadcastBalanceUpdate(balance: number): void {
    if (typeof window === 'undefined') return;

    try {
        const channel = new BroadcastChannel(BALANCE_CHANNEL);
        const message: BalanceMessage = {
            type: 'BALANCE_UPDATE',
            balance,
            timestamp: Date.now(),
        };
        channel.postMessage(message);
        channel.close();
    } catch {
        // BroadcastChannel not supported
    }
}

export function subscribeToBalanceUpdates(
    onUpdate: (balance: number) => void
): () => void {
    if (typeof window === 'undefined') return () => { };

    try {
        const channel = new BroadcastChannel(BALANCE_CHANNEL);

        const handler = (event: MessageEvent<BalanceMessage>) => {
            if (event.data?.type === 'BALANCE_UPDATE') {
                onUpdate(event.data.balance);
            }
        };

        channel.addEventListener('message', handler);

        return () => {
            channel.removeEventListener('message', handler);
            channel.close();
        };
    } catch {
        return () => { };
    }
}
