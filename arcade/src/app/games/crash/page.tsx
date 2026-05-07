'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useGame } from '@/lib/game-context';
import { useWalletIdentity } from '@/lib/wallet-identity';
import { useSound } from '@/lib/sounds';
import { authFetch, getRequestErrorMessage, readResponseError } from '@/lib/auth-fetch';
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

type GameState = 'idle' | 'launching' | 'flying' | 'cashingOut' | 'crashed' | 'cashedOut';
type ActiveCrashRound = { roundId: string; version: number };
const SERVER_CHECK_INTERVAL_MS = 500;
const MULTIPLIER_BPS = 10000;

function getMultiplierLevel(multiplier: number): 'low' | 'medium' | 'high' {
    if (multiplier >= 5) return 'high';
    if (multiplier >= 2.5) return 'medium';
    return 'low';
}

function getTrajectoryPath(multiplier: number): string {
    const startX = 15;
    const startY = 85;
    const progress = Math.min((multiplier - 1) * 12, 70);

    const endX = startX + progress;
    const endY = startY - progress;

    return `M ${startX} ${startY} L ${endX} ${endY}`;
}

function calculateDisplayedMultiplier(startTime: number, now: number): number {
    const elapsedSeconds = Math.max(0, now - startTime) / 1000;
    return Math.max(1, Math.floor(Math.pow(1.06, elapsedSeconds * 10) * 100) / 100);
}

function multiplierBpsToDisplay(multiplierBps: number): number {
    return Math.max(1, Math.floor((multiplierBps / MULTIPLIER_BPS) * 100) / 100);
}

function displayMultiplierToBps(displayedMultiplier: number): number {
    return Math.max(MULTIPLIER_BPS, Math.floor(displayedMultiplier * MULTIPLIER_BPS));
}

function canStartFromState(gameState: GameState): boolean {
    return gameState === 'idle' || gameState === 'crashed' || gameState === 'cashedOut';
}

