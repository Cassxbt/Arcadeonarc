'use client';

import { useEffect } from 'react';
import { X, Target, SlidersHorizontal, Dices, ShieldCheck, HelpCircle, TrendingUp, MousePointer, Award } from 'lucide-react';
import styles from './GameInfoPanel.module.css';

interface GameRule {
    icon: React.ReactNode;
    title: string;
    content: React.ReactNode;
    isFairness?: boolean;
}

interface GameInfoPanelProps {
    isOpen: boolean;
    onClose: () => void;
    gameName: string;
    rules: GameRule[];
}

export function GameInfoPanel({ isOpen, onClose, gameName, rules }: GameInfoPanelProps) {
    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ''}`}
                onClick={onClose}
            />

            {/* Panel */}
            <div className={`${styles.panel} ${isOpen ? styles.panelVisible : ''}`}>
                <div className={styles.panelHeader}>
                    <h2 className={styles.panelTitle}>How to Play {gameName}</h2>
                    <button
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label="Close panel"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.panelContent}>
                    {rules.map((rule, index) => (
                        <div
                            key={index}
                            className={`${styles.ruleCard} ${rule.isFairness ? styles.fairnessCard : ''}`}
                        >
                            <div className={styles.ruleIcon}>
                                {rule.icon}
                                <h3 className={styles.ruleTitle}>{rule.title}</h3>
                            </div>
                            <p className={styles.ruleText}>{rule.content}</p>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

// Info button component to trigger the panel
interface InfoButtonProps {
    onClick: () => void;
}

export function InfoButton({ onClick }: InfoButtonProps) {
    return (
        <button
            className={styles.infoButton}
            onClick={onClick}
            aria-label="How to play"
            title="How to play"
        >
            <HelpCircle size={18} />
        </button>
    );
}

// Pre-configured rules for Dice game
export const DICE_GAME_RULES: GameRule[] = [
    {
        icon: <Target size={20} style={{ color: 'var(--neon-cyan)' }} />,
        title: 'Objective',
        content: 'Predict whether the next roll will be Under or Over your target number. Lower your win chance to increase your potential multiplier.',
    },
    {
        icon: <SlidersHorizontal size={20} style={{ color: 'var(--neon-yellow)' }} />,
        title: 'Target & Chance',
        content: 'Adjust the slider to set your target number. Your win chance and multiplier adjust automatically based on your selection.',
    },
    {
        icon: <Dices size={20} style={{ color: 'var(--neon-pink)' }} />,
        title: 'Roll Type',
        content: (
            <>
                <strong>Roll Under:</strong> Win if the result is lower than your target.
                <br />
                <strong>Roll Over:</strong> Win if the result is higher than your target.
            </>
        ),
    },
    {
        icon: <ShieldCheck size={20} style={{ color: 'var(--neon-green)' }} />,
        title: 'Fairness',
        content: 'The dice roll is generated using a provably fair system on the Arc testnet. Every result is mathematically verifiable.',
        isFairness: true,
    },
];

// Pre-configured rules for Tower game
export const TOWER_GAME_RULES: GameRule[] = [
    {
        icon: <Target size={20} style={{ color: 'var(--neon-cyan)' }} />,
        title: 'Objective',
        content: 'Climb the tower by choosing safe tiles. Each floor you climb increases your multiplier. Cash out anytime or risk it all!',
    },
    {
        icon: <MousePointer size={20} style={{ color: 'var(--neon-yellow)' }} />,
        title: 'Gameplay',
        content: 'Each row has multiple tiles - one is a trap (skull). Pick wisely! The fewer tiles in a row, the higher the risk and reward.',
    },
    {
        icon: <TrendingUp size={20} style={{ color: 'var(--neon-pink)' }} />,
        title: 'Multipliers',
        content: 'Your multiplier grows with each successful pick. Higher floors have fewer tiles, meaning bigger multipliers but higher risk.',
    },
    {
        icon: <Award size={20} style={{ color: 'var(--neon-orange)' }} />,
        title: 'Cash Out',
        content: 'Hit "Cash Out" anytime after your first pick to secure your winnings. Get greedy and hit a trap? You lose everything!',
    },
    {
        icon: <ShieldCheck size={20} style={{ color: 'var(--neon-green)' }} />,
        title: 'Fairness',
        content: 'Trap positions are determined before each game using a provably fair algorithm on the Arc testnet.',
        isFairness: true,
    },
];
