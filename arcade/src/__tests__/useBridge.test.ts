import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBridge } from '../lib/useBridge';

// Mock Bridge Kit SDK - use vi.hoisted for proper mock hoisting
const { mockBridge, mockOn, MockBridgeKit } = vi.hoisted(() => {
    const mockBridge = vi.fn();
    const mockOn = vi.fn();

    class MockBridgeKit {
        bridge = mockBridge;
        on = mockOn;
    }

    return { mockBridge, mockOn, MockBridgeKit };
});

vi.mock('@circle-fin/bridge-kit', () => ({
    BridgeKit: MockBridgeKit,
    BridgeChain: {
        Arc_Testnet: 'Arc_Testnet',
        Ethereum_Sepolia: 'Ethereum_Sepolia',
        Base_Sepolia: 'Base_Sepolia',
    },
}));

// Mock adapter
vi.mock('@circle-fin/adapter-viem-v2', () => ({
    createViemAdapterFromProvider: vi.fn(() => Promise.resolve({})),
}));

// Mock viem
vi.mock('viem', async () => {
    const actual = await vi.importActual('viem');
    return {
        ...actual,
        createPublicClient: vi.fn(() => ({
            readContract: vi.fn(() => Promise.resolve(BigInt(10000000))), // 10 USDC
        })),
        http: vi.fn(),
        formatUnits: vi.fn((value: bigint, decimals: number) => {
            return (Number(value) / Math.pow(10, decimals)).toString();
        }),
    };
});

describe('useBridge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('initial state', () => {
        it('returns correct initial values', () => {
            const { result } = renderHook(() => useBridge());

            expect(result.current.isLoading).toBe(false);
            expect(result.current.error).toBeNull();
            expect(result.current.currentStep).toBe('idle');
            expect(result.current.completedSteps).toEqual([]);
            expect(result.current.sourceChains).toHaveLength(2);
        });

        it('provides Ethereum Sepolia and Base Sepolia as source chains', () => {
            const { result } = renderHook(() => useBridge());

            const chainIds = result.current.sourceChains.map(c => c.id);
            expect(chainIds).toContain('ethereum_sepolia');
            expect(chainIds).toContain('base_sepolia');
        });
    });

    describe('getSourceBalance', () => {
        it('fetches balance for valid chain', async () => {
            const { result } = renderHook(() => useBridge());

            // Should return mocked balance (10 USDC from BigInt(10000000) / 10^6)
            const balance = await result.current.getSourceBalance('ethereum_sepolia');
            expect(typeof balance).toBe('number');
        });

        it('returns 0 for invalid chain ID', async () => {
            const { result } = renderHook(() => useBridge());

            const balance = await result.current.getSourceBalance('invalid_chain');
            expect(balance).toBe(0);
        });
    });

    describe('bridge', () => {
        it('sets error when source chain is invalid', async () => {
            const { result } = renderHook(() => useBridge());

            await act(async () => {
                await result.current.bridge('invalid_chain', '10');
            });

            expect(result.current.error).toBe('Invalid source chain');
        });

        it('sets isLoading to true during bridge', async () => {
            mockBridge.mockImplementation(() => new Promise(() => { })); // Never resolves

            const { result } = renderHook(() => useBridge());

            act(() => {
                result.current.bridge('ethereum_sepolia', '10');
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(true);
            });
        });

        it('sets currentStep to bridging when bridge starts', async () => {
            mockBridge.mockImplementation(() => new Promise(() => { }));

            const { result } = renderHook(() => useBridge());

            act(() => {
                result.current.bridge('ethereum_sepolia', '10');
            });

            await waitFor(() => {
                expect(result.current.currentStep).toBe('bridging');
            });
        });

        it('handles successful bridge', async () => {
            mockBridge.mockResolvedValue({
                state: 'success',
                steps: [
                    { name: 'approve', state: 'success', txHash: '0x123' },
                    { name: 'burn', state: 'success', txHash: '0x456' },
                    { name: 'fetchAttestation', state: 'success' },
                    { name: 'mint', state: 'success', txHash: '0x789' },
                ],
            });

            const { result } = renderHook(() => useBridge());

            let success: boolean = false;
            await act(async () => {
                success = await result.current.bridge('ethereum_sepolia', '10');
            });

            expect(success).toBe(true);
            expect(result.current.currentStep).toBe('complete');
            expect(result.current.completedSteps).toHaveLength(4);
        });

        it('handles failed bridge', async () => {
            mockBridge.mockResolvedValue({
                state: 'error',
                steps: [],
            });

            const { result } = renderHook(() => useBridge());

            let success: boolean = true;
            await act(async () => {
                success = await result.current.bridge('ethereum_sepolia', '10');
            });

            expect(success).toBe(false);
            expect(result.current.currentStep).toBe('error');
            expect(result.current.error).toBe('Bridge transfer failed');
        });

        it('handles user rejection error', async () => {
            mockBridge.mockRejectedValue(new Error('Transaction rejected by user'));

            const { result } = renderHook(() => useBridge());

            await act(async () => {
                await result.current.bridge('ethereum_sepolia', '10');
            });

            expect(result.current.error).toBe('Transaction rejected by user');
            expect(result.current.currentStep).toBe('error');
        });

        it('handles insufficient balance error', async () => {
            mockBridge.mockRejectedValue(new Error('insufficient funds'));

            const { result } = renderHook(() => useBridge());

            await act(async () => {
                await result.current.bridge('ethereum_sepolia', '10');
            });

            expect(result.current.error).toBe('Insufficient balance');
            expect(result.current.currentStep).toBe('error');
        });
    });
});
