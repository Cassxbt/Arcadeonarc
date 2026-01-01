'use client';

import { useState, useEffect, useCallback } from 'react';
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
    const [isSelecting, setIsSelecting] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedGame, setSelectedGame] = useState<Game | null>(null);
    const [showMessage, setShowMessage] = useState(false);
    const [speed, setSpeed] = useState(50); // milliseconds between changes

    // Slot machine animation
    useEffect(() => {
        if (!isSelecting) return;

        const targetIndex = Math.floor(Math.random() * games.length);
        let iterations = 0;
        const minIterations = 15; // Minimum spins before slowing down
        const maxIterations = minIterations + 10 + Math.floor(Math.random() * 5);

        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % games.length);
            iterations++;

            // Slow down as we approach the end
            if (iterations >= minIterations) {
                const progress = (iterations - minIterations) / (maxIterations - minIterations);
                const newSpeed = 50 + Math.pow(progress, 2) * 400; // Exponential slowdown
                setSpeed(newSpeed);
            }

            // Stop at the random target
            if (iterations >= maxIterations) {
                clearInterval(interval);
                const finalGame = games[targetIndex];
                setCurrentIndex(targetIndex);
                setSelectedGame(finalGame);
                setIsSelecting(false);

                // Show the message
                setTimeout(() => {
                    setShowMessage(true);
                }, 300);

                // Navigate after message fades
                setTimeout(() => {
                    router.push(finalGame.path);
                    onClose();
                }, 2500);
            }
        }, speed);

        return () => clearInterval(interval);
    }, [isSelecting, speed, router, onClose]);

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
                {isSelecting && (
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
