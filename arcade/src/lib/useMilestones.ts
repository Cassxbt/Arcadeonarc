'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

export interface Milestone {
    id: string;
    title: string;
    description: string;
    target: number;
    progress: number;
    reward: number;
    icon: string;
    achieved: boolean;
    claimed: boolean;
    completed: boolean;
}

interface WeeklyStats {
    gamesPlayed: number;
    wins: number;
}

interface UseMilestonesReturn {
    milestones: Milestone[];
    stats: WeeklyStats;
    week: number;
    year: number;
    isLoading: boolean;
    error: string | null;
    claimMilestone: (milestoneId: string) => Promise<{ success: boolean; points: number }>;
    refreshMilestones: () => Promise<void>;
}

export function useMilestones(): UseMilestonesReturn {
    const { primaryWallet } = useDynamicContext();
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [stats, setStats] = useState<WeeklyStats>({ gamesPlayed: 0, wins: 0 });
    const [week, setWeek] = useState(0);
    const [year, setYear] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const walletAddress = primaryWallet?.address?.toLowerCase();

    const fetchMilestones = useCallback(async () => {
        if (!walletAddress) {
            setMilestones([]);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch('/api/milestones');
            const data = await response.json();

            if (response.ok) {
                setMilestones(data.milestones || []);
                setStats(data.stats || { gamesPlayed: 0, wins: 0 });
                setWeek(data.week || 0);
                setYear(data.year || 0);
            } else {
                setError(data.error || 'Failed to fetch milestones');
            }
        } catch (err) {
            console.error('Failed to fetch milestones:', err);
            setError('Failed to load milestones');
        } finally {
            setIsLoading(false);
        }
    }, [walletAddress]);

    const claimMilestone = useCallback(async (milestoneId: string): Promise<{ success: boolean; points: number }> => {
        if (!walletAddress) {
            return { success: false, points: 0 };
        }

        try {
            const response = await fetch('/api/milestones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ milestone_id: milestoneId }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Update local state
                setMilestones(prev => prev.map(m =>
                    m.id === milestoneId ? { ...m, achieved: true, claimed: true } : m
                ));
                return { success: true, points: data.points };
            }

            return { success: false, points: 0 };
        } catch (err) {
            console.error('Failed to claim milestone:', err);
            return { success: false, points: 0 };
        }
    }, [walletAddress]);

    useEffect(() => {
        fetchMilestones();
    }, [fetchMilestones]);

    return {
        milestones,
        stats,
        week,
        year,
        isLoading,
        error,
        claimMilestone,
        refreshMilestones: fetchMilestones,
    };
}
