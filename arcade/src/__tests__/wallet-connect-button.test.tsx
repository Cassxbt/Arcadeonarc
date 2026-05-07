import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useConnect, useConnection } from 'wagmi';
import { useAuth } from '@/lib/auth-context';

vi.mock('wagmi', () => ({
    useConnect: vi.fn(),
    useConnection: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => ({
    useAuth: vi.fn(),
}));

const connect = vi.fn();
const setShowAuthFlow = vi.fn();
const logout = vi.fn();

async function renderWalletConnectButton() {
    const { WalletConnectButton } = await import('@/components/WalletConnectButton');

    render(<WalletConnectButton />);
}

describe('WalletConnectButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(useAuth).mockReturnValue({
            isAuthenticated: false,
            isAuthenticating: false,
            sessionWallet: null,
            authenticate: vi.fn(),
            logout,
            authError: null,
        });

        vi.mocked(useConnect).mockReturnValue({
            connect,
            connectors: [{ id: 'injected', name: 'Browser Wallet', type: 'injected' }],
            isPending: false,
            error: null,
        } as never);

        vi.mocked(useConnection).mockReturnValue({
            address: undefined,
            status: 'disconnected',
        } as never);
    });

    it('uses the external wallet connector when Dynamic is blocked or still unloaded', async () => {
        vi.mocked(useDynamicContext).mockReturnValue({
            primaryWallet: null,
            sdkHasLoaded: false,
            setShowAuthFlow,
        } as never);

        await renderWalletConnectButton();

        await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

        expect(connect).toHaveBeenCalledWith({ connector: expect.objectContaining({ id: 'injected' }) });
        expect(setShowAuthFlow).not.toHaveBeenCalled();
    });

    it('opens the Dynamic auth flow when Dynamic is healthy', async () => {
        vi.mocked(useDynamicContext).mockReturnValue({
            primaryWallet: null,
            sdkHasLoaded: true,
            setShowAuthFlow,
        } as never);

        await renderWalletConnectButton();

        await userEvent.click(screen.getByRole('button', { name: /log in/i }));

        expect(setShowAuthFlow).toHaveBeenCalledWith(true);
        expect(connect).not.toHaveBeenCalled();
    });

    it('shows the connected external wallet and logs out through ARCade auth', async () => {
        vi.mocked(useDynamicContext).mockReturnValue({
            primaryWallet: null,
            sdkHasLoaded: false,
            setShowAuthFlow,
        } as never);
        vi.mocked(useConnection).mockReturnValue({
            address: '0x1234567890123456789012345678901234567890',
            status: 'connected',
        } as never);

        await renderWalletConnectButton();

        expect(screen.getByRole('button', { name: /0x1234...7890/i })).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /0x1234...7890/i }));

        expect(logout).toHaveBeenCalled();
    });

    it('shows a readable message when no injected wallet provider exists', async () => {
        vi.mocked(useDynamicContext).mockReturnValue({
            primaryWallet: null,
            sdkHasLoaded: false,
            setShowAuthFlow,
        } as never);
        vi.mocked(useConnect).mockReturnValue({
            connect,
            connectors: [{ id: 'injected', name: 'Browser Wallet', type: 'injected' }],
            isPending: false,
            error: new Error('Provider not found. Version: @wagmi/core@3.0.1'),
        } as never);

        await renderWalletConnectButton();

        expect(screen.getByText(/No browser wallet found/i)).toBeInTheDocument();
        expect(screen.queryByText(/@wagmi/i)).not.toBeInTheDocument();
    });
});