export default function CrashGame() {
    const { setShowAuthFlow } = useDynamicContext();
    const wallet = useWalletIdentity();
    const {
        betAmount,
        setBetAmount,
        canBet,
        addBetRecord,
        refreshBalance,
        demoMode,
        toggleDemoMode,
        isDemoLimitReached,
    } = useGame();
    const { playSound, stopSound } = useSound();

    const [modeSelected, setModeSelected] = useState(false);
    const showModeSelector = !wallet.address && !demoMode && !modeSelected;
    const showDemoLimitReached = demoMode && isDemoLimitReached('crash');

    const [gameState, setGameState] = useState<GameState>('idle');
    const [multiplier, setMultiplier] = useState(1.00);
    const [crashPoint, setCrashPoint] = useState(0);
    const [autoCashout, setAutoCashout] = useState<number | null>(null);
    const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
    const [roundBetAmount, setRoundBetAmount] = useState(betAmount);
    const [settledPayout, setSettledPayout] = useState<number | null>(null);
    const [showFlash, setShowFlash] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [activeRound, setActiveRound] = useState<ActiveCrashRound | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const animationRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const gameAreaRef = useRef<HTMLDivElement>(null);
    const gameStateRef = useRef<GameState>(gameState);
    const roundBetAmountRef = useRef<number>(betAmount);
    const visibleMultiplierBpsRef = useRef<number>(MULTIPLIER_BPS);
    const isStartingRef = useRef<boolean>(false);
    const isCashoutRef = useRef<boolean>(false);
    const demoCrashPointRef = useRef<number>(0);
    const serverTimeOffsetRef = useRef<number>(0);
    const lastCheckRef = useRef<number>(0);

    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    const stopAnimation = useCallback(() => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
    }, []);

    const setDisplayedMultiplier = useCallback((nextMultiplier: number) => {
        visibleMultiplierBpsRef.current = displayMultiplierToBps(nextMultiplier);
        setMultiplier(nextMultiplier);
    }, []);

    const finalizeDemoCrash = useCallback(() => {
        if (gameStateRef.current !== 'flying' || isCashoutRef.current) return;

        stopAnimation();
        const crashPointBps = demoCrashPointRef.current;
        const displayedCrashPoint = multiplierBpsToDisplay(crashPointBps);
        const wager = roundBetAmountRef.current;

        gameStateRef.current = 'crashed';
        setCrashPoint(displayedCrashPoint);
        setDisplayedMultiplier(displayedCrashPoint);
        setGameState('crashed');
        setShowFlash(true);
        playSound('EXPLOSION');

        addBetRecord({
            game: 'crash',
            betAmount: wager,
            outcome: 'loss',
            multiplier: 0,
            payout: 0,
            gameParams: { cashoutMultiplier: 0, crashPoint: crashPointBps },
        });
    }, [addBetRecord, playSound, setDisplayedMultiplier, stopAnimation]);

    const multiplierLevel = getMultiplierLevel(multiplier);

    const multiplierClass = useMemo(() => {
        if (gameState === 'crashed') return styles.multiplierCrashed;
        if (gameState === 'cashedOut') return styles.multiplierCashedOut;
        if (gameState === 'flying' || gameState === 'cashingOut') {
            const baseClass = styles.multiplierFlying;
            if (multiplierLevel === 'high') return `${baseClass} ${styles.multiplierHigh}`;
            if (multiplierLevel === 'medium') return `${baseClass} ${styles.multiplierMedium}`;
            return baseClass;
        }
        return '';
    }, [gameState, multiplierLevel]);

    const generateDemoCrashPoint = () => {
        const random = Math.random();
        if (random < 0.10) return 10000;
        const normalizedRandom = (random - 0.10) / 0.90;
        const result = (0.95 / 0.90) / normalizedRandom;
        return Math.min(Math.max(10000, Math.floor(result * 10000)), 1000000);
    };

    const getCurrentMultiplierBps = useCallback(() => {
        const now = Date.now() + serverTimeOffsetRef.current;
        const elapsedSeconds = Math.max(0, now - startTimeRef.current) / 1000;
        return Math.max(10000, Math.floor(Math.pow(1.06, elapsedSeconds * 10) * 10000));
    }, []);

    const startGame = useCallback(async () => {
        if (!canBet(betAmount) || !canStartFromState(gameState) || isStartingRef.current || isLoading) return;

        isStartingRef.current = true;
        setIsLoading(true);
        gameStateRef.current = 'launching';
        setGameState('launching');
        setErrorMessage(null);
        setActiveRound(null);
        setDisplayedMultiplier(1.00);
        setCrashPoint(0);
        setCashedOutAt(null);
        roundBetAmountRef.current = betAmount;
        setRoundBetAmount(betAmount);
        setSettledPayout(null);
        setShowFlash(false);
        isCashoutRef.current = false;
        visibleMultiplierBpsRef.current = MULTIPLIER_BPS;
        let initialMultiplier = 1.00;

        stopSound('WIN');
        stopSound('EXPLOSION');
        stopSound('CASH_OUT');
        playSound('CLICK');

        stopAnimation();

        try {
            if (demoMode) {
                demoCrashPointRef.current = generateDemoCrashPoint();
                setActiveRound(null);
            } else {
                const response = await authFetch('/api/crash', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'start',
                        betAmount,
                    }),
                });

                if (!response.ok) {
                    throw new Error(await readResponseError(response, 'Failed to start game'));
                }

                const data = await response.json();
                setActiveRound({ roundId: data.roundId, version: data.version });
                const serverTime = typeof data.serverTime === 'number' ? data.serverTime : Date.now();
                serverTimeOffsetRef.current = serverTime - Date.now();
                startTimeRef.current = typeof data.startedAt === 'number' ? data.startedAt : serverTime;
                initialMultiplier = calculateDisplayedMultiplier(startTimeRef.current, serverTime);
                if (typeof data.betAmount === 'number') {
                    roundBetAmountRef.current = data.betAmount;
                    setRoundBetAmount(data.betAmount);
                    setBetAmount(data.betAmount);
                }
            }

            setDisplayedMultiplier(initialMultiplier);
            gameStateRef.current = 'flying';
            setGameState('flying');
            if (demoMode) {
                serverTimeOffsetRef.current = 0;
                startTimeRef.current = Date.now();
            }
            lastCheckRef.current = 0;
        } catch (error) {
            console.error('Crash start error:', error);
            setErrorMessage(getRequestErrorMessage(error, 'Failed to start game'));
            gameStateRef.current = 'idle';
            setGameState('idle');
        } finally {
            setIsLoading(false);
            isStartingRef.current = false;
        }
    }, [canBet, betAmount, gameState, isLoading, playSound, setBetAmount, stopSound, demoMode, setDisplayedMultiplier, stopAnimation]);

    // Cash out
    const cashOut = useCallback(async () => {
        if (gameStateRef.current !== 'flying' || isCashoutRef.current) return;
        isCashoutRef.current = true;
        setErrorMessage(null);

        stopAnimation();

        const visibleCashoutMultiplier = Math.max(MULTIPLIER_BPS, visibleMultiplierBpsRef.current);
        const demoCrashPoint = demoCrashPointRef.current;
        const cashoutMultiplier = demoMode
            ? Math.min(visibleCashoutMultiplier, demoCrashPoint || visibleCashoutMultiplier)
            : visibleCashoutMultiplier;
        const displayedCashoutMultiplier = multiplierBpsToDisplay(cashoutMultiplier);
        const wager = roundBetAmountRef.current;

        gameStateRef.current = 'cashingOut';
        setDisplayedMultiplier(displayedCashoutMultiplier);
        setCashedOutAt(displayedCashoutMultiplier);
        setSettledPayout(wager * displayedCashoutMultiplier);
        setGameState('cashingOut');
        playSound('CASH_OUT');

        try {
            if (demoMode) {
                playSound('WIN');
                addBetRecord({
                    game: 'crash',
                    betAmount: wager,
                    outcome: 'win',
                    multiplier: displayedCashoutMultiplier,
                    payout: wager * displayedCashoutMultiplier,
                    gameParams: { cashoutMultiplier, crashPoint: demoCrashPoint },
                });
                gameStateRef.current = 'cashedOut';
                setGameState('cashedOut');
                return;
            }

            if (!activeRound) {
                throw new Error('No active crash round');
            }

            const response = await authFetch('/api/crash', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'cashout',
                    roundId: activeRound.roundId,
                    version: activeRound.version,
                    cashoutMultiplier,
                }),
            });

            if (!response.ok) {
                throw new Error(await readResponseError(response, 'Failed to cash out'));
            }

            const data = await response.json();
            if (!data.success) {
                const serverCrashPoint = data.crashPoint / MULTIPLIER_BPS;
                gameStateRef.current = 'crashed';
                setCrashPoint(serverCrashPoint);
                setDisplayedMultiplier(serverCrashPoint);
                setGameState('crashed');
                setShowFlash(true);
                playSound('EXPLOSION');
                setActiveRound(null);
                void refreshBalance();
                return;
            }

            setCashedOutAt(data.multiplier);
            setSettledPayout(typeof data.payout === 'number' ? data.payout : wager * data.multiplier);
            gameStateRef.current = 'cashedOut';
            setGameState('cashedOut');
            setActiveRound(null);
            playSound('WIN');
            void refreshBalance();
        } catch (error) {
            console.error('Crash cashout error:', error);
            const message = getRequestErrorMessage(error, 'Failed to cash out');
            setErrorMessage(message);
            setCashedOutAt(null);
            setSettledPayout(null);
            if (message === 'Round not found' || !activeRound) {
                setActiveRound(null);
                setDisplayedMultiplier(1.00);
                gameStateRef.current = 'idle';
                setGameState('idle');
            } else {
                lastCheckRef.current = 0;
                gameStateRef.current = 'flying';
                setGameState('flying');
            }
            if (!demoMode) {
                void refreshBalance();
            }
        } finally {
            isCashoutRef.current = false;
        }
    }, [demoMode, activeRound, playSound, addBetRecord, refreshBalance, setDisplayedMultiplier, stopAnimation]);

    // Animation loop
    useEffect(() => {
        if (gameState !== 'flying') return;

        const animate = async () => {
            if (gameStateRef.current !== 'flying') return;

            const multiplierBps = getCurrentMultiplierBps();
            if (demoMode && multiplierBps >= demoCrashPointRef.current) {
                finalizeDemoCrash();
                return;
            }

            const roundedMultiplier = multiplierBpsToDisplay(multiplierBps);

            setDisplayedMultiplier(roundedMultiplier);

            if (autoCashout && roundedMultiplier >= autoCashout) {
                void cashOut();
                return;
            }

            // Periodically check with server if we've crashed
            const now = Date.now();
            if (!demoMode && !isCashoutRef.current && now - lastCheckRef.current > SERVER_CHECK_INTERVAL_MS) {
                lastCheckRef.current = now;

                try {
                    if (activeRound) {
                        const response = await authFetch('/api/crash', {
                            method: 'POST',
                            body: JSON.stringify({
                                action: 'check',
                                roundId: activeRound.roundId,
                                version: activeRound.version,
                                currentMultiplier: Math.floor(roundedMultiplier * 10000),
                            }),
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.crashed) {
                                const serverCrashPoint = data.crashPoint / MULTIPLIER_BPS;
                                gameStateRef.current = 'crashed';
                                setCrashPoint(serverCrashPoint);
                                setDisplayedMultiplier(serverCrashPoint);
                                setGameState('crashed');
                                setShowFlash(true);
                                setActiveRound(null);
                                playSound('EXPLOSION');
                                void refreshBalance();
                                return;
                            }
                        } else {
                            console.warn('Crash check error:', await readResponseError(response, 'Failed to check crash round'));
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
    }, [gameState, autoCashout, cashOut, demoMode, activeRound, refreshBalance, getCurrentMultiplierBps, finalizeDemoCrash, setDisplayedMultiplier, playSound]);

    const roundLocked = gameState === 'launching' || gameState === 'flying' || gameState === 'cashingOut' || isLoading;
    const displayedPayout = roundBetAmount * multiplier;
    const flightStatus = gameState === 'idle'
        ? 'Ready'
        : gameState === 'launching'
            ? 'Launching'
            : gameState === 'flying'
                ? 'Live'
                : gameState === 'cashingOut'
                    ? 'Securing'
                    : gameState === 'cashedOut'
                        ? 'Paid'
                        : 'Crashed';
    const flightStatusDetail = gameState === 'flying'
        ? 'Cashout request will lock the current multiplier server-side.'
        : gameState === 'cashingOut'
            ? 'Settlement request in flight. Controls stay locked.'
            : gameState === 'launching'
                ? 'Creating wagered round.'
                : gameState === 'cashedOut'
                    ? `Settled at ${cashedOutAt?.toFixed(2) ?? multiplier.toFixed(2)}x.`
                    : gameState === 'crashed'
                        ? `Stopped at ${crashPoint.toFixed(2)}x.`
                        : 'Set wager, launch, and cash out before the crash.';

    const handleQuickBet = (amount: number) => {
        if (roundLocked) return;
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

    const rocketProgress = gameState === 'flying' || gameState === 'cashingOut' || gameState === 'crashed' || gameState === 'cashedOut'
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
                                disabled={roundLocked}
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.quickBets}>
                            {[1, 5, 10, 25].map(amount => (
                                <button
                                    key={amount}
                                    onClick={() => handleQuickBet(amount)}
                                    disabled={roundLocked}
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
                                disabled={roundLocked}
                                className={styles.input}
                            />
                            <span className={styles.multiplierLabel}>×</span>
                        </div>
                    </div>

                    {/* Game Actions */}
                    <div className={styles.gameActions}>
                        {errorMessage && (
                            <div className={styles.errorMessage}>{errorMessage}</div>
                        )}

                        {(canStartFromState(gameState) || gameState === 'launching') && (
                            <button
                                onClick={startGame}
                                disabled={!canBet(betAmount) || roundLocked}
                                className={`${styles.primaryBtn} ${isLoading ? styles.loading : ''}`}
                                style={{ touchAction: 'manipulation' }}
                            >
                                <Rocket size={20} style={{ marginRight: '8px' }} />
                                {gameState === 'launching' ? 'Launching...' : `Launch Cannon ($${betAmount})`}
                            </button>
                        )}

                        {(gameState === 'flying' || gameState === 'cashingOut') && (
                            <button
                                onClick={cashOut}
                                disabled={gameState === 'cashingOut'}
                                className={`${styles.cashoutBtn} ${gameState === 'cashingOut' ? styles.cashoutPending : ''}`}
                            >
                                <CircleDollarSign size={20} style={{ marginRight: '8px' }} />
                                {gameState === 'cashingOut' ? 'Cashing out...' : `Cash Out @ ${multiplier.toFixed(2)}×`}
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
                            <span className={styles.resultPayout}>+${(settledPayout ?? roundBetAmount * cashedOutAt).toFixed(2)}</span>
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
                    <div className={styles.flightDeck}>
                        <div className={styles.flightDeckItem}>
                            <span className={styles.flightDeckLabel}>Status</span>
                            <strong className={styles.flightDeckValue}>{flightStatus}</strong>
                        </div>
                        <div className={styles.flightDeckItem}>
                            <span className={styles.flightDeckLabel}>Wager</span>
                            <strong className={styles.flightDeckValue}>${roundBetAmount.toFixed(2)}</strong>
                        </div>
                        <div className={styles.flightDeckItem}>
                            <span className={styles.flightDeckLabel}>Potential</span>
                            <strong className={styles.flightDeckValue}>${displayedPayout.toFixed(2)}</strong>
                        </div>
                        <div className={styles.flightDeckItem}>
                            <span className={styles.flightDeckLabel}>Auto</span>
                            <strong className={styles.flightDeckValue}>{autoCashout ? `${autoCashout.toFixed(2)}x` : 'Off'}</strong>
                        </div>
                    </div>

                    <div className={styles.flightStatusLine}>{flightStatusDetail}</div>

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
                            {(gameState === 'flying' || gameState === 'cashingOut' || gameState === 'cashedOut') && (
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
                    {(gameState === 'idle' || gameState === 'launching' || gameState === 'flying' || gameState === 'cashingOut') && (
                        <div
                            className={styles.rocketContainer}
                            style={{
                                left: `calc(15% + ${rocketProgress}% - 10px)`,
                                bottom: `calc(15% + ${rocketProgress}% - 10px)`
                            }}
                        >
                            {/* Rocket Assembly - rocket + flame rotate together */}
                            <div className={`${styles.rocketAssembly} ${gameState === 'flying' || gameState === 'cashingOut' ? styles.rocketFlying : styles.rocketIdle}`}>
                                {/* Glowing Trail - extends from back of rocket when flying */}
                                {(gameState === 'flying' || gameState === 'cashingOut') && (
                                    <div className={styles.glowTrail} />
                                )}

                                {/* Flame - behind rocket, only when flying */}
                                {(gameState === 'flying' || gameState === 'cashingOut') && (
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
                        {gameState === 'cashingOut' && (
                            <span className={styles.multiplierHint}>
                                Securing payout...
                            </span>
                        )}
                    </div>
                </div>
            </div>


        </div>
    );
}
