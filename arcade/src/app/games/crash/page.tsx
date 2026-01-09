'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useGame } from '@/lib/game-context';
import { useSound } from '@/lib/sounds';
import { Rocket, Flame, CircleDollarSign, Sparkles, Zap, Target, BarChart3 } from '@/components/icons';
import { GameModeSelector } from '@/components/GameModeSelector';
import { DemoLimitOverlay } from '@/components/DemoLimitOverlay';
import { GameInfoPanel, InfoButton } from '@/components/GameInfoPanel';
import styles from './page.module.css';

const CRASH_GAME_RULES = [
    {
        icon: <Target size={20} style={{ color: 'var(--neon-cyan)' }} />,
        title: 'Objective',
        content: 'Watch the rocket launch and the multiplier climb. Your goal is to cash out before the rocket crashes!',
    },
    {
        icon: <BarChart3 size={20} style={{ color: 'var(--neon-green)' }} />,
        title: 'Rising Multiplier',
        content: 'The multiplier starts at 1.00x and increases exponentially. The longer you wait, the more you win – if you don\'t crash.',
    },
    {
        icon: <Rocket size={20} style={{ color: '#ff6b00' }} />,
        title: 'The Crash',
        content: 'The rocket can crash at any moment. When it crashes, all active bets that haven\'t cashed out are lost.',
    },
    {
        icon: <Zap size={20} style={{ color: 'var(--neon-yellow)' }} />,
        title: 'Auto Cashout',
        content: 'Set an auto-cashout multiplier to automatically secure your winnings when the target is reached.',
    },
];

type GameState = 'idle' | 'flying' | 'crashed' | 'cashedOut';

// Determine multiplier danger level for visual feedback
function getMultiplierLevel(multiplier: number): 'low' | 'medium' | 'high' {
    if (multiplier >= 5) return 'high';
    if (multiplier >= 2.5) return 'medium';
    return 'low';
}

// Calculate straight diagonal trajectory path
function getTrajectoryPath(multiplier: number): string {
    const startX = 15;
    const startY = 85;
    const progress = Math.min((multiplier - 1) * 12, 70);

    const endX = startX + progress;
    const endY = startY - progress;

    return `M ${startX} ${startY} L ${endX} ${endY}`;
}

