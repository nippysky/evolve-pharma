import { NextRequest }   from 'next/server';
import { z }             from 'zod';
import { db }            from '@/lib/db';
import { getSession }    from '@/lib/auth';
import {
  getOrCreateCart,
  upsertCartItem,
  getCartWithItems,
} from '@/lib/cart-db';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';

const bodySchema = z.object({
  product_id: z.number().int().positive(),
  quantity:   z.number().int().positive().max(999),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'CUSTOMER') return apiForbidden('Only customer accounts can add to cart.');

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body.', 400); }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid request.', 400);
    }

    const { product_id, quantity } = parsed.data;
    const product = await db.product.findFirst({
      where:  { id: product_id, status: 'ACTIVE', deleted_at: null },
      select: {
        id: true, sku: true, brand_name: true,
        selling_price: true, minimum_order: true,
        inventoryBatches: { select: { quantity: true }, where: { quantity: { gt: 0 } } },
      },
    });
    if (!product) return apiNotFound('Product');

    if (quantity < product.minimum_order) {
      return apiError(
        `Minimum order for "${product.brand_name}" is ${product.minimum_order} packs.`,
        400,
      );
    }

    const totalStock = product.inventoryBatches.reduce((s, b) => s + b.quantity, 0);
    if (totalStock < quantity) {
      return apiError(
        `Only ${totalStock} packs in stock for "${product.brand_name}".`,
        400,
      );
    }

    const customer = await db.customer.findUnique({
      where:  { user_id: session.userId },
      select: { id: true },
    });
    if (!customer) return apiError('Customer record not found.', 404);

    const cart     = await getOrCreateCart(customer.id);
    const unitPrice = Number(product.selling_price);

    await upsertCartItem(cart.id, product_id, quantity, unitPrice);

    const updated = await getCartWithItems(customer.id);
    const subtotal = updated?.items.reduce((s, i) => s + i.unit_price * i.quantity, 0) ?? 0;

    return apiSuccess(
      {
        cart_id:    cart.id,
        item_count: updated?.items.reduce((s, i) => s + i.quantity, 0) ?? 0,
        subtotal,
      },
      201,
      `${quantity} × ${product.brand_name} added to cart.`,
    );
  } catch (err) {
    console.error('[POST /api/cart/items]', err);
    return apiInternalError();
  }
}
