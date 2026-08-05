import { NextRequest }   from 'next/server';
import { db }            from '@/lib/db';
import { getSession }    from '@/lib/auth';
import {
  getOrCreateCart,
  getCartWithItems,
  clearCartItems,
} from '@/lib/cart-db';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
} from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'CUSTOMER') return apiForbidden('Only customer accounts can access the cart.');

    const customer = await db.customer.findUnique({
      where:  { user_id: session.userId },
      select: { id: true },
    });
    if (!customer) return apiError('Customer record not found.', 404);

    const cart = await getCartWithItems(customer.id);
    if (!cart) {
      // Cart doesn't exist yet — return empty cart shape
      await getOrCreateCart(customer.id);
      return apiSuccess({ cart: { items: [], subtotal: 0, item_count: 0 } });
    }

    const subtotal    = cart.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const item_count  = cart.items.reduce((s, i) => s + i.quantity, 0);

    return apiSuccess({
      cart: {
        id:         cart.id,
        uuid:       cart.uuid,
        items:      cart.items.map(i => ({
          id:           i.id,
          product_id:   i.product_id,
          quantity:     i.quantity,
          unit_price:   i.unit_price,
          subtotal:     i.unit_price * i.quantity,
          brand_name:   i.brand_name,
          generic_name: i.generic_name,
          sku:          i.sku,
          pack_size:    i.pack_size,
          primary_image: i.primary_image,
          in_stock:     i.status === 'ACTIVE',
        })),
        subtotal,
        item_count,
      },
    });
  } catch (err) {
    console.error('[GET /api/cart]', err);
    return apiInternalError();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'CUSTOMER') return apiForbidden();

    const customer = await db.customer.findUnique({
      where:  { user_id: session.userId },
      select: { id: true },
    });
    if (!customer) return apiError('Customer record not found.', 404);

    const cart = await getOrCreateCart(customer.id);
    await clearCartItems(cart.id);

    return apiSuccess({ cleared: true }, 200, 'Cart cleared successfully.');
  } catch (err) {
    console.error('[DELETE /api/cart]', err);
    return apiInternalError();
  }
}
