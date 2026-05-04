import { describe, expect, it } from 'vitest';
import { hashChallenge, isExpired } from '@/lib/auth-challenges';

describe('auth challenge helpers', () => {
    it('hashes the same challenge deterministically', async () => {
        const first = await hashChallenge('arcade-auth-test');
        const second = await hashChallenge('arcade-auth-test');

        expect(first).toBe(second);
        expect(first).not.toBe('arcade-auth-test');
    });

    it('detects expired timestamps', () => {
        expect(isExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
        expect(isExpired(new Date(Date.now() + 60_000).toISOString())).toBe(false);
    });
});
