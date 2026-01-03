'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPublicClient, http, formatUnits } from 'viem';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useDemoLimits } from './useDemoLimits';
import { useUser } from './useUser';
import { useStreak } from './useStreak';
import { arcTestnet, CONTRACTS } from './constants';
import { VAULT_ABI } from './abi';

// Create public client for reading vault balance (created once, outside component)
const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
});

interface GameContextType {
    // Balance
    balance: number;
    isLoading: boolean;
    refreshBalance: () => Promise<void>;

    // Demo mode
    demoMode: boolean;
    demoBalance: number;
    toggleDemoMode: () => void;

    // Demo limits
    canPlayDemo: (game: 'tower' | 'dice' | 'crash') => boolean;
    getRemainingDemoPlays: (game: 'tower' | 'dice' | 'crash') => number;
    recordDemoPlay: (game: 'tower' | 'dice' | 'crash') => boolean;
    isDemoLimitReached: (game: 'tower' | 'dice' | 'crash') => boolean;

    // Bet amount
    betAmount: number;
    setBetAmount: (amount: number) => void;

    // Bet history
    betHistory: BetRecord[];
    addBetRecord: (record: Omit<BetRecord, 'id' | 'timestamp'>) => void;

    // Helpers
    effectiveBalance: number;
    canBet: (amount: number) => boolean;

    // User registration
    isRegistered: boolean;
    username: string | null;
    showUsernameModal: boolean;
    setShowUsernameModal: (show: boolean) => void;
    refetchUser: () => Promise<void>;

    // Streak
    streak: number;
    streakMultiplier: number;
}

export interface BetRecord {
    id: string;
    timestamp: Date;
    game: 'tower' | 'dice' | 'crash';
    betAmount: number;
    outcome: 'win' | 'loss';
    multiplier: number;
    payout: number;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const DEMO_STARTING_BALANCE = 1000; // $1000 demo balance

export function GameProvider({ children }: { children: React.ReactNode }) {
    const { primaryWallet } = useDynamicContext();
    const demoLimits = useDemoLimits();
    const { user, isRegistered, refetch: refetchUser } = useUser();
    const { streak, streakMultiplier } = useStreak();

    // Real balance
    const [balance, setBalance] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // Demo mode
    const [demoMode, setDemoMode] = useState(false); // Start with demo OFF - user must select
    const [demoBalance, setDemoBalance] = useState(DEMO_STARTING_BALANCE);

    // Username modal state
    const [showUsernameModal, setShowUsernameModal] = useState(false);

    // Bet amount
    const [betAmount, setBetAmountState] = useState(1);

    // Bet history
    const [betHistory, setBetHistory] = useState<BetRecord[]>([]);

    // Show username modal when wallet connects and user isn't registered
    useEffect(() => {
        if (primaryWallet && !isRegistered && !demoMode) {
            // Small delay to let the wallet connection complete
            const timer = setTimeout(() => {
                setShowUsernameModal(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [primaryWallet, isRegistered, demoMode]);

    // Fetch real balance from vault contract
    const refreshBalance = useCallback(async () => {
        if (!primaryWallet?.address) {
            setBalance(0);
            return;
        }

        setIsLoading(true);
        try {
            const rawBalance = await publicClient.readContract({
                address: CONTRACTS.ARCADE_VAULT,
                abi: VAULT_ABI,
                functionName: 'balances',
                args: [primaryWallet.address as `0x${string}`],
            });
            setBalance(Number(formatUnits(rawBalance as bigint, 6)));
        } catch (error) {
            console.error('Failed to fetch balance:', error);
            setBalance(0);
        } finally {
            setIsLoading(false);
        }
    }, [primaryWallet?.address]);

    useEffect(() => {
        if (primaryWallet) {
            refreshBalance();
        }
    }, [primaryWallet, refreshBalance]);

    // Toggle demo mode
    const toggleDemoMode = useCallback(() => {
        setDemoMode(prev => {
            if (!prev) {
                // Entering demo mode, reset demo balance
                setDemoBalance(DEMO_STARTING_BALANCE);
            }
            return !prev;
        });
    }, []);

    // Set bet amount with validation
    const setBetAmount = useCallback((amount: number) => {
        setBetAmountState(Math.max(0.5, Math.min(100, amount)));
    }, []);

    // Record game to Supabase (for real money games when registered)
    const recordGameToServer = useCallback(async (record: Omit<BetRecord, 'id' | 'timestamp'>) => {
        if (!primaryWallet?.address || !isRegistered || demoMode) return;

        try {
            await fetch('/api/games', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: primaryWallet.address.toLowerCase(),
                    game: record.game,
                    bet_amount: record.betAmount,
                    payout: record.payout,
                    multiplier: record.multiplier,
                    won: record.outcome === 'win',
                }),
            });
        } catch (error) {
            console.error('Failed to record game:', error);
        }
    }, [primaryWallet?.address, isRegistered, demoMode]);

    // Add bet record (also records demo play if in demo mode)
    const addBetRecord = useCallback((record: Omit<BetRecord, 'id' | 'timestamp'>) => {
        const newRecord: BetRecord = {
            ...record,
            id: crypto.randomUUID(),
            timestamp: new Date(),
        };

        setBetHistory(prev => [newRecord, ...prev].slice(0, 50)); // Keep last 50

        // Update demo balance if in demo mode
        if (demoMode) {
            // Record the demo play for limit tracking
            demoLimits.recordPlay(record.game);

            if (record.outcome === 'win') {
                setDemoBalance(prev => prev + record.payout - record.betAmount);
            } else {
                setDemoBalance(prev => prev - record.betAmount);
            }
        } else {
            // Record to server for points (real money mode)
            recordGameToServer(record);
        }
    }, [demoMode, demoLimits, recordGameToServer]);

    // Effective balance (demo or real)
    const effectiveBalance = demoMode ? demoBalance : balance;

    // Can bet check - also check demo limits in demo mode
    const canBet = useCallback((amount: number) => {
        const basicCheck = amount >= 0.5 && amount <= 100 && amount <= effectiveBalance;
        return basicCheck;
    }, [effectiveBalance]);

    return (
        <GameContext.Provider
            value={{
                balance,
                isLoading,
                refreshBalance,
                demoMode,
                demoBalance,
                toggleDemoMode,
                canPlayDemo: demoLimits.canPlay,
                getRemainingDemoPlays: demoLimits.getRemainingPlays,
                recordDemoPlay: demoLimits.recordPlay,
                isDemoLimitReached: demoLimits.isLimitReached,
                betAmount,
                setBetAmount,
                betHistory,
                addBetRecord,
                effectiveBalance,
                canBet,
                // User registration
                isRegistered,
                username: user?.username_display || null,
                showUsernameModal,
                setShowUsernameModal,
                refetchUser,
                // Streak
                streak,
                streakMultiplier,
            }}
        >
            {children}
        </GameContext.Provider>
    );
}

export function useGame() {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
}
