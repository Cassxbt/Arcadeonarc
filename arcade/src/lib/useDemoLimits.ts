'use client';

import { useState, useCallback, useEffect } from 'react';

const DEMO_STORAGE_KEY = 'arcadeDemoPlays';
const MAX_PLAYS_PER_DAY = 5;

export interface DemoLimits {
    tower: { count: number; date: string };
    dice: { count: number; date: string };
    crash: { count: number; date: string };
}

export interface DemoLimitState {
    canPlay: (game: 'tower' | 'dice' | 'crash') => boolean;
    getRemainingPlays: (game: 'tower' | 'dice' | 'crash') => number;
    recordPlay: (game: 'tower' | 'dice' | 'crash') => boolean;
    isLimitReached: (game: 'tower' | 'dice' | 'crash') => boolean;
}

function getToday(): string {
    return new Date().toISOString().split('T')[0];
}

function getDefaultLimits(): DemoLimits {
    return {
        tower: { count: 0, date: getToday() },
        dice: { count: 0, date: getToday() },
        crash: { count: 0, date: getToday() },
    };
}

function loadLimits(): DemoLimits {
    if (typeof window === 'undefined') {
        return getDefaultLimits();
    }

    try {
        const stored = localStorage.getItem(DEMO_STORAGE_KEY);
        if (!stored) {
            return getDefaultLimits();
        }

        const parsed = JSON.parse(stored) as DemoLimits;
        const today = getToday();

        // Reset counts for any game that has a different date
        const updated: DemoLimits = {
            tower: parsed.tower?.date === today ? parsed.tower : { count: 0, date: today },
            dice: parsed.dice?.date === today ? parsed.dice : { count: 0, date: today },
            crash: parsed.crash?.date === today ? parsed.crash : { count: 0, date: today },
        };

        return updated;
    } catch {
        return getDefaultLimits();
    }
}

function saveLimits(limits: DemoLimits): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(limits));
}

export function useDemoLimits(): DemoLimitState {
    const [limits, setLimits] = useState<DemoLimits>(getDefaultLimits);

    // Load from localStorage on mount
    useEffect(() => {
        setLimits(loadLimits());
    }, []);

    const canPlay = useCallback((game: 'tower' | 'dice' | 'crash'): boolean => {
        const gameLimit = limits[game];
        const today = getToday();

        // If date is different, reset count (effectively 5 plays available)
        if (gameLimit.date !== today) {
            return true;
        }

        return gameLimit.count < MAX_PLAYS_PER_DAY;
    }, [limits]);

    const getRemainingPlays = useCallback((game: 'tower' | 'dice' | 'crash'): number => {
        const gameLimit = limits[game];
        const today = getToday();

        // If date is different, all plays available
        if (gameLimit.date !== today) {
            return MAX_PLAYS_PER_DAY;
        }

        return Math.max(0, MAX_PLAYS_PER_DAY - gameLimit.count);
    }, [limits]);

    const isLimitReached = useCallback((game: 'tower' | 'dice' | 'crash'): boolean => {
        return !canPlay(game);
    }, [canPlay]);

    const recordPlay = useCallback((game: 'tower' | 'dice' | 'crash'): boolean => {
        const today = getToday();
        const currentLimit = limits[game];

        // Reset if new day
        const newCount = currentLimit.date === today ? currentLimit.count + 1 : 1;

        if (newCount > MAX_PLAYS_PER_DAY) {
            return false; // Limit reached
        }

        const newLimits: DemoLimits = {
            ...limits,
            [game]: { count: newCount, date: today },
        };

        setLimits(newLimits);
        saveLimits(newLimits);

        return true;
    }, [limits]);

    return {
        canPlay,
        getRemainingPlays,
        recordPlay,
        isLimitReached,
    };
}
