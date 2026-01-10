-- MINIMAL WORKING VERSION - Just update balance, skip game recording for now
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

    -- ONLY update balance - skip game recording to avoid errors
    UPDATE users
    SET server_balance = v_new_balance, last_played_date = NOW()
    WHERE wallet_address = p_wallet;

    -- Return success immediately
    RETURN json_build_object('success', true, 'new_balance', v_new_balance, 'won', v_won);

EXCEPTION WHEN OTHERS THEN
    -- Return the actual error for debugging
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;
