'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from './auth-fetch';
import { useWalletIdentity } from './wallet-identity';

interface DailyBonusState {
    claimed: boolean;
    points: number;
    isLoading: boolean;
    lastClaimDate: string | null;
}

interface UseDailyBonusReturn {
    dailyBonus: DailyBonusState;
    claimDailyBonus: () => Promise<{ claimed: boolean; points: number }>;
    checkDailyBonus: () => Promise<void>;
}

export function useDailyBonus(): UseDailyBonusReturn {
    const wallet = useWalletIdentity();
    const [dailyBonus, setDailyBonus] = useState<DailyBonusState>({
        claimed: false,
        points: 0,
        isLoading: true,
        lastClaimDate: null,
    });

    const walletAddress = wallet.addressLower;

    const checkDailyBonus = useCallback(async () => {
        if (!walletAddress) {
            setDailyBonus(prev => ({ ...prev, isLoading: false }));
            return;
        }

        try {
            const response = await fetch(`/api/daily-bonus?wallet=${walletAddress}`);
            const data = await response.json();

            if (response.ok) {
                setDailyBonus({
                    claimed: data.claimedToday,
                    points: data.todayPoints || 0,
                    isLoading: false,
                    lastClaimDate: data.lastClaimDate,
                });
            }
        } catch (error) {
            console.error('Failed to check daily bonus:', error);
            setDailyBonus(prev => ({ ...prev, isLoading: false }));
        }
    }, [walletAddress]);

    const claimDailyBonus = useCallback(async (): Promise<{ claimed: boolean; points: number }> => {
        if (!walletAddress) {
            return { claimed: false, points: 0 };
        }

        try {
            const response = await authFetch('/api/daily-bonus', {
                method: 'POST',
                body: JSON.stringify({ wallet: walletAddress }),
            });

            const data = await response.json();

            if (response.ok && data.claimed) {
                setDailyBonus(prev => ({
                    ...prev,
                    claimed: true,
                    points: data.points,
                    lastClaimDate: new Date().toISOString().split('T')[0],
                }));
                return { claimed: true, points: data.points };
            }

            return { claimed: false, points: 0 };
        } catch (error) {
            console.error('Failed to claim daily bonus:', error);
            return { claimed: false, points: 0 };
        }
    }, [walletAddress]);

    useEffect(() => {
        queueMicrotask(() => {
            void checkDailyBonus();
        });
    }, [checkDailyBonus]);

    return {
        dailyBonus,
        claimDailyBonus,
        checkDailyBonus,
    };
}
