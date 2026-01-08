import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';

export const rateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '60 s'),
    analytics: true,
    prefix: 'arcade:ratelimit',
});

export async function checkRateLimit(identifier: string): Promise<{
    success: boolean;
    remaining: number;
    reset: number;
}> {
    const { success, remaining, reset } = await rateLimiter.limit(identifier);
    return { success, remaining, reset };
}

export function getClientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    return forwarded?.split(',')[0]?.trim() || 'unknown';
}
