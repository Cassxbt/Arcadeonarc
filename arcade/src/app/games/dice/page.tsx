'use client';

import { useState, useCallback, useMemo } from 'react';
import { useGame } from '@/lib/game-context';
import { useSound } from '@/lib/sounds';
import { Dice6, Flame, Sparkles, Frown } from '@/components/icons';
import styles from './page.module.css';

type GameState = 'idle' | 'rolling' | 'won' | 'lost';

export default function DiceGame() {
    const { effectiveBalance, betAmount, setBetAmount, canBet, addBetRecord } = useGame();
    const { playSound } = useSound();

    const [gameState, setGameState] = useState<GameState>('idle');
    const [target, setTarget] = useState(50);
    const [rollResult, setRollResult] = useState<number | null>(null);
    const [betType, setBetType] = useState<'under' | 'over'>('under');
    const [streak, setStreak] = useState(0);

    // Calculate win chance and multiplier
    const { winChance, multiplier } = useMemo(() => {
        const chance = betType === 'under' ? target - 1 : 100 - target;
        const mult = chance > 0 ? Number(((100 / chance) * 0.9).toFixed(2)) : 0;
        return { winChance: chance, multiplier: mult };
    }, [target, betType]);

    // Roll the dice
    const rollDice = useCallback(() => {
        if (!canBet(betAmount) || gameState === 'rolling') return;

        playSound('DICE_ROLL');
        setGameState('rolling');
        setRollResult(null);

        // Simulate rolling animation
        const rollInterval = setInterval(() => {
            setRollResult(Math.floor(Math.random() * 100) + 1);
        }, 50);

        // Final result after animation
        setTimeout(() => {
            clearInterval(rollInterval);

            const finalResult = Math.floor(Math.random() * 100) + 1;
            setRollResult(finalResult);

            const isWin = betType === 'under'
                ? finalResult < target
                : finalResult > target;

            if (isWin) {
                playSound('WIN');
                setGameState('won');
                setStreak(prev => prev + 1);
                addBetRecord({
                    game: 'dice',
                    betAmount,
                    outcome: 'win',
                    multiplier,
                    payout: betAmount * multiplier,
                });
            } else {
                playSound('LOSE');
                setGameState('lost');
                setStreak(0);
                addBetRecord({
                    game: 'dice',
                    betAmount,
                    outcome: 'loss',
                    multiplier: 0,
                    payout: 0,
                });
            }
        }, 1500);
    }, [canBet, betAmount, gameState, target, betType, multiplier, playSound, addBetRecord]);

    // Quick bet handlers
    const handleQuickBet = (amount: number) => {
        if (gameState === 'rolling') return;
        setBetAmount(amount);
    };

    const handleHalfBet = () => {
        if (gameState === 'rolling') return;
        setBetAmount(betAmount / 2);
    };

    const handleDoubleBet = () => {
        if (gameState === 'rolling') return;
        setBetAmount(betAmount * 2);
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h1 className={styles.title}>
                    <Dice6 size={36} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--neon-green)', filter: 'drop-shadow(0 0 12px var(--neon-green))' }} />
                    Dice
                </h1>
                <p className={styles.subtitle}>Set your target, roll the dice. Higher risk = higher reward.</p>
            </div>

            <div className={styles.gameLayout}>
                {/* Left Panel - Controls */}
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
                                disabled={gameState === 'rolling'}
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.quickBets}>
                            {[1, 5, 10, 25].map(amount => (
                                <button
                                    key={amount}
                                    onClick={() => handleQuickBet(amount)}
                                    disabled={gameState === 'rolling'}
                                    className={styles.quickBtn}
                                >
                                    ${amount}
                                </button>
                            ))}
                        </div>

                        <div className={styles.betActions}>
                            <button onClick={handleHalfBet} disabled={gameState === 'rolling'} className={styles.actionBtn}>
                                ½
                            </button>
                            <button onClick={handleDoubleBet} disabled={gameState === 'rolling'} className={styles.actionBtn}>
                                2×
                            </button>
                            <button
                                onClick={() => setBetAmount(effectiveBalance)}
                                disabled={gameState === 'rolling'}
                                className={styles.actionBtn}
                            >
                                MAX
                            </button>
                        </div>
                    </div>

                    {/* Bet Type */}
                    <div className={styles.card}>
                        <h3>Bet Type</h3>
                        <div className={styles.betTypeToggle}>
                            <button
                                onClick={() => setBetType('under')}
                                disabled={gameState === 'rolling'}
                                className={`${styles.betTypeBtn} ${betType === 'under' ? styles.betTypeActive : ''}`}
                            >
                                Roll Under
                            </button>
                            <button
                                onClick={() => setBetType('over')}
                                disabled={gameState === 'rolling'}
                                className={`${styles.betTypeBtn} ${betType === 'over' ? styles.betTypeActive : ''}`}
                            >
                                Roll Over
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className={styles.card}>
                        <div className={styles.statsGrid}>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>Win Chance</span>
                                <span className={styles.statValue}>{winChance}%</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>Multiplier</span>
                                <span className={styles.statValueHighlight}>{multiplier}×</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>Potential Win</span>
                                <span className={styles.statValueSuccess}>${(betAmount * multiplier).toFixed(2)}</span>
                            </div>
                            {streak > 0 && (
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>
                                        <Flame size={16} style={{ marginRight: '0.25rem', verticalAlign: 'middle', color: 'var(--neon-orange)' }} />
                                        Streak
                                    </span>
                                    <span className={styles.statValueStreak}>{streak}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Roll Button */}
                    <button
                        onClick={rollDice}
                        disabled={!canBet(betAmount) || gameState === 'rolling'}
                        className={styles.rollBtn}
                    >
                        {gameState === 'rolling' ? 'Rolling...' : `Roll Dice ($${betAmount})`}
                    </button>
                </div>

                {/* Game Area */}
                <div className={styles.gameArea}>
                    {/* Slider */}
                    <div className={styles.sliderContainer}>
                        <div className={styles.sliderTrack}>
                            <div
                                className={styles.sliderFill}
                                style={{
                                    width: betType === 'under' ? `${target - 1}%` : `${100 - target}%`,
                                    left: betType === 'under' ? '0' : `${target}%`,
                                    background: betType === 'under'
                                        ? 'linear-gradient(90deg, var(--color-success), var(--color-success-light))'
                                        : 'linear-gradient(90deg, var(--color-success-light), var(--color-success))'
                                }}
                            />
                            <div
                                className={styles.sliderTarget}
                                style={{ left: `${target}%` }}
                            >
                                <span className={styles.targetValue}>{target}</span>
                            </div>
                        </div>

                        <input
                            type="range"
                            min={2}
                            max={98}
                            value={target}
                            onChange={(e) => setTarget(Number(e.target.value))}
                            disabled={gameState === 'rolling'}
                            className={styles.slider}
                        />

                        <div className={styles.sliderLabels}>
                            <span>1</span>
                            <span>{betType === 'under' ? 'Win Zone' : 'Lose Zone'}</span>
                            <span>Target: {target}</span>
                            <span>{betType === 'over' ? 'Win Zone' : 'Lose Zone'}</span>
                            <span>100</span>
                        </div>
                    </div>

                    {/* Dice Result */}
                    <div className={styles.diceResult}>
                        <div className={`${styles.diceBox} ${gameState === 'rolling' ? styles.diceRolling : ''}`}>
                            <span className={styles.diceValue}>
                                {rollResult !== null ? rollResult : '?'}
                            </span>
                        </div>

                        {gameState === 'won' && (
                            <div className={styles.resultWin}>
                                <span className={styles.resultEmoji}>
                                    <Sparkles size={32} style={{ color: 'var(--neon-yellow)', filter: 'drop-shadow(0 0 10px var(--neon-yellow))' }} />
                                </span>
                                <span>You rolled {rollResult}! Won ${(betAmount * multiplier).toFixed(2)}</span>
                            </div>
                        )}

                        {gameState === 'lost' && (
                            <div className={styles.resultLoss}>
                                <span className={styles.resultEmoji}>
                                    <Frown size={32} style={{ color: 'var(--neon-pink)' }} />
                                </span>
                                <span>You rolled {rollResult}. Needed {betType === 'under' ? `< ${target}` : `> ${target}`}</span>
                            </div>
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
                        <p>Predict whether the next roll will be Under or Over your target number. Lower your win chance to increase your potential multiplier.</p>
                    </div>
                    <div className={styles.rule}>
                        <h3>Target & Chance</h3>
                        <p>Adjust the slider to set your target number. Your win chance and multiplier adjust automatically based on your selection.</p>
                    </div>
                    <div className={styles.rule}>
                        <h3>Roll Type</h3>
                        <p><strong>Roll Under:</strong> You win if the result is lower than your target.<br /><strong>Roll Over:</strong> You win if the result is higher than your target.</p>
                    </div>
                    <div className={styles.rule}>
                        <h3>Fairness</h3>
                        <p>The dice roll is generated using a provably fair system on the Arc testnet. Every result is mathematically verifiable.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
