/**
 * POST /api/products/quick-import
 *
 * Lightweight bulk product creation for catalogue build-out.
 *
 * Accepts only six columns:
 *   manufacturer, brand_name, generic_name, product_category,
 *   product_strength, pack_size
 *
 * Everything else is deferred. Products land as DRAFT with selling_price 0,
 * which is why publishing is guarded — /api/products/bulk-actions and the
 * single-product PATCH both refuse to activate a product priced at zero, so an
 * unpriced draft can never reach the catalogue.
 *
 * Deliberately separate from /api/products/bulk-import: that route handles the
 * full 15-column format including pricing and stock levels, and is relied on
 * for proper imports. Keeping them apart means this cannot regress it.
 */

import { NextRequest }        from 'next/server';
import * as XLSX              from 'xlsx';
import { z }                  from 'zod';
import { db }                 from '@/lib/db';
import { getSession }         from '@/lib/auth';
import { writeAuditLog }      from '@/lib/audit';
import { revalidateProducts } from '@/lib/revalidate';
import {
  deriveSku, identityKey, findExistingByIdentity,
} from '@/lib/products/identity';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS       = 1_000;

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

/** Only the six columns the client wants to fill in up front. */
const rowSchema = z.object({
  manufacturer:     z.string().trim().min(1, 'Manufacturer is required').max(120),
  brand_name:       z.string().trim().min(2, 'Brand name is required').max(160),
  generic_name:     z.string().trim().min(1, 'Generic name is required').max(160),
  product_category: z.string().trim().min(1, 'Category is required').max(80),
  product_strength: z.string().trim().max(100).optional(),
  pack_size:        z.string().trim().max(100).optional(),
});

interface FailRecord {
  row:    number;
  sku?:   string;
  errors: string[];
}

// SKU derivation and duplicate detection live in @/lib/products/identity, so
// this importer, the full importer and manual creation cannot drift apart —
// which is exactly how the same product ended up in the catalogue twice.

/** Accept a few spellings per column so the client's sheet doesn't have to be exact. */
const HEADER_ALIASES: Record<string, string> = {
  manufacturer:       'manufacturer',
  brand:              'brand_name',
  brand_name:         'brand_name',
  brandname:          'brand_name',
  generic:            'generic_name',
  generic_name:       'generic_name',
  genericname:        'generic_name',
  category:           'product_category',
  product_category:   'product_category',
  productcategory:    'product_category',
  strength:           'product_strength',
  product_strength:   'product_strength',
  productstrength:    'product_strength',
  pack:               'pack_size',
  pack_size:          'pack_size',
  packsize:           'pack_size',
};

