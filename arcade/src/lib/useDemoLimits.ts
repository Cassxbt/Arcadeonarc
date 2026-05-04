'use client';

import { useState, useCallback } from 'react';

const DEMO_STORAGE_KEY = 'arcadeDemoPlays';
const MAX_PLAYS_PER_DAY = 5;

export type GameType = 'tower' | 'dice' | 'crash' | 'wheel' | 'laser';

export interface DemoLimits {
    tower: { count: number; date: string };
    dice: { count: number; date: string };
    crash: { count: number; date: string };
    wheel: { count: number; date: string };
    laser: { count: number; date: string };
}

export interface DemoLimitState {
    canPlay: (game: GameType) => boolean;
    getRemainingPlays: (game: GameType) => number;
    recordPlay: (game: GameType) => boolean;
    isLimitReached: (game: GameType) => boolean;
}

function getToday(): string {
    return new Date().toISOString().split('T')[0];
}

function getDefaultLimits(): DemoLimits {
    return {
        tower: { count: 0, date: getToday() },
        dice: { count: 0, date: getToday() },
        crash: { count: 0, date: getToday() },
        wheel: { count: 0, date: getToday() },
        laser: { count: 0, date: getToday() },
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

        const updated: DemoLimits = {
            tower: parsed.tower?.date === today ? parsed.tower : { count: 0, date: today },
            dice: parsed.dice?.date === today ? parsed.dice : { count: 0, date: today },
            crash: parsed.crash?.date === today ? parsed.crash : { count: 0, date: today },
            wheel: parsed.wheel?.date === today ? parsed.wheel : { count: 0, date: today },
            laser: parsed.laser?.date === today ? parsed.laser : { count: 0, date: today },
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
    const [limits, setLimits] = useState<DemoLimits>(loadLimits);

    const canPlay = useCallback((game: GameType): boolean => {
        const gameLimit = limits?.[game];
        if (!gameLimit?.date) return true; // If no data, allow play

        const today = getToday();

        if (gameLimit.date !== today) {
            return true;
        }

        return (gameLimit.count || 0) < MAX_PLAYS_PER_DAY;
    }, [limits]);

    const getRemainingPlays = useCallback((game: GameType): number => {
        const gameLimit = limits?.[game];
        if (!gameLimit?.date) return MAX_PLAYS_PER_DAY; // If no data, all plays available

        const today = getToday();

        if (gameLimit.date !== today) {
            return MAX_PLAYS_PER_DAY;
        }

        return Math.max(0, MAX_PLAYS_PER_DAY - (gameLimit.count || 0));
    }, [limits]);

    const isLimitReached = useCallback((game: GameType): boolean => {
        return !canPlay(game);
    }, [canPlay]);

    const recordPlay = useCallback((game: GameType): boolean => {
        const today = getToday();
        const currentLimit = limits?.[game] || { count: 0, date: today };

        const newCount = currentLimit.date === today ? (currentLimit.count || 0) + 1 : 1;

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
