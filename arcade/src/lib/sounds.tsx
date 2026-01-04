'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { SOUNDS } from './constants';

interface SoundContextType {
    soundEnabled: boolean;
    soundsReady: boolean;
    volume: number;
    toggleSound: () => void;
    setVolume: (volume: number) => void;
    playSound: (sound: keyof typeof SOUNDS, options?: PlaySoundOptions) => void;
    stopSound: (sound: keyof typeof SOUNDS) => void;
    stopAllSounds: () => void;
}

interface PlaySoundOptions {
    /** Auto-stop after this many milliseconds */
    duration?: number;
    /** Loop the sound (default: false) */
    loop?: boolean;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export function SoundProvider({ children }: { children: React.ReactNode }) {
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [soundsReady, setSoundsReady] = useState(false);
    const [volume, setVolumeState] = useState(0.5);
    const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
    const loadedSounds = useRef<Set<string>>(new Set());
    const stopTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // Initialize audio elements with proper error handling
    useEffect(() => {
        if (typeof window !== 'undefined') {
            let mounted = true;
            const loadPromises: Promise<void>[] = [];

            Object.entries(SOUNDS).forEach(([key, src]) => {
                const audio = new Audio();

                const loadPromise = new Promise<void>((resolve) => {
                    audio.addEventListener('canplaythrough', () => {
                        if (mounted) {
                            loadedSounds.current.add(key);
                        }
                        resolve();
                    }, { once: true });

                    audio.addEventListener('error', () => {
                        // Sound file not found - this is OK, we'll just skip it
                        console.warn(`Sound file not found: ${src} - sounds will be disabled for this effect`);
                        resolve();
                    }, { once: true });
                });

                audio.preload = 'auto';
                audio.src = src;
                audio.volume = volume;
                audioRefs.current.set(key, audio);
                loadPromises.push(loadPromise);
            });

            // Wait for all sounds to attempt loading
            Promise.all(loadPromises).then(() => {
                if (mounted) {
                    setSoundsReady(true);
                }
            });

            return () => {
                mounted = false;
                // Copy refs to local variables before cleanup
                const audioMap = audioRefs.current;
                const loadedSet = loadedSounds.current;
                const timers = stopTimers.current;
                audioMap.forEach(audio => {
                    audio.pause();
                    audio.src = '';
                });
                audioMap.clear();
                loadedSet.clear();
                timers.forEach(timer => clearTimeout(timer));
                timers.clear();
            };
        }
    }, []);

    // Update volume for all audio elements
    useEffect(() => {
        audioRefs.current.forEach(audio => {
            audio.volume = volume;
        });
    }, [volume]);

    const toggleSound = useCallback(() => {
        setSoundEnabled(prev => !prev);
    }, []);

    const setVolume = useCallback((newVolume: number) => {
        setVolumeState(Math.max(0, Math.min(1, newVolume)));
    }, []);

    // Stop a specific sound
    const stopSound = useCallback((sound: keyof typeof SOUNDS) => {
        const audio = audioRefs.current.get(sound);
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.loop = false;
        }
        // Clear any auto-stop timer
        const timer = stopTimers.current.get(sound);
        if (timer) {
            clearTimeout(timer);
            stopTimers.current.delete(sound);
        }
    }, []);

    // Stop all playing sounds
    const stopAllSounds = useCallback(() => {
        audioRefs.current.forEach((audio, key) => {
            audio.pause();
            audio.currentTime = 0;
            audio.loop = false;
        });
        // Clear all timers
        stopTimers.current.forEach(timer => clearTimeout(timer));
        stopTimers.current.clear();
    }, []);

    // Play a sound with optional auto-stop
    const playSound = useCallback((sound: keyof typeof SOUNDS, options?: PlaySoundOptions) => {
        if (!soundEnabled) return;

        // Only play if the sound was successfully loaded
        if (!loadedSounds.current.has(sound)) return;

        const audio = audioRefs.current.get(sound);
        if (audio) {
            // Clear any existing timer for this sound
            const existingTimer = stopTimers.current.get(sound);
            if (existingTimer) {
                clearTimeout(existingTimer);
                stopTimers.current.delete(sound);
            }

            // Set loop option
            audio.loop = options?.loop ?? false;

            // Reset and play
            audio.currentTime = 0;
            audio.play().catch(() => {
                // Ignore autoplay errors (browser policy)
            });

            // Set auto-stop timer if duration specified
            if (options?.duration) {
                const timer = setTimeout(() => {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.loop = false;
                    stopTimers.current.delete(sound);
                }, options.duration);
                stopTimers.current.set(sound, timer);
            }
        }
    }, [soundEnabled]);

    return (
        <SoundContext.Provider value={{
            soundEnabled,
            soundsReady,
            volume,
            toggleSound,
            setVolume,
            playSound,
            stopSound,
            stopAllSounds
        }}>
            {children}
        </SoundContext.Provider>
    );
}

export function useSound() {
    const context = useContext(SoundContext);
    if (!context) {
        throw new Error('useSound must be used within a SoundProvider');
    }
    return context;
}
