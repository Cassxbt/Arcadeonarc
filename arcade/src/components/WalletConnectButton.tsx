'use client';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useConnect, useConnection } from 'wagmi';
import { useAuth } from '@/lib/auth-context';
import { Loader2, Wallet } from './icons';
import styles from './Navbar.module.css';

function formatAddress(address: string) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatWalletError(message?: string) {
    if (!message) return null;

    if (message.toLowerCase().includes('provider not found')) {
        return 'No browser wallet found. Install a wallet extension or open ARCade in a wallet browser.';
    }

    return message;
}

export function WalletConnectButton({ mobile = false }: { mobile?: boolean }) {
    const { primaryWallet, sdkHasLoaded, setShowAuthFlow } = useDynamicContext();
    const externalWallet = useConnection();
    const { connect, connectors, isPending, error } = useConnect();
    const { logout, isAuthenticating, authError } = useAuth();

    const dynamicAddress = primaryWallet?.address ?? null;
    const externalAddress = externalWallet.status === 'connected' ? externalWallet.address ?? null : null;
    const address = dynamicAddress ?? externalAddress;
    const injectedConnector = connectors.find((connector) => connector.type === 'injected') ?? connectors[0];
    const isBusy = isPending || isAuthenticating;

    const handleConnect = () => {
        if (sdkHasLoaded) {
            setShowAuthFlow(true);
            return;
        }

        if (injectedConnector) {
            connect({ connector: injectedConnector });
        }
    };

    if (address) {
        return (
            <button
                className={`${styles.walletButton} ${mobile ? styles.walletButtonMobile : ''}`}
                onClick={() => logout()}
                title="Disconnect wallet"
                type="button"
            >
                <Wallet size={18} />
                <span>{formatAddress(address)}</span>
            </button>
        );
    }

    const label = sdkHasLoaded ? 'Log In' : 'Connect Wallet';
    const statusText =
        formatWalletError(error?.message) ||
        authError ||
        (!sdkHasLoaded && !injectedConnector
            ? 'No browser wallet found. Install a wallet extension or open ARCade in a wallet browser.'
            : null);

    return (
        <div className={`${styles.walletConnectStack} ${mobile ? styles.walletConnectStackMobile : ''}`}>
            <button
                className={`${styles.walletButton} ${!sdkHasLoaded ? styles.walletButtonExternal : ''} ${mobile ? styles.walletButtonMobile : ''}`}
                onClick={handleConnect}
                disabled={isBusy || (!sdkHasLoaded && !injectedConnector)}
                type="button"
            >
                {isBusy ? <Loader2 size={18} className={styles.walletButtonSpinner} /> : <Wallet size={18} />}
                <span>{isBusy ? 'Connecting' : label}</span>
            </button>
            {statusText && <p className={styles.walletConnectError}>{statusText}</p>}
        </div>
    );
}
