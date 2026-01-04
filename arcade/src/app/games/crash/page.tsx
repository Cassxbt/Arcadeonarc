'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useGame } from '@/lib/game-context';
import { useSound } from '@/lib/sounds';
import { Bomb, Rocket, Flame, CircleDollarSign, Sparkles, Zap, Target, BarChart3 } from '@/components/icons';
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
        icon: <Bomb size={20} style={{ color: 'var(--neon-pink)' }} />,
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
function getTrajectoryPath(multiplier: number, width: number, height: number): string {
    const startX = width * 0.15;
    const startY = height * 0.85;
    const endX = startX + Math.min((multiplier - 1) * width * 0.08, width * 0.7);
    const endY = startY - Math.min((multiplier - 1) * height * 0.08, height * 0.7);

    // Straight line for diagonal trajectory
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

    // Mode selection state
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

    const animationRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const gameAreaRef = useRef<HTMLDivElement>(null);

    // Calculate multiplier level for styling
    const multiplierLevel = getMultiplierLevel(multiplier);

    // Get multiplier display class
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

    // Generate crash point (house edge built in)
    const generateCrashPoint = useCallback(() => {
        const houseEdge = 0.10;
        const random = Math.random();

        if (random < houseEdge) {
            return 1.00;
        }

        const e = 1 / (1 - random);
        return Math.max(1.00, Math.floor(e * 100) / 100);
    }, []);

    // Start game
    const startGame = useCallback(() => {
        if (!canBet(betAmount) || gameState === 'flying') return;

        // Stop any lingering sounds from previous game
        stopSound('WIN');
        stopSound('EXPLOSION');
        stopSound('CASH_OUT');

        const crash = generateCrashPoint();
        setCrashPoint(crash);
        setMultiplier(1.00);
        setCashedOutAt(null);
        setShowFlash(false);
        setGameState('flying');
        startTimeRef.current = Date.now();

        playSound('CLICK');
    }, [canBet, betAmount, gameState, generateCrashPoint, playSound, stopSound]);

    // Cash out
    const cashOut = useCallback(() => {
        if (gameState !== 'flying') return;

        setCashedOutAt(multiplier);
        setGameState('cashedOut');
        playSound('WIN');

        addBetRecord({
            game: 'crash',
            betAmount,
            outcome: 'win',
            multiplier,
            payout: betAmount * multiplier,
        });

        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
    }, [gameState, multiplier, betAmount, playSound, addBetRecord]);

    // Game loop
    useEffect(() => {
        if (gameState !== 'flying') return;

        const animate = () => {
            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            const newMultiplier = Math.pow(1.06, elapsed * 10);
            const roundedMultiplier = Math.floor(newMultiplier * 100) / 100;

            setMultiplier(roundedMultiplier);

            // Check auto-cashout
            if (autoCashout && roundedMultiplier >= autoCashout) {
                cashOut();
                return;
            }

            // Check crash
            if (roundedMultiplier >= crashPoint) {
                setMultiplier(crashPoint);
                setGameState('crashed');
                setShowFlash(true);
                playSound('EXPLOSION');

                addBetRecord({
                    game: 'crash',
                    betAmount,
                    outcome: 'loss',
                    multiplier: 0,
                    payout: 0,
                });
                return;
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [gameState, crashPoint, autoCashout, cashOut, betAmount, playSound, addBetRecord]);

    // Quick bet handlers
    const handleQuickBet = (amount: number) => {
        if (gameState === 'flying') return;
        setBetAmount(amount);
    };

    // Handle demo mode selection
    const handleDemoSelect = () => {
        toggleDemoMode();
        setModeSelected(true);
    };

    // If user needs to select mode, show the selector
    if (showModeSelector) {
        return (
            <GameModeSelector
                gameName="Cannon"
                gameIcon={<Bomb size={64} style={{ color: 'var(--neon-pink)' }} />}
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

    // Calculate rocket position - starts at bottom-left corner, flies diagonally up-right
    const rocketX = gameState === 'flying'
        ? Math.min((multiplier - 1) * 12, 55)  // Move right as multiplier increases
        : 0;
    const rocketY = gameState === 'flying'
        ? Math.min((multiplier - 1) * 12, 55)  // Move up as multiplier increases
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
                        <Bomb size={36} style={{ marginRight: '0.5rem', verticalAlign: 'middle', filter: 'drop-shadow(0 0 15px var(--neon-pink))' }} />
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
                                disabled={!canBet(betAmount)}
                                className={styles.primaryBtn}
                            >
                                <Rocket size={20} style={{ marginRight: '8px' }} />
                                Launch Cannon (${betAmount})
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
                                <Bomb size={32} style={{ filter: 'drop-shadow(0 0 15px var(--neon-pink))' }} />
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
                                        d={getTrajectoryPath(multiplier, 100, 100)}
                                    />
                                    <path
                                        className={`${styles.trajectoryPath} ${styles.trajectoryPathActive}`}
                                        d={getTrajectoryPath(multiplier, 100, 100)}
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
                                left: `calc(5% + ${rocketX}%)`,
                                bottom: `calc(20px + ${rocketY}%)`
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
                                <Bomb size={80} style={{ color: 'var(--neon-pink)', filter: 'drop-shadow(0 0 30px var(--neon-pink))' }} />
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
