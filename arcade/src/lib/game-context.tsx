'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { useDemoLimits, GameType } from './useDemoLimits';
import { useUser } from './useUser';
import { useStreak } from './useStreak';
import { getSupabaseClient } from './supabase';
import { broadcastBalanceUpdate, subscribeToBalanceUpdates } from './cross-tab-sync';
import { authFetch } from './auth-fetch';

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
    gameParams?: Record<string, unknown>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const DEMO_STARTING_BALANCE = 1000; // $1000 demo balance

export function GameProvider({ children }: { children: React.ReactNode }) {
    const { primaryWallet } = useDynamicContext();
    const isLoggedIn = useIsLoggedIn();
    const demoLimits = useDemoLimits();
    const { user, isRegistered, isLoading: isUserLoading, refetch: refetchUser } = useUser();
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

    useEffect(() => {
        if (isLoggedIn && !isRegistered && !demoMode && !isUserLoading) {
            const timer = setTimeout(() => {
                setShowUsernameModal(true);
            }, 500);
            return () => clearTimeout(timer);
        }

        if (isRegistered && showUsernameModal) {
            setShowUsernameModal(false);
        }
    }, [isLoggedIn, isRegistered, demoMode, isUserLoading, showUsernameModal]);

    const refreshBalance = useCallback(async () => {
        if (!primaryWallet?.address) {
            setBalance(0);
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`/api/users?wallet=${primaryWallet.address.toLowerCase()}`);
            const data = await response.json();

            if (data.user && data.user.server_balance !== undefined && data.user.server_balance !== null) {
                setBalance(data.user.server_balance);
            } else if (data.user) {
                // User exists but server_balance is null/undefined - sync from vault
                setIsLoading(false);
                const syncResponse = await authFetch('/api/balance/sync', {
                    method: 'POST',
                    body: JSON.stringify({ wallet: primaryWallet.address }),
                });
                if (syncResponse.ok) {
                    const syncData = await syncResponse.json();
                    setBalance(syncData.balance);
                    broadcastBalanceUpdate(syncData.balance);
                } else {
                    setBalance(0);
                }
                return;
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

    const syncBalanceAfterDeposit = useCallback(async () => {
        if (!primaryWallet?.address) return;

        try {
            const response = await authFetch('/api/balance/sync', {
                method: 'POST',
                body: JSON.stringify({ wallet: primaryWallet.address }),
            });

            if (response.ok) {
                const data = await response.json();
                setBalance(data.balance);
                // Broadcast balance update to ensure UI refreshes across all components and tabs
                broadcastBalanceUpdate(data.balance);
            }
        } catch (error) {
            console.error('Failed to sync balance:', error);
            await refreshBalance();
        }
    }, [primaryWallet?.address, refreshBalance]);

    useEffect(() => {
        if (primaryWallet && isRegistered) {
            refreshBalance();
        }
    }, [primaryWallet, isRegistered, refreshBalance]);
    // Supabase Realtime + cross-tab sync
    useEffect(() => {
        if (!primaryWallet?.address || demoMode) return;

        const walletLower = primaryWallet.address.toLowerCase();
        const supabase = getSupabaseClient();
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;

        const channel = supabase
            .channel(`balance:${walletLower}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'users',
                    filter: `wallet_address=eq.${walletLower}`,
                },
                (payload) => {
                    const newBalance = payload.new?.server_balance;
                    if (typeof newBalance === 'number') {
                        setBalance(newBalance);
                        broadcastBalanceUpdate(newBalance);
                    }
                    reconnectAttempts = 0;
                }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    if (reconnectAttempts < maxReconnectAttempts) {
                        reconnectAttempts++;
                        // Exponential backoff reconnection
                        setTimeout(() => {
                            supabase.removeChannel(channel);
                        }, 1000 * Math.pow(2, reconnectAttempts));
                    }
                    refreshBalance();
                }
            });

        const unsubscribeCrossTab = subscribeToBalanceUpdates((newBalance) => {
            setBalance(newBalance);
        });

        // Fallback: refresh every 15s in case realtime fails (reduced from 60s)
        const fallbackInterval = setInterval(refreshBalance, 15000);

        return () => {
            supabase.removeChannel(channel);
            unsubscribeCrossTab();
            clearInterval(fallbackInterval);
        };
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

    const setBetAmount = useCallback((amount: number) => {
        setBetAmountState(Math.max(0.5, Math.min(100, amount)));
    }, []);
    // Server-side payout calculation
    const recordGameToServer = useCallback(async (record: Omit<BetRecord, 'id' | 'timestamp'>) => {
        if (!primaryWallet?.address || demoMode) return;

        if (isRegistered && record.gameParams) {
            try {
                const response = await authFetch('/api/games', {
                    method: 'POST',
                    body: JSON.stringify({
                        wallet: primaryWallet.address.toLowerCase(),
                        game: record.game,
                        bet_amount: record.betAmount,
                        game_params: record.gameParams,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    // Use server-calculated balance (source of truth)
                    if (data.newBalance !== undefined) {
                        setBalance(data.newBalance);
                        broadcastBalanceUpdate(data.newBalance);
                    }
                } else {
                    // Server rejected - refresh to get correct balance
                    await refreshBalance();
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
            // Optimistic update
            const delta = record.outcome === 'win'
                ? record.payout - record.betAmount
                : -record.betAmount;
            setBalance(prev => prev + delta);

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
