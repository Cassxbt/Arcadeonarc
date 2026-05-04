'use client';

import { useState, useCallback, useMemo } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useGame } from '@/lib/game-context';
import { useSound } from '@/lib/sounds';
import { authFetch, getRequestErrorMessage, readResponseError } from '@/lib/auth-fetch';
import { Grid3x3, Skull, Target, Zap, BarChart3 } from '@/components/icons';
import { GameModeSelector } from '@/components/GameModeSelector';
import { DemoLimitOverlay } from '@/components/DemoLimitOverlay';
import { GameInfoPanel, InfoButton } from '@/components/GameInfoPanel';
import styles from './page.module.css';

const LASER_GAME_RULES = [
    {
        icon: <Target size={20} style={{ color: 'var(--neon-cyan)' }} />,
        title: 'Objective',
        content: 'Dodge lasers on a shrinking grid. Survive as many rounds as possible!',
    },
    {
        icon: <Zap size={20} style={{ color: 'var(--neon-pink)' }} />,
        title: 'Alternating Attacks',
        content: 'Odd turns destroy a COLUMN. Even turns destroy a ROW. Grid resizes after each attack.',
    },
    {
        icon: <BarChart3 size={20} style={{ color: 'var(--neon-green)' }} />,
        title: 'Cash Out',
        content: 'Cash out after surviving at least one round to lock your multiplier!',
    },
];

const FULL_MULTIPLIERS: { turn: number; multiplier: number }[] = [
    { turn: 1, multiplier: 1.06 },
    { turn: 2, multiplier: 1.18 },
    { turn: 3, multiplier: 1.33 },
    { turn: 4, multiplier: 1.50 },
    { turn: 5, multiplier: 1.71 },
    { turn: 6, multiplier: 1.95 },
    { turn: 7, multiplier: 2.23 },
    { turn: 8, multiplier: 2.60 },
    { turn: 9, multiplier: 3.10 },
    { turn: 10, multiplier: 3.83 },
    { turn: 11, multiplier: 4.90 },
    { turn: 12, multiplier: 6.53 },
    { turn: 13, multiplier: 8.55 },
    { turn: 14, multiplier: 10.6 },
    { turn: 15, multiplier: 18.8 },
    { turn: 16, multiplier: 38.4 },
    { turn: 17, multiplier: 57.5 },
    { turn: 18, multiplier: 95.9 },
];

// Major marks shown in thermometer
const MAJOR_MARKS = [2, 6, 10, 14, 18];
const LASER_REVEAL_MS = 180;

type GameState = 'idle' | 'playing' | 'lasered' | 'cashedOut';
type ActiveLaserRound = { roundId: string; version: number };

interface LaserGameState {
    currentTurn: number;
    columnsRemaining: number;
    rowsRemaining: number;
    animatingIndex: number | null;
    animatingType: 'column' | 'row' | null;
    lastSelectedCell: { row: number; col: number } | null;
}

type LaserServerState = {
    currentTurn?: number;
    columnsRemaining?: number;
    rowsRemaining?: number;
};

function buildLaserStateFromServer(data: {
    currentTurn?: number;
    columnsRemaining?: number;
    rowsRemaining?: number;
    state?: LaserServerState;
}): LaserGameState {
    const state = data.state ?? data;
    return {
        currentTurn: typeof state.currentTurn === 'number' ? state.currentTurn : 0,
        columnsRemaining: typeof state.columnsRemaining === 'number' ? state.columnsRemaining : 10,
        rowsRemaining: typeof state.rowsRemaining === 'number' ? state.rowsRemaining : 10,
        animatingIndex: null,
        animatingType: null,
        lastSelectedCell: null,
    };
}

