'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useDemoLimits, GameType } from './useDemoLimits';
import { useUser } from './useUser';
import { useStreak } from './useStreak';

interface GameContextType {
    // Balance
    balance: number;
    isLoading: boolean;
    refreshBalance: () => Promise<void>;
    syncBalanceAfterDeposit: () => Promise<void>;

    // Demo mode
    demoMode: boolean;
    demoBalance: number;
    toggleDemoMode: () => void;

    // Demo limits
    canPlayDemo: (game: GameType) => boolean;
    getRemainingDemoPlays: (game: GameType) => number;
    recordDemoPlay: (game: GameType) => boolean;
    isDemoLimitReached: (game: GameType) => boolean;

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
    game: GameType;
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

    // Server-tracked balance (for instant gameplay)
    const [balance, setBalance] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // Demo mode
    const [demoMode, setDemoMode] = useState(false);
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
            const timer = setTimeout(() => {
                setShowUsernameModal(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [primaryWallet, isRegistered, demoMode]);

    // Fetch server balance from Supabase (via user data)
    const refreshBalance = useCallback(async () => {
        if (!primaryWallet?.address) {
            setBalance(0);
            return;
        }

        setIsLoading(true);
        try {
            // Fetch user data which includes server_balance
            const response = await fetch(`/api/users?wallet=${primaryWallet.address.toLowerCase()}`);
            const data = await response.json();

            if (data.user && data.user.server_balance !== undefined) {
                setBalance(data.user.server_balance);
            } else {
                setBalance(0);
            }
        } catch (error) {
            console.error('Failed to fetch balance:', error);
            setBalance(0);
        } finally {
            setIsLoading(false);
        }
    }, [primaryWallet?.address]);

    // Sync vault balance to server after deposit
    const syncBalanceAfterDeposit = useCallback(async () => {
        if (!primaryWallet?.address) return;

        try {
            const response = await fetch('/api/balance/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: primaryWallet.address }),
            });

            if (response.ok) {
                const data = await response.json();
                setBalance(data.balance);
            }
        } catch (error) {
            console.error('Failed to sync balance:', error);
            // Fallback to regular refresh
            await refreshBalance();
        }
    }, [primaryWallet?.address, refreshBalance]);

    useEffect(() => {
        if (primaryWallet && isRegistered) {
            refreshBalance();
        }
    }, [primaryWallet, isRegistered, refreshBalance]);

    useEffect(() => {
        if (!primaryWallet?.address || demoMode) return;
        const interval = setInterval(refreshBalance, 30000);
        return () => clearInterval(interval);
    }, [primaryWallet?.address, demoMode, refreshBalance]);

    // Toggle demo mode
    const toggleDemoMode = useCallback(() => {
        setDemoMode(prev => {
            if (!prev) {
                setDemoBalance(DEMO_STARTING_BALANCE);
            }
            return !prev;
        });
    }, []);

    // Set bet amount with validation
    const setBetAmount = useCallback((amount: number) => {
        setBetAmountState(Math.max(0.5, Math.min(100, amount)));
    }, []);

    // Record game to server - NO blockchain calls, just API
    const recordGameToServer = useCallback(async (record: Omit<BetRecord, 'id' | 'timestamp'>) => {
        if (!primaryWallet?.address || demoMode) return;

        if (isRegistered) {
            try {
                const response = await fetch('/api/games', {
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

                if (response.ok) {
                    const data = await response.json();
                    // Update balance from server response
                    if (data.newBalance !== undefined) {
                        setBalance(data.newBalance);
                    }
                }
            } catch (error) {
                console.error('Failed to record game:', error);
                // On error, refresh balance from server
                await refreshBalance();
            }
        }
    }, [primaryWallet?.address, isRegistered, demoMode, refreshBalance]);

    // Add bet record - instant UI update, async server update
    const addBetRecord = useCallback((record: Omit<BetRecord, 'id' | 'timestamp'>) => {
        const newRecord: BetRecord = {
            ...record,
            id: crypto.randomUUID(),
            timestamp: new Date(),
        };

        setBetHistory(prev => [newRecord, ...prev].slice(0, 50));

        if (demoMode) {
            demoLimits.recordPlay(record.game);

            if (record.outcome === 'win') {
                setDemoBalance(prev => prev + record.payout - record.betAmount);
            } else {
                setDemoBalance(prev => prev - record.betAmount);
            }
        } else {
            // Update balance optimistically for instant feedback
            const delta = record.outcome === 'win'
                ? record.payout - record.betAmount
                : -record.betAmount;
            setBalance(prev => prev + delta);

            // Record to server (async, non-blocking)
            recordGameToServer(record);
        }
    }, [demoMode, demoLimits, recordGameToServer]);

    // Effective balance
    const effectiveBalance = demoMode ? demoBalance : balance;

    // Can bet check
    const canBet = useCallback((amount: number) => {
        return amount >= 0.5 && amount <= 100 && amount <= effectiveBalance;
    }, [effectiveBalance]);

    return (
        <GameContext.Provider
            value={{
                balance,
                isLoading,
                refreshBalance,
                syncBalanceAfterDeposit,
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
                isRegistered,
                username: user?.username_display || null,
                showUsernameModal,
                setShowUsernameModal,
                refetchUser,
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
