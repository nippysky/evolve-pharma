import { db }                        from '@/lib/db';
import { writeAuditLog }              from '@/lib/audit';
import { revalidateOrders, revalidateInventory, revalidateProfile } from '@/lib/revalidate';
import { sendOrderReceiptEmail }      from '@/lib/mail';
import {
  createPaymentTransaction,
  clearCartItems,
  getOrCreateCart,
}                                     from '@/lib/cart-db';
import { getVatSettings }             from '@/lib/data/settings.server';

const FREE_SHIP_THRESHOLD = 50_000;    // ₦50,000
const SHIP_FEE            = 2_500;     // ₦2,500

export interface OrderLineItem {
  product_id: number;
  quantity:   number;
}

export interface CreateOrderParams {
  customerId:       number;
  userId:           number;
  items:            OrderLineItem[];
  deliveryState:    string;
  deliveryCity:     string;
  deliveryAddress:  string;
  contactPhone:     string;
  deliveryNotes?:   string;
  poNumber?:        string;
  paymentMethod:    'paystack' | 'bank_transfer' | 'cash_on_delivery';
  paystackReference?: string;
}

export type CreateOrderResult =
  | { ok: true;  orderNumber: string; orderId: number; total: number }
  | { ok: false; message: string };

export async function createOrder(
  params: CreateOrderParams,
): Promise<CreateOrderResult> {
  const {
    customerId, userId, items,
    deliveryState, deliveryCity, deliveryAddress,
    contactPhone, deliveryNotes, poNumber,
    paymentMethod, paystackReference,
  } = params;

  if (!items.length) {
    return { ok: false, message: 'Order must contain at least one item.' };
  }

  const productIds = items.map(i => i.product_id);

  // Load all requested products + ACTIVE inventory batches (1 query)
  const products = await db.product.findMany({
    where:   { id: { in: productIds }, deleted_at: null, status: 'ACTIVE' },
    select:  {
      id:            true,
      sku:           true,
      brand_name:    true,
      selling_price: true,
      minimum_order: true,
      inventoryBatches: {
        where:   { quantity: { gt: 0 } },
        select:  { id: true, quantity: true, expiry_date: true },
        orderBy: [{ expiry_date: 'asc' }, { id: 'asc' }],
      },
    },
  });

  // Validate every item
  const productMap = new Map(products.map(p => [p.id, p]));

  for (const item of items) {
    const p = productMap.get(item.product_id);
    if (!p) {
      return {
        ok:      false,
        message: `Product #${item.product_id} is not available or does not exist.`,
      };
    }

    const totalStock = p.inventoryBatches.reduce((s, b) => s + b.quantity, 0);
    if (totalStock < item.quantity) {
      return {
        ok:      false,
        message: `Insufficient stock for "${p.brand_name}". ` +
                 `Requested ${item.quantity}, available ${totalStock}.`,
      };
    }

    if (item.quantity < p.minimum_order) {
      return {
        ok:      false,
        message: `"${p.brand_name}" requires a minimum order of ${p.minimum_order} packs.`,
      };
    }
  }

  // Calculate totals
  let subtotal = 0;
  const lineItems = items.map(item => {
    const p          = productMap.get(item.product_id)!;
    const unitPrice  = Number(p.selling_price);
    const lineTotal  = unitPrice * item.quantity;
    subtotal        += lineTotal;
    return { product_id: p.id, quantity: item.quantity, unit_price: unitPrice, subtotal: lineTotal };
  });

  const { enabled: vatEnabled, rate: vatRate } = await getVatSettings();
  const deliveryFee = subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIP_FEE;
  const vat         = vatEnabled ? Math.round(subtotal * vatRate) : 0;
  const total       = subtotal + deliveryFee + vat;

  // Create Order (temp order_number avoids UNIQUE collision)
  const tempNum = `TEMP-${crypto.randomUUID()}`;
  const year    = new Date().getFullYear();

  const isPaid = paymentMethod === 'paystack' && !!paystackReference;

  const order = await db.order.create({
    data: {
      order_number:     tempNum,
      customer_id:      customerId,
      status:           'PENDING',
      payment_status:   isPaid ? 'PAID' : 'UNPAID',
      payment_reference: paystackReference ?? null,
      delivery_address: deliveryAddress,
      delivery_city:    deliveryCity,
      delivery_state:   deliveryState,
      subtotal,
      delivery_fee:     deliveryFee,
      total,
      notes: JSON.stringify({
        po_number:      poNumber      ?? null,
        delivery_notes: deliveryNotes ?? null,
        contact_phone:  contactPhone,
        vat,
        vat_rate:       vatEnabled ? vatRate * 100 : 0,
      }),
    },
  });

  // Batch-insert OrderItems (1 query)
  await db.orderItem.createMany({
    data: lineItems.map(li => ({
      order_id:   order.id,
      product_id: li.product_id,
      quantity:   li.quantity,
      unit_price: li.unit_price,
      subtotal:   li.subtotal,
    })),
  });

  // FIFO inventory deduction (sequential per item per batch)
  for (const item of items) {
    const p     = productMap.get(item.product_id)!;
    let remaining = item.quantity;

    for (const batch of p.inventoryBatches) {
      if (remaining <= 0) break;

      const deduct    = Math.min(remaining, batch.quantity);
      const newQty    = batch.quantity - deduct;
      remaining      -= deduct;

      await db.inventoryBatch.update({
        where: { id: batch.id },
        data:  { quantity: newQty },
      });

      await db.stockMovement.create({
        data: {
          product_id:    p.id,
          batch_id:      batch.id,
          type:          'OUT',
          quantity:      deduct,
          reference_type: 'ORDER',
          reference_id:  order.id,
          created_by_id: userId,
          notes:         `Order ${order.id} — FIFO deduction`,
        },
      });
    }
  }

  // Set real order_number
  const orderNumber = `ENV-${year}-${String(order.id).padStart(6, '0')}`;
  await db.order.update({
    where: { id: order.id },
    data:  { order_number: orderNumber },
  });

  // Payment transaction record
  if (paystackReference) {
    await createPaymentTransaction({
      orderId:   order.id,
      reference: paystackReference,
      amount:    total,
      gateway:   'paystack',
      status:    isPaid ? 'success' : 'pending',
    });
  }

  // Fire-and-forget: clear cart, audit log, receipt email
  void (async () => {
    // 1. Clear cart
    try {
      const cart = await getOrCreateCart(customerId);
      await clearCartItems(cart.id);
    } catch (e) {
      console.warn('[createOrder] cart clear failed (non-fatal)', e);
    }

    // 2. Audit log
    void writeAuditLog({
      userId:      userId,
      userType:    'CUSTOMER',
      userName:    `customer_id:${customerId}`,
      email:       '',
      action:      'CREATE_ORDER',
      entityType:  'Order',
      entityId:    String(order.id),
      description: `Order ${orderNumber} created. Total: ₦${total.toLocaleString('en-NG')}. ` +
                   `Items: ${items.length}. Payment: ${paymentMethod}.`,
    });

    // 3. Receipt email to customer
    try {
      const custRecord = await db.customer.findUnique({
        where:  { id: customerId },
        select: { user: { select: { email: true, first_name: true } } },
      });
      if (custRecord?.user) {
        try {
          await sendOrderReceiptEmail({
            to:            custRecord.user.email,
            name:          custRecord.user.first_name,
            orderNumber,
            orderId:       order.id,
            items:         lineItems.map(li => {
              const p = productMap.get(li.product_id)!;
              return {
                brand_name:   p.brand_name,
                generic_name: null,
                quantity:     li.quantity,
                unit_price:   li.unit_price,
                subtotal:     li.subtotal,
              };
            }),
            subtotal,
            deliveryFee,
            vat,
            total,
            paymentMethod,
            isPaid,
          });
        } catch (mailErr) {
          console.error('[createOrder] receipt email failed:', mailErr);
        }
      }
    } catch (e) {
      console.error('[createOrder] receipt email lookup failed (non-fatal)', e);
    }
  })();

  // Bust caches so portal reflects the new order immediately
  try {
    revalidateOrders({ orderId: order.id, userId });
    revalidateInventory();               // stock levels changed via FIFO deduction
    revalidateProfile(userId);           // total_orders / total_spent metrics
  } catch {
    // revalidateTag is a no-op outside a request context — safe to ignore
  }

  return { ok: true, orderNumber, orderId: order.id, total };
}