export default function LaserGame() {
    const { primaryWallet, setShowAuthFlow } = useDynamicContext();
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
    const showModeSelector = !primaryWallet && !demoMode && !modeSelected;
    const showDemoLimitReached = demoMode && isDemoLimitReached('laser');

    const [gameState, setGameState] = useState<GameState>('idle');
    const [laserState, setLaserState] = useState<LaserGameState>({
        currentTurn: 0,
        columnsRemaining: 10,
        rowsRemaining: 10,
        animatingIndex: null,
        animatingType: null,
        lastSelectedCell: null,
    });
    const [showInfo, setShowInfo] = useState(false);
    const [showSkullOverlay, setShowSkullOverlay] = useState(false);
    const [hoveredTurn, setHoveredTurn] = useState<number | null>(null);
    const [activeRound, setActiveRound] = useState<ActiveLaserRound | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [isCashingOut, setIsCashingOut] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const currentMultiplier = useMemo(() => {
        if (laserState.currentTurn === 0) return 1.00;
        const entry = FULL_MULTIPLIERS.find(m => m.turn === laserState.currentTurn);
        return entry?.multiplier || 1.00;
    }, [laserState.currentTurn]);

    // Start game
    const startGame = useCallback(async () => {
        if (!canBet(betAmount) || gameState === 'playing' || isStarting) return;

        stopSound('WIN');
        stopSound('EXPLOSION');
        stopSound('LASER_ZAP');
        setIsStarting(true);
        setErrorMessage(null);
        playSound('CLICK');
        setShowSkullOverlay(false);
        setActiveRound(null);
        setLaserState({
            currentTurn: 0,
            columnsRemaining: 10,
            rowsRemaining: 10,
            animatingIndex: null,
            animatingType: null,
            lastSelectedCell: null,
        });

        try {
            if (demoMode) {
                setActiveRound(null);
                setGameState('playing');
            } else {
                const response = await authFetch('/api/laser', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'start',
                        betAmount,
                    }),
                });

                if (!response.ok) {
                    throw new Error(await readResponseError(response, 'Failed to start laser round'));
                }

                const data = await response.json();
                setActiveRound({ roundId: data.roundId, version: data.version });
                setLaserState(buildLaserStateFromServer(data));
                if (typeof data.betAmount === 'number') {
                    setBetAmount(data.betAmount);
                }
                setGameState('playing');
            }
        } catch (error) {
            console.error('Laser start error:', error);
            setErrorMessage(getRequestErrorMessage(error, 'Failed to start laser round'));
            setGameState('idle');
            if (!demoMode) {
                void refreshBalance();
            }
        } finally {
            setIsStarting(false);
        }
    }, [canBet, betAmount, gameState, isStarting, demoMode, playSound, setBetAmount, stopSound, refreshBalance]);

    const handleCellClick = useCallback(async (row: number, col: number) => {
        if (gameState !== 'playing' || laserState.animatingIndex !== null || isResolving || isStarting) return;

        const isColumnAttack = laserState.currentTurn % 2 === 0;
        const remaining = isColumnAttack ? laserState.columnsRemaining : laserState.rowsRemaining;
        let laserTarget = Math.floor(Math.random() * remaining);
        let survived: boolean;
        let nextVersion: number | null = null;
        let finalOutcome: 'safe' | 'loss' | 'win';
        let serverColumnsRemaining: number | null = null;
        let serverRowsRemaining: number | null = null;

        setIsResolving(true);
        setErrorMessage(null);
        setLaserState(prev => ({
            ...prev,
            lastSelectedCell: { row, col },
        }));
        playSound('CLICK');

        try {
            if (!demoMode) {
                if (!activeRound) {
                    throw new Error('No active laser round');
                }

                const response = await authFetch('/api/laser', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'select',
                        roundId: activeRound.roundId,
                        version: activeRound.version,
                        row,
                        col,
                    }),
                });

                if (!response.ok) {
                    throw new Error(await readResponseError(response, 'Failed to select laser cell'));
                }

                const data = await response.json();
                laserTarget = data.laserTarget;
                survived = data.survived;
                finalOutcome = data.outcome;
                nextVersion = data.version ?? null;
                serverColumnsRemaining = data.columnsRemaining ?? null;
                serverRowsRemaining = data.rowsRemaining ?? null;
            } else {
                survived = (isColumnAttack ? col : row) !== laserTarget;
                finalOutcome = survived ? 'safe' : 'loss';
            }
        } catch (error) {
            console.error('Laser select error:', error);
            setErrorMessage(getRequestErrorMessage(error, 'Failed to select laser cell'));
            setLaserState(prev => ({
                ...prev,
                lastSelectedCell: null,
            }));
            setIsResolving(false);
            if (!demoMode) {
                void refreshBalance();
            }
            return;
        }

        setLaserState(prev => ({
            ...prev,
            animatingIndex: laserTarget,
            animatingType: isColumnAttack ? 'column' : 'row',
            lastSelectedCell: { row, col },
        }));
        playSound('LASER_ZAP');

        setTimeout(() => {
            if (survived && finalOutcome !== 'win') {
                setLaserState(prev => ({
                    currentTurn: prev.currentTurn + 1,
                    columnsRemaining: serverColumnsRemaining ?? (isColumnAttack ? prev.columnsRemaining - 1 : prev.columnsRemaining),
                    rowsRemaining: serverRowsRemaining ?? (!isColumnAttack ? prev.rowsRemaining - 1 : prev.rowsRemaining),
                    animatingIndex: null,
                    animatingType: null,
                    lastSelectedCell: null,
                }));
                if (!demoMode && nextVersion) {
                    setActiveRound(prev => prev ? { ...prev, version: nextVersion } : prev);
                }
                setIsResolving(false);
                playSound('CLICK');
            } else if (survived) {
                setLaserState(prev => ({
                    currentTurn: prev.currentTurn + 1,
                    columnsRemaining: serverColumnsRemaining ?? (isColumnAttack ? prev.columnsRemaining - 1 : prev.columnsRemaining),
                    rowsRemaining: serverRowsRemaining ?? (!isColumnAttack ? prev.rowsRemaining - 1 : prev.rowsRemaining),
                    animatingIndex: null,
                    animatingType: null,
                    lastSelectedCell: null,
                }));
                setGameState('cashedOut');
                setActiveRound(null);
                setIsResolving(false);
                playSound('WIN');
                if (!demoMode) {
                    void refreshBalance();
                }
            } else {
                setLaserState(prev => ({
                    ...prev,
                    animatingIndex: null,
                    animatingType: null,
                }));
                setGameState('lasered');
                setActiveRound(null);
                setIsResolving(false);
                setShowSkullOverlay(true);
                playSound('EXPLOSION');

                // Hide skull overlay after animation
                setTimeout(() => {
                    setShowSkullOverlay(false);
                }, 1500);

                if (demoMode) {
                    addBetRecord({
                        game: 'laser',
                        betAmount,
                        outcome: 'loss',
                        multiplier: 0,
                        payout: 0,
                        gameParams: { survivedTurns: 0 },
                    });
                } else {
                    void refreshBalance();
                }
            }
        }, LASER_REVEAL_MS);
    }, [gameState, laserState, isResolving, isStarting, betAmount, demoMode, activeRound, playSound, addBetRecord, refreshBalance]);

    // Cash out
    const handleCashOut = useCallback(async () => {
        if (gameState !== 'playing' || laserState.currentTurn === 0) return;
        if (isCashingOut || isResolving) return;

        try {
            let finalMultiplier = currentMultiplier;
            let payout = betAmount * currentMultiplier;

            setIsCashingOut(true);
            setErrorMessage(null);
            setGameState('cashedOut');
            playSound('WIN');

            if (!demoMode) {
                if (!activeRound) {
                    throw new Error('No active laser round');
                }

                const response = await authFetch('/api/laser', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'cashout',
                        roundId: activeRound.roundId,
                        version: activeRound.version,
                    }),
                });

                if (!response.ok) {
                    throw new Error(await readResponseError(response, 'Failed to cash out laser round'));
                }

                const data = await response.json();
                finalMultiplier = data.multiplier;
                payout = data.payout;
            }

            setGameState('cashedOut');
            setActiveRound(null);

            if (demoMode) {
                addBetRecord({
                    game: 'laser',
                    betAmount,
                    outcome: 'win',
                    multiplier: finalMultiplier,
                    payout,
                    gameParams: { survivedTurns: laserState.currentTurn },
                });
            } else {
                void refreshBalance();
            }
        } catch (error) {
            console.error('Laser cashout error:', error);
            setErrorMessage(getRequestErrorMessage(error, 'Failed to cash out laser round'));
            setGameState('playing');
            if (!demoMode) {
                void refreshBalance();
            }
        } finally {
            setIsCashingOut(false);
        }
    }, [gameState, laserState.currentTurn, isCashingOut, isResolving, betAmount, currentMultiplier, demoMode, activeRound, playSound, addBetRecord, refreshBalance]);

    const handleDemoSelect = () => {
        toggleDemoMode();
        setModeSelected(true);
    };

    if (showModeSelector) {
        return (
            <GameModeSelector
                gameName="Laser"
                gameIcon={<Grid3x3 size={64} style={{ color: 'var(--neon-pink)' }} />}
                onDemoSelect={handleDemoSelect}
            />
        );
    }

    if (showDemoLimitReached) {
        return (
            <DemoLimitOverlay gameName="Gridy Laser" onSignIn={() => setShowAuthFlow?.(true)} />
        );
    }

    return (
        <div className={styles.container}>
            <GameInfoPanel
                isOpen={showInfo}
                onClose={() => setShowInfo(false)}
                gameName="Gridy Laser"
                rules={LASER_GAME_RULES}
            />

            {/* Full-screen Skull Overlay */}
            {showSkullOverlay && (
                <div className={styles.skullOverlay}>
                    <div className={styles.skullIcon}>
                        <svg viewBox="0 0 120 120" className={styles.skullSvg}>
                            {/* Skull head */}
                            <ellipse cx="60" cy="48" rx="42" ry="40" fill="#ff2a6d" />
                            {/* Left eye */}
                            <ellipse cx="42" cy="45" rx="12" ry="13" fill="#0a0a0a" />
                            {/* Right eye */}
                            <ellipse cx="78" cy="45" rx="12" ry="13" fill="#0a0a0a" />
                            {/* Nose */}
                            <path d="M55 60 L60 70 L65 60 Z" fill="#0a0a0a" />
                            {/* Jaw */}
                            <rect x="35" y="82" width="50" height="20" rx="5" fill="#ff2a6d" />
                            {/* Teeth gaps */}
                            <rect x="44" y="82" width="4" height="12" fill="#0a0a0a" />
                            <rect x="58" y="82" width="4" height="12" fill="#0a0a0a" />
                            <rect x="72" y="82" width="4" height="12" fill="#0a0a0a" />
                        </svg>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    <h1 className={styles.title}>
                        <Grid3x3 size={28} className={styles.titleIcon} />
                        GRIDY LASER
                    </h1>
                    <InfoButton onClick={() => setShowInfo(true)} />
                </div>
            </div>

            <div className={styles.gameLayout}>
                {/* Left Panel */}
                <div className={styles.controlPanel}>
                    <div className={styles.card}>
                        <h3>BET AMOUNT</h3>
                        <div className={styles.betInput}>
                            <span className={styles.currency}>$</span>
                            <input
                                type="number"
                                value={betAmount}
                                onChange={(e) => setBetAmount(Number(e.target.value))}
                                min={0.5}
                                max={100}
                                step={0.5}
                                disabled={gameState === 'playing' || isStarting}
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.quickBets}>
                            {[1, 5, 10, 25].map(amount => (
                                <button
                                    key={amount}
                                    onClick={() => setBetAmount(amount)}
                                    disabled={gameState === 'playing' || isStarting}
                                    className={styles.quickBtn}
                                >
                                    ${amount}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className={styles.card}>
                        <div className={styles.statsGrid}>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Turn</span>
                                <span className={styles.statValue}>{laserState.currentTurn}</span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Multiplier</span>
                                <span className={styles.statValueHighlight}>{currentMultiplier.toFixed(2)}x</span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Grid</span>
                                <span className={styles.statValue}>{laserState.columnsRemaining}×{laserState.rowsRemaining}</span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Cash Out</span>
                                <span className={styles.statValueGreen}>${(betAmount * currentMultiplier).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {errorMessage && (
                        <div className={styles.errorMessage}>{errorMessage}</div>
                    )}

                    {(gameState === 'idle' || gameState === 'lasered' || gameState === 'cashedOut') && (
                        <button onClick={startGame} disabled={!canBet(betAmount) || isStarting} className={styles.startBtn}>
                            {isStarting ? 'STARTING...' : gameState === 'idle' ? `START GAME ($${betAmount})` : `PLAY AGAIN ($${betAmount})`}
                        </button>
                    )}

                    {gameState === 'playing' && (
                        <>
                            <div className={styles.instruction}>
                                Click a cell to dodge the {laserState.currentTurn % 2 === 0 ? 'COLUMN' : 'ROW'} laser
                            </div>
                            <button
                                onClick={handleCashOut}
                                disabled={laserState.currentTurn === 0 || laserState.animatingIndex !== null || isResolving || isCashingOut}
                                className={styles.cashOutBtn}
                            >
                                {isCashingOut ? 'CASHING OUT...' : `CASH OUT $${(betAmount * currentMultiplier).toFixed(2)}`}
                            </button>
                        </>
                    )}

                    {gameState === 'cashedOut' && (
                        <div className={styles.resultWin}>
                            <span>WON ${(betAmount * currentMultiplier).toFixed(2)}</span>
                        </div>
                    )}

                    {gameState === 'lasered' && (
                        <div className={styles.resultLoss}>
                            <Skull size={20} />
                            <span>LASERED!</span>
                        </div>
                    )}
                </div>

                {/* Grid Area */}
                <div className={styles.gridWrapper}>
                    <div
                        className={styles.grid}
                        style={{
                            gridTemplateColumns: `repeat(${laserState.columnsRemaining}, 1fr)`,
                            gridTemplateRows: `repeat(${laserState.rowsRemaining}, 1fr)`,
                        }}
                    >
                        {Array.from({ length: laserState.rowsRemaining }, (_, row) => (
                            Array.from({ length: laserState.columnsRemaining }, (_, col) => {
                                const isAnimatingCol = laserState.animatingType === 'column' && laserState.animatingIndex === col;
                                const isAnimatingRow = laserState.animatingType === 'row' && laserState.animatingIndex === row;
                                const isSelected = laserState.lastSelectedCell?.row === row && laserState.lastSelectedCell?.col === col;
                                const isLasered = gameState === 'lasered' && isSelected;

                                return (
                                    <button
                                        key={`${row}-${col}`}
                                        className={`${styles.cell} 
                                            ${isAnimatingCol || isAnimatingRow ? styles.cellAnimating : ''}
                                            ${isLasered ? styles.cellLasered : ''}
                                            ${isSelected && !isLasered ? styles.cellPlayer : ''}
                                        `}
                                        onClick={() => handleCellClick(row, col)}
                                        disabled={gameState !== 'playing' || laserState.animatingIndex !== null || isResolving || isStarting}
                                    >
                                        {isLasered && <Skull size={14} />}
                                    </button>
                                );
                            })
                        )).flat()}
                    </div>

                    {/* Thermometer-style Multiplier Ladder */}
                    <div className={styles.thermometer}>
                        <div className={styles.thermometerTrack}>
                            {/* Progress fill */}
                            <div
                                className={styles.thermometerFill}
                                style={{
                                    height: `${(laserState.currentTurn / 18) * 100}%`
                                }}
                            />
                        </div>
                        <div className={styles.thermometerMarks}>
                            {FULL_MULTIPLIERS.slice().reverse().map(entry => {
                                const isMajor = MAJOR_MARKS.includes(entry.turn);
                                const isActive = laserState.currentTurn >= entry.turn;
                                const isHovered = hoveredTurn === entry.turn;

                                return (
                                    <div
                                        key={entry.turn}
                                        className={`${styles.thermometerMark} ${isMajor ? styles.thermometerMarkMajor : ''} ${isActive ? styles.thermometerMarkActive : ''}`}
                                        onMouseEnter={() => setHoveredTurn(entry.turn)}
                                        onMouseLeave={() => setHoveredTurn(null)}
                                    >
                                        <div className={styles.thermometerTick} />
                                        {(isMajor || isHovered) && (
                                            <>
                                                <span className={styles.thermometerTurn}>{entry.turn}</span>
                                                <span className={styles.thermometerMult}>{entry.multiplier.toFixed(entry.multiplier >= 10 ? 1 : 2)}x</span>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
