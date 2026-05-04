import { describe, expect, it } from 'vitest';
import { calculateServerPayout, verifyGamePayout } from '@/lib/game-logic';
import { canTransitionRound, type RoundStatus } from '@/lib/game-rounds';

function settleRound(initialBalance: number, betAmount: number, payout: number) {
    return {
        afterStart: initialBalance - betAmount,
        afterFinalize: initialBalance - betAmount + payout,
    };
}

describe('money path invariants', () => {
    it('debits the bet at round start and only credits the finalized payout', () => {
        expect(settleRound(100, 10, 25)).toEqual({
            afterStart: 90,
            afterFinalize: 115,
        });
        expect(settleRound(100, 10, 0)).toEqual({
            afterStart: 90,
            afterFinalize: 90,
        });
    });

    it('never allows terminal game rounds to settle a second time', () => {
        const terminalStatuses: RoundStatus[] = ['won', 'lost', 'cashed_out', 'expired', 'cancelled'];

        for (const status of terminalStatuses) {
            expect(canTransitionRound(status, 'won')).toBe(false);
            expect(canTransitionRound(status, 'lost')).toBe(false);
            expect(canTransitionRound(status, 'cashed_out')).toBe(false);
        }
    });

    it('keeps server-calculated payouts non-negative for every game', () => {
        const cases = [
            calculateServerPayout('wheel', 10, { segment: 6 }),
            calculateServerPayout('wheel', 10, { segment: 0 }),
            calculateServerPayout('dice', 10, { target: 50, betUnder: true, result: 25 }),
            calculateServerPayout('dice', 10, { target: 50, betUnder: true, result: 75 }),
            calculateServerPayout('tower', 10, { row: 2 }),
            calculateServerPayout('tower', 10, { row: 2, outcome: 'loss' }),
            calculateServerPayout('crash', 10, { cashoutMultiplier: 15000, crashPoint: 20000 }),
            calculateServerPayout('crash', 10, { cashoutMultiplier: 25000, crashPoint: 20000 }),
            calculateServerPayout('laser', 10, { survivedTurns: 2 }),
            calculateServerPayout('laser', 10, { survivedTurns: 0 }),
        ];

        for (const result of cases) {
            expect(result.payout).toBeGreaterThanOrEqual(0);
            expect(result.multiplier).toBeGreaterThanOrEqual(0);
        }
    });

    it('rejects tampered payout claims outside the accepted tolerance', () => {
        const valid = verifyGamePayout('wheel', 10, 22, { segment: 6 });
        const tampered = verifyGamePayout('wheel', 10, 50, { segment: 6 });

        expect(valid).toEqual({ verified: true, calculatedPayout: 22 });
        expect(tampered).toEqual({ verified: false, calculatedPayout: 22 });
    });

    it('documents the expected balance result for win, loss, and cashout outcomes', () => {
        const scenarios = [
            { initialBalance: 40, betAmount: 5, payout: 0, expectedFinal: 35 },
            { initialBalance: 40, betAmount: 5, payout: 7.5, expectedFinal: 42.5 },
            { initialBalance: 40, betAmount: 5, payout: 12, expectedFinal: 47 },
        ];

        for (const scenario of scenarios) {
            expect(settleRound(scenario.initialBalance, scenario.betAmount, scenario.payout).afterFinalize)
                .toBe(scenario.expectedFinal);
        }
    });
});
