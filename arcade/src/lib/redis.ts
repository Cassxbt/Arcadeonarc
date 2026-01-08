/**
 * Upstash Redis client for distributed state and rate limiting
 * Used for game state persistence across serverless instances
 */
import { Redis } from '@upstash/redis';

// Create Redis client using Vercel KV environment variables
export const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Game state TTL (5 minutes - games should complete within this)
export const GAME_STATE_TTL = 300;
