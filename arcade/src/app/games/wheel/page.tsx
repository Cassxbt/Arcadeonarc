'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useGame } from '@/lib/game-context';
import { useSound } from '@/lib/sounds';
import { FerrisWheel, Target, BarChart3 } from '@/components/icons';
import { GameModeSelector } from '@/components/GameModeSelector';
import { DemoLimitOverlay } from '@/components/DemoLimitOverlay';
import { GameInfoPanel, InfoButton } from '@/components/GameInfoPanel';
import styles from './page.module.css';

const WHEEL_GAME_RULES = [
    {
        icon: <Target size={20} style={{ color: 'var(--neon-cyan)' }} />,
        title: 'Objective',
        content: 'Spin the wheel and hope it lands on a high multiplier to win big!',
    },
    {
        icon: <BarChart3 size={20} style={{ color: 'var(--neon-green)' }} />,
        title: 'Multipliers',
        content: 'The wheel has 20 segments with multipliers: 0x (loss), 1.5x, 1.8x, 2x, 3x, and 5x!',
    },
    {
        icon: <FerrisWheel size={20} style={{ color: 'var(--neon-purple)' }} />,
        title: 'Simple Gameplay',
        content: 'Just place your bet and spin. No decisions to make - pure luck!',
    },
];

// Wheel segment configuration (20 segments) - balanced with 8 losses (40%)
const SEGMENTS = [
    { multiplier: 0, color: '#5a5a5a' },      // Gray (loss)
    { multiplier: 1.5, color: '#39ff14' },    // Green
    { multiplier: 0, color: '#5a5a5a' },      // Gray (loss)
    { multiplier: 1.8, color: '#66ff33' },    // Light Green
    { multiplier: 0, color: '#5a5a5a' },      // Gray (loss)
    { multiplier: 2, color: '#ffdd00' },      // Yellow
    { multiplier: 1.5, color: '#39ff14' },    // Green
    { multiplier: 0, color: '#5a5a5a' },      // Gray (loss)
    { multiplier: 3, color: '#ff9500' },      // Orange
    { multiplier: 1.5, color: '#39ff14' },    // Green
    { multiplier: 0, color: '#5a5a5a' },      // Gray (loss)
    { multiplier: 1.8, color: '#66ff33' },    // Light Green
    { multiplier: 0, color: '#5a5a5a' },      // Gray (loss)
    { multiplier: 2, color: '#ffdd00' },      // Yellow
    { multiplier: 5, color: '#9d4edd' },      // Purple (Jackpot)
    { multiplier: 1.5, color: '#39ff14' },    // Green
    { multiplier: 0, color: '#5a5a5a' },      // Gray (loss)
    { multiplier: 1.8, color: '#66ff33' },    // Light Green
    { multiplier: 0, color: '#5a5a5a' },      // Gray (loss)
    { multiplier: 3, color: '#ff9500' },      // Orange
];

type GameState = 'idle' | 'spinning' | 'result';

