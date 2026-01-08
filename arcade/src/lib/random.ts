/**
 * Cryptographically secure random number generation
 * Uses Node.js crypto module for unpredictable randomness
 */
import { randomInt, randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure random integer in range [min, max)
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (exclusive)
 */
export function secureRandomInt(min: number, max: number): number {
    return randomInt(min, max);
}

/**
 * Generate a cryptographically secure random float in range [0, 1)
 */
export function secureRandomFloat(): number {
    const bytes = randomBytes(4);
    return bytes.readUInt32BE(0) / 0x100000000;
}

/**
 * Generate a secure server seed for provably fair gaming
 */
export function generateServerSeed(): string {
    return randomBytes(32).toString('hex');
}
