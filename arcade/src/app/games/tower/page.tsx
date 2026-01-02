'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useGame } from '@/lib/game-context';
import { useSound } from '@/lib/sounds';
import { GAME_CONFIG } from '@/lib/constants';
import { TowerControl, Dice6, Bomb, Skull } from '@/components/icons';
import { GameModeSelector } from '@/components/GameModeSelector';
import { DemoLimitOverlay } from '@/components/DemoLimitOverlay';
import styles from './page.module.css';

// Tower configuration
const TOWER_ROWS = GAME_CONFIG.TOWER_ROWS;
const TILE_PATTERN = GAME_CONFIG.TOWER_PATTERN;
const VISIBLE_ROWS = 4; // Only show 4 rows at a time
const ROW_HEIGHT = 88; // Height of tile row + gap

// Calculate multipliers based on probability
function calculateMultiplier(row: number): number {
    let cumulativeProbability = 1;
    for (let i = 0; i <= row; i++) {
        const tiles = TILE_PATTERN[i];
        const survivalRate = (tiles - 1) / tiles;
        cumulativeProbability *= survivalRate;
    }
    return Number((1 / cumulativeProbability * 0.9).toFixed(2));
}

const MULTIPLIERS = Array.from({ length: TOWER_ROWS }, (_, i) => calculateMultiplier(i));

type GameState = 'idle' | 'playing' | 'won' | 'lost';

interface TileState {
    revealed: boolean;
    isDeath: boolean;
    isSelected: boolean;
}

