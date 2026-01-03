'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { getSupabaseClient, User } from './supabase';

interface UseUserReturn {
    user: User | null;
    isLoading: boolean;
    isRegistered: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    registerUsername: (username: string) => Promise<{ success: boolean; error?: string }>;
    updateUsername: (username: string) => Promise<{ success: boolean; error?: string }>;
}

export function useUser(): UseUserReturn {
    const { primaryWallet } = useDynamicContext();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const walletAddress = primaryWallet?.address?.toLowerCase();

    // Fetch user from Supabase
    const fetchUser = useCallback(async () => {
        if (!walletAddress) {
            setUser(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/users?wallet=${walletAddress}`);
            const data = await response.json();

            if (response.ok && data.user) {
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch (err) {
            console.error('Failed to fetch user:', err);
            setError('Failed to fetch user data');
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, [walletAddress]);

    // Fetch user on wallet change
    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    // Register a new username
    const registerUsername = useCallback(async (username: string): Promise<{ success: boolean; error?: string }> => {
        if (!walletAddress) {
            return { success: false, error: 'Wallet not connected' };
        }

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: walletAddress, username }),
            });

            const data = await response.json();

            if (response.ok) {
                await fetchUser(); // Refresh user data
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Registration failed' };
            }
        } catch (err) {
            console.error('Registration error:', err);
            return { success: false, error: 'Network error' };
        }
    }, [walletAddress, fetchUser]);

    // Update username (if changes remaining)
    const updateUsername = useCallback(async (username: string): Promise<{ success: boolean; error?: string }> => {
        if (!walletAddress) {
            return { success: false, error: 'Wallet not connected' };
        }

        if (!user || user.username_changes_remaining <= 0) {
            return { success: false, error: 'No username changes remaining' };
        }

        try {
            const response = await fetch('/api/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: walletAddress, username }),
            });

            const data = await response.json();

            if (response.ok) {
                await fetchUser(); // Refresh user data
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Update failed' };
            }
        } catch (err) {
            console.error('Update error:', err);
            return { success: false, error: 'Network error' };
        }
    }, [walletAddress, user, fetchUser]);

    return {
        user,
        isLoading,
        isRegistered: !!user,
        error,
        refetch: fetchUser,
        registerUsername,
        updateUsername,
    };
}

// Hook to check username availability in real-time
export function useUsernameCheck() {
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);

    const checkUsername = useCallback(async (username: string) => {
        // Validate format first
        if (!username || username.length < 3) {
            setIsAvailable(null);
            setError('Username must be at least 3 characters');
            return;
        }

        if (username.length > 16) {
            setIsAvailable(null);
            setError('Username must be 16 characters or less');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setIsAvailable(null);
            setError('Only letters, numbers, and underscores allowed');
            return;
        }

        setIsChecking(true);
        setError(null);

        try {
            const response = await fetch(`/api/users/check?username=${encodeURIComponent(username)}`);
            const data = await response.json();

            if (response.ok) {
                setIsAvailable(data.available);
                if (!data.available) {
                    setError('Username already taken');
                }
            } else {
                setError(data.error || 'Failed to check username');
                setIsAvailable(null);
            }
        } catch (err) {
            console.error('Username check error:', err);
            setError('Network error');
            setIsAvailable(null);
        } finally {
            setIsChecking(false);
        }
    }, []);

    const reset = useCallback(() => {
        setIsAvailable(null);
        setError(null);
        setIsChecking(false);
    }, []);

    return { isChecking, isAvailable, error, checkUsername, reset };
}
