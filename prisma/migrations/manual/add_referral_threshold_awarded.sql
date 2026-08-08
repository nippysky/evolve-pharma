-- Add referral_threshold_awarded flag to customers.
-- Tracks whether this customer (as a referee) has already triggered
-- the referral reward for their referrer. Prevents double-awarding.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS referral_threshold_awarded TINYINT(1) NOT NULL DEFAULT 0;
