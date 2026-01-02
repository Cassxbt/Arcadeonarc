'use client';

import { Lock, Sparkles } from './icons';
import styles from './DemoLimitOverlay.module.css';

interface DemoLimitOverlayProps {
    gameName: string;
    onSignIn?: () => void;
}

export function DemoLimitOverlay({ gameName, onSignIn }: DemoLimitOverlayProps) {
    return (
        <div className={styles.overlay}>
            <div className={styles.content}>
                <div className={styles.icon}>
                    <Lock size={48} style={{ color: 'var(--neon-pink)' }} />
                </div>
                <h2 className={styles.title}>Demo Limit Reached</h2>
                <p className={styles.message}>
                    You've used all 5 demo plays for {gameName} today.
                </p>
                <p className={styles.hint}>
                    <Sparkles size={16} style={{ color: 'var(--neon-yellow)', marginRight: '0.5rem' }} />
                    Sign in to continue playing with real USDC!
                </p>
                <div className={styles.actions}>
                    <button
                        onClick={onSignIn}
                        className={styles.signInBtn}
                    >
                        Sign In to Play
                    </button>
                </div>
                <p className={styles.resetNote}>
                    Demo plays reset at midnight
                </p>
            </div>
        </div>
    );
}
