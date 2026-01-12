'use client';

import { useState, useEffect, useCallback } from 'react';

export type GameType = 'tower' | 'dice' | 'crash' | 'wheel' | 'laser';

export interface PlatformStats {
    biggestWin: {
        amount: number;
        player: string;
        game: GameType;
    } | null;
    mostPreferredGame: {
        game: GameType;
        count: number;
        percentage: number;
    } | null;
    totalUsdcWon: number;
    totalGamesPlayed: number;
    gameCounts: {
        tower: number;
        dice: number;
        crash: number;
        wheel: number;
        laser: number;
    };
    isLoading: boolean;
    error: string | null;
}

export function useStats(): PlatformStats {
    const [stats, setStats] = useState<PlatformStats>({
        biggestWin: null,
        mostPreferredGame: null,
        totalUsdcWon: 0,
        totalGamesPlayed: 0,
        gameCounts: { tower: 0, dice: 0, crash: 0, wheel: 0, laser: 0 },
        isLoading: true,
        error: null,
    });

    const fetchStats = useCallback(async () => {
        try {
            setStats(prev => ({ ...prev, isLoading: true, error: null }));

            const response = await fetch('/api/stats', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }

            const data = await response.json();

            setStats({
                biggestWin: data.biggestWin,
                mostPreferredGame: data.mostPreferredGame,
                totalUsdcWon: data.totalUsdcWon,
                totalGamesPlayed: data.totalGamesPlayed,
                gameCounts: data.gameCounts,
                isLoading: false,
                error: null,
            });

        } catch (error) {
            console.error('Failed to fetch stats:', error);
            setStats(prev => ({
                ...prev,
                isLoading: false,
                error: 'Failed to load stats. Please try again.',
            }));
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return stats;
}
