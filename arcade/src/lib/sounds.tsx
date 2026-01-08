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
                        console.warn(`Sound file not found: ${src}`);
                        resolve();
                    }, { once: true });
                });

                audio.preload = 'auto';
                audio.src = src;
                audio.volume = volume;
                audioRefs.current.set(key, audio);
                loadPromises.push(loadPromise);
            });

            Promise.all(loadPromises).then(() => {
                if (mounted) {
                    setSoundsReady(true);
                }
            });

            return () => {
                mounted = false;
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

    // Mobile audio unlock - iOS/Safari blocks audio until user interaction
    // This unlocks the audio context on first touch/click
    const audioUnlocked = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined' || audioUnlocked.current) return;

        const unlockAudio = () => {
            if (audioUnlocked.current) return;

            // Try to play and immediately pause each audio element
            // This "unlocks" them for future playback on iOS
            audioRefs.current.forEach(audio => {
                const playPromise = audio.play();
                if (playPromise) {
                    playPromise
                        .then(() => {
                            audio.pause();
                            audio.currentTime = 0;
                        })
                        .catch(() => {
                            // Still locked, will try again on next interaction
                        });
                }
            });

            audioUnlocked.current = true;

            // Also create and resume AudioContext if available (for Web Audio API)
            try {
                const AudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
                if (AudioContext) {
                    const ctx = new AudioContext();
                    if (ctx.state === 'suspended') {
                        ctx.resume();
                    }
                }
            } catch {
                // AudioContext not supported
            }

            // Remove listeners after unlock
            document.removeEventListener('touchstart', unlockAudio);
            document.removeEventListener('touchend', unlockAudio);
            document.removeEventListener('click', unlockAudio);
        };

        // Listen for first user interaction
        document.addEventListener('touchstart', unlockAudio, { passive: true });
        document.addEventListener('touchend', unlockAudio, { passive: true });
        document.addEventListener('click', unlockAudio, { passive: true });

        return () => {
            document.removeEventListener('touchstart', unlockAudio);
            document.removeEventListener('touchend', unlockAudio);
            document.removeEventListener('click', unlockAudio);
        };
    }, [soundsReady]);

    useEffect(() => {
        audioRefs.current.forEach(audio => {
            audio.volume = volume;
        });
    }, [volume]);

    useEffect(() => {
        if (!soundEnabled) {
            audioRefs.current.forEach((audio) => {
                audio.pause();
                audio.currentTime = 0;
                audio.loop = false;
            });
            stopTimers.current.forEach(timer => clearTimeout(timer));
            stopTimers.current.clear();
        }
    }, [soundEnabled]);

    const toggleSound = useCallback(() => {
        setSoundEnabled(prev => !prev);
    }, []);

    const setVolume = useCallback((newVolume: number) => {
        setVolumeState(Math.max(0, Math.min(1, newVolume)));
    }, []);

    const stopSound = useCallback((sound: keyof typeof SOUNDS) => {
        const audio = audioRefs.current.get(sound);
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.loop = false;
        }
        const timer = stopTimers.current.get(sound);
        if (timer) {
            clearTimeout(timer);
            stopTimers.current.delete(sound);
        }
    }, []);

    const stopAllSounds = useCallback(() => {
        audioRefs.current.forEach((audio, key) => {
            audio.pause();
            audio.currentTime = 0;
            audio.loop = false;
        });
        stopTimers.current.forEach(timer => clearTimeout(timer));
        stopTimers.current.clear();
    }, []);

    const playSound = useCallback((sound: keyof typeof SOUNDS, options?: PlaySoundOptions) => {
        if (!soundEnabled) return;

        if (!loadedSounds.current.has(sound)) return;

        const audio = audioRefs.current.get(sound);
        if (audio) {
            const existingTimer = stopTimers.current.get(sound);
            if (existingTimer) {
                clearTimeout(existingTimer);
                stopTimers.current.delete(sound);
            }

            audio.loop = options?.loop ?? false;
            audio.currentTime = 0;
            audio.play().catch(() => {
                // Ignore autoplay errors (browser policy)
            });

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
