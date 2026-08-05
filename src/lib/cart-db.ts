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

interface CartRow {
  id:          number;
  uuid:        string;
  customer_id: number;
}

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

  const existing = await db.$queryRaw<CartRow[]>`
    SELECT id, uuid, customer_id FROM carts WHERE customer_id = ${customerId} LIMIT 1
  `;

  if (existing.length > 0) {
    return { id: existing[0]!.id, uuid: existing[0]!.uuid };
  }

  const uuid = crypto.randomUUID();
  await db.$executeRaw`
    INSERT INTO carts (uuid, customer_id) VALUES (${uuid}, ${customerId})
  `;

  const created = await db.$queryRaw<CartRow[]>`
    SELECT id, uuid, customer_id FROM carts WHERE customer_id = ${customerId} LIMIT 1
  `;

  if (!created[0]) throw new Error('Failed to retrieve cart after insert');
  return { id: created[0].id, uuid: created[0].uuid };
}

export async function getCartWithItems(customerId: number): Promise<CartWithItems | null> {
  await ensureCartTables();

  const carts = await db.$queryRaw<CartRow[]>`
    SELECT id, uuid, customer_id FROM carts WHERE customer_id = ${customerId} LIMIT 1
  `;
  if (!carts.length) return null;

  const cart = carts[0]!;

  // Left-join cart_items → products → product_images (primary only)
  const rows = await db.$queryRaw<Array<{
    id:            number;
    cart_id:       number;
    product_id:    number;
    quantity:      number;
    unit_price:    string;   // Decimal comes back as string in MySQL raw
    brand_name:    string;
    generic_name:  string;
    sku:           string;
    pack_size:     string | null;
    selling_price: string;
    primary_image: string | null;
    status:        string;
  }>>`
    SELECT
      ci.id,
      ci.cart_id,
      ci.product_id,
      ci.quantity,
      ci.unit_price,
      p.brand_name,
      p.generic_name,
      p.sku,
      p.pack_size,
      p.selling_price,
      p.status,
      (
        SELECT pi.url FROM product_images pi
        WHERE pi.product_id = p.id AND pi.is_primary = 1
        LIMIT 1
      ) AS primary_image
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.cart_id = ${cart.id}
      AND p.deleted_at IS NULL
    ORDER BY ci.created_at ASC
  `;

  return {
    id:         cart.id,
    uuid:       cart.uuid,
    customerId: cart.customer_id,
    items:      rows.map(r => ({
      ...r,
      unit_price:    Number(r.unit_price),
      selling_price: Number(r.selling_price),
    })),
  };
}

export async function upsertCartItem(
  cartId:    number,
  productId: number,
  quantity:  number,
  unitPrice: number,
): Promise<void> {
  await db.$executeRaw`
    INSERT INTO cart_items (cart_id, product_id, quantity, unit_price)
    VALUES (${cartId}, ${productId}, ${quantity}, ${unitPrice})
    ON DUPLICATE KEY UPDATE
      quantity   = quantity + VALUES(quantity),
      unit_price = VALUES(unit_price),
      updated_at = CURRENT_TIMESTAMP
  `;
}

export async function setCartItemQuantity(
  itemId: number,
  cartId: number,
  quantity: number,
): Promise<boolean> {
  const result = await db.$executeRaw`
    UPDATE cart_items
    SET    quantity = ${quantity}, updated_at = CURRENT_TIMESTAMP
    WHERE  id = ${itemId} AND cart_id = ${cartId}
  `;
  return (result as number) > 0;
}

export async function removeCartItem(
  itemId: number,
  cartId: number,
): Promise<boolean> {
  const result = await db.$executeRaw`
    DELETE FROM cart_items WHERE id = ${itemId} AND cart_id = ${cartId}
  `;
  return (result as number) > 0;
}

export async function clearCartItems(cartId: number): Promise<void> {
  await db.$executeRaw`
    DELETE FROM cart_items WHERE cart_id = ${cartId}
  `;
}

export async function createPaymentTransaction(params: {
  orderId:   number;
  reference: string;
  amount:    number; // naira (not kobo)
  gateway:   string;
  status:    'pending' | 'success' | 'failed';
}): Promise<void> {
  await ensureCartTables();
  await db.$executeRaw`
    INSERT INTO payment_transactions (order_id, reference, amount, gateway, status)
    VALUES (${params.orderId}, ${params.reference}, ${params.amount}, ${params.gateway}, ${params.status})
    ON DUPLICATE KEY UPDATE
      status   = VALUES(status),
      updated_at = CURRENT_TIMESTAMP
  `;
}

export async function updatePaymentTransactionStatus(
  reference: string,
  status:    'pending' | 'success' | 'failed',
  gatewayResponse?: string,
): Promise<void> {
  await db.$executeRaw`
    UPDATE payment_transactions
    SET    status           = ${status},
           gateway_response = ${gatewayResponse ?? null},
           updated_at       = CURRENT_TIMESTAMP
    WHERE  reference = ${reference}
  `;
}

export async function getPaymentTransactionByRef(reference: string) {
  await ensureCartTables();
  const rows = await db.$queryRaw<Array<{
    id:       number;
    order_id: number;
    reference: string;
    amount:   string;
    status:   string;
    gateway:  string;
  }>>`
    SELECT id, order_id, reference, amount, status, gateway
    FROM   payment_transactions
    WHERE  reference = ${reference}
    LIMIT  1
  `;
  if (!rows.length) return null;
  return { ...rows[0]!, amount: Number(rows[0]!.amount) };
}
