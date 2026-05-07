import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props} > {children} </div>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children} </>,
}));

// Mock Dynamic SDK
vi.mock('@dynamic-labs/sdk-react-core', () => ({
    useDynamicContext: vi.fn(() => ({
        primaryWallet: {
            address: '0x1234567890123456789012345678901234567890',
            connector: {
                getProvider: vi.fn(() => Promise.resolve({})),
            },
        },
    })),
    useIsLoggedIn: vi.fn(() => true),
}));

// Mock Wagmi hooks for component tests that render wallet-aware components
// outside the app-level WagmiProvider.
vi.mock('wagmi', async () => {
    const actual = await vi.importActual<typeof import('wagmi')>('wagmi');

    return {
        ...actual,
        useConnection: vi.fn(() => ({
            address: undefined,
            status: 'disconnected',
        })),
        useConnect: vi.fn(() => ({
            connect: vi.fn(),
            connectors: [],
            isPending: false,
            error: null,
        })),
        useDisconnect: vi.fn(() => ({
            disconnect: vi.fn(),
        })),
        useSignMessage: vi.fn(() => ({
            signMessageAsync: vi.fn(),
        })),
    };
});

// Mock sounds hook
vi.mock('@/lib/sounds', () => ({
    useSound: vi.fn(() => ({
        playSound: vi.fn(),
        stopSound: vi.fn(),
    })),
}));

// Mock game context
vi.mock('@/lib/game-context', () => ({
    useGame: vi.fn(() => ({
        syncBalanceAfterDeposit: vi.fn(() => Promise.resolve()),
        refreshBalance: vi.fn(() => Promise.resolve()),
        balance: 100,
    })),
}));
