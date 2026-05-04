import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';

vi.unmock('@/lib/game-context');

vi.mock('@/lib/useUser', () => ({
    useUser: vi.fn(() => ({
        user: null,
        isRegistered: false,
        isLoading: false,
        refetch: vi.fn(),
    })),
}));

vi.mock('@/lib/useStreak', () => ({
    useStreak: vi.fn(() => ({
        streak: 0,
        streakMultiplier: 1,
    })),
}));

vi.mock('@/lib/useDemoLimits', () => ({
    useDemoLimits: vi.fn(() => ({
        canPlay: vi.fn(() => true),
        getRemainingPlays: vi.fn(() => 3),
        recordPlay: vi.fn(() => true),
        isLimitReached: vi.fn(() => false),
    })),
}));

vi.mock('@/lib/supabase', () => ({
    getSupabaseClient: vi.fn(() => ({
        channel: vi.fn(() => ({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn(),
        })),
        removeChannel: vi.fn(),
    })),
}));

vi.mock('@/lib/cross-tab-sync', () => ({
    broadcastBalanceUpdate: vi.fn(),
    subscribeToBalanceUpdates: vi.fn(() => vi.fn()),
}));

vi.mock('@/lib/auth-fetch', () => ({
    authFetch: vi.fn(),
}));

async function renderProvider() {
    const { GameProvider, useGame } = await import('@/lib/game-context');

    function Consumer() {
        const { showUsernameModal } = useGame();

        return <div>{showUsernameModal ? 'username-open' : 'username-closed'}</div>;
    }

    render(
        <GameProvider>
            <Consumer />
        </GameProvider>
    );
}

describe('GameProvider username modal gating', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useIsLoggedIn).mockReturnValue(true);
    });

    it('does not show username creation when Dynamic still reports logged in but no wallet is connected', async () => {
        vi.mocked(useDynamicContext).mockReturnValue({
            primaryWallet: null,
        } as never);

        await renderProvider();

        await waitFor(() => {
            expect(screen.getByText('username-closed')).toBeInTheDocument();
        });
    });

    it('shows username creation only when a wallet is actively connected and unregistered', async () => {
        vi.mocked(useDynamicContext).mockReturnValue({
            primaryWallet: {
                address: '0x1234567890123456789012345678901234567890',
            },
        } as never);

        await renderProvider();

        await waitFor(() => {
            expect(screen.getByText('username-open')).toBeInTheDocument();
        }, { timeout: 1000 });
    });
});
