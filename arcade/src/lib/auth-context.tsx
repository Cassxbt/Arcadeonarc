'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

interface AuthContextType {
    isAuthenticated: boolean;
    isAuthenticating: boolean;
    sessionWallet: string | null;
    authenticate: () => Promise<boolean>;
    logout: () => Promise<void>;
    authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { primaryWallet, handleLogOut } = useDynamicContext();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [sessionWallet, setSessionWallet] = useState<string | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const [hasCheckedSession, setHasCheckedSession] = useState(false);
    const [authAttemptFailed, setAuthAttemptFailed] = useState(false);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const response = await fetch('/api/auth/session');
                const data = await response.json();

                if (data.authenticated && data.wallet) {
                    setIsAuthenticated(true);
                    setSessionWallet(data.wallet);
                }
            } catch {
                // Session check failed, user will re-auth
            } finally {
                setHasCheckedSession(true);
            }
        };

        checkSession();
    }, []);

    // Reset failed flag when wallet changes
    useEffect(() => {
        setAuthAttemptFailed(false);
    }, [primaryWallet?.address]);

    // Auto-authenticate when wallet connects
    useEffect(() => {
        if (!hasCheckedSession) return;
        if (!primaryWallet?.address) {
            if (isAuthenticated) {
                setIsAuthenticated(false);
                setSessionWallet(null);
            }
            return;
        }

        const walletLower = primaryWallet.address.toLowerCase();

        if (isAuthenticated && sessionWallet === walletLower) {
            return;
        }

        if (!isAuthenticating && !authAttemptFailed) {
            authenticate();
        }
    }, [primaryWallet?.address, hasCheckedSession, isAuthenticated, sessionWallet, isAuthenticating, authAttemptFailed]);

    const authenticate = useCallback(async (): Promise<boolean> => {
        if (!primaryWallet?.address) {
            setAuthError('Wallet not connected');
            return false;
        }

        setIsAuthenticating(true);
        setAuthError(null);

        try {
            const walletLower = primaryWallet.address.toLowerCase();

            // Step 1: Get challenge from server
            const challengeResponse = await fetch('/api/auth/challenge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: walletLower }),
            });

            if (!challengeResponse.ok) {
                throw new Error('Failed to get challenge');
            }

            const { message } = await challengeResponse.json();

            // Step 2: Sign the message with wallet
            const connector = primaryWallet.connector;
            let signature: string;

            if (connector && 'signMessage' in connector) {
                signature = await (connector as { signMessage: (msg: string) => Promise<string> }).signMessage(message);
            } else if ('signMessage' in primaryWallet) {
                signature = await (primaryWallet as { signMessage: (msg: string) => Promise<string> }).signMessage(message);
            } else {
                throw new Error('Wallet does not support message signing');
            }

            // Step 3: Verify signature with server
            const verifyResponse = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: walletLower, signature }),
            });

            if (!verifyResponse.ok) {
                const error = await verifyResponse.json();
                throw new Error(error.error || 'Verification failed');
            }

            setIsAuthenticated(true);
            setSessionWallet(walletLower);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Authentication failed';

            if (!message.includes('rejected') && !message.includes('denied')) {
                setAuthError(message);
                setAuthAttemptFailed(true);
            }
            return false;
        } finally {
            setIsAuthenticating(false);
        }
    }, [primaryWallet]);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/session', { method: 'DELETE' });
        } catch {
            // Logout failed, clear local state anyway
        }

        setIsAuthenticated(false);
        setSessionWallet(null);

        // Also disconnect wallet
        if (handleLogOut) {
            await handleLogOut();
        }
    }, [handleLogOut]);

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated,
                isAuthenticating,
                sessionWallet,
                authenticate,
                logout,
                authError,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
