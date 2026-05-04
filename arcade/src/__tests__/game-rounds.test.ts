import { describe, expect, it } from 'vitest';
import {
    buildRoundExpiry,
    canTransitionRound,
    createRoundNonce,
    isActiveRound,
    isGameType,
    isTerminalRoundStatus,
    nextRoundVersion,
    normalizeWalletAddress,
} from '@/lib/game-rounds';

describe('game round helpers', () => {
    it('recognizes supported game types', () => {
        expect(isGameType('dice')).toBe(true);
        expect(isGameType('wheel')).toBe(true);
        expect(isGameType('tower')).toBe(true);
        expect(isGameType('crash')).toBe(true);
        expect(isGameType('laser')).toBe(true);
        expect(isGameType('roulette')).toBe(false);
    });

    it('normalizes valid wallet addresses and rejects invalid ones', () => {
        expect(normalizeWalletAddress('0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD')).toBe(
            '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
        );
        expect(() => normalizeWalletAddress('demo')).toThrow('Invalid wallet address');
    });

    it('creates unique nonce values', () => {
        const first = createRoundNonce();
        const second = createRoundNonce();

        expect(first).not.toBe(second);
        expect(first.length).toBeGreaterThan(16);
    });

    it('builds future expiry timestamps', () => {
        const now = new Date('2026-05-01T12:00:00.000Z');
        const expiresAt = buildRoundExpiry(30_000, now);

        expect(expiresAt).toBe('2026-05-01T12:00:30.000Z');
    });

    it('identifies active and terminal round states', () => {
        expect(isTerminalRoundStatus('active')).toBe(false);
        expect(isTerminalRoundStatus('won')).toBe(true);
        expect(isTerminalRoundStatus('lost')).toBe(true);
        expect(isTerminalRoundStatus('cashed_out')).toBe(true);
        expect(isTerminalRoundStatus('expired')).toBe(true);
        expect(isTerminalRoundStatus('cancelled')).toBe(true);
    });

    it('only treats non-expired active rounds as active', () => {
        const now = new Date('2026-05-01T12:00:00.000Z');

        expect(isActiveRound({ status: 'active', expires_at: '2026-05-01T12:00:01.000Z' }, now)).toBe(true);
        expect(isActiveRound({ status: 'active', expires_at: '2026-05-01T12:00:00.000Z' }, now)).toBe(false);
        expect(isActiveRound({ status: 'won', expires_at: '2026-05-01T12:00:01.000Z' }, now)).toBe(false);
    });

    it('allows active rounds to finalize once and blocks terminal transitions', () => {
        expect(canTransitionRound('active', 'won')).toBe(true);
        expect(canTransitionRound('active', 'lost')).toBe(true);
        expect(canTransitionRound('active', 'cashed_out')).toBe(true);
        expect(canTransitionRound('active', 'expired')).toBe(true);
        expect(canTransitionRound('active', 'cancelled')).toBe(true);
        expect(canTransitionRound('won', 'lost')).toBe(false);
        expect(canTransitionRound('lost', 'won')).toBe(false);
    });

    it('increments round versions monotonically', () => {
        expect(nextRoundVersion(1)).toBe(2);
        expect(nextRoundVersion(41)).toBe(42);
    });
});
