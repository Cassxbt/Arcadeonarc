import { createServerClient } from '@/lib/supabase-server';

const QUEST_DEFINITIONS = {
    play_3: { target: 3, type: 'games_played' },
    win_1: { target: 1, type: 'wins' },
    try_2_games: { target: 2, type: 'unique_games' },
};

function getTodayQuestIds(): string[] {
    const today = new Date().toISOString().split('T')[0];
    const allQuests = Object.keys(QUEST_DEFINITIONS);
    const seed = today.split('-').reduce((acc, part) => acc + parseInt(part), 0);

    const shuffled = [...allQuests].sort((a, b) => {
        const hashA = (seed * a.charCodeAt(0)) % 100;
        const hashB = (seed * b.charCodeAt(0)) % 100;
        return hashA - hashB;
    });

    return shuffled.slice(0, 3);
}

export async function updateQuestProgress(
    wallet: string,
    gameResult: {
        game: string;
        won: boolean;
        bet_amount: number;
    }
): Promise<void> {
    const supabase = createServerClient();
    const today = new Date().toISOString().split('T')[0];
    const todayQuestIds = getTodayQuestIds();

    const { data: existingQuests } = await supabase
        .from('daily_quests')
        .select('*')
        .eq('wallet_address', wallet)
        .eq('quest_date', today);

    const questMap = new Map(
        (existingQuests || []).map(q => [q.quest_id, q])
    );

    const { data: todayGames } = await supabase
        .from('game_sessions')
        .select('game')
        .eq('wallet_address', wallet)
        .gte('played_at', `${today}T00:00:00Z`);

    const uniqueGames = new Set(todayGames?.map(g => g.game) || []);
    uniqueGames.add(gameResult.game);

    for (const questId of todayQuestIds) {
        const definition = QUEST_DEFINITIONS[questId as keyof typeof QUEST_DEFINITIONS];
        if (!definition) continue;

        const existing = questMap.get(questId);

        if (existing?.completed) continue;

        let newProgress = existing?.progress || 0;
        let shouldIncrement = false;

        switch (definition.type) {
            case 'games_played':
                shouldIncrement = true;
                newProgress += 1;
                break;
            case 'wins':
                if (gameResult.won) {
                    shouldIncrement = true;
                    newProgress += 1;
                }
                break;
            case 'unique_games':
                newProgress = uniqueGames.size;
                shouldIncrement = true;
                break;
        }

        if (!shouldIncrement && definition.type !== 'unique_games') continue;

        const completed = newProgress >= definition.target;

        await supabase.from('daily_quests').upsert({
            wallet_address: wallet,
            quest_date: today,
            quest_id: questId,
            quest_type: definition.type,
            target: definition.target,
            progress: newProgress,
            completed,
            reward_claimed: existing?.reward_claimed || false,
        }, { onConflict: 'wallet_address,quest_date,quest_id' });
    }
}
