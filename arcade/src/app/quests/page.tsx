'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useQuests, Quest } from '@/lib/useQuests';
import { useDailyBonus } from '@/lib/useDailyBonus';
import { useMilestones, Milestone } from '@/lib/useMilestones';
import { useToast } from '@/components/Toast';
import {
    Target,
    Trophy,
    Gamepad2,
    Grid3x3,
    Gift,
    CheckCircle,
    Flame,
    Zap,
    Lock,
    Medal,
} from '@/components/icons';
import styles from './page.module.css';

// Map quest icon names to components
const iconMap: Record<string, React.ElementType> = {
    Gamepad2,
    Trophy,
    Grid3x3,
    Target,
    Flame,
    Zap,
    Medal,
};

function getDifficultyColor(difficulty: string): string {
    switch (difficulty) {
        case 'easy': return 'var(--neon-green)';
        case 'medium': return 'var(--neon-yellow)';
        case 'hard': return 'var(--neon-pink)';
        default: return 'var(--neon-cyan)';
    }
}

function QuestCard({ quest, onClaim }: { quest: Quest; onClaim: (id: string) => void }) {
    const IconComponent = iconMap[quest.icon] || Target;
    const progressPercent = Math.min((quest.progress / quest.target) * 100, 100);
    const difficultyColor = getDifficultyColor(quest.difficulty);

    return (
        <div className={`${styles.questCard} ${quest.completed ? styles.questCompleted : ''}`}>
            <div className={styles.questHeader}>
                <div
                    className={styles.questIcon}
                    style={{
                        borderColor: difficultyColor,
                        boxShadow: `0 0 15px ${difficultyColor}40`,
                    }}
                >
                    <IconComponent
                        size={24}
                        style={{
                            color: difficultyColor,
                            filter: `drop-shadow(0 0 8px ${difficultyColor})`,
                        }}
                    />
                </div>
                <div className={styles.questInfo}>
                    <h3 className={styles.questTitle}>{quest.title}</h3>
                    <p className={styles.questDescription}>{quest.description}</p>
                </div>
                <div className={styles.questReward}>
                    <span className={styles.rewardAmount}>+{quest.reward}</span>
                    <span className={styles.rewardLabel}>pts</span>
                </div>
            </div>

            <div className={styles.progressContainer}>
                <div className={styles.progressBar}>
                    <div
                        className={styles.progressFill}
                        style={{
                            width: `${progressPercent}%`,
                            background: `linear-gradient(90deg, ${difficultyColor}, ${difficultyColor}80)`,
                            boxShadow: `0 0 10px ${difficultyColor}`,
                        }}
                    />
                </div>
                <span className={styles.progressText}>
                    {quest.progress}/{quest.target}
                </span>
            </div>

            {quest.completed && !quest.claimed && (
                <button
                    className={styles.claimBtn}
                    onClick={() => onClaim(quest.id)}
                >
                    <Gift size={16} />
                    Claim Reward
                </button>
            )}

            {quest.claimed && (
                <div className={styles.claimedBadge}>
                    <CheckCircle size={16} />
                    Claimed
                </div>
            )}
        </div>
    );
}

function getTierColor(tierId: string): string {
    switch (tierId) {
        case 'bronze': return '#cd7f32';
        case 'silver': return '#c0c0c0';
        case 'gold': return '#ffd700';
        case 'diamond': return '#b9f2ff';
        default: return 'var(--neon-cyan)';
    }
}

