'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from './icons';
import styles from './GameCarousel.module.css';

interface Game {
    id: string;
    name: string;
    icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
    iconColor: string;
    description: string;
    multiplier: string;
    color: string;
}

interface GameCarouselProps {
    games: Game[];
}

export function GameCarousel({ games }: GameCarouselProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const carouselRef = useRef<HTMLDivElement>(null);

    const totalGames = games.length;

    const goToPrev = useCallback(() => {
        setActiveIndex((prev) => (prev - 1 + totalGames) % totalGames);
    }, [totalGames]);

    const goToNext = useCallback(() => {
        setActiveIndex((prev) => (prev + 1) % totalGames);
    }, [totalGames]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') goToPrev();
            if (e.key === 'ArrowRight') goToNext();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToPrev, goToNext]);

    // Touch/drag handlers with direction locking
    const touchDirectionRef = useRef<'horizontal' | 'vertical' | null>(null);
    const startYRef = useRef(0);

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        touchDirectionRef.current = null;
        if ('touches' in e) {
            setStartX(e.touches[0].clientX);
            startYRef.current = e.touches[0].clientY;
        } else {
            setStartX(e.clientX);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = Math.abs(currentX - startX);
        const diffY = Math.abs(currentY - startYRef.current);

        if (!touchDirectionRef.current && (diffX > 10 || diffY > 10)) {
            touchDirectionRef.current = diffX > diffY ? 'horizontal' : 'vertical';
        }

        // If horizontal swipe, prevent page scroll
        if (touchDirectionRef.current === 'horizontal') {
            e.preventDefault();
        }
    };

    const handleDragEnd = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return;
        setIsDragging(false);

        const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
        const diff = startX - clientX;

        // Only change slide if horizontal swipe
        if (touchDirectionRef.current !== 'vertical' && Math.abs(diff) > 50) {
            if (diff > 0) goToNext();
            else goToPrev();
        }

        touchDirectionRef.current = null;
    };

    // Parallax tilt effect on mouse move
    const handleMouseMove = (e: React.MouseEvent, index: number) => {
        if (index !== activeIndex) return;

        const card = e.currentTarget as HTMLElement;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const tiltX = (y - centerY) / centerY * 8;
        const tiltY = (centerX - x) / centerX * 8;

        setTilt({ x: tiltX, y: tiltY });
    };

    const handleMouseLeave = () => {
        setTilt({ x: 0, y: 0 });
    };

    const getCardStyle = (index: number): React.CSSProperties => {
        const diff = index - activeIndex;

        let normalizedDiff = diff;
        if (diff > totalGames / 2) normalizedDiff = diff - totalGames;
        if (diff < -totalGames / 2) normalizedDiff = diff + totalGames;

        const isActive = normalizedDiff === 0;
        const isAdjacent = Math.abs(normalizedDiff) === 1;
        const isHidden = Math.abs(normalizedDiff) > 2;

        if (isHidden) {
            return {
                opacity: 0,
                transform: `translateX(${normalizedDiff * 100}%) scale(0.5)`,
                pointerEvents: 'none',
                zIndex: 0,
            };
        }

        if (isActive) {
            return {
                opacity: 1,
                transform: `translateX(0) translateZ(0) scale(1) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                zIndex: 10,
                filter: 'blur(0)',
            };
        }

        if (isAdjacent) {
            return {
                opacity: 0.6,
                transform: `translateX(${normalizedDiff * 70}%) translateZ(-150px) scale(0.75)`,
                zIndex: 5,
                filter: 'blur(2px)',
            };
        }

        // Far cards
        return {
            opacity: 0.3,
            transform: `translateX(${normalizedDiff * 100}%) translateZ(-250px) scale(0.6)`,
            zIndex: 1,
            filter: 'blur(4px)',
        };
    };

    return (
        <div className={styles.carouselContainer}>
            {/* Navigation Arrows */}
            <button
                onClick={goToPrev}
                className={`${styles.navButton} ${styles.navButtonLeft}`}
                aria-label="Previous game"
            >
                <ChevronLeft size={32} />
            </button>

            {/* Carousel Track */}
            <div
                ref={carouselRef}
                className={styles.carouselTrack}
                onMouseDown={handleDragStart}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchStart={handleDragStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleDragEnd}
            >
                {games.map((game, index) => {
                    const IconComponent = game.icon;
                    const isActive = index === activeIndex;

                    return (
                        <div
                            key={game.id}
                            className={`${styles.cardWrapper} ${isActive ? styles.cardActive : ''}`}
                            style={getCardStyle(index)}
                            onClick={() => {
                                if (!isActive) setActiveIndex(index);
                            }}
                            onMouseMove={(e) => handleMouseMove(e, index)}
                            onMouseLeave={handleMouseLeave}
                        >
                            <Link
                                href={`/games/${game.id}`}
                                className={styles.gameCard}
                                style={{ '--game-color': game.color } as React.CSSProperties}
                                onClick={(e) => {
                                    if (!isActive) e.preventDefault();
                                }}
                            >
                                <div className={styles.cardGlow} />
                                <div className={styles.gameIcon}>
                                    <IconComponent
                                        size={80}
                                        style={{
                                            color: game.iconColor,
                                            filter: `drop-shadow(0 0 30px ${game.iconColor})`,
                                        }}
                                    />
                                </div>
                                <h3 className={styles.gameName}>{game.name}</h3>
                                <p className={styles.gameDescription}>{game.description}</p>
                                <div className={styles.gameMultiplier}>
                                    {game.multiplier}
                                </div>
                                {isActive && (
                                    <div className={styles.playButton}>
                                        Play Now →
                                    </div>
                                )}
                            </Link>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={goToNext}
                className={`${styles.navButton} ${styles.navButtonRight}`}
                aria-label="Next game"
            >
                <ChevronRight size={32} />
            </button>

            {/* Dots Indicator */}
            <div className={styles.dotsContainer}>
                {games.map((game, index) => (
                    <button
                        key={game.id}
                        className={`${styles.dot} ${index === activeIndex ? styles.dotActive : ''}`}
                        onClick={() => setActiveIndex(index)}
                        aria-label={`Go to ${game.name}`}
                        style={{ '--dot-color': game.color } as React.CSSProperties}
                    />
                ))}
            </div>
        </div>
    );
}
