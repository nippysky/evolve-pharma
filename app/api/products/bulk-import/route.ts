/**
 * POST /api/products/bulk-import
 *
 * Accepts a multipart/form-data Excel (.xlsx) or CSV file.
 * Parses rows, upserts products by SKU, and returns an import summary.
 *
 * Required columns (case-insensitive header match):
 *   sku, brand_name, generic_name, selling_price
 *
 * Optional columns:
 *   category, manufacturer, product_strength, pack_size,
 *   quantity_per_carton, description, allow_unit_sale,
 *   minimum_order, last_cost_price, minimum_stock_level,
 *   reorder_quantity, status
 */

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

// ─── Row shape after parsing ──────────────────────────────────────────────────

interface ProductRow {
  sku:                  string;
  brand_name:           string;
  generic_name:         string;
  selling_price:        number;
  category?:            string;
  manufacturer?:        string;
  product_strength?:    string;
  pack_size?:           string;
  quantity_per_carton?: number;
  description?:         string;
  allow_unit_sale?:     boolean;
  minimum_order?:       number;
  last_cost_price?:     number;
  minimum_stock_level?: number;
  reorder_quantity?:    number;
  status?:              'ACTIVE' | 'DRAFT' | 'DISCONTINUED';
}

interface RowError {
  row:    number;
  sku:    string;
  errors: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a header-name → column-index map (lowercase, underscored). */
function buildHeaderMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = String(h).toLowerCase().trim().replace(/\s+/g, '_');
    map[key] = i;
  });
  return map;
}

/** Safely read a cell as string. Returns '' when column is absent. */
function cellStr(row: unknown[], headers: Record<string, number>, col: string): string {
  const i = headers[col];
  if (i === undefined) return '';
  const v = (row as (string | number | boolean | null | undefined)[])[i];
  return v != null ? String(v).trim() : '';
}

// ─── Parse rows ───────────────────────────────────────────────────────────────

