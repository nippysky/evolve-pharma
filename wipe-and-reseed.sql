-- Envolve Pharmaceuticals — Database wipe
-- Paste into phpMyAdmin SQL tab and click Go.
-- Uses DELETE FROM (no FK check changes needed).

DELETE FROM stock_movements;
DELETE FROM inventory_batches;
DELETE FROM product_images;
DELETE FROM cart_items;
DELETE FROM order_items;
DELETE FROM payment_transactions;
DELETE FROM otp_tokens;
DELETE FROM refresh_tokens;
DELETE FROM login_history;
DELETE FROM audit_logs;
DELETE FROM notifications;
DELETE FROM carts;
DELETE FROM deliveries;
DELETE FROM orders;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM manufacturers;
DELETE FROM app_settings;
DELETE FROM customers;
DELETE FROM drivers;
DELETE FROM staff;
DELETE FROM users;