function MilestoneCard({
    milestone,
    onClaim
}: {
    milestone: Milestone;
    onClaim: (id: string) => void;
}) {
    const IconComponent = iconMap[milestone.icon] || Medal;
    const progressPercent = Math.min((milestone.progress / milestone.target) * 100, 100);
    const tierColor = getTierColor(milestone.id);

    return (
        <div className={`${styles.milestoneCard} ${milestone.completed ? styles.milestoneCompleted : ''}`}>
            <div className={styles.milestoneHeader}>
                <div
                    className={styles.milestoneIcon}
                    style={{
                        borderColor: tierColor,
                        boxShadow: `0 0 12px ${tierColor}40`,
                    }}
                >
                    <IconComponent
                        size={20}
                        style={{
                            color: tierColor,
                            filter: `drop-shadow(0 0 6px ${tierColor})`,
                        }}
                    />
                </div>
                <div className={styles.milestoneInfo}>
                    <h4 className={styles.milestoneTitle}>{milestone.title}</h4>
                    <p className={styles.milestoneDescription}>{milestone.description}</p>
                </div>
                <div className={styles.milestoneReward}>
                    <span className={styles.rewardAmount}>+{milestone.reward}</span>
                </div>
            </div>

            <div className={styles.progressContainer}>
                <div className={styles.progressBar}>
                    <div
                        className={styles.progressFill}
                        style={{
                            width: `${progressPercent}%`,
                            background: `linear-gradient(90deg, ${tierColor}, ${tierColor}80)`,
                            boxShadow: `0 0 8px ${tierColor}`,
                        }}
                    />
                </div>
                <span className={styles.progressText}>
                    {milestone.progress}/{milestone.target}
                </span>
            </div>

            {milestone.completed && !milestone.claimed && (
                <button
                    className={styles.claimBtn}
                    onClick={() => onClaim(milestone.id)}
                >
                    <Gift size={14} />
                    Claim
                </button>
            )}

            {milestone.claimed && (
                <div className={styles.claimedBadge}>
                    <CheckCircle size={14} />
                    Claimed
                </div>
            )}
        </div>
    );
}

