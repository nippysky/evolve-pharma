/**
 * POST /api/inventory/receive
 *
 * Records a stock receipt (new inventory batch).
 * Creates an InventoryBatch + StockMovement, updates product's last_cost_price.
 *
 * Body:
 *   product_id, batch_number, quantity, cost_price, expiry_date?
 */

import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  product_id:    z.number().int().positive(),
  batch_number:  z.string().min(1).max(100),
  quantity:      z.number().int().positive(),
  cost_price:    z.number().positive(),
  expiry_date:   z.string().optional(), // ISO date string YYYY-MM-DD
  notes:         z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const [field, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        errors[field] = msgs as string[];
      }
      return apiError('Please review the fields below.', 422, errors);
    }

    const { product_id, batch_number, quantity, cost_price, expiry_date, notes } = parsed.data;

    // Verify product exists
    const product = await db.product.findFirst({
      where: { id: product_id, deleted_at: null },
    });
    if (!product) return apiNotFound('Product');

    // Check batch number uniqueness
    const existingBatch = await db.inventoryBatch.findUnique({ where: { batch_number } });
    if (existingBatch) return apiError('A batch with this number already exists.', 409);

    // Create batch + stock movement + update last_cost_price in a transaction
    const batch = await db.$transaction(async (tx: any) => {
      const newBatch = await tx.inventoryBatch.create({
        data: {
          product_id,
          batch_number,
          quantity,
          cost_price,
          expiry_date:   expiry_date ? new Date(expiry_date) : null,
          created_by_id: session.userId,
        },
      });

      await tx.stockMovement.create({
        data: {
          product_id,
          batch_id:       newBatch.id,
          type:           'IN',
          quantity,
          reference_type: 'MANUAL_RECEIVE',
          notes,
          created_by_id:  session.userId,
        },
      });

      await tx.product.update({
        where: { id: product_id },
        data:  { last_cost_price: cost_price, updated_by_id: session.userId },
      });

      return newBatch;
    });

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'RECEIVE_STOCK',
      entityType:  'InventoryBatch',
      entityId:    String(batch.id),
      description: `Received ${quantity} units of ${product.brand_name} (batch ${batch_number})`,
      req,
    });

    return apiSuccess({ batch: { id: batch.id, batch_number: batch.batch_number, quantity: batch.quantity } }, 201, 'Stock received successfully');
  } catch (err) {
    console.error('[POST /api/inventory/receive]', err);
    return apiInternalError();
  }
}
