-- Fix: Update place_bet_atomic to include week_num and year in game_sessions
-- This fixes the bug where all game sessions have week_num stuck at 2

CREATE OR REPLACE FUNCTION place_bet_atomic(
    p_wallet TEXT,
    p_bet_amount NUMERIC,
    p_payout NUMERIC,
    p_game TEXT,
    p_multiplier NUMERIC DEFAULT 0
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $function$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
    v_won BOOLEAN;
    v_week_num INTEGER;
    v_year INTEGER;
    v_start_of_year TIMESTAMP;
    v_days INTEGER;
BEGIN
    -- Calculate current week number and year (matching TypeScript logic)
    v_year := EXTRACT(YEAR FROM NOW());
    v_start_of_year := DATE_TRUNC('year', NOW());
    v_days := EXTRACT(DAY FROM (NOW() - v_start_of_year));
    v_week_num := CEIL((v_days + EXTRACT(DOW FROM v_start_of_year) + 1) / 7.0)::INTEGER;

    -- Lock user row
    SELECT server_balance INTO v_current_balance
    FROM users
    WHERE wallet_address = p_wallet
    FOR UPDATE;

    -- Check if user exists
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Handle null balance
    v_current_balance := COALESCE(v_current_balance, 0);

    -- Check sufficient balance
    IF v_current_balance < p_bet_amount THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Insufficient balance',
            'available', v_current_balance,
            'required', p_bet_amount
        );
    END IF;

    -- Calculate new balance
    v_won := p_payout > p_bet_amount;
    v_new_balance := v_current_balance - p_bet_amount + p_payout;

    -- Update balance
    UPDATE users
    SET server_balance = v_new_balance, last_played_date = NOW()
    WHERE wallet_address = p_wallet;

    -- Record game WITH week_num and year (FIX: these were missing!)
    INSERT INTO game_sessions (wallet_address, game_type, bet_amount, payout, multiplier, won, played_at, week_num, year)
    VALUES (p_wallet, p_game, p_bet_amount, p_payout, p_multiplier, v_won, NOW(), v_week_num, v_year);

    RETURN json_build_object('success', true, 'new_balance', v_new_balance, 'won', v_won);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$function$;
