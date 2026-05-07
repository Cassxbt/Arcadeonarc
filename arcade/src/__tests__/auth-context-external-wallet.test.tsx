import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useConnection, useDisconnect, useSignMessage } from 'wagmi';

vi.unmock('@/lib/auth-context');

vi.mock('wagmi', () => ({
    useConnection: vi.fn(),
    useDisconnect: vi.fn(),
    useSignMessage: vi.fn(),
}));

const signMessageAsync = vi.fn();
const disconnect = vi.fn();

async function renderAuthConsumer() {
    const { AuthProvider, useAuth } = await import('@/lib/auth-context');

    function Consumer() {
        const { authenticate, isAuthenticated, authError } = useAuth();

        return (
            <div>
                <span>{isAuthenticated ? 'authenticated' : 'anonymous'}</span>
                {authError && <span>{authError}</span>}
                <button onClick={() => authenticate()}>Authenticate</button>
            </div>
        );
    }

    render(
        <AuthProvider>
            <Consumer />
        </AuthProvider>
    );
}

describe('AuthProvider external wallet authentication', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(useDynamicContext).mockReturnValue({
            primaryWallet: null,
            handleLogOut: vi.fn(),
        } as never);

        vi.mocked(useConnection).mockReturnValue({
            address: '0x1234567890123456789012345678901234567890',
            status: 'connected',
        } as never);

        vi.mocked(useDisconnect).mockReturnValue({ disconnect } as never);
        vi.mocked(useSignMessage).mockReturnValue({ signMessageAsync } as never);

        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = input.toString();

            if (url === '/api/auth/session') {
                return Response.json({ authenticated: false });
            }

            if (url === '/api/auth/challenge') {
                return Response.json({ challenge: 'challenge-1', message: 'Sign challenge-1' });
            }

            if (url === '/api/auth/verify') {
                return Response.json({ success: true, wallet: '0x1234567890123456789012345678901234567890' });
            }

            return Response.json({}, { status: 404 });
        }));

        signMessageAsync.mockResolvedValue('0xsigned');
    });

    it('signs the ARCade challenge with a connected external wallet', async () => {
        await renderAuthConsumer();

        await userEvent.click(screen.getByRole('button', { name: /authenticate/i }));

        await waitFor(() => {
            expect(screen.getByText('authenticated')).toBeInTheDocument();
        });

        expect(signMessageAsync).toHaveBeenCalledWith({ message: 'Sign challenge-1' });
        expect(fetch).toHaveBeenCalledWith('/api/auth/verify', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
                wallet: '0x1234567890123456789012345678901234567890',
                signature: '0xsigned',
                challenge: 'challenge-1',
            }),
        }));
    });
});
