import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getVerifiedWallet } from '@/lib/verify-dynamic-jwt';

const QUEST_DEFINITIONS = {
    play_3: {
        id: 'play_3',
        title: 'Daily Grind',
        description: 'Play 3 games',
        target: 3,
        reward: 50,
        difficulty: 'easy' as const,
        icon: 'Gamepad2',
    },
    win_1: {
        id: 'win_1',
        title: 'First Victory',
        description: 'Win any game',
        target: 1,
        reward: 100,
        difficulty: 'medium' as const,
        icon: 'Trophy',
    },
    try_2_games: {
        id: 'try_2_games',
        title: 'Variety Player',
        description: 'Play 2 different games',
        target: 2,
        reward: 75,
        difficulty: 'medium' as const,
        icon: 'Grid3x3',
    },
};

const COMPLETION_BONUS = 200;
const QUESTS_PER_DAY = 3;

function getTodayString(): string {
    return new Date().toISOString().split('T')[0];
}

function getTodayQuestIds(date: string): string[] {
    const allQuests = Object.keys(QUEST_DEFINITIONS);
    const seed = date.split('-').reduce((acc, part) => acc + parseInt(part), 0);

    const shuffled = [...allQuests].sort((a, b) => {
        const hashA = (seed * a.charCodeAt(0)) % 100;
        const hashB = (seed * b.charCodeAt(0)) % 100;
        return hashA - hashB;
    });

    return shuffled.slice(0, QUESTS_PER_DAY);
}

export async function GET(request: NextRequest) {
    try {
        const wallet = await getVerifiedWallet(request);
        if (!wallet) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServerClient();
        const today = getTodayString();
        const todayQuestIds = getTodayQuestIds(today);

        const { data: existingQuests, error } = await supabase
            .from('daily_quests')
            .select('*')
            .eq('wallet_address', wallet)
            .eq('quest_date', today);

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        const questMap = new Map(
            (existingQuests || []).map(q => [q.quest_id, q])
        );

        const quests = todayQuestIds.map(questId => {
            const definition = QUEST_DEFINITIONS[questId as keyof typeof QUEST_DEFINITIONS];
            const existing = questMap.get(questId);

            return {
                id: questId,
                title: definition.title,
                description: definition.description,
                target: definition.target,
                reward: definition.reward,
                difficulty: definition.difficulty,
                icon: definition.icon,
                progress: existing?.progress || 0,
                completed: existing?.completed || false,
                claimed: existing?.reward_claimed || false,
            };
        });

        const allCompleted = quests.every(q => q.completed);
        const bonusClaimed = existingQuests?.some(q => q.quest_id === 'completion_bonus' && q.reward_claimed) || false;

        return NextResponse.json({
            quests,
            date: today,
            completionBonus: {
                available: allCompleted && !bonusClaimed,
                claimed: bonusClaimed,
                amount: COMPLETION_BONUS,
            },
        });
    } catch (error) {
        console.error('Error fetching quests:', error);
        return NextResponse.json({ error: 'Failed to fetch quests' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const wallet = await getVerifiedWallet(request);
        if (!wallet) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action, quest_id } = body;

        const supabase = createServerClient();
        const today = getTodayString();

        if (action === 'claim') {
            if (quest_id === 'completion_bonus') {
                const { data: todayQuests } = await supabase
                    .from('daily_quests')
                    .select('quest_id, completed, reward_claimed')
                    .eq('wallet_address', wallet)
                    .eq('quest_date', today);

                const todayQuestIds = getTodayQuestIds(today);
                const allCompleted = todayQuestIds.every(id =>
                    todayQuests?.some(q => q.quest_id === id && q.completed)
                );
                const alreadyClaimed = todayQuests?.some(q =>
                    q.quest_id === 'completion_bonus' && q.reward_claimed
                );

                if (!allCompleted) {
                    return NextResponse.json({ error: 'Complete all quests first' }, { status: 400 });
                }
                if (alreadyClaimed) {
                    return NextResponse.json({ error: 'Bonus already claimed' }, { status: 400 });
                }

                await supabase.from('daily_quests').upsert({
                    wallet_address: wallet,
                    quest_date: today,
                    quest_id: 'completion_bonus',
                    quest_type: 'bonus',
                    target: 0,
                    progress: 0,
                    completed: true,
                    reward_claimed: true,
                }, { onConflict: 'wallet_address,quest_date,quest_id' });

                await supabase.rpc('increment_lifetime_xp', {
                    p_wallet: wallet,
                    p_amount: COMPLETION_BONUS,
                });

                return NextResponse.json({
                    success: true,
                    points: COMPLETION_BONUS,
                    message: 'Completion bonus claimed!',
                });
            }

            const { data: quest } = await supabase
                .from('daily_quests')
                .select('*')
                .eq('wallet_address', wallet)
                .eq('quest_date', today)
                .eq('quest_id', quest_id)
                .single();

            if (!quest) {
                return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
            }
            if (!quest.completed) {
                return NextResponse.json({ error: 'Quest not completed' }, { status: 400 });
            }
            if (quest.reward_claimed) {
                return NextResponse.json({ error: 'Reward already claimed' }, { status: 400 });
            }

            const definition = QUEST_DEFINITIONS[quest_id as keyof typeof QUEST_DEFINITIONS];
            if (!definition) {
                return NextResponse.json({ error: 'Invalid quest' }, { status: 400 });
            }

            await supabase
                .from('daily_quests')
                .update({ reward_claimed: true })
                .eq('wallet_address', wallet)
                .eq('quest_date', today)
                .eq('quest_id', quest_id);

            await supabase.rpc('increment_lifetime_xp', {
                p_wallet: wallet,
                p_amount: definition.reward,
            });

            return NextResponse.json({
                success: true,
                points: definition.reward,
                message: `+${definition.reward} points!`,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Error processing quest action:', error);
        return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
    }
}
