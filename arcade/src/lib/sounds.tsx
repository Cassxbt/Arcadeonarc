'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { SOUNDS } from './constants';

interface SoundContextType {
    soundEnabled: boolean;
    soundsReady: boolean;
    volume: number;
    toggleSound: () => void;
    setVolume: (volume: number) => void;
    playSound: (sound: keyof typeof SOUNDS) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export function SoundProvider({ children }: { children: React.ReactNode }) {
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [soundsReady, setSoundsReady] = useState(false);
    const [volume, setVolumeState] = useState(0.5);
    const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
    const loadedSounds = useRef<Set<string>>(new Set());

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
                audioRefs.current.forEach(audio => {
                    audio.pause();
                    audio.src = '';
                });
                audioRefs.current.clear();
                loadedSounds.current.clear();
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

    const playSound = useCallback((sound: keyof typeof SOUNDS) => {
        if (!soundEnabled) return;

        // Only play if the sound was successfully loaded
        if (!loadedSounds.current.has(sound)) return;

        const audio = audioRefs.current.get(sound);
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => {
                // Ignore autoplay errors (browser policy)
            });
        }
    }, [soundEnabled]);

    return (
        <SoundContext.Provider value={{ soundEnabled, soundsReady, volume, toggleSound, setVolume, playSound }}>
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
