'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useGame } from '@/lib/game-context';
import { useSound } from '@/lib/sounds';
import { authFetch, getRequestErrorMessage, readResponseError } from '@/lib/auth-fetch';
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
        content: 'The wheel has 20 segments: 8× 0x (loss), 4× 1.1x, 3× 1.3x, 2× 1.5x, 2× 2.2x, and 1× 3.5x jackpot!',
    },
    {
        icon: <FerrisWheel size={20} style={{ color: 'var(--neon-purple)' }} />,
        title: 'Simple Gameplay',
        content: 'Just place your bet and spin. No decisions to make - pure luck!',
    },
];

const SEGMENTS = [
    { multiplier: 0, color: '#5a5a5a' },
    { multiplier: 1.1, color: '#39ff14' },
    { multiplier: 0, color: '#5a5a5a' },
    { multiplier: 1.3, color: '#00d4ff' },
    { multiplier: 0, color: '#5a5a5a' },
    { multiplier: 1.1, color: '#39ff14' },
    { multiplier: 2.2, color: '#ff2a6d' },
    { multiplier: 0, color: '#5a5a5a' },
    { multiplier: 1.3, color: '#00d4ff' },
    { multiplier: 1.1, color: '#39ff14' },
    { multiplier: 0, color: '#5a5a5a' },
    { multiplier: 1.5, color: '#ffdd00' },
    { multiplier: 0, color: '#5a5a5a' },
    { multiplier: 1.3, color: '#00d4ff' },
    { multiplier: 3.5, color: '#9d4edd' },
    { multiplier: 1.1, color: '#39ff14' },
    { multiplier: 0, color: '#5a5a5a' },
    { multiplier: 2.2, color: '#ff2a6d' },
    { multiplier: 0, color: '#5a5a5a' },
    { multiplier: 1.5, color: '#ffdd00' },
];

type GameState = 'idle' | 'spinning' | 'result';
const SPIN_DURATION_MS = 5000;
const RESULT_HOLD_MS = 1800;

type WheelOutcome = {
    segment: number;
    multiplier: number;
    payout: number;
    color: string;
    isWin: boolean;
};

