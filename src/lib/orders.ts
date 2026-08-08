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
import { notifyUser, notifyRoles }    from '@/lib/notifications';

const FREE_SHIP_THRESHOLD = 50_000;    // ₦50,000
const SHIP_FEE            = 2_500;     // ₦2,500

export interface OrderLineItem {
  product_id: number;
  quantity:   number;
}

/**
 * Who physically created the order, when it wasn't the customer themselves.
 * Absent for normal customer self-service checkout.
 */
export interface PlacedBy {
  userId: number;
  role:   string;   // 'ADMIN' | 'STAFF'
  name:   string;
  email:  string;
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
  /**
   * Set when a staff member or admin places this order on the customer's
   * behalf. Drives attribution on the order row, the audit entry, and the
   * wording of the receipt email.
   */
  placedBy?:        PlacedBy;
  /**
   * Paystack checkout URL to embed in the receipt email as a "Pay now" button.
   * Used when an order is created awaiting payment (payment-link flow).
   */
  paymentUrl?:      string | null;
  /**
   * Skip the receipt email so the caller can send it later — used by the
   * on-behalf flow, which must generate the Paystack link (needs the computed
   * total) before emailing, so the customer gets one email with a Pay now button.
   * The caller receives everything it needs in `receipt` on the result.
   */
  deferReceiptEmail?: boolean;
}

/** Everything needed to send the receipt email, returned when it was deferred. */
export interface DeferredReceipt {
  to:            string;
  name:          string;
  orderNumber:   string;
  orderId:       number;
  items:         Array<{
    brand_name:   string;
    generic_name: string | null;
    quantity:     number;
    unit_price:   number;
    subtotal:     number;
  }>;
  subtotal:      number;
  deliveryFee:   number;
  vat:           number;
  total:         number;
  paymentMethod: string;
  isPaid:        boolean;
  placedByName:  string | null;
}

export type CreateOrderResult =
  | {
      ok: true;
      orderNumber: string;
      orderId: number;
      total: number;
      /** Present only when deferReceiptEmail was set. */
      receipt?: DeferredReceipt;
    }
  | { ok: false; message: string };