export default function WheelGame() {
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
    const showDemoLimitReached = demoMode && isDemoLimitReached('wheel');

    const [gameState, setGameState] = useState<GameState>('idle');
    const [currentRotation, setCurrentRotation] = useState(0);
    const [resultSegment, setResultSegment] = useState<number | null>(null);
    const [recentResults, setRecentResults] = useState<number[]>([]);
    const [showInfo, setShowInfo] = useState(false);

    const resultInfo = useMemo(() => {
        if (resultSegment === null) return null;
        const segment = SEGMENTS[resultSegment];
        return {
            multiplier: segment.multiplier,
            payout: betAmount * segment.multiplier,
            color: segment.color,
            isWin: segment.multiplier > 0,
        };
    }, [resultSegment, betAmount]);

    // Spin the wheel
    const spinWheel = useCallback(() => {
        if (!canBet(betAmount) || gameState !== 'idle') return;

        stopSound('WIN');
        stopSound('LOSE');
        stopSound('WHEEL_SPIN');

        playSound('CLICK');
        setGameState('spinning');
        setResultSegment(null);

        // Start the wheel spin sound (looped for duration of spin)
        playSound('WHEEL_SPIN', { loop: true });

        // Generate random segment (0-19)
        const targetSegment = Math.floor(Math.random() * 20);

        const segmentAngle = 360 / 20;
        const fullSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full rotations
        // Pointer is at top (0deg), adjust for segment positioning
        const segmentPosition = 360 - (targetSegment * segmentAngle) - (segmentAngle / 2);
        const targetRotation = currentRotation + (fullSpins * 360) + segmentPosition - (currentRotation % 360);

        setCurrentRotation(targetRotation);

        // After spin animation completes (5 seconds)
        setTimeout(() => {
            // Stop the wheel spin sound
            stopSound('WHEEL_SPIN');

            const segment = SEGMENTS[targetSegment];
            setResultSegment(targetSegment);
            setGameState('result');

            setRecentResults(prev => [segment.multiplier, ...prev].slice(0, 3));

            if (segment.multiplier > 0) {
                playSound('WIN');
                addBetRecord({
                    game: 'wheel',
                    betAmount,
                    outcome: 'win',
                    multiplier: segment.multiplier,
                    payout: betAmount * segment.multiplier,
                    gameParams: { segment: targetSegment },
                });
            } else {
                playSound('LOSE');
                addBetRecord({
                    game: 'wheel',
                    betAmount,
                    outcome: 'loss',
                    multiplier: 0,
                    payout: 0,
                    gameParams: { segment: targetSegment },
                });
            }

            setTimeout(() => {
                setGameState('idle');
            }, 2000);
        }, 5000);
    }, [canBet, betAmount, gameState, currentRotation, playSound, stopSound, addBetRecord]);

    const handleQuickBet = (amount: number) => {
        if (gameState === 'spinning') return;
        setBetAmount(amount);
    };

    const handleHalfBet = () => {
        if (gameState === 'spinning') return;
        setBetAmount(Math.max(0.5, betAmount / 2));
    };

    const handleDoubleBet = () => {
        if (gameState === 'spinning') return;
        setBetAmount(Math.min(effectiveBalance, betAmount * 2));
    };

    const handleDemoSelect = () => {
        toggleDemoMode();
        setModeSelected(true);
    };

    // If user needs to select mode, show the selector
    if (showModeSelector) {
        return (
            <GameModeSelector
                gameName="Wheel"
                gameIcon={<FerrisWheel size={64} style={{ color: 'var(--neon-purple)' }} />}
                onDemoSelect={handleDemoSelect}
            />
        );
    }

    // If demo limit reached, show overlay
    if (showDemoLimitReached) {
        return (
            <DemoLimitOverlay gameName="Wheel" onSignIn={() => setShowAuthFlow?.(true)} />
        );
    }

    return (
        <div className={styles.container}>
            {/* Info Panel */}
            <GameInfoPanel
                isOpen={showInfo}
                onClose={() => setShowInfo(false)}
                gameName="Wheel"
                rules={WHEEL_GAME_RULES}
            />

            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    <h1 className={styles.title}>
                        <FerrisWheel size={32} className={styles.titleIcon} />
                        WHEEL
                    </h1>
                    <InfoButton onClick={() => setShowInfo(true)} />
                </div>
            </div>

            <div className={styles.gameLayout}>
                {/* Left Panel - Controls */}
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
                                disabled={gameState === 'spinning'}
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.quickBets}>
                            {[1, 5, 10, 25].map(amount => (
                                <button
                                    key={amount}
                                    onClick={() => handleQuickBet(amount)}
                                    disabled={gameState === 'spinning'}
                                    className={styles.quickBtn}
                                >
                                    ${amount}
                                </button>
                            ))}
                        </div>

                        <div className={styles.betActions}>
                            <button onClick={handleHalfBet} disabled={gameState === 'spinning'} className={styles.actionBtn}>
                                ½
                            </button>
                            <button onClick={handleDoubleBet} disabled={gameState === 'spinning'} className={styles.actionBtn}>
                                2×
                            </button>
                            <button
                                onClick={() => setBetAmount(effectiveBalance)}
                                disabled={gameState === 'spinning'}
                                className={styles.actionBtn}
                            >
                                MAX
                            </button>
                        </div>
                    </div>

                    {/* Max Win */}
                    <div className={styles.card}>
                        <div className={styles.statRow}>
                            <span className={styles.statLabel}>Max Win</span>
                            <span className={styles.statValue}>${(betAmount * 5).toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Spin Button */}
                    <button
                        onClick={spinWheel}
                        disabled={!canBet(betAmount) || gameState !== 'idle'}
                        className={styles.spinBtn}
                    >
                        {gameState === 'spinning' ? 'SPINNING...' : `SPIN ($${betAmount})`}
                    </button>
                </div>

                {/* Game Area - The Wheel */}
                <div className={styles.gameArea}>
                    {/* Recent Results Strip */}
                    {recentResults.length > 0 && (
                        <div className={styles.recentResults}>
                            {recentResults.map((mult, idx) => (
                                <span
                                    key={idx}
                                    className={styles.recentResult}
                                    style={{
                                        backgroundColor: mult === 0 ? '#5a5a5a' :
                                            mult === 5 ? '#9d4edd' :
                                                mult >= 3 ? '#ff9500' :
                                                    mult >= 2 ? '#ffdd00' : '#39ff14',
                                        opacity: 1 - (idx * 0.25)
                                    }}
                                >
                                    {mult.toFixed(2)}x
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Pointer */}
                    <div className={styles.pointer}>
                        <svg width="24" height="32" viewBox="0 0 24 32">
                            <path d="M12 32L0 8Q12 0 24 8Z" fill="#ff2a6d" />
                        </svg>
                    </div>

                    {/* Wheel Ring */}
                    <div className={styles.wheelContainer}>
                        <svg
                            viewBox="0 0 400 400"
                            className={styles.wheelSvg}
                            style={{
                                transform: `rotate(${currentRotation}deg)`,
                                transition: gameState === 'spinning'
                                    ? 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
                                    : 'none',
                            }}
                        >
                            {/* Outer ring segments */}
                            {SEGMENTS.map((segment, index) => {
                                const angle = (360 / 20) * index;
                                const nextAngle = (360 / 20) * (index + 1);
                                const startAngle = (angle - 90) * (Math.PI / 180);
                                const endAngle = (nextAngle - 90) * (Math.PI / 180);

                                const outerRadius = 190;
                                const innerRadius = 140;

                                const x1 = 200 + outerRadius * Math.cos(startAngle);
                                const y1 = 200 + outerRadius * Math.sin(startAngle);
                                const x2 = 200 + outerRadius * Math.cos(endAngle);
                                const y2 = 200 + outerRadius * Math.sin(endAngle);
                                const x3 = 200 + innerRadius * Math.cos(endAngle);
                                const y3 = 200 + innerRadius * Math.sin(endAngle);
                                const x4 = 200 + innerRadius * Math.cos(startAngle);
                                const y4 = 200 + innerRadius * Math.sin(startAngle);

                                return (
                                    <path
                                        key={index}
                                        d={`M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4} Z`}
                                        fill={segment.color}
                                        stroke="#1a1a1a"
                                        strokeWidth="1"
                                    />
                                );
                            })}

                            {/* Inner dark circle */}
                            <circle cx="200" cy="200" r="130" fill="#0a0a0a" stroke="#2a2a2a" strokeWidth="2" />
                        </svg>

                        {/* Center Result Display */}
                        <div className={styles.centerDisplay}>
                            {gameState === 'result' && resultInfo ? (
                                <div
                                    className={styles.resultBox}
                                    style={{ borderColor: resultInfo.color }}
                                >
                                    <div
                                        className={styles.resultMultiplier}
                                        style={{ color: resultInfo.color }}
                                    >
                                        {resultInfo.multiplier.toFixed(2)}x
                                    </div>
                                    <div className={styles.resultPayout}>
                                        {resultInfo.isWin ? '+' : ''}${resultInfo.payout.toFixed(2)}
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.idleCenter}>
                                    <FerrisWheel size={48} className={styles.centerIcon} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Professional Legend */}
                    <div className={styles.legend}>
                        {[
                            { mult: '0x', color: '#5a5a5a', count: 8 },
                            { mult: '1.5x', color: '#39ff14', count: 4 },
                            { mult: '1.8x', color: '#66ff33', count: 3 },
                            { mult: '2x', color: '#ffdd00', count: 2 },
                            { mult: '3x', color: '#ff9500', count: 2 },
                            { mult: '5x', color: '#9d4edd', count: 1 },
                        ].map(item => (
                            <div key={item.mult} className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ backgroundColor: item.color }} />
                                <span className={styles.legendText}>{item.mult}</span>
                                <span className={styles.legendCount}>×{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
