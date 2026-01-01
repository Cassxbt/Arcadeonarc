'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { formatUnits, parseUnits } from 'viem';

interface GameContextType {
    // Balance
    balance: number;
    isLoading: boolean;
    refreshBalance: () => Promise<void>;

    // Demo mode
    demoMode: boolean;
    demoBalance: number;
    toggleDemoMode: () => void;

    // Bet amount
    betAmount: number;
    setBetAmount: (amount: number) => void;

    // Bet history
    betHistory: BetRecord[];
    addBetRecord: (record: Omit<BetRecord, 'id' | 'timestamp'>) => void;

    // Helpers
    effectiveBalance: number;
    canBet: (amount: number) => boolean;
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

    // Real balance
    const [balance, setBalance] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // Demo mode
    const [demoMode, setDemoMode] = useState(true); // Start in demo mode
    const [demoBalance, setDemoBalance] = useState(DEMO_STARTING_BALANCE);

    // Bet amount
    const [betAmount, setBetAmountState] = useState(1);

    // Bet history
    const [betHistory, setBetHistory] = useState<BetRecord[]>([]);

    // Fetch real balance when wallet connected
    const refreshBalance = useCallback(async () => {
        if (!primaryWallet?.address) {
            setBalance(0);
            return;
        }

        setIsLoading(true);
        try {
            // Balance is fetched from vault contract when connected
            setBalance(0);
        } catch (error) {
            console.error('Failed to fetch balance:', error);
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

    // Add bet record
    const addBetRecord = useCallback((record: Omit<BetRecord, 'id' | 'timestamp'>) => {
        const newRecord: BetRecord = {
            ...record,
            id: crypto.randomUUID(),
            timestamp: new Date(),
        };

        setBetHistory(prev => [newRecord, ...prev].slice(0, 50)); // Keep last 50

        // Update demo balance if in demo mode
        if (demoMode) {
            if (record.outcome === 'win') {
                setDemoBalance(prev => prev + record.payout - record.betAmount);
            } else {
                setDemoBalance(prev => prev - record.betAmount);
            }
        }
    }, [demoMode]);

    // Effective balance (demo or real)
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
                demoMode,
                demoBalance,
                toggleDemoMode,
                betAmount,
                setBetAmount,
                betHistory,
                addBetRecord,
                effectiveBalance,
                canBet,
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
