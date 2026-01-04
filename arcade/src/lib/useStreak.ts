'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

interface UseStreakReturn {
    streak: number;
    streakMultiplier: number;
    lastPlayedDate: string | null;
    isLoading: boolean;
    recordPlay: (game: 'dice' | 'tower' | 'crash') => Promise<void>;
}

// Calculate streak multiplier: 1.0× at day 1, up to 2.0× at day 7+
function getStreakMultiplier(streak: number): number {
    if (streak <= 0) return 1.0;
    if (streak >= 7) return 2.0;
    return 1.0 + (streak - 1) * 0.15; // 1.0, 1.15, 1.30, 1.45, 1.60, 1.75, 2.0
}

export function useStreak(): UseStreakReturn {
    const { primaryWallet } = useDynamicContext();
    const [streak, setStreak] = useState(0);
    const [lastPlayedDate, setLastPlayedDate] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const walletAddress = primaryWallet?.address?.toLowerCase();

    // Fetch streak data
    const fetchStreak = useCallback(async () => {
        if (!walletAddress) {
            setStreak(0);
            setLastPlayedDate(null);
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch(`/api/users?wallet=${walletAddress}`);
            const data = await response.json();

            if (response.ok && data.user) {
                setStreak(data.user.current_streak || 0);
                setLastPlayedDate(data.user.last_played_date);
            }
        } catch (err) {
            console.error('Failed to fetch streak:', err);
        } finally {
            setIsLoading(false);
        }
    }, [walletAddress]);

    useEffect(() => {
        fetchStreak();
    }, [fetchStreak]);

    // Record a play and update streak
    const recordPlay = useCallback(async (_game: 'dice' | 'tower' | 'crash') => {
        if (!walletAddress) return;

        try {
            // The streak update happens server-side when recording a game
            // This function is called after a game is recorded
            await fetchStreak(); // Refresh streak data
        } catch (err) {
            console.error('Failed to update streak:', err);
        }
    }, [walletAddress, fetchStreak]);

    return {
        streak,
        streakMultiplier: getStreakMultiplier(streak),
        lastPlayedDate,
        isLoading,
        recordPlay,
    };
}

// Export the multiplier function for use elsewhere
export { getStreakMultiplier };
