import { NextRequest }   from 'next/server';
import { z }             from 'zod';
import { db }            from '@/lib/db';
import { getSession }    from '@/lib/auth';
import {
  getOrCreateCart,
  setCartItemQuantity,
  removeCartItem,
} from '@/lib/cart-db';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';

type Ctx = { params: Promise<{ itemId: string }> };

async function resolveCart(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return { error: apiUnauthorized() } as const;
  if (session.role !== 'CUSTOMER') return { error: apiForbidden() } as const;

  const customer = await db.customer.findUnique({
    where:  { user_id: session.userId },
    select: { id: true },
  });
  if (!customer) return { error: apiError('Customer record not found.', 404) } as const;

  const cart = await getOrCreateCart(customer.id);
  return { cart, session } as const;
}

const patchSchema = z.object({
  quantity: z.number().int().positive().max(999),
});

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const resolved = await resolveCart(req);
    if ('error' in resolved) return resolved.error;

    const { cart } = resolved;
    const { itemId } = await params;
    const id = parseInt(itemId, 10);
    if (isNaN(id)) return apiError('Invalid item ID.', 400);

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body.', 400); }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid request.', 400);
    }

    const updated = await setCartItemQuantity(id, cart.id, parsed.data.quantity);
    if (!updated) return apiNotFound('Cart item');

    return apiSuccess({ item_id: id, quantity: parsed.data.quantity }, 200, 'Quantity updated.');
  } catch (err) {
    console.error('[PATCH /api/cart/items/[itemId]]', err);
    return apiInternalError();
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const resolved = await resolveCart(req);
    if ('error' in resolved) return resolved.error;

    const { cart } = resolved;
    const { itemId } = await params;
    const id = parseInt(itemId, 10);
    if (isNaN(id)) return apiError('Invalid item ID.', 400);

    const removed = await removeCartItem(id, cart.id);
    if (!removed) return apiNotFound('Cart item');

    return apiSuccess({ removed: true }, 200, 'Item removed from cart.');
  } catch (err) {
    console.error('[DELETE /api/cart/items/[itemId]]', err);
    return apiInternalError();
  }
}
