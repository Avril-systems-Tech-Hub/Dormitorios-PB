-- ============================================================
-- Promo codes: multi-use discount codes for reservations
-- ============================================================
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent DECIMAL(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  max_uses INT NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  current_uses INT NOT NULL DEFAULT 0 CHECK (current_uses >= 0),
  batch_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE promo_codes IS 'Promotional discount codes that can be redeemed multiple times up to max_uses';
COMMENT ON COLUMN promo_codes.code IS 'Unique promo code (e.g. VERANO50-3A7K)';
COMMENT ON COLUMN promo_codes.max_uses IS 'Maximum number of times this code can be redeemed';
COMMENT ON COLUMN promo_codes.current_uses IS 'Number of times this code has been redeemed';
COMMENT ON COLUMN promo_codes.batch_name IS 'Campaign/batch name for grouping codes';

-- Index for fast code lookups
CREATE INDEX idx_promo_codes_code ON promo_codes (code) WHERE is_active = true;
CREATE INDEX idx_promo_codes_batch ON promo_codes (batch_name);

-- RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Admins can manage promo codes
CREATE POLICY "Admins can manage promo_codes"
  ON promo_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Anyone can read active promo codes (needed for guest validation)
CREATE POLICY "Anyone can read active promo_codes"
  ON promo_codes
  FOR SELECT
  USING (is_active = true);

-- Function to atomically redeem a promo code
CREATE OR REPLACE FUNCTION redeem_promo_code(p_code TEXT)
RETURNS TABLE (id UUID, code TEXT, discount_percent DECIMAL(5,2)) AS $$
BEGIN
  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE code = p_code
    AND is_active = true
    AND current_uses < max_uses
    AND valid_from <= CURRENT_DATE
    AND valid_until >= CURRENT_DATE
  RETURNING promo_codes.id, promo_codes.code, promo_codes.discount_percent
  INTO id, code, discount_percent;

  IF id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired promo code: %', p_code;
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;