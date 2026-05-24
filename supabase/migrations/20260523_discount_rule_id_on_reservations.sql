-- Add discount_rule_id to reservations to track which discount was applied
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS discount_rule_id UUID REFERENCES discount_rules(id);

-- Add discount columns for clarity
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;

COMMENT ON COLUMN reservations.discount_rule_id IS 'Reference to the discount rule applied, if any';
COMMENT ON COLUMN reservations.discount_percent IS 'Discount percentage applied to this reservation';