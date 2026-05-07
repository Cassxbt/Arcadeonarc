'use client';

import { createConfig, http, injected } from 'wagmi';
import { arcTestnet } from './constants';

export const wagmiConfig = createConfig({
    chains: [arcTestnet],
    connectors: [
        injected(),
    ],
    transports: {
        [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
    },
    ssr: true,
});