export default function TowerGame() {
    const { primaryWallet, setShowAuthFlow } = useDynamicContext();
    const {
        effectiveBalance,
        betAmount,
        setBetAmount,
        canBet,
        addBetRecord,
        betHistory,
        demoMode,
        toggleDemoMode,
        isDemoLimitReached,
        getRemainingDemoPlays,
    } = useGame();
    const { playSound } = useSound();

    // Mode selection state - show selector if not signed in and not in demo
    const [modeSelected, setModeSelected] = useState(false);
    const showModeSelector = !primaryWallet && !demoMode && !modeSelected;
    const showDemoLimitReached = demoMode && isDemoLimitReached('tower');

    const [gameState, setGameState] = useState<GameState>('idle');
    const [currentRow, setCurrentRow] = useState(-1);
    const [tiles, setTiles] = useState<TileState[][]>([]);
    const [deathPositions, setDeathPositions] = useState<number[]>([]);
    const [currentMultiplier, setCurrentMultiplier] = useState(1);
    const [isShaking, setIsShaking] = useState(false);

    // Calculate camera offset based on current row
    // Positive value moves tower DOWN on screen.
    // Player starts at bottom (Row 0). As they climb to Row 1, 2...
    // the tower slides DOWN to keep the active row visible near the bottom.
    const cameraOffset = useMemo(() => {
        if (currentRow < 0) return 0;
        return currentRow * ROW_HEIGHT;
    }, [currentRow]);

    // Stats calculations
    const towerHistory = useMemo(() =>
        betHistory.filter(b => b.game === 'tower').slice(-20),
        [betHistory]
    );

    const stats = useMemo(() => {
        const wins = towerHistory.filter(b => b.outcome === 'win').length;
        const total = towerHistory.length;
        const biggestWin = Math.max(...towerHistory.filter(b => b.outcome === 'win').map(b => b.payout), 0);
        const totalWagered = towerHistory.reduce((sum, b) => sum + b.betAmount, 0);
        const totalWon = towerHistory.filter(b => b.outcome === 'win').reduce((sum, b) => sum + b.payout, 0);
        const profit = totalWon - totalWagered;

        return {
            gamesPlayed: total,
            winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
            biggestWin: biggestWin.toFixed(2),
            profit: profit.toFixed(2),
            profitPositive: profit >= 0
        };
    }, [towerHistory]);

    // Initialize game grid
    const initializeGame = useCallback(() => {
        const deaths = TILE_PATTERN.map(tileCount =>
            Math.floor(Math.random() * tileCount)
        );
        setDeathPositions(deaths);

        const newTiles = TILE_PATTERN.map(tileCount =>
            Array.from({ length: tileCount }, () => ({
                revealed: false,
                isDeath: false,
                isSelected: false,
            }))
        );
        setTiles(newTiles);
        setCurrentRow(-1);
        setCurrentMultiplier(1);
        setIsShaking(false);
    }, []);

    const startGame = useCallback(() => {
        if (!canBet(betAmount)) return;
        initializeGame();
        setGameState('playing');
        setCurrentRow(0);
        playSound('CLICK');
    }, [betAmount, canBet, initializeGame, playSound]);

    const handleTileClick = useCallback((rowIndex: number, tileIndex: number) => {
        if (gameState !== 'playing') return;
        if (rowIndex !== currentRow) return;

        const isDeath = deathPositions[rowIndex] === tileIndex;

        setTiles(prev => {
            const newTiles = [...prev];
            // Only reveal the clicked tile + mark as selected
            newTiles[rowIndex] = newTiles[rowIndex].map((tile, i) => ({
                ...tile,
                revealed: i === tileIndex ? true : tile.revealed,
                isSelected: i === tileIndex,
                // On loss, reveal deaths. On win, we only reveal the clicked one here.
                // Loss logic below handles revealing deaths if needed.
                isDeath: deathPositions[rowIndex] === i,
            }));
            return newTiles;
        });

        if (isDeath) {
            playSound('LOSE');
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 400);
            setGameState('lost');
            addBetRecord({
                game: 'tower',
                betAmount,
                outcome: 'loss',
                multiplier: 0,
                payout: 0,
            });
        } else {
            playSound('CLICK');
            const newMultiplier = MULTIPLIERS[rowIndex];
            setCurrentMultiplier(newMultiplier);

            if (rowIndex === TOWER_ROWS - 1) {
                cashOut();
            } else {
                setTimeout(() => setCurrentRow(rowIndex + 1), 300);
            }
        }
    }, [gameState, currentRow, deathPositions, betAmount, playSound, addBetRecord]);

    const cashOut = useCallback(() => {
        if (gameState !== 'playing' || currentRow < 0) return;

        const payout = betAmount * currentMultiplier;
        playSound('CASH_OUT');
        setGameState('won');
        addBetRecord({
            game: 'tower',
            betAmount,
            outcome: 'win',
            multiplier: currentMultiplier,
            payout,
        });

        // Reveal all death tiles
        setTiles(prev => prev.map((row, rowIndex) =>
            row.map((tile, tileIndex) => ({
                ...tile,
                revealed: true,
                isDeath: deathPositions[rowIndex] === tileIndex,
            }))
        ));
    }, [gameState, currentRow, betAmount, currentMultiplier, deathPositions, playSound, addBetRecord]);

    useEffect(() => {
        initializeGame();
    }, [initializeGame]);

    // Render only visible rows (4 at a time, centered on current row)
    const visibleRowIndices = useMemo(() => {
        const start = Math.max(0, currentRow - 1);
        const end = Math.min(TOWER_ROWS, start + VISIBLE_ROWS);
        return Array.from({ length: end - start }, (_, i) => start + i);
    }, [currentRow]);

    // Handle demo mode selection
    const handleDemoSelect = () => {
        toggleDemoMode();
        setModeSelected(true);
    };

    // If user needs to select mode, show the selector
    if (showModeSelector) {
        return (
            <GameModeSelector
                gameName="Tower"
                gameIcon={<TowerControl size={64} style={{ color: 'var(--neon-cyan)' }} />}
                onDemoSelect={handleDemoSelect}
            />
        );
    }

    // If demo limit reached, show overlay
    if (showDemoLimitReached) {
        return (
            <DemoLimitOverlay gameName="Tower" onSignIn={() => setShowAuthFlow?.(true)} />
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.gameLayout}>
                {/* Left Nav */}
                <div className={styles.leftNav}>
                    <div className={`${styles.navIcon} ${styles.navIconActive}`}>
                        <TowerControl size={24} style={{ color: 'var(--neon-cyan)', filter: 'drop-shadow(0 0 8px var(--neon-cyan))' }} />
                    </div>
                    <div className={styles.navIcon}>
                        <Dice6 size={24} style={{ color: 'var(--neon-green)' }} />
                    </div>
                    <div className={styles.navIcon}>
                        <Bomb size={24} style={{ color: 'var(--neon-pink)' }} />
                    </div>
                </div>

                {/* Game Area */}
                <div className={styles.gameArea}>
                    <div className={styles.towerViewport}>
                        <div
                            className={`${styles.towerContainer} ${isShaking ? styles.shaking : ''}`}
                            style={{ transform: `translateY(${cameraOffset}px)` }}
                        >
                            {/* Render rows: Row 19 (high) at TOP, Row 0 (low) at BOTTOM */}
                            {/* Player starts at bottom and climbs up */}
                            {[...Array(TOWER_ROWS)].map((_, idx) => {
                                const rowIndex = TOWER_ROWS - 1 - idx; // Row 19 at top, Row 0 at bottom
                                const tileCount = TILE_PATTERN[rowIndex];
                                const rowTiles = tiles[rowIndex] || [];
                                const isActive = rowIndex === currentRow;
                                const isCompleted = rowIndex < currentRow;
                                const multiplier = MULTIPLIERS[rowIndex];

                                // Only render rows that are near the viewport (3-4 rows visible)
                                if (Math.abs(rowIndex - currentRow) > 2 && currentRow >= 0) {
                                    return <div key={rowIndex} style={{ height: ROW_HEIGHT }} />;
                                }

                                return (
                                    <div
                                        key={rowIndex}
                                        className={`
                                            ${styles.row}
                                            ${isActive ? styles.rowActive : ''}
                                            ${isCompleted ? styles.rowCompleted : ''}
                                        `}
                                    >
                                        <div className={styles.multiplier}>
                                            {multiplier.toFixed(2)}x
                                        </div>
                                        <div className={styles.tilesWrapper}>
                                            {Array.from({ length: tileCount }, (_, tileIndex) => {
                                                const tile = rowTiles[tileIndex];
                                                const isRevealed = tile?.revealed;
                                                const isDeath = tile?.isDeath;
                                                const isSelected = tile?.isSelected;

                                                let tileClass = styles.tile;
                                                if (isActive && gameState === 'playing') {
                                                    tileClass += ` ${styles.tileClickable}`;
                                                }
                                                if (isRevealed && !isDeath) {
                                                    tileClass += ` ${styles.tileSafe}`;
                                                }
                                                if (isRevealed && isDeath) {
                                                    tileClass += ` ${styles.tileDeathRevealed}`;
                                                }

                                                return (
                                                    <button
                                                        key={tileIndex}
                                                        onClick={() => handleTileClick(rowIndex, tileIndex)}
                                                        disabled={!isActive || gameState !== 'playing'}
                                                        className={tileClass}
                                                    >
                                                        {isRevealed && isDeath && (
                                                            <Skull size={24} style={{ color: 'white' }} />
                                                        )}
                                                        {isRevealed && !isDeath && isSelected && ''}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Win Overlay */}
                        {gameState === 'won' && (
                            <div className={`${styles.overlay} ${styles.overlayWin}`}>
                                <h2>Cashed Out</h2>
                                <div className={styles.amount}>
                                    ${(betAmount * currentMultiplier).toFixed(2)}
                                </div>
                            </div>
                        )}

                        {/* Lose Overlay */}
                        {gameState === 'lost' && (
                            <div className={`${styles.overlay} ${styles.overlayLose}`}>
                                <h2>BUSTED</h2>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className={styles.sidebar}>
                    <div className={styles.sidebarHeader}>Your Stats</div>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>Games</span>
                            <span className={styles.statValue}>{stats.gamesPlayed}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>Win Rate</span>
                            <span className={`${styles.statValue} ${styles.statValueGreen}`}>
                                {stats.winRate}%
                            </span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>Best Win</span>
                            <span className={`${styles.statValue} ${styles.statValueGreen}`}>
                                ${stats.biggestWin}
                            </span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>Profit</span>
                            <span className={`${styles.statValue} ${stats.profitPositive ? styles.statValueGreen : styles.statValueRed}`}>
                                {stats.profitPositive ? '+' : ''}${stats.profit}
                            </span>
                        </div>
                    </div>

                    <div className={styles.historyHeader}>Recent Games</div>
                    <div className={styles.historyList}>
                        {towerHistory.slice().reverse().slice(0, 10).map((bet, idx) => (
                            <div
                                key={idx}
                                className={`${styles.historyItem} ${bet.outcome === 'win' ? styles.historyWin : styles.historyLoss}`}
                            >
                                <span className={styles.historyMultiplier}>
                                    {bet.outcome === 'win' ? `${bet.multiplier.toFixed(2)}x` : 'BUST'}
                                </span>
                                <span className={styles.historyAmount}>
                                    {bet.outcome === 'win' ? `+$${bet.payout.toFixed(2)}` : `-$${bet.betAmount.toFixed(2)}`}
                                </span>
                            </div>
                        ))}
                        {towerHistory.length === 0 && (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#444', fontSize: '0.85rem' }}>
                                No games yet. Start playing!
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Control Panel */}
                <div className={styles.controlPanel}>
                    {gameState === 'playing' && currentRow >= 0 && (
                        <div className={styles.multiplierDisplay}>
                            <span className={styles.currentMultiplier}>
                                {currentMultiplier.toFixed(2)}x
                            </span>
                            <span className={styles.potentialWin}>
                                {(betAmount * currentMultiplier).toFixed(4)}
                            </span>
                        </div>
                    )}

                    <div className={styles.actionRow}>
                        <div className={styles.betInput}>
                            <span>$</span>
                            <input
                                type="number"
                                value={betAmount}
                                onChange={(e) => setBetAmount(Number(e.target.value))}
                                min={0.5}
                                max={100}
                                step={0.5}
                                disabled={gameState === 'playing'}
                            />
                        </div>

                        {gameState === 'idle' && (
                            <button
                                onClick={startGame}
                                disabled={!canBet(betAmount)}
                                className={styles.primaryBtn}
                            >
                                Play
                            </button>
                        )}

                        {gameState === 'playing' && currentRow > 0 && (
                            <button onClick={cashOut} className={styles.cashoutBtn}>
                                Cash Out
                            </button>
                        )}

                        {gameState === 'playing' && currentRow === 0 && (
                            <button disabled className={styles.primaryBtn}>
                                Pick a Tile
                            </button>
                        )}

                        {(gameState === 'won' || gameState === 'lost') && (
                            <button onClick={startGame} className={styles.primaryBtn}>
                                Play Again
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
