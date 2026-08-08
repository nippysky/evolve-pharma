-- ─────────────────────────────────────────────────────────────────────────────
-- Staff/admin ordering on behalf of customers.
--
-- placed_by_user_id records WHO actually created the order:
--   NULL  → the customer placed it themselves through the portal
--   <id>  → a staff member or admin placed it on the customer's behalf
--
-- Audit logs cover the compliance trail; this column lives on the order row so
-- the UI can render a "Placed by" badge and reports can attribute correctly
-- without joining against audit_logs.
--
-- Run with:
--   npx prisma db execute --file prisma/migrations/manual/add_placed_by_to_orders.sql --schema prisma/schema.prisma
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS placed_by_user_id INT NULL DEFAULT NULL;

-- FK is added separately so re-running the file doesn't fail on a duplicate
-- constraint name (MySQL has no ADD CONSTRAINT IF NOT EXISTS).
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME        = 'orders'
    AND CONSTRAINT_NAME   = 'fk_order_placed_by'
);

SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE orders
     ADD CONSTRAINT fk_order_placed_by
     FOREIGN KEY (placed_by_user_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT "fk_order_placed_by already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE INDEX IF NOT EXISTS idx_orders_placed_by ON orders(placed_by_user_id);
