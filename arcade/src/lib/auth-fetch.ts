'use client';

type AuthFetchOptions = RequestInit & {
    timeoutMs?: number;
};

const DEFAULT_AUTH_FETCH_TIMEOUT_MS = 15_000;

export function getAuthHeaders(): HeadersInit {
    return {
        'Content-Type': 'application/json',
    };
}

export async function authFetch(url: string, options: AuthFetchOptions = {}): Promise<Response> {
    const { timeoutMs = DEFAULT_AUTH_FETCH_TIMEOUT_MS, signal, ...fetchOptions } = options;
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const abortRequest = () => controller.abort();
    if (signal) {
        if (signal.aborted) {
            controller.abort();
        } else {
            signal.addEventListener('abort', abortRequest, { once: true });
        }
    }

    if (timeoutMs > 0) {
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
        return await fetch(url, {
            ...fetchOptions,
            credentials: 'same-origin',
            headers,
            signal: controller.signal,
        });
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        signal?.removeEventListener('abort', abortRequest);
    }
}

export async function readResponseError(response: Response, fallback: string): Promise<string> {
    try {
        const data = await response.json();
        return typeof data?.error === 'string' ? data.error : fallback;
    } catch {
        return fallback;
    }
}

export function getRequestErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
        if (error.name === 'AbortError') {
            return 'Request timed out. Please try again.';
        }
        return error.message || fallback;
    }

    return fallback;
}