function parseRows(rows: unknown[][]): { data: ProductRow[]; errors: RowError[] } {
  if (rows.length < 2) return { data: [], errors: [] };

  const headers = buildHeaderMap(rows[0] as string[]);
  const data:    ProductRow[] = [];
  const errors:  RowError[]   = [];
  const statusVals = new Set(['ACTIVE', 'DRAFT', 'DISCONTINUED']);

  for (let i = 1; i < rows.length; i++) {
    const row     = rows[i] as unknown[];
    const rowNum  = i + 1;
    const rowErrs: string[] = [];

    const sku          = cellStr(row, headers, 'sku');
    const brand_name   = cellStr(row, headers, 'brand_name');
    const generic_name = cellStr(row, headers, 'generic_name');
    const priceRaw     = cellStr(row, headers, 'selling_price');
    const price        = parseFloat(priceRaw);

    if (!sku)          rowErrs.push('sku is required');
    if (!brand_name)   rowErrs.push('brand_name is required');
    if (!generic_name) rowErrs.push('generic_name is required');
    if (!priceRaw || isNaN(price) || price <= 0) rowErrs.push('selling_price must be a positive number');

    if (rowErrs.length) {
      errors.push({ row: rowNum, sku: sku || `row ${rowNum}`, errors: rowErrs });
      continue;
    }

    const statusRaw = cellStr(row, headers, 'status').toUpperCase();
    const status    = statusVals.has(statusRaw) ? (statusRaw as ProductRow['status']) : 'DRAFT';

    const qpc  = parseInt(cellStr(row, headers, 'quantity_per_carton'), 10);
    const mo   = parseInt(cellStr(row, headers, 'minimum_order'),       10);
    const lcp  = parseFloat(cellStr(row, headers, 'last_cost_price'));
    const msl  = parseInt(cellStr(row, headers, 'minimum_stock_level'), 10);
    const rq   = parseInt(cellStr(row, headers, 'reorder_quantity'),    10);

    data.push({
      sku,
      brand_name,
      generic_name,
      selling_price:       price,
      category:            cellStr(row, headers, 'category')         || undefined,
      manufacturer:        cellStr(row, headers, 'manufacturer')     || undefined,
      product_strength:    cellStr(row, headers, 'product_strength') || undefined,
      pack_size:           cellStr(row, headers, 'pack_size')        || undefined,
      quantity_per_carton: isNaN(qpc) ? undefined : qpc,
      description:         cellStr(row, headers, 'description')      || undefined,
      allow_unit_sale:     cellStr(row, headers, 'allow_unit_sale').toLowerCase() === 'true',
      minimum_order:       isNaN(mo)  ? 1 : mo,
      last_cost_price:     isNaN(lcp) ? undefined : lcp,
      minimum_stock_level: isNaN(msl) ? 0 : msl,
      reorder_quantity:    isNaN(rq)  ? 0 : rq,
      status,
    });
  }

  return { data, errors };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const formData = await req.formData().catch(() => null);
    if (!formData) return apiError('Multipart form data required', 400);

    const file = formData.get('file');
    if (!file || typeof file === 'string') return apiError('No file uploaded', 400);

    const blob = file as File;
    const name = blob.name.toLowerCase();

    if (!name.endsWith('.xlsx') && !name.endsWith('.csv')) {
      return apiError('Only .xlsx and .csv files are supported', 415);
    }

    const buffer     = Buffer.from(await blob.arrayBuffer());
    const XLSX       = await import('xlsx');
    const workbook   = XLSX.read(buffer, { type: 'buffer' });
    const sheetName  = workbook.SheetNames[0];
    if (!sheetName) return apiError('Spreadsheet appears to be empty', 400);
    const sheet      = workbook.Sheets[sheetName];
    if (!sheet) return apiError('Could not read spreadsheet sheet', 400);
    const rows       = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

    const { data: validRows, errors: rowErrors } = parseRows(rows as unknown[][]);

    if (!validRows.length && rowErrors.length) {
      return apiError('No valid rows found in the uploaded file.', 422, {
        rows: rowErrors.map(e => `Row ${e.row} (${e.sku}): ${e.errors.join(', ')}`),
      });
    }

    // Resolve category and manufacturer IDs
    const categoryNames     = [...new Set(validRows.map(r => r.category).filter(Boolean))] as string[];
    const manufacturerNames = [...new Set(validRows.map(r => r.manufacturer).filter(Boolean))] as string[];

    const [cats, mfrs] = await Promise.all([
      categoryNames.length     ? db.category.findMany({     where: { name: { in: categoryNames     } } }) : [],
      manufacturerNames.length ? db.manufacturer.findMany({ where: { name: { in: manufacturerNames } } }) : [],
    ]);

    const catMap = new Map(cats.map(c  => [c.name,  c.id]));
    const mfrMap = new Map(mfrs.map(m => [m.name, m.id]));

    let inserted = 0;
    let updated  = 0;

    for (const row of validRows) {
      const data = {
        brand_name:          row.brand_name,
        generic_name:        row.generic_name,
        selling_price:       row.selling_price,
        category_id:         (row.category    ? catMap.get(row.category)    : undefined) ?? null,
        manufacturer_id:     (row.manufacturer ? mfrMap.get(row.manufacturer): undefined) ?? null,
        product_strength:    row.product_strength    ?? null,
        pack_size:           row.pack_size           ?? null,
        quantity_per_carton: row.quantity_per_carton ?? null,
        description:         row.description         ?? null,
        allow_unit_sale:     row.allow_unit_sale      ?? false,
        minimum_order:       row.minimum_order        ?? 1,
        last_cost_price:     row.last_cost_price      ?? null,
        minimum_stock_level: row.minimum_stock_level  ?? 0,
        reorder_quantity:    row.reorder_quantity      ?? 0,
        status:              row.status               ?? ('DRAFT' as const),
        updated_by_id:       session.userId,
      };

      const existing = await db.product.findFirst({ where: { sku: row.sku, deleted_at: null } });

      if (existing) {
        await db.product.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await db.product.create({ data: { ...data, sku: row.sku, created_by_id: session.userId } });
        inserted++;
      }
    }

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'BULK_IMPORT_PRODUCTS',
      entityType:  'Product',
      description: `Bulk imported ${inserted} new + ${updated} updated products`,
      req,
    });

    return apiSuccess({
      total_records:  validRows.length + rowErrors.length,
      inserted,
      updated,
      failed:         rowErrors.length,
      failed_records: rowErrors,
    }, 200, `Import complete: ${inserted} created, ${updated} updated, ${rowErrors.length} failed`);
  } catch (err) {
    console.error('[POST /api/products/bulk-import]', err);
    return apiInternalError();
  }
}
