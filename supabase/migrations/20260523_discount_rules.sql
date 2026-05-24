-- ============================================================
-- Discount rules: configurable discounts for reservations
-- Types: 'date_range' (seasonal/event) and 'loyalty' (recurring guests)
-- ============================================================
CREATE TABLE IF NOT EXISTS discount_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('date_range', 'loyalty')),
  -- date_range fields: discount valid when check-in falls within range
  valid_from DATE,
  valid_until DATE,
  -- loyalty fields: applies based on guest stay history
  loyalty_min_stays INT DEFAULT 0,
  loyalty_within_days INT DEFAULT 0,
  -- common
  discount_percent DECIMAL(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE discount_rules IS 'Configurable discount rules applied at reservation time';
COMMENT ON COLUMN discount_rules.type IS 'date_range: applies when check-in is within valid_from/valid_until. loyalty: applies when guest has >= loyalty_min_stays within loyalty_within_days';
COMMENT ON COLUMN discount_rules.discount_percent IS 'Percentage to discount from total (e.g. 15.00 = 15%)';

-- Seed examples
INSERT INTO discount_rules (name, type, valid_from, valid_until, discount_percent) VALUES
  ('Día de la Virgen de Guadalupe', 'date_range', '2026-12-10', '2026-12-13', 10.00),
  ('Día de la Mujer', 'date_range', '2027-03-08', '2027-03-09', 10.00);

INSERT INTO discount_rules (name, type, loyalty_min_stays, loyalty_within_days, discount_percent) VALUES
  ('Cliente frecuente (2 estancias en 15 días)', 'loyalty', 2, 15, 15.00);

-- RLS: only admins can manage discount_rules
ALTER TABLE discount_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage discount_rules"
  ON discount_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Anyone can read active discount rules (needed for guest reservation flow)
CREATE POLICY "Anyone can read active discount_rules"
  ON discount_rules
  FOR SELECT
  USING (is_active = true);