'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useGame } from '@/lib/game-context';
import { useSound } from '@/lib/sounds';
import { Bomb, Rocket, Flame, CircleDollarSign, Sparkles } from '@/components/icons';
import { GameModeSelector } from '@/components/GameModeSelector';
import { DemoLimitOverlay } from '@/components/DemoLimitOverlay';
import styles from './page.module.css';

type GameState = 'idle' | 'flying' | 'crashed' | 'cashedOut';

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
    const { playSound } = useSound();

    // Mode selection state
    const [modeSelected, setModeSelected] = useState(false);
    const showModeSelector = !primaryWallet && !demoMode && !modeSelected;
    const showDemoLimitReached = demoMode && isDemoLimitReached('crash');

    const [gameState, setGameState] = useState<GameState>('idle');
    const [multiplier, setMultiplier] = useState(1.00);
    const [crashPoint, setCrashPoint] = useState(0);
    const [autoCashout, setAutoCashout] = useState<number | null>(null);
    const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);

    const animationRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);

    // Generate crash point (house edge built in)
    const generateCrashPoint = useCallback(() => {
        // This creates a distribution where:
        // - 10% of games crash at 1.00x (instant loss)
        // - Average multiplier is around 2x
        // - Max around 100x (rare)
        const houseEdge = 0.10;
        const random = Math.random();

        if (random < houseEdge) {
            return 1.00;
        }

        // Exponential distribution for crash point
        const e = 1 / (1 - random);
        return Math.max(1.00, Math.floor(e * 100) / 100);
    }, []);

    // Start game
    const startGame = useCallback(() => {
        if (!canBet(betAmount) || gameState === 'flying') return;

        const crash = generateCrashPoint();
        setCrashPoint(crash);
        setMultiplier(1.00);
        setCashedOutAt(null);
        setGameState('flying');
        startTimeRef.current = Date.now();

        playSound('CLICK');
    }, [canBet, betAmount, gameState, generateCrashPoint, playSound]);

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
            // Multiplier grows exponentially
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

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h1 className={styles.title}>
                    <Bomb size={36} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--neon-pink)', filter: 'drop-shadow(0 0 12px var(--neon-pink))' }} />
                    Cannon Crash
                </h1>
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
                                Launch Cannon (${betAmount})
                            </button>
                        )}

                        {gameState === 'flying' && (
                            <button onClick={cashOut} className={styles.cashoutBtn}>
                                Cash Out @ {multiplier.toFixed(2)}×
                            </button>
                        )}
                    </div>

                    {/* Result */}
                    {gameState === 'cashedOut' && cashedOutAt && (
                        <div className={styles.resultWin}>
                            <span className={styles.resultEmoji}>
                                <Sparkles size={28} style={{ color: 'var(--neon-yellow)', filter: 'drop-shadow(0 0 10px var(--neon-yellow))' }} />
                            </span>
                            <span>Cashed out at {cashedOutAt.toFixed(2)}×</span>
                            <span className={styles.resultPayout}>+${(betAmount * cashedOutAt).toFixed(2)}</span>
                        </div>
                    )}

                    {gameState === 'crashed' && (
                        <div className={styles.resultLoss}>
                            <span className={styles.resultEmoji}>
                                <Bomb size={28} style={{ color: 'var(--neon-pink)' }} />
                            </span>
                            <span>Crashed at {crashPoint.toFixed(2)}×</span>
                        </div>
                    )}
                </div>

                {/* Game Area */}
                <div className={`${styles.gameArea} ${gameState === 'crashed' ? styles.shake : ''}`}>
                    {/* Background stars */}
                    <div className={`${styles.stars} ${gameState === 'flying' ? styles.starsActive : ''}`}></div>

                    {/* Rocket and Trajectory */}
                    <div
                        className={styles.rocketContainer}
                        style={{
                            transform: gameState === 'flying' || gameState === 'cashedOut'
                                ? `translateY(-${Math.min((multiplier - 1) * 30, 250)}px)`
                                : 'translateY(0)'
                        }}
                    >
                        {/* Rocket Body */}
                        <div className={styles.rocket}>
                            <Rocket size={48} style={{ color: 'var(--neon-cyan)', filter: 'drop-shadow(0 0 15px var(--neon-cyan))', transform: 'rotate(-45deg)' }} />
                        </div>

                        {/* Thruster Flame */}
                        <div className={`${styles.flame} ${gameState === 'flying' ? styles.flameActive : ''}`}>
                            <Flame size={32} style={{ color: 'var(--neon-orange)', filter: 'drop-shadow(0 0 10px var(--neon-orange))' }} />
                        </div>

                        {/* Cashout Marker */}
                        {gameState === 'cashedOut' && (
                            <div className={styles.cashoutMarker}>
                                <CircleDollarSign size={24} style={{ color: 'var(--neon-green)', filter: 'drop-shadow(0 0 8px var(--neon-green))' }} />
                            </div>
                        )}
                    </div>

                    {/* Crash Explosion */}
                    {gameState === 'crashed' && (
                        <div className={styles.crashExplosion}>
                            <Bomb size={64} style={{ color: 'var(--neon-pink)', filter: 'drop-shadow(0 0 20px var(--neon-pink))', animation: 'pulse 0.3s ease' }} />
                        </div>
                    )}

                    {/* Multiplier Display */}
                    <div className={`${styles.multiplierDisplay} ${gameState === 'flying' ? styles.gameStateActive : ''} ${gameState === 'crashed' ? styles.multiplierCrashed : ''}`}>
                        <span className={styles.multiplierValue}>
                            {multiplier.toFixed(2)}×
                        </span>
                        {gameState === 'flying' && (
                            <span className={styles.multiplierHint}>Click to cash out!</span>
                        )}
                    </div>
                </div>
            </div>

            {/* How It Works */}
            <div className={styles.howItWorks}>
                <h2>How It Works</h2>
                <div className={styles.rules}>
                    <div className={styles.rule}>
                        <h3>Objective</h3>
                        <p>Watch the rocket launch and the multiplier climb. Your goal is to cash out before the rocket crashes!</p>
                    </div>
                    <div className={styles.rule}>
                        <h3>Rising Multiplier</h3>
                        <p>The multiplier starts at 1.00x and increases exponentially. The longer you wait, the more you win – if you don't crash.</p>
                    </div>
                    <div className={styles.rule}>
                        <h3>The Crash</h3>
                        <p>The rocket can crash at any moment. When it crashes, all active bets that haven't cashed out are lost.</p>
                    </div>
                    <div className={styles.rule}>
                        <h3>Auto Cashout</h3>
                        <p>Set an auto-cashout multiplier to automatically secure your winnings when the target is reached.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