function DailyBonusCard({
    claimed,
    points,
    onClaim,
    isLoading
}: {
    claimed: boolean;
    points: number;
    onClaim: () => void;
    isLoading: boolean;
}) {
    return (
        <div className={`${styles.bonusCard} ${claimed ? styles.bonusClaimed : ''}`}>
            <div className={styles.bonusIcon}>
                <Gift
                    size={32}
                    style={{
                        color: claimed ? 'var(--text-muted)' : 'var(--neon-yellow)',
                        filter: claimed ? 'none' : 'drop-shadow(0 0 15px var(--neon-yellow))',
                    }}
                />
            </div>
            <div className={styles.bonusContent}>
                <h3 className={styles.bonusTitle}>Daily Login Bonus</h3>
                <p className={styles.bonusDescription}>
                    {claimed ? 'Come back tomorrow!' : 'Claim your daily reward'}
                </p>
            </div>
            <div className={styles.bonusAction}>
                {claimed ? (
                    <div className={styles.bonusClaimedBadge}>
                        <CheckCircle size={18} />
                        +{points} pts
                    </div>
                ) : (
                    <button
                        className={styles.bonusClaimBtn}
                        onClick={onClaim}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Claiming...' : '+25 pts'}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function QuestsPage() {
    const { primaryWallet } = useDynamicContext();
    const { quests, completionBonus, isLoading, claimReward, claimCompletionBonus, refreshQuests } = useQuests();
    const { dailyBonus, claimDailyBonus } = useDailyBonus();
    const { milestones, claimMilestone, refreshMilestones } = useMilestones();
    const { showToast } = useToast();
    const [claimingBonus, setClaimingBonus] = useState(false);

    const handleClaimQuest = async (questId: string) => {
        const result = await claimReward(questId);
        if (result.success) {
            showToast(`+${result.points} points claimed!`, 'success');
            refreshQuests();
        } else {
            showToast('Failed to claim reward', 'error');
        }
    };

    const handleClaimCompletionBonus = async () => {
        const result = await claimCompletionBonus();
        if (result.success) {
            showToast(`Bonus: +${result.points} points!`, 'success');
        } else {
            showToast('Failed to claim bonus', 'error');
        }
    };

    const handleClaimMilestone = async (milestoneId: string) => {
        const result = await claimMilestone(milestoneId);
        if (result.success) {
            showToast(`+${result.points} milestone points!`, 'success');
            refreshMilestones();
        } else {
            showToast('Failed to claim milestone', 'error');
        }
    };

    const handleClaimDailyBonus = useCallback(async () => {
        setClaimingBonus(true);
        const result = await claimDailyBonus();
        setClaimingBonus(false);

        if (result.claimed) {
            showToast(`Daily bonus: +${result.points} points!`, 'success');
        }
    }, [claimDailyBonus, showToast]);

    // Auto-claim daily bonus on first visit
    useEffect(() => {
        if (!dailyBonus.isLoading && !dailyBonus.claimed && primaryWallet && !claimingBonus) {
            queueMicrotask(() => {
                void handleClaimDailyBonus();
            });
        }
    }, [dailyBonus.isLoading, dailyBonus.claimed, primaryWallet, claimingBonus, handleClaimDailyBonus]);

    const completedCount = quests.filter(q => q.completed).length;
    const allCompleted = completedCount === quests.length && quests.length > 0;

    if (!primaryWallet) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <Target size={48} style={{ color: 'var(--neon-pink)', filter: 'drop-shadow(0 0 20px var(--neon-pink))' }} />
                    <h1 className={styles.title}>Daily Quests</h1>
                    <p className={styles.subtitle}>Complete challenges, earn rewards</p>
                </div>
                <div className={styles.connectPrompt}>
                    <Lock size={60} style={{ color: 'var(--neon-cyan)', filter: 'drop-shadow(0 0 15px var(--neon-cyan))' }} />
                    <h3>Connect Wallet</h3>
                    <p>Connect your wallet to view and complete daily quests</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <Target size={48} style={{ color: 'var(--neon-pink)', filter: 'drop-shadow(0 0 20px var(--neon-pink))' }} />
                <h1 className={styles.title}>Daily Quests</h1>
                <p className={styles.subtitle}>Complete challenges, earn rewards</p>
            </div>

            {/* Daily Login Bonus */}
            <DailyBonusCard
                claimed={dailyBonus.claimed}
                points={dailyBonus.points || 25}
                onClaim={handleClaimDailyBonus}
                isLoading={claimingBonus || dailyBonus.isLoading}
            />

            {/* Quest Progress Overview */}
            <div className={styles.progressOverview}>
                <div className={styles.progressStats}>
                    <span className={styles.progressLabel}>Today&apos;s Progress</span>
                    <span className={styles.progressCount}>
                        {completedCount}/{quests.length}
                    </span>
                </div>
                <div className={styles.overviewBar}>
                    <div
                        className={styles.overviewFill}
                        style={{ width: quests.length > 0 ? `${(completedCount / quests.length) * 100}%` : '0%' }}
                    />
                </div>
            </div>

            {/* Quests Grid */}
            {isLoading ? (
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <p>Loading quests...</p>
                </div>
            ) : (
                <div className={styles.questsGrid}>
                    {quests.map(quest => (
                        <QuestCard
                            key={quest.id}
                            quest={quest}
                            onClaim={handleClaimQuest}
                        />
                    ))}
                </div>
            )}

            {/* Completion Bonus */}
            {allCompleted && (
                <div className={`${styles.completionBonus} ${completionBonus.claimed ? styles.bonusClaimed : ''}`}>
                    <div className={styles.completionIcon}>
                        <Trophy
                            size={36}
                            style={{
                                color: 'var(--neon-yellow)',
                                filter: 'drop-shadow(0 0 15px var(--neon-yellow))',
                            }}
                        />
                    </div>
                    <div className={styles.completionContent}>
                        <h3>All Quests Complete!</h3>
                        <p>Claim your bonus reward</p>
                    </div>
                    {completionBonus.claimed ? (
                        <div className={styles.completionClaimed}>
                            <CheckCircle size={20} />
                            +{completionBonus.amount} pts
                        </div>
                    ) : (
                        <button
                            className={styles.completionClaimBtn}
                            onClick={handleClaimCompletionBonus}
                        >
                            <Zap size={18} />
                            +{completionBonus.amount} pts
                        </button>
                    )}
                </div>
            )}

            {/* Info */}
            <div className={styles.infoNote}>
                <p>
                    <Flame size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--neon-orange)' }} />
                    Quests reset daily at midnight UTC
                </p>
            </div>

            {/* Weekly Milestones Section */}
            {milestones.length > 0 && (
                <div className={styles.milestonesSection}>
                    <h2 className={styles.sectionTitle}>
                        <Medal size={24} style={{ color: 'var(--neon-cyan)', marginRight: '0.5rem' }} />
                        Weekly Milestones
                    </h2>
                    <p className={styles.sectionSubtitle}>
                        Complete milestones for bonus rewards
                    </p>
                    <div className={styles.milestonesGrid}>
                        {milestones.map(milestone => (
                            <MilestoneCard
                                key={milestone.id}
                                milestone={milestone}
                                onClaim={handleClaimMilestone}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
