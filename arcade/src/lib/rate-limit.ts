import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';

export const rateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '60 s'),
    analytics: false,
    prefix: 'arcade:ratelimit',
});

export async function checkRateLimit(identifier: string): Promise<{
    success: boolean;
    remaining: number;
    reset: number;
}> {
    try {
        const { success, remaining, reset } = await rateLimiter.limit(identifier);
        return { success, remaining, reset };
    } catch (error) {
        // If Redis fails (quota exceeded, connection issues, etc.), allow the request
        // This prevents the entire app from breaking when Redis is unavailable
        console.warn('[Rate Limit] Redis unavailable, allowing request:', error instanceof Error ? error.message : 'Unknown error');
        return { success: true, remaining: 1, reset: Date.now() + 60000 };
    }
}

export function getClientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    return forwarded?.split(',')[0]?.trim() || 'unknown';
}
