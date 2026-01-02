'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    TowerControl,
    Dice6,
    Bomb,
} from './icons';
import styles from './GameSelector.module.css';

interface Game {
    id: string;
    name: string;
    icon: React.ReactNode;
    color: string;
    path: string;
}

const games: Game[] = [
    {
        id: 'tower',
        name: 'Tower',
        icon: <TowerControl size={48} />,
        color: 'var(--neon-cyan)',
        path: '/games/tower',
    },
    {
        id: 'dice',
        name: 'Dice',
        icon: <Dice6 size={48} />,
        color: 'var(--neon-green)',
        path: '/games/dice',
    },
    {
        id: 'crash',
        name: 'Cannon',
        icon: <Bomb size={48} />,
        color: 'var(--neon-pink)',
        path: '/games/crash',
    },
];

interface GameSelectorProps {
    onClose: () => void;
}

export function GameSelector({ onClose }: GameSelectorProps) {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedGame, setSelectedGame] = useState<Game | null>(null);
    const [showMessage, setShowMessage] = useState(false);
    const [phase, setPhase] = useState<'spinning' | 'slowing' | 'done'>('spinning');

    // Use refs to avoid dependency issues
    const iterationRef = useRef(0);
    const targetIndexRef = useRef(Math.floor(Math.random() * games.length));
    const hasStartedRef = useRef(false);

    useEffect(() => {
        // Prevent double execution in StrictMode
        if (hasStartedRef.current) return;
        hasStartedRef.current = true;

        const targetIndex = targetIndexRef.current;
        const totalSpins = 20 + Math.floor(Math.random() * 10); // 20-30 total spins

        // Phase 1: Fast spinning (first 15 spins at 80ms each)
        const fastSpinCount = 15;
        // Phase 2: Slowing down (remaining spins with increasing delay)

        let currentIteration = 0;
        let currentIdx = 0;

        const runAnimation = () => {
            currentIteration++;
            currentIdx = (currentIdx + 1) % games.length;
            setCurrentIndex(currentIdx);

            if (currentIteration >= totalSpins) {
                // Animation complete - land on target
                setCurrentIndex(targetIndex);
                setSelectedGame(games[targetIndex]);
                setPhase('done');

                // Show message after a brief pause
                setTimeout(() => {
                    setShowMessage(true);
                }, 400);

                // Navigate after message displays
                setTimeout(() => {
                    router.push(games[targetIndex].path);
                    onClose();
                }, 2200);

                return; // Stop animation
            }

            // Calculate delay for next iteration
            let delay: number;
            if (currentIteration < fastSpinCount) {
                // Fast phase
                delay = 80;
            } else {
                // Slowing phase - exponentially increase delay
                const slowProgress = (currentIteration - fastSpinCount) / (totalSpins - fastSpinCount);
                delay = 80 + Math.pow(slowProgress, 1.5) * 400;

                if (currentIteration === fastSpinCount) {
                    setPhase('slowing');
                }
            }

            setTimeout(runAnimation, delay);
        };

        // Start animation after a brief delay
        setTimeout(runAnimation, 100);

    }, []); // Empty dependency array - runs once on mount

    return (
        <div className={styles.overlay}>
            <div className={styles.container}>
                {/* Selector Display */}
                <div className={styles.selectorBox}>
                    <div className={styles.gameCards}>
                        {games.map((game, index) => (
                            <div
                                key={game.id}
                                className={`${styles.gameCard} ${index === currentIndex ? styles.gameCardActive : ''
                                    } ${selectedGame?.id === game.id ? styles.gameCardSelected : ''
                                    }`}
                                style={{ '--game-color': game.color } as React.CSSProperties}
                            >
                                <div
                                    className={styles.iconWrapper}
                                    style={{ color: game.color }}
                                >
                                    {game.icon}
                                </div>
                                <span className={styles.gameName}>{game.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Selecting indicator */}
                {phase !== 'done' && (
                    <div className={styles.selectingText}>
                        <span>Selecting your fate...</span>
                    </div>
                )}

                {/* May the odds favor you message */}
                {showMessage && (
                    <div className={styles.messageOverlay}>
                        <h2 className={styles.message}>MAY THE ODDS FAVOR YOU</h2>
                    </div>
                )}
            </div>
        </div>
    );
}
