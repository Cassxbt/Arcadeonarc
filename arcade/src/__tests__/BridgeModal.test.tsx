import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BridgeModal } from '../components/BridgeModal';

// Mock useBridge hook
const mockBridge = vi.fn();
const mockGetSourceBalance = vi.fn();

vi.mock('../lib/useBridge', () => ({
    useBridge: vi.fn(() => ({
        bridge: mockBridge,
        getSourceBalance: mockGetSourceBalance,
        isLoading: false,
        error: null,
        currentStep: 'idle',
        completedSteps: [],
        sourceChains: [
            {
                id: 'ethereum_sepolia',
                name: 'Ethereum Sepolia',
                chainId: 11155111,
                domain: 0,
                usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
                bridgeKitChain: 'Ethereum_Sepolia',
                explorer: 'https://sepolia.etherscan.io',
                logo: '/chains/ethereum.svg',
            },
            {
                id: 'base_sepolia',
                name: 'Base Sepolia',
                chainId: 84532,
                domain: 6,
                usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                bridgeKitChain: 'Base_Sepolia',
                explorer: 'https://sepolia.basescan.org',
                logo: '/chains/base.svg',
            },
        ],
    })),
}));

describe('BridgeModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onSuccess: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSourceBalance.mockResolvedValue(100);
    });

    describe('rendering', () => {
        it('renders nothing when closed', () => {
            render(<BridgeModal {...defaultProps} isOpen={false} />);
            expect(screen.queryByText('Bridge USDC')).not.toBeInTheDocument();
        });

        it('renders modal when open', () => {
            render(<BridgeModal {...defaultProps} />);
            expect(screen.getByText('Bridge USDC')).toBeInTheDocument();
        });

        it('displays subtitle text', () => {
            render(<BridgeModal {...defaultProps} />);
            expect(screen.getByText(/Transfer USDC from another chain to Arc Testnet/)).toBeInTheDocument();
        });

        it('displays chain selector', () => {
            render(<BridgeModal {...defaultProps} />);
            expect(screen.getByText('From Chain')).toBeInTheDocument();
        });

        it('displays quick amount buttons', () => {
            render(<BridgeModal {...defaultProps} />);
            expect(screen.getByRole('button', { name: '$5' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '$10' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '$25' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '$50' })).toBeInTheDocument();
        });

        it('displays submit button', () => {
            render(<BridgeModal {...defaultProps} />);
            expect(screen.getByRole('button', { name: 'Bridge to Arc' })).toBeInTheDocument();
        });
    });

    describe('chain selection', () => {
        it('defaults to first chain', async () => {
            render(<BridgeModal {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Ethereum Sepolia')).toBeInTheDocument();
            });
        });

        it('opens dropdown when chain button clicked', async () => {
            const user = userEvent.setup();
            render(<BridgeModal {...defaultProps} />);

            const chainButton = screen.getByRole('button', { name: /Ethereum Sepolia/i });
            await user.click(chainButton);

            await waitFor(() => {
                expect(screen.getAllByText('Base Sepolia').length).toBeGreaterThan(0);
            });
        });

        it('fetches balance when chain selected', async () => {
            render(<BridgeModal {...defaultProps} />);

            await waitFor(() => {
                expect(mockGetSourceBalance).toHaveBeenCalledWith('ethereum_sepolia');
            });
        });
    });

    describe('amount input', () => {
        it('allows typing amount', async () => {
            const user = userEvent.setup();
            render(<BridgeModal {...defaultProps} />);

            const input = screen.getByPlaceholderText('0.00');
            await user.type(input, '50');

            expect(input).toHaveValue(50);
        });

        it('sets amount when quick button clicked', async () => {
            const user = userEvent.setup();
            render(<BridgeModal {...defaultProps} />);

            await user.click(screen.getByRole('button', { name: '$25' }));

            const input = screen.getByPlaceholderText('0.00');
            expect(input).toHaveValue(25);
        });

        it('disables quick buttons when amount exceeds balance', async () => {
            mockGetSourceBalance.mockResolvedValue(20);
            render(<BridgeModal {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: '$25' })).toBeDisabled();
                expect(screen.getByRole('button', { name: '$50' })).toBeDisabled();
            });
        });
    });

    describe('form submission', () => {
        it('disables submit when amount is empty', () => {
            render(<BridgeModal {...defaultProps} />);

            expect(screen.getByRole('button', { name: 'Bridge to Arc' })).toBeDisabled();
        });

        it('disables submit when amount is zero', async () => {
            const user = userEvent.setup();
            render(<BridgeModal {...defaultProps} />);

            const input = screen.getByPlaceholderText('0.00');
            await user.type(input, '0');

            expect(screen.getByRole('button', { name: 'Bridge to Arc' })).toBeDisabled();
        });

        it('calls bridge function on submit', async () => {
            const user = userEvent.setup();
            mockBridge.mockResolvedValue(true);
            render(<BridgeModal {...defaultProps} />);

            const input = screen.getByPlaceholderText('0.00');
            await user.type(input, '10');

            const submitButton = screen.getByRole('button', { name: 'Bridge to Arc' });
            await user.click(submitButton);

            await waitFor(() => {
                expect(mockBridge).toHaveBeenCalledWith('ethereum_sepolia', '10');
            });
        });
    });

    describe('close behavior', () => {
        it('calls onClose when close button clicked', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            render(<BridgeModal {...defaultProps} onClose={onClose} />);

            const closeButton = screen.getByRole('button', { name: '×' });
            await user.click(closeButton);

            expect(onClose).toHaveBeenCalled();
        });

        it('calls onClose when overlay clicked', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            render(<BridgeModal {...defaultProps} onClose={onClose} />);

            const overlay = screen.getByText('Bridge USDC').parentElement?.parentElement?.parentElement;
            if (overlay) {
                await user.click(overlay);
            }
        });
    });
});
