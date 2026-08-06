/**
 * cart-db.ts
 *
 * All cart and payment-transaction operations via the Prisma client.
 * Tables are still bootstrapped via ensureCartTables() because this project
 * uses manual DB setup rather than prisma migrate — the IF NOT EXISTS guards
 * are harmless no-ops once the tables exist.
 */

import { db } from '@/lib/db';

let tablesReady = false;

export async function ensureCartTables(): Promise<void> {
  if (tablesReady) return;

  // Sequential DDL — each statement uses one connection slot at a time.
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS carts (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      uuid        VARCHAR(36)   NOT NULL UNIQUE,
      customer_id INT           NOT NULL UNIQUE,
      expires_at  DATETIME      NULL,
      created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_carts_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id         INT            AUTO_INCREMENT PRIMARY KEY,
      cart_id    INT            NOT NULL,
      product_id INT            NOT NULL,
      quantity   INT            NOT NULL DEFAULT 1,
      unit_price DECIMAL(12,2)  NOT NULL,
      created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cart_item (cart_id, product_id),
      CONSTRAINT fk_ci_cart    FOREIGN KEY (cart_id)    REFERENCES carts(id)    ON DELETE CASCADE,
      CONSTRAINT fk_ci_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id               INT            AUTO_INCREMENT PRIMARY KEY,
      order_id         INT            NOT NULL,
      reference        VARCHAR(255)   NOT NULL UNIQUE,
      amount           DECIMAL(12,2)  NOT NULL,
      currency         VARCHAR(10)    NOT NULL DEFAULT 'NGN',
      gateway          VARCHAR(50)    NOT NULL DEFAULT 'paystack',
      status           VARCHAR(20)    NOT NULL DEFAULT 'pending',
      gateway_response TEXT           NULL,
      created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_pt_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  tablesReady = true;
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export interface CartItemRow {
  id:            number;
  cart_id:       number;
  product_id:    number;
  quantity:      number;
  unit_price:    number;
  brand_name:    string;
  generic_name:  string;
  sku:           string;
  pack_size:     string | null;
  selling_price: number;
  primary_image: string | null;
  status:        string;
}

export interface CartWithItems {
  id:         number;
  uuid:       string;
  customerId: number;
  items:      CartItemRow[];
}

export async function getOrCreateCart(customerId: number): Promise<{ id: number; uuid: string }> {
  await ensureCartTables();

  const existing = await db.cart.findUnique({
    where:  { customer_id: customerId },
    select: { id: true, uuid: true },
  });
  if (existing) return existing;

  const uuid = crypto.randomUUID();
  const created = await db.cart.create({
    data:   { uuid, customer_id: customerId },
    select: { id: true, uuid: true },
  });
  return created;
}

export async function getCartWithItems(customerId: number): Promise<CartWithItems | null> {
  await ensureCartTables();

  const cart = await db.cart.findUnique({
    where: { customer_id: customerId },
    select: { id: true, uuid: true, customer_id: true },
  });
  if (!cart) return null;

  // Fetch items with product + primary image via Prisma
  const rawItems = await db.cartItem.findMany({
    where:   { cart_id: cart.id },
    orderBy: { created_at: 'asc' },
    select: {
      id:         true,
      cart_id:    true,
      product_id: true,
      quantity:   true,
      unit_price: true,
      product: {
        select: {
          brand_name:    true,
          generic_name:  true,
          sku:           true,
          pack_size:     true,
          selling_price: true,
          status:        true,
          deleted_at:    true,
          images: {
            where:   { is_primary: true },
            take:    1,
            select:  { url: true },
          },
        },
      },
    },
  });

  const items: CartItemRow[] = rawItems
    .filter(i => i.product.deleted_at === null)
    .map(i => ({
      id:            i.id,
      cart_id:       i.cart_id,
      product_id:    i.product_id,
      quantity:      i.quantity,
      unit_price:    Number(i.unit_price),
      brand_name:    i.product.brand_name,
      generic_name:  i.product.generic_name,
      sku:           i.product.sku,
      pack_size:     i.product.pack_size ?? null,
      selling_price: Number(i.product.selling_price),
      primary_image: i.product.images[0]?.url ?? null,
      status:        i.product.status,
    }));

  return { id: cart.id, uuid: cart.uuid, customerId: cart.customer_id, items };
}

export async function upsertCartItem(
  cartId:    number,
  productId: number,
  quantity:  number,
  unitPrice: number,
): Promise<void> {
  // Prisma doesn't support ON DUPLICATE KEY UPDATE natively, so we upsert manually.
  const existing = await db.cartItem.findUnique({
    where: { cart_id_product_id: { cart_id: cartId, product_id: productId } },
    select: { id: true, quantity: true },
  });

  if (existing) {
    await db.cartItem.update({
      where: { id: existing.id },
      data:  { quantity: existing.quantity + quantity, unit_price: unitPrice },
    });
  } else {
    await db.cartItem.create({
      data: { cart_id: cartId, product_id: productId, quantity, unit_price: unitPrice },
    });
  }
}

export async function setCartItemQuantity(
  itemId: number,
  cartId: number,
  quantity: number,
): Promise<boolean> {
  try {
    await db.cartItem.updateMany({
      where: { id: itemId, cart_id: cartId },
      data:  { quantity },
    });
    return true;
  } catch {
    return false;
  }
}

export async function removeCartItem(
  itemId: number,
  cartId: number,
): Promise<boolean> {
  const result = await db.cartItem.deleteMany({
    where: { id: itemId, cart_id: cartId },
  });
  return result.count > 0;
}

export async function clearCartItems(cartId: number): Promise<void> {
  await db.cartItem.deleteMany({ where: { cart_id: cartId } });
}

// ─── Payment Transactions ─────────────────────────────────────────────────────

export async function createPaymentTransaction(params: {
  orderId:   number;
  reference: string;
  amount:    number;
  gateway:   string;
  status:    'pending' | 'success' | 'failed';
}): Promise<void> {
  await ensureCartTables();

  await db.paymentTransaction.upsert({
    where:  { reference: params.reference },
    update: { status: params.status },
    create: {
      order_id:  params.orderId,
      reference: params.reference,
      amount:    params.amount,
      gateway:   params.gateway,
      status:    params.status,
    },
  });
}

export async function updatePaymentTransactionStatus(
  reference: string,
  status:    'pending' | 'success' | 'failed',
  gatewayResponse?: string,
): Promise<void> {
  await db.paymentTransaction.update({
    where: { reference },
    data:  { status, gateway_response: gatewayResponse ?? null },
  });
}

export async function getPaymentTransactionByRef(reference: string) {
  await ensureCartTables();

  const row = await db.paymentTransaction.findUnique({
    where:  { reference },
    select: { id: true, order_id: true, reference: true, amount: true, status: true, gateway: true },
  });
  if (!row) return null;
  return { ...row, amount: Number(row.amount) };
}
