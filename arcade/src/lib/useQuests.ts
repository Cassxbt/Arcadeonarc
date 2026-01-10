'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { authFetch } from './auth-fetch';
import { getSupabaseClient } from './supabase';

export interface Quest {
    id: string;
    title: string;
    description: string;
    target: number;
    reward: number;
    difficulty: 'easy' | 'medium' | 'hard';
    icon: string;
    progress: number;
    completed: boolean;
    claimed: boolean;
}

export interface CompletionBonus {
    available: boolean;
    claimed: boolean;
    amount: number;
}

interface UseQuestsReturn {
    quests: Quest[];
    completionBonus: CompletionBonus;
    isLoading: boolean;
    error: string | null;
    claimReward: (questId: string) => Promise<{ success: boolean; points: number }>;
    claimCompletionBonus: () => Promise<{ success: boolean; points: number }>;
    refreshQuests: () => Promise<void>;
}

export function useQuests(): UseQuestsReturn {
    const { primaryWallet } = useDynamicContext();
    const [quests, setQuests] = useState<Quest[]>([]);
    const [completionBonus, setCompletionBonus] = useState<CompletionBonus>({
        available: false,
        claimed: false,
        amount: 200,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const walletAddress = primaryWallet?.address?.toLowerCase();

    const fetchQuests = useCallback(async () => {
        if (!walletAddress) {
            setQuests([]);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const response = await authFetch('/api/quests');
            const data = await response.json();

            if (response.ok) {
                setQuests(data.quests || []);
                setCompletionBonus(data.completionBonus || {
                    available: false,
                    claimed: false,
                    amount: 200,
                });
            } else {
                setError(data.error || 'Failed to fetch quests');
            }
        } catch (err) {
            console.error('Failed to fetch quests:', err);
            setError('Failed to load quests');
        } finally {
            setIsLoading(false);
        }
    }, [walletAddress]);

    const claimReward = useCallback(async (questId: string): Promise<{ success: boolean; points: number }> => {
        if (!walletAddress) {
            return { success: false, points: 0 };
        }

        try {
            const response = await authFetch('/api/quests', {
                method: 'POST',
                body: JSON.stringify({ action: 'claim', quest_id: questId }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Update local state
                setQuests(prev => prev.map(q =>
                    q.id === questId ? { ...q, claimed: true } : q
                ));
                return { success: true, points: data.points };
            }

            return { success: false, points: 0 };
        } catch (err) {
            console.error('Failed to claim reward:', err);
            return { success: false, points: 0 };
        }
    }, [walletAddress]);

    const claimCompletionBonus = useCallback(async (): Promise<{ success: boolean; points: number }> => {
        if (!walletAddress) {
            return { success: false, points: 0 };
        }

        try {
            const response = await authFetch('/api/quests', {
                method: 'POST',
                body: JSON.stringify({ action: 'claim', quest_id: 'completion_bonus' }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setCompletionBonus(prev => ({ ...prev, available: false, claimed: true }));
                return { success: true, points: data.points };
            }

            return { success: false, points: 0 };
        } catch (err) {
            console.error('Failed to claim completion bonus:', err);
            return { success: false, points: 0 };
        }
    }, [walletAddress]);

    // Fetch quests on mount
    useEffect(() => {
        fetchQuests();
    }, [fetchQuests]);

    // Real-time subscription to quest updates
    useEffect(() => {
        if (!walletAddress) return;

        const supabase = getSupabaseClient();

        // Get today's date (same format as backend uses)
        const today = new Date().toISOString().split('T')[0];

        // Subscribe to changes in the daily_quests table for this user
        const channel = supabase
            .channel('quest-updates')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'daily_quests',
                    filter: `wallet_address=eq.${walletAddress}`,
                },
                (payload) => {
                    // When database changes, refresh the quests
                    fetchQuests();
                }
            )
            .subscribe();

        // Cleanup: unsubscribe when component unmounts or wallet changes
        return () => {
            supabase.removeChannel(channel);
        };
    }, [walletAddress, fetchQuests]);

    return {
        quests,
        completionBonus,
        isLoading,
        error,
        claimReward,
        claimCompletionBonus,
        refreshQuests: fetchQuests,
    };
}
