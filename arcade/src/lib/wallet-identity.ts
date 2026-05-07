'use client';

import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { useConnection } from 'wagmi';

export type WalletSource = 'dynamic' | 'external' | 'none';

export function useWalletIdentity() {
    const { primaryWallet } = useDynamicContext();
    const dynamicLoggedIn = useIsLoggedIn();
    const externalWallet = useConnection();

    const dynamicAddress = primaryWallet?.address ?? null;
    const externalAddress = externalWallet.status === 'connected'
        ? externalWallet.address ?? null
        : null;
    const address = dynamicAddress ?? externalAddress;
    const source: WalletSource = dynamicAddress ? 'dynamic' : externalAddress ? 'external' : 'none';

    return {
        address,
        addressLower: address?.toLowerCase() ?? null,
        isConnected: source === 'dynamic' ? Boolean(dynamicAddress && dynamicLoggedIn) : Boolean(externalAddress),
        source,
        dynamicWallet: primaryWallet,
        externalStatus: externalWallet.status,
    };
}
