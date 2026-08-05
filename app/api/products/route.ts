import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiSuccess,
  apiPaginated,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
  handlePrismaError,
  parsePagination,
} from '@/lib/api/response';
import { writeAuditLog } from '@/lib/audit';

const createSchema = z.object({
  sku:                z.string().min(1).max(100),
  brand_name:         z.string().min(1).max(255),
  generic_name:       z.string().min(1).max(255),
  category_id:        z.number().int().positive().optional(),
  manufacturer_id:    z.number().int().positive().optional(),
  product_strength:   z.string().max(100).optional(),
  pack_size:          z.string().max(100).optional(),
  quantity_per_carton:z.number().int().positive().optional(),
  allow_unit_sale:    z.boolean().default(false),
  minimum_order:      z.number().int().positive().default(1),
  selling_price:      z.number().positive(),
  last_cost_price:    z.number().positive().optional(),
  final_price:        z.number().positive().optional(),
  discount_percentage:z.number().min(0).max(100).optional(),
  minimum_stock_level:z.number().int().min(0).default(0),
  reorder_quantity:   z.number().int().min(0).default(0),
  status:             z.enum(['ACTIVE', 'DRAFT', 'DISCONTINUED']).default('DRAFT'),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 20 });

    const search     = sp.get('search') ?? '';
    const categoryId = sp.get('category') ? parseInt(sp.get('category')!, 10) : undefined;
    const status     = sp.get('status') as 'ACTIVE' | 'DRAFT' | 'DISCONTINUED' | null;
    const sort       = sp.get('sort') ?? 'newest';

    const where = {
      deleted_at: null,
      ...(search ? {
        OR: [
          { brand_name:   { contains: search } },
          { generic_name: { contains: search } },
          { sku:          { contains: search } },
        ],
      } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(status     ? { status }                 : {}),
    };

    const orderBy = sort === 'price_asc'  ? { selling_price: 'asc'  as const }
                  : sort === 'price_desc' ? { selling_price: 'desc' as const }
                  : sort === 'name_asc'   ? { brand_name:    'asc'  as const }
                  : sort === 'name_desc'  ? { brand_name:    'desc' as const }
                  :                        { created_at:     'desc' as const };

    const [records, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category:     { select: { id: true, name: true } },
          manufacturer: { select: { id: true, name: true } },
          images:       { orderBy: { is_primary: 'desc' } },
          inventoryBatches: {
            select: { quantity: true },
          },
        },
      }),
      db.product.count({ where }),
    ]);

    const products = records.map(p => ({
      id:                   p.id,
      uuid:                 p.uuid,
      sku:                  p.sku,
      brand_name:           p.brand_name,
      generic_name:         p.generic_name,
      product_strength:     p.product_strength,
      pack_size:            p.pack_size,
      quantity_per_carton:  p.quantity_per_carton,
      allow_unit_sale:      p.allow_unit_sale,
      minimum_order:        p.minimum_order,
      selling_price:        Number(p.selling_price),
      last_cost_price:      p.last_cost_price ? Number(p.last_cost_price) : null,
      final_price:          p.final_price      ? Number(p.final_price)      : null,
      discount_percentage:  p.discount_percentage ? Number(p.discount_percentage) : null,
      minimum_stock_level:  p.minimum_stock_level,
      reorder_quantity:     p.reorder_quantity,
      status:               p.status,
      category:             p.category,
      manufacturer:         p.manufacturer,
      primary_image:        p.images[0]?.url ?? null,
      images:               p.images,
      total_stock:          p.inventoryBatches.reduce((s, b) => s + b.quantity, 0),
      created_at:           p.created_at,
      updated_at:           p.updated_at,
    }));

    return apiPaginated(products, { page, limit, total }, 'Products retrieved successfully');
  } catch (err) {
    console.error('[GET /api/products]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const [field, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        errors[field] = msgs as string[];
      }
      return apiError('Please review the fields below.', 422, errors);
    }

    const data = parsed.data;

    // Check SKU uniqueness
    const existing = await db.product.findUnique({ where: { sku: data.sku } });
    if (existing) return apiError('A product with this SKU already exists.', 409);

    const product = await db.product.create({
      data: {
        sku:                 data.sku,
        brand_name:          data.brand_name,
        generic_name:        data.generic_name,
        category_id:         data.category_id,
        manufacturer_id:     data.manufacturer_id,
        product_strength:    data.product_strength,
        pack_size:           data.pack_size,
        quantity_per_carton: data.quantity_per_carton,
        allow_unit_sale:     data.allow_unit_sale,
        minimum_order:       data.minimum_order,
        selling_price:       data.selling_price,
        last_cost_price:     data.last_cost_price,
        final_price:         data.final_price,
        discount_percentage: data.discount_percentage,
        minimum_stock_level: data.minimum_stock_level,
        reorder_quantity:    data.reorder_quantity,
        status:              data.status,
        created_by_id:       session.userId,
        updated_by_id:       session.userId,
      },
    });

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'CREATE_PRODUCT',
      entityType:  'Product',
      entityId:    String(product.id),
      description: `Created product ${product.brand_name} (${product.sku})`,
      req,
    });

    return apiSuccess({ product: { id: product.id, sku: product.sku, uuid: product.uuid } }, 201, 'Product created successfully');
  } catch (err) {
    console.error('[POST /api/products]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
