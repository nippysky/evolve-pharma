import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import { writeAuditLog }       from '@/lib/audit';
import { revalidateInventory } from '@/lib/revalidate';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';

const patchSchema = z.object({
  batch_number: z.string().min(1).max(100).optional(),
  cost_price:   z.number().positive().optional(),
  expiry_date:  z.string().nullable().optional(), // ISO date string or null to clear
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided.',
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return apiError('Invalid batch ID.', 400);

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? 'Invalid input.',
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    // Load existing batch (with product info for context)
    const existing = await db.inventoryBatch.findUnique({
      where:   { id },
      include: { product: { select: { id: true, sku: true, brand_name: true } } },
    });
    if (!existing) return apiNotFound('Inventory batch not found.');

    const { batch_number, cost_price, expiry_date } = parsed.data;

    // Check batch_number uniqueness if changing it
    if (batch_number && batch_number !== existing.batch_number) {
      const conflict = await db.inventoryBatch.findUnique({ where: { batch_number } });
      if (conflict) return apiError('Batch number already exists.', 409);
    }

    const updateData: Record<string, unknown> = {};
    if (batch_number !== undefined) updateData.batch_number = batch_number;
    if (cost_price   !== undefined) updateData.cost_price   = cost_price;
    if (expiry_date  !== undefined) {
      updateData.expiry_date = expiry_date ? new Date(expiry_date) : null;
    }

    const updated = await db.inventoryBatch.update({
      where: { id },
      data:  updateData,
    });

    // If cost_price changed, sync Product.last_cost_price when this is the most recent batch
    if (cost_price !== undefined && cost_price !== Number(existing.cost_price)) {
      const latestBatch = await db.inventoryBatch.findFirst({
        where:   { product_id: existing.product.id },
        orderBy: { received_at: 'desc' },
        select:  { id: true },
      });
      if (latestBatch?.id === id) {
        await db.product.update({
          where: { id: existing.product.id },
          data:  { last_cost_price: cost_price },
        });
      }
    }

    // Audit log — record what changed
    const changes: string[] = [];
    if (batch_number !== undefined && batch_number !== existing.batch_number) {
      changes.push(`batch_number: "${existing.batch_number}" → "${batch_number}"`);
    }
    if (cost_price !== undefined && cost_price !== Number(existing.cost_price)) {
      changes.push(`cost_price: ${existing.cost_price} → ${cost_price}`);
    }
    if (expiry_date !== undefined) {
      const oldExp = existing.expiry_date?.toISOString().split('T')[0] ?? 'null';
      const newExp = expiry_date ?? 'null';
      if (oldExp !== newExp) changes.push(`expiry_date: ${oldExp} → ${newExp}`);
    }

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    session.email,
      email:       session.email,
      action:      'UPDATE_INVENTORY_BATCH',
      entityType:  'InventoryBatch',
      entityId:    String(id),
      description: `Batch ${existing.batch_number} (${existing.product.sku}) metadata updated. Changes: ${changes.join('; ') || 'none'}.`,
    });

    revalidateInventory();
    return apiSuccess({
      id:           updated.id,
      batch_number: updated.batch_number,
      cost_price:   Number(updated.cost_price),
      expiry_date:  updated.expiry_date,
    }, 200, 'Batch updated successfully.');
  } catch (err) {
    console.error('[PATCH /api/inventory/batches/:id]', err);
    return apiInternalError();
  }
}
