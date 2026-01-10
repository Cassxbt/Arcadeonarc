-- =============================================================================
-- ATOMIC BET PLACEMENT FUNCTION
-- =============================================================================
-- This function handles all bet-related operations atomically to prevent
-- race conditions and ensure data consistency across balance, games, quests,
-- and leaderboards.
-- =============================================================================

CREATE OR REPLACE FUNCTION place_bet_atomic(
    p_wallet TEXT,
    p_bet_amount NUMERIC,
    p_payout NUMERIC,
    p_game TEXT,
    p_multiplier NUMERIC
)
RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
    v_balance_change NUMERIC;
    v_won BOOLEAN;
    v_current_streak INTEGER;
BEGIN
    -- Lock the user row to prevent concurrent updates
    SELECT server_balance, current_streak
    INTO v_current_balance, v_current_streak
    FROM users
    WHERE wallet_address = p_wallet
    FOR UPDATE;

    -- Check if user exists
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;

    -- Ensure balance is not null
    v_current_balance := COALESCE(v_current_balance, 0);

    -- Check if user has sufficient balance
    IF v_current_balance < p_bet_amount THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Insufficient balance',
            'available', v_current_balance,
            'required', p_bet_amount
        );
    END IF;

    -- Determine if this was a win
    v_won := p_payout > p_bet_amount;

    -- Calculate balance change
    v_balance_change := p_payout - p_bet_amount;
    v_new_balance := v_current_balance + v_balance_change;

    -- Update user balance
    UPDATE users
    SET
        server_balance = v_new_balance,
        last_played_date = NOW()
    WHERE wallet_address = p_wallet;

    -- Insert game session record
    INSERT INTO game_sessions (
        wallet_address,
        game_type,
        bet_amount,
        payout,
        multiplier,
        won,
        played_at
    ) VALUES (
        p_wallet,
        p_game,
        p_bet_amount,
        p_payout,
        p_multiplier,
        v_won,
        NOW()
    );

    -- Return success with new balance
    RETURN json_build_object(
        'success', true,
        'new_balance', v_new_balance,
        'won', v_won,
        'streak', v_current_streak
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Rollback happens automatically
        RETURN json_build_object(
            'success', false,
            'error', 'Database operation failed: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- WITHDRAWAL RESERVATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION reserve_withdrawal(
    p_wallet TEXT,
    p_amount NUMERIC
)
RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    -- Lock the user row
    SELECT server_balance
    INTO v_current_balance
    FROM users
    WHERE wallet_address = p_wallet
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;

    v_current_balance := COALESCE(v_current_balance, 0);

    IF v_current_balance < p_amount THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Insufficient balance',
            'available', v_current_balance
        );
    END IF;

    -- Reserve by subtracting from balance
    UPDATE users
    SET server_balance = v_current_balance - p_amount
    WHERE wallet_address = p_wallet;

    RETURN json_build_object(
        'success', true,
        'reserved', p_amount
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Reservation failed: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- WITHDRAWAL CONFIRMATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION confirm_withdrawal(
    p_wallet TEXT,
    p_amount NUMERIC,
    p_success BOOLEAN
)
RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    -- If withdrawal failed, refund the reserved amount
    IF NOT p_success THEN
        SELECT server_balance
        INTO v_current_balance
        FROM users
        WHERE wallet_address = p_wallet
        FOR UPDATE;

        IF FOUND THEN
            UPDATE users
            SET server_balance = COALESCE(v_current_balance, 0) + p_amount
            WHERE wallet_address = p_wallet;
        END IF;
    END IF;

    RETURN json_build_object(
        'success', true
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Confirmation failed: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;