export default function WheelGame() {
    const { primaryWallet, setShowAuthFlow } = useDynamicContext();
    const {
        effectiveBalance,
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
    const showDemoLimitReached = demoMode && isDemoLimitReached('wheel');

    const [gameState, setGameState] = useState<GameState>('idle');
    const [currentRotation, setCurrentRotation] = useState(0);
    const [resultSegment, setResultSegment] = useState<number | null>(null);
    const [lastOutcome, setLastOutcome] = useState<WheelOutcome | null>(null);
    const [lockedBetAmount, setLockedBetAmount] = useState(betAmount);
    const [recentResults, setRecentResults] = useState<number[]>([]);
    const [showInfo, setShowInfo] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resultInfo = useMemo(() => {
        if (!lastOutcome) return null;
        return lastOutcome;
    }, [lastOutcome]);

    const roundLocked = gameState !== 'idle';
    const displayBetAmount = roundLocked ? lockedBetAmount : betAmount;
    const wheelStatus = gameState === 'idle'
        ? 'Ready'
        : gameState === 'spinning'
            ? resultSegment === null ? 'Locking result' : 'Spinning'
            : resultInfo?.isWin ? 'Paid' : 'No hit';

    const wheelStatusDetail = gameState === 'idle'
        ? 'One spin. One server result.'
        : gameState === 'spinning'
            ? resultSegment === null ? 'Confirming round...' : 'Landing on the committed segment.'
            : resultInfo
                ? `${resultInfo.multiplier.toFixed(1)}x on $${lockedBetAmount.toFixed(2)}`
                : 'Round settled.';

    useEffect(() => {
        return () => {
            if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
            if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
            stopSound('WHEEL_SPIN');
        };
    }, [stopSound]);

    const spinWheel = useCallback(async () => {
        if (!canBet(betAmount) || gameState !== 'idle') return;
        const wager = betAmount;

        if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
        if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);

        stopSound('WIN');
        stopSound('LOSE');
        stopSound('WHEEL_SPIN');

        playSound('CLICK');
        setGameState('spinning');
        setResultSegment(null);
        setLastOutcome(null);
        setLockedBetAmount(wager);
        setErrorMessage(null);

        let targetSegment: number;
        let serverPayout: number | null = null;
        let serverMultiplier: number | null = null;

        try {
            if (demoMode) {
                targetSegment = Math.floor(Math.random() * 20);
            } else {
                const response = await authFetch('/api/wheel', {
                    method: 'POST',
                    body: JSON.stringify({ betAmount: wager }),
                });

                if (!response.ok) {
                    throw new Error(await readResponseError(response, 'Failed to spin wheel'));
                }

                const result = await response.json();
                targetSegment = result.segment;
                serverPayout = typeof result.payout === 'number' ? result.payout : null;
                serverMultiplier = typeof result.multiplier === 'number' ? result.multiplier : null;
            }

            if (!Number.isInteger(targetSegment) || targetSegment < 0 || targetSegment >= SEGMENTS.length) {
                throw new Error('Invalid wheel result');
            }
        } catch (error) {
            stopSound('WHEEL_SPIN');
            setGameState('idle');
            setErrorMessage(getRequestErrorMessage(error, 'Failed to spin wheel'));
            console.error('Wheel spin error:', error);
            await refreshBalance();
            return;
        }

        const segmentAngle = 360 / 20;
        const currentAngle = ((currentRotation % 360) + 360) % 360;
        const fullSpins = 7 + Math.floor(Math.random() * 2);
        const segmentPosition = 360 - (targetSegment * segmentAngle) - (segmentAngle / 2);
        const deltaToSegment = (segmentPosition - currentAngle + 360) % 360;
        const targetRotation = currentRotation + (fullSpins * 360) + deltaToSegment;

        setResultSegment(targetSegment);
        playSound('WHEEL_SPIN', { loop: true });
        setCurrentRotation(targetRotation);

        spinTimeoutRef.current = setTimeout(() => {
            stopSound('WHEEL_SPIN');

            const segment = SEGMENTS[targetSegment];
            const settledMultiplier = serverMultiplier ?? segment.multiplier;
            const settledPayout = serverPayout ?? wager * settledMultiplier;
            const settledOutcome: WheelOutcome = {
                segment: targetSegment,
                multiplier: settledMultiplier,
                payout: settledPayout,
                color: segment.color,
                isWin: settledMultiplier > 0,
            };

            setLastOutcome(settledOutcome);
            setGameState('result');

            setRecentResults(prev => [settledMultiplier, ...prev].slice(0, 5));

            if (!demoMode) {
                refreshBalance();
            } else if (settledOutcome.isWin) {
                playSound('WIN');
                addBetRecord({
                    game: 'wheel',
                    betAmount: wager,
                    outcome: 'win',
                    multiplier: settledMultiplier,
                    payout: settledPayout,
                    gameParams: { segment: targetSegment },
                });
            } else {
                playSound('LOSE');
                addBetRecord({
                    game: 'wheel',
                    betAmount: wager,
                    outcome: 'loss',
                    multiplier: 0,
                    payout: 0,
                    gameParams: { segment: targetSegment },
                });
            }

            if (!demoMode) {
                if (settledOutcome.isWin) {
                    playSound('WIN');
                } else {
                    playSound('LOSE');
                }
            }

            resetTimeoutRef.current = setTimeout(() => {
                setGameState('idle');
            }, RESULT_HOLD_MS);
        }, SPIN_DURATION_MS);
    }, [canBet, betAmount, gameState, demoMode, currentRotation, playSound, stopSound, addBetRecord, refreshBalance]);

    const handleQuickBet = (amount: number) => {
        if (roundLocked) return;
        setBetAmount(amount);
    };

    const handleHalfBet = () => {
        if (roundLocked) return;
        setBetAmount(Math.max(0.5, betAmount / 2));
    };

    const handleDoubleBet = () => {
        if (roundLocked) return;
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

                        <div className={styles.betActions}>
                            <button onClick={handleHalfBet} disabled={roundLocked} className={styles.actionBtn}>
                                ½
                            </button>
                            <button onClick={handleDoubleBet} disabled={roundLocked} className={styles.actionBtn}>
                                2×
                            </button>
                            <button
                                onClick={() => setBetAmount(effectiveBalance)}
                                disabled={roundLocked}
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
                            <span className={styles.statValue}>${(displayBetAmount * 3.5).toFixed(2)}</span>
                        </div>
                    </div>

                    <div className={styles.statusCard}>
                        <span className={styles.statusLabel}>{wheelStatus}</span>
                        <span className={styles.statusDetail}>{wheelStatusDetail}</span>
                    </div>

                    {errorMessage && (
                        <div className={styles.errorMessage}>{errorMessage}</div>
                    )}

                    {/* Spin Button */}
                    <button
                        onClick={spinWheel}
                        disabled={!canBet(betAmount) || roundLocked}
                        className={`${styles.spinBtn} ${roundLocked ? styles.spinBtnLocked : ''}`}
                    >
                        {gameState === 'spinning' ? 'SPINNING...' : `SPIN ($${betAmount})`}
                    </button>
                </div>

                {/* Game Area - The Wheel */}
                <div className={`${styles.gameArea} ${gameState === 'spinning' ? styles.gameAreaActive : ''}`}>
                    {/* Recent Results Strip */}
                    {recentResults.length > 0 && (
                        <div className={styles.recentResults}>
                            {recentResults.map((mult, idx) => (
                                <span
                                    key={idx}
                                    className={styles.recentResult}
                                    style={{
                                        backgroundColor: mult === 0 ? '#5a5a5a' :
                                            mult === 3.5 ? '#9d4edd' :
                                                mult === 2.2 ? '#ff2a6d' :
                                                    mult === 1.5 ? '#ffdd00' :
                                                        mult === 1.3 ? '#00d4ff' : '#39ff14',
                                        opacity: 1 - (idx * 0.25)
                                    }}
                                >
                                    {mult.toFixed(1)}x
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
                                        {resultInfo.multiplier.toFixed(1)}x
                                    </div>
                                    <div className={styles.resultPayout}>
                                        {resultInfo.isWin ? '+' : ''}${resultInfo.payout.toFixed(2)}
                                    </div>
                                </div>
                            ) : gameState === 'spinning' ? (
                                <div className={styles.spinCenter}>
                                    <div className={styles.spinCenterLabel}>
                                        {resultSegment === null ? 'LOCKING' : 'LIVE'}
                                    </div>
                                    <div className={styles.spinCenterValue}>
                                        ${lockedBetAmount.toFixed(2)}
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
                            { mult: '1.1x', color: '#39ff14', count: 4 },
                            { mult: '1.3x', color: '#00d4ff', count: 3 },
                            { mult: '1.5x', color: '#ffdd00', count: 2 },
                            { mult: '2.2x', color: '#ff2a6d', count: 2 },
                            { mult: '3.5x', color: '#9d4edd', count: 1 },
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
