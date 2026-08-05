import { NextRequest, NextResponse } from 'next/server';
import { db }         from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
} from '@/lib/api/response';

const CACHE_TTL     = 30_000;   // 30 seconds
const CACHE_MAX     = 200;      // max distinct queries cached

interface CacheEntry {
  data:      SearchData;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): SearchData | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { cache.delete(key); return null; }
  // LRU: re-insert so it moves to the end (Map iteration order = insertion order)
  cache.delete(key);
  cache.set(key, entry);
  return entry.data;
}

function cacheSet(key: string, data: SearchData) {
  // Evict oldest entry if at capacity
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

interface SearchData {
  products:  ProductHit[];
  customers: CustomerHit[];
  orders:    OrderHit[];
}

interface ProductHit {
  id:            number;
  sku:           string;
  brand_name:    string;
  generic_name:  string;
  status:        string;
  primary_image: string | null;
}

interface CustomerHit {
  id:           number;
  company_name: string | null;
  name:         string;
  email:        string;
  status:       string;
}

interface OrderHit {
  id:            number;
  order_number:  string;
  status:        string;
  total:         number;
  customer_name: string;
}

const MAX_PER = 5;

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
    if (q.length < 2) {
      return NextResponse.json(
        { status: 'error', message: 'Query must be at least 2 characters' },
        { status: 400 },
      );
    }

    // ── Cache hit ──────────────────────────────────────────────────────────
    const cached = cacheGet(q);
    if (cached) {
      return NextResponse.json(
        { status: 'success', message: 'OK', data: cached },
        { headers: { 'Cache-Control': 'private, max-age=10', 'X-Cache': 'HIT' } },
      );
    }

    // ── DB queries (parallel, raw SQL) ────────────────────────────────────
    //
    // We use $queryRaw instead of the ORM `contains` filter because
    // @prisma/adapter-mariadb sends string parameters with utf8mb4_bin
    // collation (coercibility NONE), while columns use utf8mb4_unicode_ci
    // (coercibility IMPLICIT).  MySQL error 1267 fires on any LIKE.
    //
    // Fix: wrap every search parameter in
    //   CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci
    // This gives the parameter utf8mb4_unicode_ci coercibility NONE,
    // which matches the column — no conflict.
    //
    // The `pat` template-tag variable is used as a single Prisma
    // interpolation point (becomes one `?` placeholder), keeping the
    // query fully parameterised.

    const pat = `%${q}%`;

    type ProductRow = {
      id: number; sku: string; brand_name: string;
      generic_name: string; status: string; primary_image: string | null;
    };
    type CustomerRow = {
      id: number; company_name: string | null;
      first_name: string; last_name: string; email: string; status: string;
    };
    type OrderRow = {
      id: number; order_number: string; status: string;
      total: string; company_name: string | null;
      first_name: string; last_name: string;
    };

    const [products, customers, orders] = await Promise.all([

      db.$queryRaw<ProductRow[]>`
        SELECT
          p.id, p.sku, p.brand_name, p.generic_name, p.status,
          (SELECT url FROM product_images
           WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS primary_image
        FROM products p
        LEFT JOIN manufacturers m ON m.id = p.manufacturer_id
        WHERE p.deleted_at IS NULL
          AND (
            p.brand_name   LIKE CONVERT(${pat} USING utf8mb4) COLLATE utf8mb4_unicode_ci
            OR p.generic_name LIKE CONVERT(${pat} USING utf8mb4) COLLATE utf8mb4_unicode_ci
            OR p.sku          LIKE CONVERT(${pat} USING utf8mb4) COLLATE utf8mb4_unicode_ci
            OR m.name         LIKE CONVERT(${pat} USING utf8mb4) COLLATE utf8mb4_unicode_ci
          )
        ORDER BY p.brand_name ASC
        LIMIT ${MAX_PER}
      `,

      db.$queryRaw<CustomerRow[]>`
        SELECT
          c.id, c.company_name, c.status,
          u.first_name, u.last_name, u.email
        FROM customers c
        JOIN users u ON u.id = c.user_id
        WHERE
          c.company_name LIKE CONVERT(${pat} USING utf8mb4) COLLATE utf8mb4_unicode_ci
          OR u.first_name LIKE CONVERT(${pat} USING utf8mb4) COLLATE utf8mb4_unicode_ci
          OR u.last_name  LIKE CONVERT(${pat} USING utf8mb4) COLLATE utf8mb4_unicode_ci
          OR u.email      LIKE CONVERT(${pat} USING utf8mb4) COLLATE utf8mb4_unicode_ci
        ORDER BY c.created_at DESC
        LIMIT ${MAX_PER}
      `,

      db.$queryRaw<OrderRow[]>`
        SELECT
          o.id, o.order_number, o.status, o.total,
          c.company_name, u.first_name, u.last_name
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        JOIN users u ON u.id = c.user_id
        WHERE
          o.order_number LIKE CONVERT(${pat} USING utf8mb4) COLLATE utf8mb4_unicode_ci
          OR c.company_name LIKE CONVERT(${pat} USING utf8mb4) COLLATE utf8mb4_unicode_ci
          OR u.first_name   LIKE CONVERT(${pat} USING utf8mb4) COLLATE utf8mb4_unicode_ci
          OR u.last_name    LIKE CONVERT(${pat} USING utf8mb4) COLLATE utf8mb4_unicode_ci
        ORDER BY o.created_at DESC
        LIMIT ${MAX_PER}
      `,
    ]);

    // ── Shape & cache ──────────────────────────────────────────────────────
    const data: SearchData = {
      products: products.map(p => ({
        id:            Number(p.id),
        sku:           p.sku,
        brand_name:    p.brand_name,
        generic_name:  p.generic_name,
        status:        p.status,
        primary_image: p.primary_image ?? null,
      })),

      customers: customers.map(c => ({
        id:           Number(c.id),
        company_name: c.company_name,
        name:         `${c.first_name} ${c.last_name}`.trim(),
        email:        c.email,
        status:       c.status,
      })),

      orders: orders.map(o => ({
        id:            Number(o.id),
        order_number:  o.order_number,
        status:        o.status,
        total:         Number(o.total),
        customer_name: o.company_name ?? `${o.first_name} ${o.last_name}`.trim(),
      })),
    };

    cacheSet(q, data);

    return NextResponse.json(
      { status: 'success', message: 'OK', data },
      { headers: { 'Cache-Control': 'private, max-age=10', 'X-Cache': 'MISS' } },
    );
  } catch (err) {
    console.error('[GET /api/search]', err);
    return apiInternalError();
  }
}
