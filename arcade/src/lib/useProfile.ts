import { useState, useEffect, useCallback } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { BadgeDefinition } from './badges';

interface ProfileData {
    user: {
        wallet_address: string;
        username: string;
        lifetime_xp: number;
        current_streak: number;
        created_at: string;
    };
    badges: (BadgeDefinition & { earned_at: string })[];
    gameStats: {
        totalGames: number;
        totalWins: number;
        winRate: number;
        totalWagered: number;
        totalWon: number;
    };
    favoriteGame: {
        game: string;
        count: number;
        percentage: number;
    } | null;
    weeklyPoints: number;
}

interface UseProfileReturn {
    profile: ProfileData | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useProfile(): UseProfileReturn {
    const { primaryWallet } = useDynamicContext();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const walletAddress = primaryWallet?.address?.toLowerCase();

    const fetchProfile = useCallback(async () => {
        if (!walletAddress) {
            setProfile(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/profile?wallet=${walletAddress}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch profile');
            }

            setProfile(data);
        } catch (err) {
            console.error('Error fetching profile:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [walletAddress]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    return {
        profile,
        isLoading,
        error,
        refetch: fetchProfile
    };
}
