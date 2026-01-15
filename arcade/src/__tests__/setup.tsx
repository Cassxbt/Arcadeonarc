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
}));

// Mock sounds hook
vi.mock('@/lib/sounds', () => ({
    useSound: vi.fn(() => ({
        playSound: vi.fn(),
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
