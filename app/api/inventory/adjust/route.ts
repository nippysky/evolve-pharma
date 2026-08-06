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

const adjustSchema = z.object({
  batch_id: z.number().int().positive(),
  delta:    z.number().int().refine(n => n !== 0, { message: 'Delta cannot be zero.' }),
  reason:   z.string().min(3, 'Reason is required (min 3 characters).').max(500),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const body   = await req.json();
    const parsed = adjustSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? 'Invalid input.',
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const { batch_id, delta, reason } = parsed.data;

    // Load batch + product info
    const batch = await db.inventoryBatch.findUnique({
      where:   { id: batch_id },
      include: { product: { select: { id: true, sku: true, brand_name: true } } },
    });
    if (!batch) return apiNotFound('Inventory batch not found.');

    const newQuantity = batch.quantity + delta;
    if (newQuantity < 0) {
      return apiError(
        `Adjustment would result in negative stock (${batch.quantity} + ${delta} = ${newQuantity}). ` +
        `Maximum removal is ${batch.quantity} units.`,
        400,
      );
    }

    // 1. Create StockMovement audit record FIRST
    await db.stockMovement.create({
      data: {
        product_id:     batch.product.id,
        batch_id:       batch.id,
        type:           'ADJUSTMENT',
        quantity:       Math.abs(delta),
        reference_type: 'MANUAL_ADJUSTMENT',
        reference_id:   null,
        notes:          `${delta > 0 ? '+' : ''}${delta} units. Reason: ${reason}`,
        created_by_id:  session.userId,
      },
    });

    // 2. Update batch quantity
    const updated = await db.inventoryBatch.update({
      where: { id: batch_id },
      data:  { quantity: newQuantity },
    });

    // 3. Audit log
    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    session.email,
      email:       session.email,
      action:      'ADJUST_INVENTORY',
      entityType:  'InventoryBatch',
      entityId:    String(batch_id),
      description: `Batch ${batch.batch_number} (${batch.product.sku}) adjusted by ${delta > 0 ? '+' : ''}${delta} units. ` +
                   `${batch.quantity} → ${newQuantity}. Reason: ${reason}.`,
    });

    revalidateInventory();
    return apiSuccess({
      batch_id:      updated.id,
      batch_number:  updated.batch_number,
      previous_qty:  batch.quantity,
      delta,
      new_qty:       newQuantity,
      product_sku:   batch.product.sku,
      product_name:  batch.product.brand_name,
    }, 200, `Stock adjusted: ${batch.quantity} → ${newQuantity} units.`);
  } catch (err) {
    console.error('[POST /api/inventory/adjust]', err);
    return apiInternalError();
  }
}
