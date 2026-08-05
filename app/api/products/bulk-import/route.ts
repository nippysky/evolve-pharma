import { NextRequest } from 'next/server';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
} from '@/lib/api/response';
import { writeAuditLog } from '@/lib/audit';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS       = 1_000;

interface ParsedRow {
  // row metadata (not stored)
  rowNum: number;

  // product fields
  brand_name:           string;
  generic_name:         string;
  manufacturer:         string;
  product_category:     string;
  product_strength?:    string;
  pack_size?:           string;
  quantity_per_carton?: number;
  minimum_order:        number;
  selling_price:        number;
  cost_price?:          number;
  minimum_stock_level:  number;
  reorder_quantity:     number;

  // inventory fields
  batch_no?:          string;
  expiry_date?:       string;
  quantity_received?: number;
}

interface RowError {
  row:    number;
  sku:    string;
  errors: string[];
}

function headerKey(h: string): string {
  return String(h).toLowerCase().trim().replace(/[\s-]+/g, '_');
}

function cellStr(
  row:     (string | number | boolean | null | undefined)[],
  headers: Record<string, number>,
  col:     string,
): string {
  const i = headers[col];
  if (i === undefined) return '';
  const v = row[i];
  return v != null ? String(v).trim() : '';
}

function deriveSku(manufacturer: string, brandName: string): string {
  const slug = (s: string) =>
    s.toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 20);
  return `${slug(manufacturer)}-${slug(brandName)}`;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parseRows(rawRows: unknown[][]): {
  rows:   ParsedRow[];
  errors: RowError[];
} {
  if (rawRows.length < 2) return { rows: [], errors: [] };

  const headers: Record<string, number> = {};
  (rawRows[0] as string[]).forEach((h, i) => { headers[headerKey(h)] = i; });

  const rows:   ParsedRow[] = [];
  const errors: RowError[]  = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row    = rawRows[i] as (string | number | boolean | null | undefined)[];
    const rowNum = i + 1;
    const errs:  string[] = [];

    const brand_name       = cellStr(row, headers, 'brand_name');
    const generic_name     = cellStr(row, headers, 'generic_name');
    const manufacturer     = cellStr(row, headers, 'manufacturer');
    const product_category = cellStr(row, headers, 'product_category');
    const sellRaw          = cellStr(row, headers, 'selling_price');
    const costRaw          = cellStr(row, headers, 'cost_price');

    // Skip entirely blank rows
    if (!brand_name && !generic_name && !manufacturer && !sellRaw) continue;

    if (!brand_name)       errs.push('brand_name is required');
    if (!generic_name)     errs.push('generic_name is required');
    if (!manufacturer)     errs.push('manufacturer is required');
    if (!product_category) errs.push('product_category is required');

    const selling_price = parseFloat(sellRaw.replace(/,/g, ''));
    if (!sellRaw || isNaN(selling_price) || selling_price <= 0)
      errs.push('selling_price must be a positive number');

    if (errs.length) {
      const sku = manufacturer && brand_name ? deriveSku(manufacturer, brand_name) : `row ${rowNum}`;
      errors.push({ row: rowNum, sku, errors: errs });
      continue;
    }

    const cost_price = parseFloat(costRaw.replace(/,/g, ''));
    const qpcRaw     = cellStr(row, headers, 'quantity_per_carton');
    const moRaw      = cellStr(row, headers, 'minimum_order');
    const mslRaw     = cellStr(row, headers, 'minimum_stock_level');
    const rqRaw      = cellStr(row, headers, 'reorder_quantity');
    const qrcvRaw    = cellStr(row, headers, 'quantity_received');

    rows.push({
      rowNum,
      brand_name,
      generic_name,
      manufacturer,
      product_category,
      product_strength:    cellStr(row, headers, 'product_strength') || undefined,
      pack_size:           cellStr(row, headers, 'pack_size')        || undefined,
      quantity_per_carton: parseInt(qpcRaw.replace(/,/g, ''), 10)  || undefined,
      minimum_order:       Math.max(1, parseInt(moRaw.replace(/,/g, ''), 10)  || 1),
      selling_price,
      cost_price:          isNaN(cost_price) || cost_price <= 0 ? undefined : cost_price,
      minimum_stock_level: parseInt(mslRaw.replace(/,/g, ''), 10) || 0,
      reorder_quantity:    parseInt(rqRaw.replace(/,/g, ''),  10) || 0,
      batch_no:            cellStr(row, headers, 'batch_no')     || undefined,
      expiry_date:         cellStr(row, headers, 'expiry_date')  || undefined,
      quantity_received:   parseInt(qrcvRaw.replace(/,/g, ''), 10) || undefined,
    });
  }

  return { rows, errors };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    // ── File validation ──────────────────────────────────────────────────────

    const formData = await req.formData().catch(() => null);
    if (!formData) return apiError('Multipart form data required', 400);

    const file = formData.get('file');
    if (!file || typeof file === 'string') return apiError('No file uploaded', 400);

    const blob = file as File;
    const name = blob.name.toLowerCase();

    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv'))
      return apiError('Only .xlsx, .xls, and .csv files are supported', 415);
    if (blob.size > MAX_FILE_BYTES)
      return apiError('File exceeds the 5 MB limit', 413);

    // ── Phase 1: Parse in memory ─────────────────────────────────────────────

    const buffer    = Buffer.from(await blob.arrayBuffer());
    const XLSX      = await import('xlsx');
    const workbook  = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return apiError('Spreadsheet appears to be empty', 400);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return apiError('Could not read spreadsheet', 400);

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    if (rawRows.length < 2) return apiError('No data rows found in the file', 400);
    if (rawRows.length - 1 > MAX_ROWS)
      return apiError(`File has more than ${MAX_ROWS} rows. Split into smaller batches.`, 400);

    const { rows: allRows, errors: parseErrors } = parseRows(rawRows as unknown[][]);
    if (!allRows.length) return apiError('No valid rows found.', 422);

    // Within-file SKU deduplication (keep first occurrence)
    const seenSkus  = new Map<string, number>(); // sku → rowNum
    const validRows: ParsedRow[] = [];
    const dupErrors: RowError[]  = [];

    for (const row of allRows) {
      const sku = deriveSku(row.manufacturer, row.brand_name);
      if (seenSkus.has(sku)) {
        dupErrors.push({
          row:    row.rowNum,
          sku,
          errors: [`Duplicate in this file — same manufacturer + brand already in row ${seenSkus.get(sku)}`],
        });
      } else {
        seenSkus.set(sku, row.rowNum);
        validRows.push(row);
      }
    }

    const failedRecords: RowError[] = [...parseErrors, ...dupErrors];
    if (!validRows.length) return apiError('No unique valid rows to import.', 422);

    // ── Phase 2: Seed categories + manufacturers (2 queries) ─────────────────

    const uniqueCategories    = [...new Set(validRows.map(r => r.product_category))];
    const uniqueManufacturers = [...new Set(validRows.map(r => r.manufacturer))];

    // INSERT IGNORE via skipDuplicates — 1 query each, no pool pressure
    await db.category.createMany({
      data:            uniqueCategories.map(name => ({ name })),
      skipDuplicates:  true,
    });
    await db.manufacturer.createMany({
      data:            uniqueManufacturers.map(name => ({ name })),
      skipDuplicates:  true,
    });

    // ── Phase 3: Load reference maps (2 queries, Promise.all) ────────────────

    const [cats, mfrs] = await Promise.all([
      db.category.findMany({     select: { id: true, name: true }, where: { name: { in: uniqueCategories     } } }),
      db.manufacturer.findMany({ select: { id: true, name: true }, where: { name: { in: uniqueManufacturers } } }),
    ]);

    const catMap = new Map(cats.map(c => [c.name, c.id]));
    const mfrMap = new Map(mfrs.map(m => [m.name, m.id]));

    // ── Phase 4: Split rows into inserts vs updates (1 query) ────────────────

    const allSkus     = validRows.map(r => deriveSku(r.manufacturer, r.brand_name));
    const existingProd = await db.product.findMany({
      select: { id: true, sku: true },
      where:  { sku: { in: allSkus }, deleted_at: null },
    });
    const existingSkuSet = new Map(existingProd.map(p => [p.sku, p.id]));

    const toCreate: ParsedRow[] = [];
    const toUpdate: ParsedRow[] = [];

    for (const row of validRows) {
      const sku = deriveSku(row.manufacturer, row.brand_name);
      if (existingSkuSet.has(sku)) toUpdate.push(row);
      else                         toCreate.push(row);
    }

    // ── Phase 5: Bulk-insert new products (1 query) ───────────────────────────

    let inserted = 0;
    let updated  = 0;

    if (toCreate.length > 0) {
      await db.product.createMany({
        data: toCreate.map(row => ({
          sku:                 deriveSku(row.manufacturer, row.brand_name),
          brand_name:          row.brand_name,
          generic_name:        row.generic_name,
          product_strength:    row.product_strength    ?? null,
          pack_size:           row.pack_size           ?? null,
          quantity_per_carton: row.quantity_per_carton ?? null,
          minimum_order:       row.minimum_order,
          selling_price:       row.selling_price,
          last_cost_price:     row.cost_price          ?? null,
          minimum_stock_level: row.minimum_stock_level,
          reorder_quantity:    row.reorder_quantity,
          category_id:         catMap.get(row.product_category) ?? null,
          manufacturer_id:     mfrMap.get(row.manufacturer)     ?? null,
          status:              'DRAFT' as const,
          created_by_id:       session.userId,
          updated_by_id:       session.userId,
        })),
        skipDuplicates: true, // guard against any race
      });
      inserted = toCreate.length;
    }

    // ── Phase 6: Update existing products (serial, N_existing queries) ────────
    // N_existing is typically 0 on first import; small on re-import.
    // Accepts the serial cost — these are unavoidable since each row
    // has distinct field values and MySQL has no upsertMany.

    for (const row of toUpdate) {
      const sku = deriveSku(row.manufacturer, row.brand_name);
      const id  = existingSkuSet.get(sku);
      if (!id) continue;

      try {
        await db.product.update({
          where: { id },
          data:  {
            brand_name:          row.brand_name,
            generic_name:        row.generic_name,
            product_strength:    row.product_strength    ?? null,
            pack_size:           row.pack_size           ?? null,
            quantity_per_carton: row.quantity_per_carton ?? null,
            minimum_order:       row.minimum_order,
            selling_price:       row.selling_price,
            last_cost_price:     row.cost_price          ?? null,
            minimum_stock_level: row.minimum_stock_level,
            reorder_quantity:    row.reorder_quantity,
            category_id:         catMap.get(row.product_category) ?? null,
            manufacturer_id:     mfrMap.get(row.manufacturer)     ?? null,
            // status intentionally omitted — re-importing must not downgrade ACTIVE → DRAFT
            updated_by_id:       session.userId,
          },
        });
        updated++;
      } catch (err) {
        const sku2 = deriveSku(row.manufacturer, row.brand_name);
        failedRecords.push({ row: row.rowNum, sku: sku2, errors: [(err as Error).message] });
      }
    }

    // ── Phase 7: Resolve product IDs for batch FK (1 query) ──────────────────

    const allProducts = await db.product.findMany({
      select: { id: true, sku: true },
      where:  { sku: { in: allSkus }, deleted_at: null },
    });
    const productIdMap = new Map(allProducts.map(p => [p.sku, p.id]));

    // ── Phase 8: Inventory batches ────────────────────────────────────────────

    // Only rows that carry batch_no + quantity_received > 0
    const batchRows = validRows.filter(
      r => r.batch_no && r.quantity_received && r.quantity_received > 0,
    );

    let batchesCreated = 0;

    if (batchRows.length > 0) {
      const batchNos = batchRows.map(r => r.batch_no as string);

      // Find batch_numbers that already exist (1 query)
      const existingBatches = await db.inventoryBatch.findMany({
        select: { batch_number: true },
        where:  { batch_number: { in: batchNos } },
      });
      const existingBatchSet = new Set(existingBatches.map(b => b.batch_number));

      const newBatchRows = batchRows.filter(r => !existingBatchSet.has(r.batch_no as string));

      if (newBatchRows.length > 0) {
        // Bulk-insert batches (1 query)
        await db.inventoryBatch.createMany({
          data: newBatchRows.map(row => {
            const sku       = deriveSku(row.manufacturer, row.brand_name);
            const productId = productIdMap.get(sku) ?? 0;
            const batchCost = row.cost_price ?? row.selling_price * 0.85;
            return {
              product_id:    productId,
              batch_number:  row.batch_no as string,
              quantity:      row.quantity_received as number,
              cost_price:    batchCost,
              expiry_date:   parseDate(row.expiry_date ?? ''),
              created_by_id: session.userId,
            };
          }),
          skipDuplicates: true,
        });

        // Fetch the just-created batches to get their auto-increment IDs (1 query)
        const createdBatches = await db.inventoryBatch.findMany({
          select: { id: true, batch_number: true, product_id: true, quantity: true },
          where:  { batch_number: { in: newBatchRows.map(r => r.batch_no as string) } },
        });

        batchesCreated = createdBatches.length;

        // Bulk-insert stock movements (1 query)
        if (createdBatches.length > 0) {
          await db.stockMovement.createMany({
            data: createdBatches.map(batch => ({
              product_id:     batch.product_id,
              batch_id:       batch.id,
              type:           'IN' as const,
              quantity:       batch.quantity,
              reference_type: 'BULK_IMPORT',
              notes:          `Bulk import: batch ${batch.batch_number}`,
              created_by_id:  session.userId,
            })),
          });
        }
      }

      // Report skipped (already-existing) batches as informational failures
      const skippedBatchRows = batchRows.filter(r => existingBatchSet.has(r.batch_no as string));
      for (const row of skippedBatchRows) {
        failedRecords.push({
          row:    row.rowNum,
          sku:    deriveSku(row.manufacturer, row.brand_name),
          errors: [`Batch "${row.batch_no}" already exists — product was upserted but stock receipt skipped`],
        });
      }
    }

    // ── Audit + response ─────────────────────────────────────────────────────

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'BULK_IMPORT_PRODUCTS',
      entityType:  'Product',
      description: `Bulk import: ${inserted} new, ${updated} updated, ${batchesCreated} batches, ${failedRecords.length} issues`,
      req,
    });

    return apiSuccess(
      {
        total_records:             allRows.length + parseErrors.length,
        inserted,
        updated,
        failed:                    failedRecords.length,
        inventory_batches_created: batchesCreated,
        failed_records:            failedRecords,
      },
      200,
      `Import complete: ${inserted} created, ${updated} updated, ${batchesCreated} inventory batches recorded.`,
    );
  } catch (err) {
    console.error('[POST /api/products/bulk-import]', err);
    return apiInternalError();
  }
}
