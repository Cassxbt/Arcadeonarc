'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useGame } from '@/lib/game-context';
import { useWalletIdentity } from '@/lib/wallet-identity';
import { useSound } from '@/lib/sounds';
import { authFetch, getRequestErrorMessage, readResponseError } from '@/lib/auth-fetch';
import { GAME_CONFIG } from '@/lib/constants';
import { TowerControl, Skull, Sparkles, Check } from '@/components/icons';
import { GameModeSelector } from '@/components/GameModeSelector';
import { DemoLimitOverlay } from '@/components/DemoLimitOverlay';
import { GameInfoPanel, InfoButton, TOWER_GAME_RULES } from '@/components/GameInfoPanel';
import styles from './page.module.css';

// Tower configuration
const TOWER_ROWS = GAME_CONFIG.TOWER_ROWS;
const TILE_PATTERN = GAME_CONFIG.TOWER_PATTERN;
const ROW_HEIGHT = 88; // Height of tile row + gap

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

type TowerServerState = {
    currentRow?: number;
    revealedDeaths?: Record<string, number>;
    selectedTiles?: Record<string, number>;
};

function buildTowerTiles(state?: TowerServerState): TileState[][] {
    const revealedDeaths = state?.revealedDeaths ?? {};
    const selectedTiles = state?.selectedTiles ?? {};

    return TILE_PATTERN.map((tileCount, rowIndex) =>
        Array.from({ length: tileCount }, (_, tileIndex) => {
            const deathTile = revealedDeaths[rowIndex];
            const selectedTile = selectedTiles[rowIndex];
            return {
                revealed: selectedTile === tileIndex || deathTile === tileIndex,
                isDeath: deathTile === tileIndex,
                isSelected: selectedTile === tileIndex,
            };
        })
    );
}

function buildRevealedDeathsMap(state?: TowerServerState): Map<number, number> {
    const entries: Array<[number, number]> = [];
    for (const [row, tile] of Object.entries(state?.revealedDeaths ?? {})) {
        const rowNumber = Number(row);
        const tileNumber = Number(tile);
        if (Number.isInteger(rowNumber) && Number.isInteger(tileNumber)) {
            entries.push([rowNumber, tileNumber]);
        }
    }
    return new Map(entries);
}

