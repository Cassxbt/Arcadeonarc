'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './TypewriterText.module.css';

interface TypewriterTextProps {
    phrases: string[];
    typingSpeed?: number;
    deletingSpeed?: number;
    pauseTime?: number;
    className?: string;
}

export function TypewriterText({
    phrases,
    typingSpeed = 80,
    deletingSpeed = 40,
    pauseTime = 2000,
    className = '',
}: TypewriterTextProps) {
    const [displayText, setDisplayText] = useState('');
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    const currentPhrase = phrases[phraseIndex];

    const handleTyping = useCallback(() => {
        if (isPaused) return;

        if (!isDeleting) {
            // Typing
            if (displayText.length < currentPhrase.length) {
                setDisplayText(currentPhrase.slice(0, displayText.length + 1));
            } else {
                // Finished typing, pause then start deleting
                setIsPaused(true);
                setTimeout(() => {
                    setIsPaused(false);
                    setIsDeleting(true);
                }, pauseTime);
            }
        } else {
            // Deleting
            if (displayText.length > 0) {
                setDisplayText(currentPhrase.slice(0, displayText.length - 1));
            } else {
                // Finished deleting, move to next phrase
                setIsDeleting(false);
                setPhraseIndex((prev) => (prev + 1) % phrases.length);
            }
        }
    }, [displayText, currentPhrase, isDeleting, isPaused, pauseTime, phrases.length]);

    useEffect(() => {
        const speed = isDeleting ? deletingSpeed : typingSpeed;
        const timer = setTimeout(handleTyping, speed);
        return () => clearTimeout(timer);
    }, [handleTyping, isDeleting, deletingSpeed, typingSpeed]);

    return (
        <span className={`${styles.typewriter} ${className}`}>
            {displayText}
            <span className={styles.cursor}>|</span>
        </span>
    );
}