export async function createOrder(
  params: CreateOrderParams,
): Promise<CreateOrderResult> {
  const {
    customerId, userId, items,
    deliveryState, deliveryCity, deliveryAddress,
    contactPhone, deliveryNotes, poNumber,
    paymentMethod, paystackReference,
    placedBy, deferReceiptEmail,
  } = params;

  const isOnBehalf = !!placedBy;

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

  // Persist on-behalf attribution. Raw SQL because placed_by_user_id is added
  // via manual migration and isn't in the generated Prisma types.
  if (isOnBehalf) {
    await db.$executeRaw`
      UPDATE orders SET placed_by_user_id = ${placedBy.userId} WHERE id = ${order.id}
    `;
  }

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
    // 1. Clear cart — ONLY for customer self-checkout.
    //    An on-behalf order must never wipe a cart the customer is still
    //    building on their own device.
    if (!isOnBehalf) {
      try {
        const cart = await getOrCreateCart(customerId);
        await clearCartItems(cart.id);
      } catch (e) {
        console.warn('[createOrder] cart clear failed (non-fatal)', e);
      }
    }

    // 2. Resolve the customer ONCE.
    //    The audit label, both notifications and the receipt email all need
    //    the same record. Serverless runs a connection pool of 1, so four
    //    separate lookups of the same row would queue behind each other on the
    //    single connection. One raw join covers all of them — and picks up
    //    assigned_staff_id in the same pass, which the Prisma types may not
    //    expose until the client is regenerated.
    let customerLabel = `customer_id:${customerId}`;
    let custUserId:   number | null = null;
    let custEmail:    string | null = null;
    let custFirst:    string | null = null;
    let assignedStaffId: number | null = null;

    try {
      const rows = await db.$queryRaw<Array<{
        user_id:           number;
        company_name:      string | null;
        assigned_staff_id: number | null;
        first_name:        string;
        last_name:         string;
        email:             string;
      }>>`
        SELECT c.user_id, c.company_name, c.assigned_staff_id,
               u.first_name, u.last_name, u.email
        FROM customers c
        JOIN users u ON u.id = c.user_id
        WHERE c.id = ${customerId}
        LIMIT 1
      `;
      const c = rows[0];
      if (c) {
        customerLabel   = `${c.first_name} ${c.last_name}` +
                          (c.company_name ? ` (${c.company_name})` : '') +
                          ` <${c.email}>`;
        custUserId      = c.user_id;
        custEmail       = c.email;
        custFirst       = c.first_name;
        assignedStaffId = c.assigned_staff_id;
      }
    } catch { /* fall back to the id label; notifications degrade quietly */ }

    void writeAuditLog({
      userId:      placedBy?.userId ?? userId,
      userType:    placedBy?.role   ?? 'CUSTOMER',
      userName:    placedBy?.name   ?? customerLabel,
      email:       placedBy?.email  ?? '',
      action:      isOnBehalf ? 'CREATE_ORDER_ON_BEHALF' : 'CREATE_ORDER',
      entityType:  'Order',
      entityId:    String(order.id),
      description: isOnBehalf
        ? `Order ${orderNumber} placed on behalf of ${customerLabel} by ` +
          `${placedBy!.name} (${placedBy!.role}). Total: ₦${total.toLocaleString('en-NG')}. ` +
          `Items: ${items.length}. Payment: ${paymentMethod}.`
        : `Order ${orderNumber} created. Total: ₦${total.toLocaleString('en-NG')}. ` +
          `Items: ${items.length}. Payment: ${paymentMethod}.`,
    });

    // 2b. In-app notifications — customer confirmation plus an operational
    //     alert for whoever handles this account. Both reuse the lookup above
    //     rather than resolving the customer again, so this costs one INSERT
    //     each instead of a lookup-plus-insert pair.
    const staffAlert = {
      type:  'order' as const,
      title: `New order ${orderNumber}`,
      body:  `${customerLabel} — ₦${total.toLocaleString('en-NG')}, ${items.length} line item(s).` +
             (isOnBehalf ? ` Placed by ${placedBy!.name}.` : ''),
      link:  `/admin/orders`,
    };

    if (custUserId) {
      void notifyUser(custUserId, {
        type:  'order',
        title: `Order ${orderNumber} placed`,
        body:  isOnBehalf
          ? `${placedBy!.name} placed this order on your behalf. ` +
            `Total ₦${total.toLocaleString('en-NG')}.`
          : `We've received your order. Total ₦${total.toLocaleString('en-NG')}.`,
        link:  `/portal/orders/${order.id}`,
      });
    }

    if (assignedStaffId) {
      void notifyUser(assignedStaffId, staffAlert);
    } else {
      // No rep on the account — fall back to the admin team.
      void notifyRoles(['ADMIN'], staffAlert);
    }

    // 3. Receipt email to customer.
    //    Skipped when the caller defers it — the on-behalf flow needs to mint a
    //    Paystack link first (which requires the total this function computes)
    //    and then send a single receipt that already contains the Pay now
    //    button, rather than emailing the customer twice.
    if (deferReceiptEmail) return;

    // Reuses the single customer lookup above — no second round trip.
    if (custEmail && custFirst) {
      try {
        {
          await sendOrderReceiptEmail({
            to:            custEmail,
            name:          custFirst,
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
            placedByName: placedBy ? placedBy.name : null,
            paymentUrl:   params.paymentUrl ?? null,
          });
        }
      } catch (mailErr) {
        console.error('[createOrder] receipt email failed:', mailErr);
      }
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

  // When the receipt was deferred, hand the caller everything it needs to send
  // it once the payment link exists.
  let receipt: DeferredReceipt | undefined;
  if (deferReceiptEmail) {
    const custRecord = await db.customer.findUnique({
      where:  { id: customerId },
      select: { user: { select: { email: true, first_name: true } } },
    });
    if (custRecord?.user) {
      receipt = {
        to:          custRecord.user.email,
        name:        custRecord.user.first_name,
        orderNumber,
        orderId:     order.id,
        items: lineItems.map(li => {
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
        placedByName: placedBy?.name ?? null,
      };
    }
  }

  return { ok: true, orderNumber, orderId: order.id, total, receipt };
}