export default function CrashGame() {
    const { primaryWallet, setShowAuthFlow } = useDynamicContext();
    const {
        effectiveBalance,
        betAmount,
        setBetAmount,
        canBet,
        addBetRecord,
        demoMode,
        toggleDemoMode,
        isDemoLimitReached,
    } = useGame();
    const { playSound, stopSound } = useSound();

    const [modeSelected, setModeSelected] = useState(false);
    const showModeSelector = !primaryWallet && !demoMode && !modeSelected;
    const showDemoLimitReached = demoMode && isDemoLimitReached('crash');

    const [gameState, setGameState] = useState<GameState>('idle');
    const [multiplier, setMultiplier] = useState(1.00);
    const [crashPoint, setCrashPoint] = useState(0);
    const [autoCashout, setAutoCashout] = useState<number | null>(null);
    const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
    const [showFlash, setShowFlash] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const animationRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const gameAreaRef = useRef<HTMLDivElement>(null);
    const gameStateRef = useRef<GameState>(gameState);
    const isStartingRef = useRef<boolean>(false);

    // Keep gameStateRef in sync - critical for animation loop to see latest state
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    const multiplierLevel = getMultiplierLevel(multiplier);

    const multiplierClass = useMemo(() => {
        if (gameState === 'crashed') return styles.multiplierCrashed;
        if (gameState === 'cashedOut') return styles.multiplierCashedOut;
        if (gameState === 'flying') {
            const baseClass = styles.multiplierFlying;
            if (multiplierLevel === 'high') return `${baseClass} ${styles.multiplierHigh}`;
            if (multiplierLevel === 'medium') return `${baseClass} ${styles.multiplierMedium}`;
            return baseClass;
        }
        return '';
    }, [gameState, multiplierLevel]);

    const [gameNonce, setGameNonce] = useState<number>(0);

    const startGame = useCallback(async () => {
        // Prevent double-taps and check eligibility
        if (!canBet(betAmount) || gameState === 'flying' || isStartingRef.current || isLoading) return;

        // Mark as starting immediately to prevent double-taps
        isStartingRef.current = true;
        setIsLoading(true);

        // Stop any lingering sounds
        stopSound('WIN');
        stopSound('EXPLOSION');
        stopSound('CASH_OUT');

        // Cancel any lingering animation frame from previous game
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }

        const nonce = Date.now();
        setGameNonce(nonce);

        try {
            const response = await fetch('/api/crash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    userAddress: primaryWallet?.address || 'demo',
                    nonce,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to start game');
            }

            // Reset game state for new round
            setMultiplier(1.00);
            setCashedOutAt(null);
            setShowFlash(false);
            setGameState('flying');
            startTimeRef.current = Date.now();
            lastCheckRef.current = 0;

            playSound('CLICK');
        } catch (error) {
            console.error('Crash start error:', error);
        } finally {
            setIsLoading(false);
            isStartingRef.current = false;
        }
    }, [canBet, betAmount, gameState, isLoading, playSound, stopSound, primaryWallet?.address]);

    // Cash out
    const cashOut = useCallback(() => {
        if (gameState !== 'flying') return;

        // Cancel animation frame immediately to stop any pending API checks
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }

        setCashedOutAt(multiplier);
        setGameState('cashedOut');
        playSound('WIN');

        addBetRecord({
            game: 'crash',
            betAmount,
            outcome: 'win',
            multiplier,
            payout: betAmount * multiplier,
            gameParams: { cashoutMultiplier: Math.floor(multiplier * 10000), crashPoint: 0 },
        });
    }, [gameState, multiplier, betAmount, playSound, addBetRecord]);

    const lastCheckRef = useRef<number>(0);

    // Animation loop
    useEffect(() => {
        if (gameState !== 'flying') return;

        const checkInterval = 150; // Check server every 150ms (reduced from 500ms for better timing)

        const animate = async () => {
            // Check ref for latest state - prevents animation continuing after cashout
            if (gameStateRef.current !== 'flying') return;

            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            const newMultiplier = Math.pow(1.06, elapsed * 10);
            const roundedMultiplier = Math.floor(newMultiplier * 100) / 100;

            setMultiplier(roundedMultiplier);

            if (autoCashout && roundedMultiplier >= autoCashout) {
                cashOut();
                return;
            }

            // Periodically check with server if we've crashed
            const now = Date.now();
            if (now - lastCheckRef.current > checkInterval) {
                lastCheckRef.current = now;

                try {
                    const response = await fetch('/api/crash', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'check',
                            userAddress: primaryWallet?.address || 'demo',
                            nonce: gameNonce,
                            currentMultiplier: roundedMultiplier * 10000, // Convert to basis points
                        }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.crashed) {
                            setCrashPoint(data.crashPoint / 10000);
                            setMultiplier(data.crashPoint / 10000);
                            setGameState('crashed');
                            setShowFlash(true);
                            playSound('EXPLOSION');

                            addBetRecord({
                                game: 'crash',
                                betAmount,
                                outcome: 'loss',
                                multiplier: 0,
                                payout: 0,
                                gameParams: { cashoutMultiplier: 0, crashPoint: data.crashPoint },
                            });
                            return;
                        }
                    }
                } catch {
                    // Network error, continue game
                }
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [gameState, gameNonce, autoCashout, cashOut, betAmount, playSound, addBetRecord, primaryWallet?.address]);

    const handleQuickBet = (amount: number) => {
        if (gameState === 'flying') return;
        setBetAmount(amount);
    };

    const handleDemoSelect = () => {
        toggleDemoMode();
        setModeSelected(true);
    };

    // If user needs to select mode, show the selector
    if (showModeSelector) {
        return (
            <GameModeSelector
                gameName="Cannon"
                gameIcon={<Rocket size={64} style={{ color: '#ff6b00' }} />}
                onDemoSelect={handleDemoSelect}
            />
        );
    }

    // If demo limit reached, show overlay
    if (showDemoLimitReached) {
        return (
            <DemoLimitOverlay gameName="Cannon" onSignIn={() => setShowAuthFlow?.(true)} />
        );
    }

    const rocketProgress = gameState === 'flying' || gameState === 'crashed' || gameState === 'cashedOut'
        ? Math.min((multiplier - 1) * 12, 70)
        : 0;

    return (
        <div className={styles.container}>
            {/* Info Panel */}
            <GameInfoPanel
                isOpen={showInfo}
                onClose={() => setShowInfo(false)}
                gameName="Cannon Crash"
                rules={CRASH_GAME_RULES}
            />

            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    <h1 className={styles.title}>
                        <Rocket size={36} style={{ marginRight: '0.5rem', verticalAlign: 'middle', filter: 'drop-shadow(0 0 15px #ff6b00)' }} />
                        Cannon Crash
                    </h1>
                    <InfoButton onClick={() => setShowInfo(true)} />
                </div>
                <p className={styles.subtitle}>Watch the multiplier rise. Cash out before the BOOM!</p>
            </div>

            <div className={styles.gameLayout}>
                {/* Control Panel */}
                <div className={styles.controlPanel}>
                    <div className={styles.card}>
                        <h3>Bet Amount</h3>
                        <div className={styles.betInput}>
                            <span className={styles.currency}>$</span>
                            <input
                                type="number"
                                value={betAmount}
                                onChange={(e) => setBetAmount(Number(e.target.value))}
                                min={0.5}
                                max={100}
                                step={0.5}
                                disabled={gameState === 'flying'}
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.quickBets}>
                            {[1, 5, 10, 25].map(amount => (
                                <button
                                    key={amount}
                                    onClick={() => handleQuickBet(amount)}
                                    disabled={gameState === 'flying'}
                                    className={styles.quickBtn}
                                >
                                    ${amount}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Auto Cashout */}
                    <div className={styles.card}>
                        <h3>Auto Cashout</h3>
                        <div className={styles.autoCashout}>
                            <input
                                type="number"
                                value={autoCashout || ''}
                                onChange={(e) => setAutoCashout(e.target.value ? Number(e.target.value) : null)}
                                placeholder="Off"
                                min={1.1}
                                step={0.1}
                                disabled={gameState === 'flying'}
                                className={styles.input}
                            />
                            <span className={styles.multiplierLabel}>×</span>
                        </div>
                    </div>

                    {/* Game Actions */}
                    <div className={styles.gameActions}>
                        {(gameState === 'idle' || gameState === 'crashed' || gameState === 'cashedOut') && (
                            <button
                                onClick={startGame}
                                disabled={!canBet(betAmount) || isLoading}
                                className={`${styles.primaryBtn} ${isLoading ? styles.loading : ''}`}
                                style={{ touchAction: 'manipulation' }}
                            >
                                <Rocket size={20} style={{ marginRight: '8px' }} />
                                {isLoading ? 'Launching...' : `Launch Cannon ($${betAmount})`}
                            </button>
                        )}

                        {gameState === 'flying' && (
                            <button onClick={cashOut} className={styles.cashoutBtn}>
                                <CircleDollarSign size={20} style={{ marginRight: '8px' }} />
                                Cash Out @ {multiplier.toFixed(2)}×
                            </button>
                        )}
                    </div>

                    {/* Result */}
                    {gameState === 'cashedOut' && cashedOutAt && (
                        <div className={styles.resultWin}>
                            <span className={styles.resultEmoji}>
                                <Sparkles size={32} style={{ color: 'var(--neon-green)', filter: 'drop-shadow(0 0 15px var(--neon-green))' }} />
                            </span>
                            <span>Cashed out at {cashedOutAt.toFixed(2)}×</span>
                            <span className={styles.resultPayout}>+${(betAmount * cashedOutAt).toFixed(2)}</span>
                        </div>
                    )}

                    {gameState === 'crashed' && (
                        <div className={styles.resultLoss}>
                            <span className={styles.resultEmoji}>
                                <Rocket size={32} style={{ filter: 'drop-shadow(0 0 15px #ff6b00)' }} />
                            </span>
                            <span>Crashed at {crashPoint.toFixed(2)}×</span>
                        </div>
                    )}
                </div>

                {/* Game Area */}
                <div
                    ref={gameAreaRef}
                    className={`${styles.gameArea} ${gameState === 'crashed' ? styles.shake : ''}`}
                >
                    {/* Screen Flash on Crash */}
                    {showFlash && <div className={styles.screenFlash} />}

                    {/* Background stars */}
                    <div className={`${styles.stars} ${gameState === 'flying' ? styles.starsActive : ''}`} />

                    {/* Speed Lines */}
                    <div className={`${styles.speedLines} ${gameState === 'flying' && multiplier > 2 ? styles.speedLinesActive : ''}`} />

                    {/* Trajectory SVG */}
                    <div className={styles.trajectoryContainer}>
                        <svg className={styles.trajectorySvg} viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="trajectoryGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="transparent" />
                                    <stop offset="30%" stopColor="var(--neon-cyan)" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="var(--neon-cyan)" />
                                </linearGradient>
                            </defs>
                            {(gameState === 'flying' || gameState === 'cashedOut') && (
                                <>
                                    <path
                                        className={styles.trajectoryGlow}
                                        d={getTrajectoryPath(multiplier)}
                                    />
                                    <path
                                        className={`${styles.trajectoryPath} ${styles.trajectoryPathActive}`}
                                        d={getTrajectoryPath(multiplier)}
                                    />
                                </>
                            )}
                        </svg>
                    </div>

                    {/* Rocket Container - Only show when flying or idle */}
                    {(gameState === 'idle' || gameState === 'flying') && (
                        <div
                            className={styles.rocketContainer}
                            style={{
                                left: `calc(15% + ${rocketProgress}% - 10px)`, // -10px puts the flame (bottom-left of 100px box) at the point
                                bottom: `calc(15% + ${rocketProgress}% - 10px)`
                            }}
                        >
                            {/* Rocket Assembly - rocket + flame rotate together */}
                            <div className={`${styles.rocketAssembly} ${gameState === 'flying' ? styles.rocketFlying : styles.rocketIdle}`}>
                                {/* Glowing Trail - extends from back of rocket when flying */}
                                {gameState === 'flying' && (
                                    <div className={styles.glowTrail} />
                                )}

                                {/* Flame - behind rocket, only when flying */}
                                {gameState === 'flying' && (
                                    <div className={styles.flameContainer}>
                                        <Flame
                                            size={50}
                                            className={styles.flameIcon}
                                            style={{
                                                color: 'var(--neon-orange)',
                                                filter: 'drop-shadow(0 0 15px var(--neon-orange))'
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Rocket Body */}
                                <div className={styles.rocketBody}>
                                    <Rocket
                                        size={80}
                                        style={{
                                            color: 'var(--neon-cyan)',
                                            filter: 'drop-shadow(0 0 25px var(--neon-cyan))'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Money Bag - Show on successful cashout */}
                    {gameState === 'cashedOut' && (
                        <div className={styles.cashoutSuccess}>
                            <CircleDollarSign
                                size={100}
                                style={{
                                    color: 'var(--neon-green)',
                                    filter: 'drop-shadow(0 0 30px var(--neon-green))'
                                }}
                            />
                        </div>
                    )}

                    {/* Crash Explosion */}
                    {gameState === 'crashed' && (
                        <div className={styles.crashExplosion}>
                            <div className={styles.explosionRing} />
                            <div className={styles.explosionRing} />
                            <div className={styles.explosionRing} />
                            <div className={styles.explosionCore}>
                                <Rocket size={80} style={{ color: '#ff6b00', filter: 'drop-shadow(0 0 30px #ff6b00)' }} />
                            </div>
                        </div>
                    )}

                    {/* Multiplier Display */}
                    <div className={`${styles.multiplierDisplay} ${multiplierClass}`}>
                        <span className={styles.multiplierValue}>
                            {multiplier.toFixed(2)}×
                        </span>
                        {gameState === 'flying' && (
                            <span className={styles.multiplierHint}>
                                <Zap size={16} fill="currentColor" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                                Click to cash out!
                                <Zap size={16} fill="currentColor" style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px' }} />
                            </span>
                        )}
                    </div>
                </div>
            </div>


        </div>
    );
}
