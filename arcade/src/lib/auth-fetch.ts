'use client';

import { getAuthToken } from '@dynamic-labs/sdk-react-core';

/**
 * Create headers for authenticated API requests
 * Includes Dynamic JWT in Authorization header
 */
export function getAuthHeaders(): HeadersInit {
    const authToken = getAuthToken();

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    return headers;
}

/**
 * Make an authenticated fetch request
 * Automatically includes Dynamic JWT in Authorization header
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const authToken = getAuthToken();

    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    if (authToken) {
        headers.set('Authorization', `Bearer ${authToken}`);
    }

    return fetch(url, {
        ...options,
        headers,
    });
}
