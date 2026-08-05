import { NextRequest }   from 'next/server';
import { db }            from '@/lib/db';
import {
  apiSuccess,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  try {
    const { sku } = await params;

    const product = await db.product.findFirst({
      where: { sku, status: 'ACTIVE', deleted_at: null },
      include: {
        category:     true,
        manufacturer: true,
        images:       { orderBy: { is_primary: 'desc' } },
        inventoryBatches: {
          where:   { quantity: { gt: 0 } },
          select:  { quantity: true },
        },
      },
    });

    if (!product) return apiNotFound('Product');

    const totalStock = product.inventoryBatches.reduce((s, b) => s + b.quantity, 0);

    return apiSuccess({
      product: {
        id:                  product.id,
        uuid:                product.uuid,
        sku:                 product.sku,
        brand_name:          product.brand_name,
        generic_name:        product.generic_name,
        product_strength:    product.product_strength,
        pack_size:           product.pack_size,
        quantity_per_carton: product.quantity_per_carton,
        allow_unit_sale:     product.allow_unit_sale,
        minimum_order:       product.minimum_order,
        selling_price:       Number(product.selling_price),
        final_price:         product.final_price         ? Number(product.final_price)         : null,
        discount_percentage: product.discount_percentage ? Number(product.discount_percentage) : null,
        category:            product.category,
        manufacturer:        product.manufacturer,
        images:              product.images,
        total_stock:         totalStock,
        in_stock:            totalStock > 0,
      },
    });
  } catch (err) {
    console.error('[GET /api/catalog/products/[sku]]', err);
    return apiInternalError();
  }
}
