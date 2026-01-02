'use client';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useGame } from '@/lib/game-context';
import { Lock, Play, Sparkles, Wallet } from './icons';
import styles from './GameModeSelector.module.css';

interface GameModeSelectorProps {
    gameName: string;
    gameIcon: React.ReactNode;
    onDemoSelect: () => void;
}

export function GameModeSelector({ gameName, gameIcon, onDemoSelect }: GameModeSelectorProps) {
    const { setShowAuthFlow } = useDynamicContext();
    const { getRemainingDemoPlays, isDemoLimitReached } = useGame();

    const gameId = gameName.toLowerCase() as 'tower' | 'dice' | 'crash';
    const remainingPlays = getRemainingDemoPlays(gameId);
    const limitReached = isDemoLimitReached(gameId);

    const handleSignIn = () => {
        setShowAuthFlow?.(true);
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.container}>
                <div className={styles.gameIcon}>
                    {gameIcon}
                </div>
                <h1 className={styles.title}>{gameName}</h1>
                <p className={styles.subtitle}>Choose how you want to play</p>

                <div className={styles.options}>
                    {/* Sign In Option */}
                    <button onClick={handleSignIn} className={styles.signInOption}>
                        <div className={styles.optionIcon}>
                            <Wallet size={32} style={{ color: 'var(--neon-green)' }} />
                        </div>
                        <div className={styles.optionContent}>
                            <h3>Sign In</h3>
                            <p>Play with real USDC</p>
                        </div>
                        <div className={styles.optionBadge}>
                            <Sparkles size={14} style={{ marginRight: '0.25rem' }} />
                            Real Wins
                        </div>
                    </button>

                    {/* Demo Option */}
                    <button
                        onClick={onDemoSelect}
                        disabled={limitReached}
                        className={`${styles.demoOption} ${limitReached ? styles.demoDisabled : ''}`}
                    >
                        <div className={styles.optionIcon}>
                            {limitReached ? (
                                <Lock size={32} style={{ color: 'var(--neon-pink)' }} />
                            ) : (
                                <Play size={32} style={{ color: 'var(--neon-cyan)' }} />
                            )}
                        </div>
                        <div className={styles.optionContent}>
                            <h3>Demo Mode</h3>
                            {limitReached ? (
                                <p className={styles.limitReached}>Daily limit reached</p>
                            ) : (
                                <p>{remainingPlays} plays remaining today</p>
                            )}
                        </div>
                        {!limitReached && (
                            <div className={styles.demoPlays}>
                                {remainingPlays}/5
                            </div>
                        )}
                    </button>
                </div>

                <p className={styles.footer}>
                    Demo uses virtual balance • Real play requires USDC deposit
                </p>
            </div>
        </div>
    );
}
