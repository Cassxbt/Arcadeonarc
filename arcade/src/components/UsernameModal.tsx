'use client';

import { useState, useEffect } from 'react';
import { useUser, useUsernameCheck } from '@/lib/useUser';
import { useSound } from '@/lib/sounds';
import { Gamepad2, Gift, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import styles from './UsernameModal.module.css';

interface UsernameModalProps {
    isOpen: boolean;
    onComplete: () => void;
}

export function UsernameModal({ isOpen, onComplete }: UsernameModalProps) {
    const [username, setUsername] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const { registerUsername } = useUser();
    const { isChecking, isAvailable, error: checkError, checkUsername, reset } = useUsernameCheck();
    const { playSound } = useSound();

    // Debounced username check
    useEffect(() => {
        if (!username) {
            reset();
            return;
        }

        const timer = setTimeout(() => {
            checkUsername(username);
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [username, checkUsername, reset]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isAvailable || isChecking) return;

        setIsSubmitting(true);
        setSubmitError(null);

        const result = await registerUsername(username);

        if (result.success) {
            playSound('CHIME');
            onComplete();
        } else {
            setSubmitError(result.error || 'Registration failed');
        }

        setIsSubmitting(false);
    };

    const getInputClass = () => {
        if (!username) return styles.input;
        if (isChecking) return styles.input;
        if (isAvailable) return `${styles.input} ${styles.inputValid}`;
        return `${styles.input} ${styles.inputInvalid}`;
    };

    const getStatusIcon = () => {
        if (!username || username.length < 3) return null;
        if (isChecking) return <Loader2 className={styles.spin} size={18} style={{ color: 'var(--neon-cyan)', animation: 'spin 1s linear infinite' }} />;
        if (isAvailable) return <CheckCircle size={18} style={{ color: 'var(--neon-green)' }} />;
        if (checkError) return <XCircle size={18} style={{ color: 'var(--neon-pink)' }} />;
        return null;
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <header className={styles.header}>
                    <span className={styles.icon}>
                        <Gamepad2 size={32} style={{ color: 'var(--neon-pink)' }} />
                    </span>
                    <h2 className={styles.title}>Choose Your Name</h2>
                    <p className={styles.subtitle}>Create your ARCade identity</p>
                </header>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                            placeholder="Enter username..."
                            className={getInputClass()}
                            maxLength={16}
                            autoFocus
                            autoComplete="off"
                        />
                        <span className={styles.statusIcon}>
                            {getStatusIcon()}
                        </span>
                    </div>

                    {username.length > 0 && username.length < 3 && (
                        <p className={styles.hint}>At least 3 characters needed</p>
                    )}

                    {checkError && (
                        <p className={styles.error}>{checkError}</p>
                    )}

                    {isAvailable && username.length >= 3 && (
                        <p className={styles.success}><CheckCircle size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle', color: 'var(--neon-green)' }} /> Username available!</p>
                    )}

                    {submitError && (
                        <p className={styles.error}>{submitError}</p>
                    )}

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={!isAvailable || isChecking || isSubmitting}
                    >
                        {isSubmitting ? 'Creating...' : 'Create Username'}
                    </button>
                </form>

                <div className={styles.rules}>
                    <p className={styles.rulesTitle}>Username Rules</p>
                    <ul className={styles.rulesList}>
                        <li>3-16 characters</li>
                        <li>Letters, numbers, and underscores only</li>
                        <li>You get 1 free change later</li>
                    </ul>
                </div>

                <div className={styles.bonusNote}>
                    <p className={styles.bonusText}>
                        <span className={styles.bonusIcon}>
                            <Gift size={20} style={{ color: 'var(--neon-yellow)' }} />
                        </span>
                        Register now and start earning points!
                    </p>
                </div>
            </div>
        </div>
    );
}
