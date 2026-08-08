-- Migration: Add assigned_staff_id to customers table
-- Run this manually: mysql -u USER -p DATABASE < this_file.sql

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS assigned_staff_id INT NULL DEFAULT NULL,
  ADD CONSTRAINT fk_customer_assigned_staff
    FOREIGN KEY (assigned_staff_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_assigned_staff ON customers(assigned_staff_id);