function normaliseRow(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const canonical = HEADER_ALIASES[key.trim().toLowerCase().replace(/[\s-]+/g, '_')];
    if (canonical) out[canonical] = String(value ?? '').trim();
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    // Product creation is admin-only, matching the rest of the products area.
    if (session.role !== 'ADMIN') {
      return apiForbidden('Only admins can import products.');
    }

    let formData: FormData;
    try { formData = await req.formData(); }
    catch { return apiError('Multipart form data required.', 400); }

    const blob = formData.get('file') as File | null;
    if (!blob) return apiError('No file uploaded.', 422);

    const name = blob.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some(e => name.endsWith(e))) {
      return apiError('Upload an .xlsx, .xls or .csv file.', 415);
    }
    if (blob.size > MAX_FILE_BYTES) {
      return apiError('File is larger than 5 MB. Split it into smaller batches.', 413);
    }

    // ── Parse ───────────────────────────────────────────────────────────────
    let rawRows: Record<string, unknown>[];
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      const wb     = XLSX.read(buffer, { type: 'buffer' });
      const sheet  = wb.Sheets[wb.SheetNames[0]!];
      if (!sheet) return apiError('The file has no sheets.', 400);
      rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '', raw: false,
      });
    } catch {
      return apiError('Could not read that file. Make sure it is a valid spreadsheet.', 400);
    }

    if (rawRows.length === 0) {
      return apiError('No data rows found. The first row must be a header row.', 400);
    }
    if (rawRows.length > MAX_ROWS) {
      return apiError(`File has more than ${MAX_ROWS} rows. Split into smaller batches.`, 400);
    }

    // ── Phase 1: validate + dedupe ──────────────────────────────────────────
    const failed:    FailRecord[] = [];
    const validRows: Array<
      z.infer<typeof rowSchema> & { rowNum: number; sku: string; key: string }
    > = [];
    // Keyed on identity, not on the derived SKU. Two rows for the same brand at
    // different strengths are different products and must both import.
    const seenKeys = new Map<string, number>();

    rawRows.forEach((raw, i) => {
      const rowNum = i + 2; // +1 for zero-index, +1 for the header row
      const parsed = rowSchema.safeParse(normaliseRow(raw));

      if (!parsed.success) {
        failed.push({
          row:    rowNum,
          errors: Object.entries(parsed.error.flatten().fieldErrors)
            .flatMap(([f, msgs]) => (msgs ?? []).map(m => `${f}: ${m}`)),
        });
        return;
      }

      const identity = {
        manufacturer:     parsed.data.manufacturer,
        brand_name:       parsed.data.brand_name,
        product_strength: parsed.data.product_strength,
        pack_size:        parsed.data.pack_size,
      };
      const key = identityKey(identity);
      const sku = deriveSku(identity);

      const dup = seenKeys.get(key);
      if (dup) {
        failed.push({
          row: rowNum, sku,
          errors: [`Duplicate of row ${dup} — same manufacturer, brand, strength and pack size.`],
        });
        return;
      }
      seenKeys.set(key, rowNum);
      validRows.push({ ...parsed.data, rowNum, sku, key });
    });

    if (validRows.length === 0) {
      return apiSuccess(
        { total_records: rawRows.length, created: 0, skipped: 0, failed: failed.length, failed_records: failed },
        200,
        'No valid rows to import.',
      );
    }

    // ── Phase 2: seed categories + manufacturers (2 queries) ────────────────
    const uniqueCategories    = [...new Set(validRows.map(r => r.product_category))];
    const uniqueManufacturers = [...new Set(validRows.map(r => r.manufacturer))];

    await db.category.createMany({
      data: uniqueCategories.map(n => ({ name: n })), skipDuplicates: true,
    });
    await db.manufacturer.createMany({
      data: uniqueManufacturers.map(n => ({ name: n })), skipDuplicates: true,
    });

    // ── Phase 3: reference maps (2 sequential queries — pool of 1 on serverless)
    const cats = await db.category.findMany({
      select: { id: true, name: true }, where: { name: { in: uniqueCategories } },
    });
    const mfrs = await db.manufacturer.findMany({
      select: { id: true, name: true }, where: { name: { in: uniqueManufacturers } },
    });
    const catMap = new Map(cats.map(c => [c.name, c.id]));
    const mfrMap = new Map(mfrs.map(m => [m.name, m.id]));

    // ── Phase 4: skip products that already exist (1 query) ─────────────────
    // This importer only creates. Updating an existing product is the full
    // importer's job — silently overwriting a priced product with a blank
    // quick row would wipe real data.
    //
    // Matched on identity rather than on the derived SKU. A product created by
    // hand carries a SKU with a random uniqueness suffix, which no derived SKU
    // will ever equal — so the old SKU-only check couldn't see it and imported
    // a second copy. That is the duplicate the client reported.
    const existing = await findExistingByIdentity(validRows.map(r => ({
      manufacturer:     r.manufacturer,
      brand_name:       r.brand_name,
      product_strength: r.product_strength,
      pack_size:        r.pack_size,
    })));

    const toCreate = validRows.filter(r => {
      const match = existing.get(r.key);
      if (match) {
        failed.push({
          row: r.rowNum, sku: r.sku,
          errors: [`Already in the catalogue as ${match.sku} — skipped.`],
        });
        return false;
      }
      return true;
    });

    // ── Phase 5: single batch insert ────────────────────────────────────────
    let created = 0;
    if (toCreate.length > 0) {
      const result = await db.product.createMany({
        data: toCreate.map(r => ({
          sku:              r.sku,
          // UNIQUE in the database — the last line of defence if two
          // imports race past the check above.
          identity_key:     r.key,
          brand_name:       r.brand_name,
          generic_name:     r.generic_name,
          product_strength: r.product_strength || null,
          pack_size:        r.pack_size        || null,
          category_id:      catMap.get(r.product_category) ?? null,
          manufacturer_id:  mfrMap.get(r.manufacturer)     ?? null,
          // Deferred fields. selling_price 0 marks "not priced yet" — the
          // publish guards refuse to activate anything still at zero.
          selling_price:    0,
          status:           'DRAFT' as const,
          created_by_id:    session.userId,
        })),
        skipDuplicates: true,
      });
      created = result.count;
    }

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'QUICK_IMPORT_PRODUCTS',
      entityType:  'Product',
      description: `Quick-imported ${created} draft product(s) from ${blob.name}. ` +
                   `${failed.length} row(s) skipped or invalid. All created without pricing.`,
      req,
    });

    revalidateProducts();

    return apiSuccess(
      {
        total_records:  rawRows.length,
        created,
        // Rows skipped because the product already exists. Previously reported
        // the size of the whole lookup result, which counted matches rather
        // than skips and could exceed the number of rows in the file.
        skipped:        validRows.length - toCreate.length,
        failed:         failed.length,
        failed_records: failed,
      },
      201,
      created === 0
        ? 'No new products were created.'
        : `${created} draft product${created !== 1 ? 's' : ''} created. Add pricing before publishing.`,
    );
  } catch (err) {
    console.error('[POST /api/products/quick-import]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
