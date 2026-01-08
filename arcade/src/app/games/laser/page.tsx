'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useGame } from '@/lib/game-context';
import { useSound } from '@/lib/sounds';
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

// Full multiplier ladder for thermometer (all turns 1-18)
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

type GameState = 'idle' | 'playing' | 'lasered' | 'cashedOut';

interface LaserGameState {
    currentTurn: number;
    columnsRemaining: number;
    rowsRemaining: number;
    animatingIndex: number | null;
    animatingType: 'column' | 'row' | null;
    lastSelectedCell: { row: number; col: number } | null;
}

export default function LaserGame() {
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

    const currentMultiplier = useMemo(() => {
        if (laserState.currentTurn === 0) return 1.00;
        const entry = FULL_MULTIPLIERS.find(m => m.turn === laserState.currentTurn);
        return entry?.multiplier || 1.00;
    }, [laserState.currentTurn]);

    // Start game
    const startGame = useCallback(() => {
        if (!canBet(betAmount) || gameState === 'playing') return;

        stopSound('WIN');
        stopSound('EXPLOSION');
        stopSound('LASER_ZAP');

        playSound('CLICK');
        setGameState('playing');
        setShowSkullOverlay(false);
        setLaserState({
            currentTurn: 0,
            columnsRemaining: 10,
            rowsRemaining: 10,
            animatingIndex: null,
            animatingType: null,
            lastSelectedCell: null,
        });
    }, [canBet, betAmount, gameState, playSound, stopSound]);

    const handleCellClick = useCallback((row: number, col: number) => {
        if (gameState !== 'playing' || laserState.animatingIndex !== null) return;

        const isColumnAttack = laserState.currentTurn % 2 === 0;
        const remaining = isColumnAttack ? laserState.columnsRemaining : laserState.rowsRemaining;

        const laserTarget = Math.floor(Math.random() * remaining);

        setLaserState(prev => ({
            ...prev,
            animatingIndex: laserTarget,
            animatingType: isColumnAttack ? 'column' : 'row',
            lastSelectedCell: { row, col },
        }));
        playSound('LASER_ZAP');

        setTimeout(() => {
            const playerPosition = isColumnAttack ? col : row;
            const survived = playerPosition !== laserTarget;

            if (survived) {
                setLaserState(prev => ({
                    currentTurn: prev.currentTurn + 1,
                    columnsRemaining: isColumnAttack ? prev.columnsRemaining - 1 : prev.columnsRemaining,
                    rowsRemaining: !isColumnAttack ? prev.rowsRemaining - 1 : prev.rowsRemaining,
                    animatingIndex: null,
                    animatingType: null,
                    lastSelectedCell: null,
                }));
                playSound('CLICK');
            } else {
                setLaserState(prev => ({
                    ...prev,
                    animatingIndex: null,
                    animatingType: null,
                }));
                setGameState('lasered');
                setShowSkullOverlay(true);
                playSound('EXPLOSION');

                // Hide skull overlay after animation
                setTimeout(() => {
                    setShowSkullOverlay(false);
                }, 1500);

                addBetRecord({
                    game: 'laser',
                    betAmount,
                    outcome: 'loss',
                    multiplier: 0,
                    payout: 0,
                    gameParams: { survivedTurns: 0 },
                });
            }
        }, 700);
    }, [gameState, laserState, betAmount, playSound, addBetRecord]);

    // Cash out
    const handleCashOut = useCallback(() => {
        if (gameState !== 'playing' || laserState.currentTurn === 0) return;
        setGameState('cashedOut');
        playSound('WIN');

        const payout = betAmount * currentMultiplier;
        addBetRecord({
            game: 'laser',
            betAmount,
            outcome: 'win',
            multiplier: currentMultiplier,
            payout,
            gameParams: { survivedTurns: laserState.currentTurn },
        });
    }, [gameState, laserState.currentTurn, betAmount, currentMultiplier, playSound, addBetRecord]);

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
                                disabled={gameState === 'playing'}
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.quickBets}>
                            {[1, 5, 10, 25].map(amount => (
                                <button
                                    key={amount}
                                    onClick={() => setBetAmount(amount)}
                                    disabled={gameState === 'playing'}
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
                    {(gameState === 'idle' || gameState === 'lasered' || gameState === 'cashedOut') && (
                        <button onClick={startGame} disabled={!canBet(betAmount)} className={styles.startBtn}>
                            {gameState === 'idle' ? `START GAME ($${betAmount})` : `PLAY AGAIN ($${betAmount})`}
                        </button>
                    )}

                    {gameState === 'playing' && (
                        <>
                            <div className={styles.instruction}>
                                Click a cell to dodge the {laserState.currentTurn % 2 === 0 ? 'COLUMN' : 'ROW'} laser
                            </div>
                            <button
                                onClick={handleCashOut}
                                disabled={laserState.currentTurn === 0 || laserState.animatingIndex !== null}
                                className={styles.cashOutBtn}
                            >
                                CASH OUT ${(betAmount * currentMultiplier).toFixed(2)}
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
                                        disabled={gameState !== 'playing' || laserState.animatingIndex !== null}
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
