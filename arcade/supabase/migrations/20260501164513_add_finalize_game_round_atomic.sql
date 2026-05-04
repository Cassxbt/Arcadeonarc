CREATE OR REPLACE FUNCTION finalize_game_round_atomic(
    p_round_id UUID,
    p_wallet TEXT,
    p_expected_version INTEGER,
    p_status TEXT,
    p_payout NUMERIC,
    p_multiplier NUMERIC,
    p_result_json JSONB DEFAULT '{}'::jsonb
)
RETURNS JSON
LANGUAGE plpgsql
AS $finalize_game_round_atomic$
DECLARE
    v_round RECORD;
    v_user RECORD;
    v_won BOOLEAN;
    v_week_number INT;
    v_year INT;
    v_today DATE;
    v_new_streak INT;
BEGIN
    IF p_status NOT IN ('won', 'lost', 'cashed_out', 'expired', 'cancelled') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid final status');
    END IF;

    IF p_payout < 0 OR p_multiplier < 0 THEN
        RETURN json_build_object('success', false, 'error', 'Invalid payout');
    END IF;

    IF p_status IN ('lost', 'expired') AND p_payout <> 0 THEN
        RETURN json_build_object('success', false, 'error', 'Losing rounds cannot pay out');
    END IF;

    SELECT * INTO v_round
    FROM game_rounds
    WHERE id = p_round_id
      AND wallet_address = p_wallet
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Round not found');
    END IF;

    IF v_round.status <> 'active' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Round already finalized',
            'round', row_to_json(v_round)
        );
    END IF;

    IF v_round.version <> p_expected_version THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Round version mismatch',
            'round', row_to_json(v_round)
        );
    END IF;

    IF v_round.expires_at <= NOW() AND p_status <> 'expired' THEN
        RETURN json_build_object('success', false, 'error', 'Round expired');
    END IF;

    SELECT * INTO v_user
    FROM users
    WHERE wallet_address = p_wallet
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    v_won := p_status IN ('won', 'cashed_out') AND p_payout > 0;
    v_today := CURRENT_DATE;
    v_year := EXTRACT(YEAR FROM v_today);
    v_week_number := EXTRACT(WEEK FROM v_today);

    IF v_user.last_played_date IS NULL THEN
        v_new_streak := 1;
    ELSIF v_user.last_played_date = v_today THEN
        v_new_streak := v_user.current_streak;
    ELSIF v_user.last_played_date = v_today - INTERVAL '1 day' THEN
        v_new_streak := v_user.current_streak + 1;
    ELSE
        v_new_streak := 1;
    END IF;

    UPDATE users
    SET server_balance = server_balance + p_payout,
        current_streak = v_new_streak,
        last_played_date = v_today
    WHERE wallet_address = p_wallet
    RETURNING * INTO v_user;

    UPDATE game_rounds
    SET status = p_status,
        result_json = p_result_json,
        finalized_at = NOW(),
        updated_at = NOW(),
        version = version + 1
    WHERE id = p_round_id
    RETURNING * INTO v_round;

    INSERT INTO game_sessions (
        wallet_address,
        game,
        bet_amount,
        payout,
        multiplier,
        won,
        week_number,
        year
    ) VALUES (
        p_wallet,
        v_round.game,
        v_round.bet_amount,
        p_payout,
        p_multiplier,
        v_won,
        v_week_number,
        v_year
    );

    RETURN json_build_object(
        'success', true,
        'round', row_to_json(v_round),
        'new_balance', v_user.server_balance,
        'streak', v_new_streak,
        'won', v_won
    );
END;
$finalize_game_round_atomic$;
