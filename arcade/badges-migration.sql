-- Create badges table
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
    badge_type TEXT NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, badge_type)
);

CREATE INDEX IF NOT EXISTS idx_badges_wallet ON badges(wallet_address);

-- Function: Award Badge (idempotent)
CREATE OR REPLACE FUNCTION award_badge(p_wallet TEXT, p_badge_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO badges (wallet_address, badge_type)
    VALUES (p_wallet, p_badge_type)
    ON CONFLICT (wallet_address, badge_type) DO NOTHING;
    
    RETURN FOUND;
END;
$$;