export default function TowerGame() {
    const { setShowAuthFlow } = useDynamicContext();
    const wallet = useWalletIdentity();
    const {
        betAmount,
        setBetAmount,
        canBet,
        addBetRecord,
        refreshBalance,
        betHistory,
        demoMode,
        toggleDemoMode,
        isDemoLimitReached,
    } = useGame();
    const { playSound, stopSound } = useSound();

    const [modeSelected, setModeSelected] = useState(false);
    const showModeSelector = !wallet.address && !demoMode && !modeSelected;
    const showDemoLimitReached = demoMode && isDemoLimitReached('tower');

    const [gameState, setGameState] = useState<GameState>('idle');
    const [currentRow, setCurrentRow] = useState(-1);
    const [tiles, setTiles] = useState<TileState[][]>([]);
    const [revealedDeaths, setRevealedDeaths] = useState<Map<number, number>>(new Map());
    const [currentMultiplier, setCurrentMultiplier] = useState(1);
    const [isShaking, setIsShaking] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [isRevealing, setIsRevealing] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isCashoutPending, setIsCashoutPending] = useState(false);
    const [lostBetAmount, setLostBetAmount] = useState(0);
    const [roundId, setRoundId] = useState<string | null>(null);
    const [roundVersion, setRoundVersion] = useState<number | null>(null);
    const [lastPayout, setLastPayout] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    const initializeGame = useCallback(() => {
        setTiles(buildTowerTiles());
        setRevealedDeaths(new Map());
        setCurrentRow(-1);
        setCurrentMultiplier(1);
        setIsShaking(false);
        setIsRevealing(false);
        setRoundId(null);
        setRoundVersion(null);
        setLastPayout(null);
    }, []);

    const startGame = useCallback(async () => {
        if (!canBet(betAmount) || isStarting || gameState === 'playing') return;

        stopSound('WIN');
        stopSound('LOSE');
        stopSound('CASH_OUT');

        initializeGame();
        setIsStarting(true);
        setErrorMessage(null);
        playSound('CLICK');

        try {
            if (demoMode) {
                setGameState('playing');
                setCurrentRow(0);
            } else {
                const response = await authFetch('/api/tower/reveal', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'start',
                        betAmount,
                    }),
                });

                if (!response.ok) {
                    throw new Error(await readResponseError(response, 'Failed to start tower round'));
                }

                const result = await response.json();
                const serverState = result.state as TowerServerState | undefined;
                const serverRow = typeof serverState?.currentRow === 'number'
                    ? serverState.currentRow
                    : typeof result.currentRow === 'number'
                        ? result.currentRow
                        : 0;
                const nextRow = Math.min(Math.max(serverRow, 0), TOWER_ROWS - 1);

                setRoundId(result.roundId);
                setRoundVersion(result.version);
                setTiles(buildTowerTiles(serverState));
                setRevealedDeaths(buildRevealedDeathsMap(serverState));
                setCurrentMultiplier(nextRow > 0 ? MULTIPLIERS[nextRow - 1] : 1);
                if (typeof result.betAmount === 'number') {
                    setBetAmount(result.betAmount);
                }
                setGameState('playing');
                setCurrentRow(nextRow);
                void refreshBalance();
            }
        } catch (error) {
            console.error('Tower start error:', error);
            setErrorMessage(getRequestErrorMessage(error, 'Failed to start tower round'));
            setGameState('idle');
            if (!demoMode) {
                void refreshBalance();
            }
        } finally {
            setIsStarting(false);
        }
    }, [betAmount, canBet, demoMode, gameState, initializeGame, isStarting, playSound, refreshBalance, setBetAmount, stopSound]);

    const handleTileClick = useCallback(async (rowIndex: number, tileIndex: number) => {
        if (gameState !== 'playing') return;
        if (rowIndex !== currentRow) return;
        if (isRevealing) return;
        if (!demoMode && (!roundId || roundVersion === null)) return;

        setIsRevealing(true);
        setErrorMessage(null);
        let keepRevealLock = false;
        setTiles(prev => {
            const newTiles = [...prev];
            newTiles[rowIndex] = newTiles[rowIndex].map((tile, i) => ({
                ...tile,
                isSelected: i === tileIndex,
            }));
            return newTiles;
        });
        playSound('CLICK');

        try {
            let deathTile: number;
            let outcome: 'safe' | 'loss' | 'win';
            let nextVersion: number | null = null;
            let serverMultiplier = MULTIPLIERS[rowIndex];
            let serverPayout = betAmount * serverMultiplier;

            if (demoMode) {
                deathTile = Math.floor(Math.random() * TILE_PATTERN[rowIndex]);
                outcome = deathTile === tileIndex
                    ? 'loss'
                    : rowIndex === TOWER_ROWS - 1
                        ? 'win'
                        : 'safe';
            } else {
                const response = await authFetch('/api/tower/reveal', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'reveal',
                        roundId,
                        version: roundVersion,
                        row: rowIndex,
                        tileIndex,
                    }),
                });

                if (!response.ok) {
                    throw new Error(await readResponseError(response, 'Failed to reveal tile'));
                }

                const result = await response.json();
                deathTile = result.deathTile;
                outcome = result.outcome;
                nextVersion = result.version ?? null;
                serverMultiplier = result.multiplier ?? serverMultiplier;
                serverPayout = result.payout ?? serverPayout;
            }

            setRevealedDeaths(prev => new Map(prev).set(rowIndex, deathTile));

            setTiles(prev => {
                const newTiles = [...prev];
                newTiles[rowIndex] = newTiles[rowIndex].map((tile, i) => ({
                    ...tile,
                    revealed: i === tileIndex || i === deathTile,
                    isSelected: i === tileIndex,
                    isDeath: i === deathTile,
                }));
                return newTiles;
            });

            if (outcome === 'loss') {
                playSound('LOSE');
                setIsShaking(true);
                setTimeout(() => setIsShaking(false), 400);
                setLostBetAmount(betAmount);
                setGameState('lost');
                setLastPayout(0);
                if (demoMode) {
                    addBetRecord({
                        game: 'tower',
                        betAmount,
                        outcome: 'loss',
                        multiplier: 0,
                        payout: 0,
                        gameParams: { row: rowIndex, outcome: 'loss' },
                    });
                } else {
                    void refreshBalance();
                }
            } else if (outcome === 'win') {
                playSound('WIN');
                setCurrentMultiplier(serverMultiplier);
                setLastPayout(serverPayout);
                setGameState('won');
                if (demoMode) {
                    addBetRecord({
                        game: 'tower',
                        betAmount,
                        outcome: 'win',
                        multiplier: serverMultiplier,
                        payout: serverPayout,
                        gameParams: { row: rowIndex, outcome: 'win' },
                    });
                } else {
                    void refreshBalance();
                }
            } else {
                setCurrentMultiplier(serverMultiplier);
                if (nextVersion !== null) {
                    setRoundVersion(nextVersion);
                }
                keepRevealLock = true;
                setTimeout(() => {
                    setCurrentRow(rowIndex + 1);
                    setIsRevealing(false);
                }, 120);
            }
        } catch (error) {
            console.error('Tile reveal error:', error);
            setErrorMessage(getRequestErrorMessage(error, 'Failed to reveal tile'));
            setTiles(prev => {
                const newTiles = [...prev];
                newTiles[rowIndex] = newTiles[rowIndex].map(tile => ({
                    ...tile,
                    isSelected: tile.revealed ? tile.isSelected : false,
                }));
                return newTiles;
            });
            if (!demoMode) {
                void refreshBalance();
            }
        } finally {
            if (!keepRevealLock) {
                setIsRevealing(false);
            }
        }
    }, [gameState, currentRow, isRevealing, demoMode, roundId, roundVersion, betAmount, playSound, addBetRecord, refreshBalance]);

    const cashOut = useCallback(async () => {
        if (gameState !== 'playing' || currentRow < 0) return;
        if (isCashoutPending) return;
        if (!demoMode && (!roundId || roundVersion === null)) return;

        setIsCashoutPending(true);
        setErrorMessage(null);

        try {
            let payout = betAmount * currentMultiplier;
            let multiplier = currentMultiplier;
            let completedRow = Math.max(0, currentRow - 1);

            if (!demoMode) {
                const response = await authFetch('/api/tower/reveal', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'cashout',
                        roundId,
                        version: roundVersion,
                    }),
                });

                if (!response.ok) {
                    throw new Error(await readResponseError(response, 'Failed to cash out'));
                }

                const result = await response.json();
                payout = result.payout;
                multiplier = result.multiplier;
                completedRow = result.row;
            }

            playSound('CASH_OUT');
            setCurrentMultiplier(multiplier);
            setLastPayout(payout);
            setGameState('won');

            if (demoMode) {
                addBetRecord({
                    game: 'tower',
                    betAmount,
                    outcome: 'win',
                    multiplier,
                    payout,
                    gameParams: { row: completedRow, outcome: 'win' },
                });
            } else {
                void refreshBalance();
            }

            setTiles(prev => prev.map((row, rowIndex) =>
                row.map((tile, tileIndex) => ({
                    ...tile,
                    revealed: revealedDeaths.has(rowIndex) ? true : tile.revealed,
                    isDeath: revealedDeaths.get(rowIndex) === tileIndex,
                }))
            ));
        } catch (error) {
            console.error('Tower cashout error:', error);
            setErrorMessage(getRequestErrorMessage(error, 'Failed to cash out'));
            setGameState('playing');
            if (!demoMode) {
                void refreshBalance();
            }
        } finally {
            setIsCashoutPending(false);
        }
    }, [gameState, currentRow, isCashoutPending, demoMode, roundId, roundVersion, betAmount, currentMultiplier, revealedDeaths, playSound, addBetRecord, refreshBalance]);

    useEffect(() => {
        initializeGame();
    }, [initializeGame]);

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
            {/* Info Panel */}
            <GameInfoPanel
                isOpen={showInfo}
                onClose={() => setShowInfo(false)}
                gameName="Tower"
                rules={TOWER_GAME_RULES}
            />

            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <h1 className={styles.title}>
                        <TowerControl size={32} style={{ color: 'var(--neon-cyan)', filter: 'drop-shadow(0 0 12px var(--neon-cyan))' }} />
                        Tower
                    </h1>
                    <InfoButton onClick={() => setShowInfo(true)} />
                </div>
                <p className={styles.subtitle}>Climb the tower. Cash out or risk it all.</p>
            </div>

            <div className={styles.gameLayout}>
                {/* Left Panel - Controls */}
                <div className={styles.controlPanel}>
                    {/* Bet Amount Card */}
                    <div className={styles.card}>
                        <h3>Bet Amount</h3>
                        <div className={styles.betControls}>
                            <button
                                className={styles.betAdjustBtn}
                                onClick={() => setBetAmount(Math.max(0.5, betAmount - 0.5))}
                                disabled={gameState === 'playing' || isStarting}
                            >
                                −
                            </button>
                            <div className={styles.betInputWrapper}>
                                <span className={styles.betCurrency}>$</span>
                                <input
                                    type="text"
                                    value={betAmount}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (!isNaN(val)) setBetAmount(val);
                                    }}
                                    disabled={gameState === 'playing' || isStarting}
                                    className={styles.betInput}
                                />
                            </div>
                            <button
                                className={styles.betAdjustBtn}
                                onClick={() => setBetAmount(Math.min(100, betAmount + 0.5))}
                                disabled={gameState === 'playing' || isStarting}
                            >
                                +
                            </button>
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

                    {/* Game Info Card - Shows stats during idle, multiplier during game */}
                    <div className={styles.card}>
                        {gameState === 'idle' && (
                            <>
                                <h3>Next Game</h3>
                                <div className={styles.statsGrid}>
                                    <div className={styles.statItem}>
                                        <span className={styles.statLabel}>Starting Multi</span>
                                        <span className={styles.statValue}>{MULTIPLIERS[0]}×</span>
                                    </div>
                                    <div className={styles.statItem}>
                                        <span className={styles.statLabel}>Max Multi</span>
                                        <span className={styles.statValueHighlight}>{MULTIPLIERS[TOWER_ROWS - 1]}×</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {gameState === 'playing' && (
                            <>
                                <h3>Current Game</h3>
                                <div className={styles.multiplierDisplay}>
                                    <span className={styles.currentMultiplier}>
                                        {currentMultiplier.toFixed(2)}×
                                    </span>
                                    <span className={styles.potentialWin}>
                                        ${(betAmount * currentMultiplier).toFixed(2)}
                                    </span>
                                </div>
                            </>
                        )}

                        {(gameState === 'won' || gameState === 'lost') && (
                            <>
                                <h3>Result</h3>
                                <div className={styles.resultDisplay}>
                                    {gameState === 'won' ? (
                                        <>
                                            <span className={styles.resultWon}>
                                                +${(lastPayout ?? betAmount * currentMultiplier).toFixed(2)}
                                            </span>
                                            <span className={styles.resultLabel}>at {currentMultiplier.toFixed(2)}×</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className={styles.resultLost}>-${lostBetAmount.toFixed(2)}</span>
                                            <span className={styles.resultLabel}>Better luck next time</span>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Action Button */}
                    {errorMessage && (
                        <div className={styles.errorMessage}>{errorMessage}</div>
                    )}

                    {gameState === 'idle' && (
                        <button
                            onClick={startGame}
                            disabled={!canBet(betAmount) || isStarting}
                            className={styles.primaryBtn}
                        >
                            {isStarting ? 'Starting...' : 'Play'}
                        </button>
                    )}

                    {gameState === 'playing' && currentRow > 0 && (
                        <button onClick={cashOut} disabled={isCashoutPending} className={styles.cashoutBtn}>
                            {isCashoutPending ? 'Cashing Out...' : `Cash Out $${(betAmount * currentMultiplier).toFixed(2)}`}
                        </button>
                    )}

                    {gameState === 'playing' && currentRow === 0 && (
                        <button disabled className={styles.primaryBtn}>
                            {isStarting ? 'Starting...' : 'Pick a Tile'}
                        </button>
                    )}

                    {(gameState === 'won' || gameState === 'lost') && (
                        <button onClick={startGame} className={styles.primaryBtn}>
                            Play Again
                        </button>
                    )}
                </div>

                {/* Center - Game Area */}
                <div className={styles.gameArea}>
                    <div className={styles.towerViewport}>
                        <div
                            className={`${styles.towerContainer} ${isShaking ? styles.shaking : ''}`}
                            style={{ transform: `translateY(${cameraOffset}px)` }}
                        >
                            {/* Render rows: Row 19 (high) at TOP, Row 0 (low) at BOTTOM */}
                            {[...Array(TOWER_ROWS)].map((_, idx) => {
                                const rowIndex = TOWER_ROWS - 1 - idx;
                                const tileCount = TILE_PATTERN[rowIndex];
                                const rowTiles = tiles[rowIndex] || [];
                                const isActive = rowIndex === currentRow;
                                const isCompleted = rowIndex < currentRow;
                                const multiplier = MULTIPLIERS[rowIndex];

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
                                            {multiplier.toFixed(2)}×
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
                                                if (isSelected && !isRevealed) {
                                                    tileClass += ` ${styles.tileSelected}`;
                                                }

                                                return (
                                                    <button
                                                        key={tileIndex}
                                                        onClick={() => handleTileClick(rowIndex, tileIndex)}
                                                        disabled={!isActive || gameState !== 'playing' || isRevealing || isStarting}
                                                        className={tileClass}
                                                    >
                                                        {!isRevealed && (
                                                            <span className={styles.tileQuestion}>?</span>
                                                        )}
                                                        {isRevealed && isDeath && (
                                                            <Skull size={28} className={styles.skullIcon} />
                                                        )}
                                                        {isRevealed && !isDeath && isSelected && (
                                                            <Check size={28} className={styles.checkIcon} />
                                                        )}
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
                                <div className={styles.winContent}>
                                    <Sparkles size={48} className={styles.winIcon} />
                                    <h2>CASHED OUT!</h2>
                                    <div className={styles.winMultiplier}>{currentMultiplier.toFixed(2)}×</div>
                                    <div className={styles.winAmount}>
                                        +${(lastPayout ?? betAmount * currentMultiplier).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Lose Overlay */}
                        {gameState === 'lost' && (
                            <div className={`${styles.overlay} ${styles.overlayLose}`} onClick={() => setGameState('idle')}>
                                <div className={styles.loseContent}>
                                    <Skull size={56} className={styles.loseIcon} />
                                    <h2>BUSTED!</h2>
                                    <div className={styles.loseAmount}>-${lostBetAmount.toFixed(2)}</div>
                                    <button className={styles.overlayClose} onClick={() => setGameState('idle')}>×</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Stats */}
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
                                    {bet.outcome === 'win' ? `${bet.multiplier.toFixed(2)}×` : 'BUST'}
                                </span>
                                <span className={styles.historyAmount}>
                                    {bet.outcome === 'win' ? `+$${bet.payout.toFixed(2)}` : `-$${bet.betAmount.toFixed(2)}`}
                                </span>
                            </div>
                        ))}
                        {towerHistory.length === 0 && (
                            <div className={styles.emptyHistory}>
                                No games yet. Start playing!
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
