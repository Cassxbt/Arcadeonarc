-- Durable auth challenges and game rounds for ARCade.
-- Redis can cache live reads, but login and settlement state must survive Redis loss.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auth_challenges (
    wallet_address TEXT PRIMARY KEY,
    challenge_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires_at
ON auth_challenges (expires_at);

CREATE TABLE IF NOT EXISTS game_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    game TEXT NOT NULL CHECK (game IN ('dice', 'wheel', 'tower', 'crash', 'laser')),
    bet_amount NUMERIC NOT NULL CHECK (bet_amount > 0),
    nonce TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'won', 'lost', 'cashed_out', 'expired', 'cancelled')),
    state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE game_rounds ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_rounds_wallet_game_nonce
ON game_rounds (wallet_address, game, nonce);

CREATE INDEX IF NOT EXISTS idx_game_rounds_active_wallet
ON game_rounds (wallet_address, game, status)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_game_rounds_expires_at
ON game_rounds (expires_at)
WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_rounds_one_active_wallet_game
ON game_rounds (wallet_address, game)
WHERE status = 'active';

CREATE OR REPLACE FUNCTION start_game_round_atomic(
    p_wallet TEXT,
    p_game TEXT,
    p_bet_amount NUMERIC,
    p_nonce TEXT,
    p_state_json JSONB DEFAULT '{}'::jsonb,
    p_expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes'
)
RETURNS JSON
LANGUAGE plpgsql
AS $start_game_round_atomic$
DECLARE
    v_user RECORD;
    v_round RECORD;
    v_available NUMERIC;
BEGIN
    IF p_game NOT IN ('dice', 'wheel', 'tower', 'crash', 'laser') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid game type');
    END IF;

    IF p_bet_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Invalid bet amount');
    END IF;

    SELECT * INTO v_user
    FROM users
    WHERE wallet_address = p_wallet
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    v_available := v_user.server_balance - COALESCE(v_user.pending_withdrawal, 0);

    IF v_available < p_bet_amount THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Insufficient balance',
            'available', v_available,
            'required', p_bet_amount
        );
    END IF;

    IF EXISTS (
        SELECT 1
        FROM game_rounds
        WHERE wallet_address = p_wallet
          AND game = p_game
          AND status = 'active'
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Active round already exists');
    END IF;

    UPDATE users
    SET server_balance = server_balance - p_bet_amount
    WHERE wallet_address = p_wallet
    RETURNING * INTO v_user;

    INSERT INTO game_rounds (
        wallet_address,
        game,
        bet_amount,
        nonce,
        status,
        state_json,
        expires_at
    ) VALUES (
        p_wallet,
        p_game,
        p_bet_amount,
        p_nonce,
        'active',
        p_state_json,
        p_expires_at
    )
    RETURNING * INTO v_round;

    RETURN json_build_object(
        'success', true,
        'round', row_to_json(v_round),
        'new_balance', v_user.server_balance
    );
END;
$start_game_round_atomic$;
