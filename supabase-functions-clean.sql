-- Atomic Bet Placement Function with RLS bypass
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
BEGIN
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

    -- Record game
    INSERT INTO game_sessions (wallet_address, game_type, bet_amount, payout, multiplier, won, played_at)
    VALUES (p_wallet, p_game, p_bet_amount, p_payout, p_multiplier, v_won, NOW());

    RETURN json_build_object('success', true, 'new_balance', v_new_balance, 'won', v_won);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$function$;

-- Withdrawal Reserve Function
CREATE OR REPLACE FUNCTION reserve_withdrawal(
    p_wallet TEXT,
    p_amount NUMERIC
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $function$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    SELECT server_balance INTO v_current_balance
    FROM users
    WHERE wallet_address = p_wallet
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    v_current_balance := COALESCE(v_current_balance, 0);

    IF v_current_balance < p_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient balance', 'available', v_current_balance);
    END IF;

    UPDATE users SET server_balance = v_current_balance - p_amount WHERE wallet_address = p_wallet;
    RETURN json_build_object('success', true, 'reserved', p_amount);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Reservation failed');
END;
$function$;

-- Withdrawal Confirm Function
CREATE OR REPLACE FUNCTION confirm_withdrawal(
    p_wallet TEXT,
    p_amount NUMERIC,
    p_success BOOLEAN
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $function$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    IF NOT p_success THEN
        SELECT server_balance INTO v_current_balance FROM users WHERE wallet_address = p_wallet FOR UPDATE;
        IF FOUND THEN
            UPDATE users SET server_balance = COALESCE(v_current_balance, 0) + p_amount WHERE wallet_address = p_wallet;
        END IF;
    END IF;
    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Confirmation failed');
END;
$function$;
