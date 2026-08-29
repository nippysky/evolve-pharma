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
import { writeAuditLog }       from '@/lib/audit';
import { revalidateInventory } from '@/lib/revalidate';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS       = 500;

interface BatchRow {
  rowNum:      number;
  sku:         string;
  batch_no:    string;
  quantity:    number;
  cost_price:  number;
  expiry_date?: string;
  notes?:      string;
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

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parseRows(rawRows: unknown[][]): {
  rows:   BatchRow[];
  errors: RowError[];
} {
  if (rawRows.length < 2) return { rows: [], errors: [] };

  const headers: Record<string, number> = {};
  (rawRows[0] as string[]).forEach((h, i) => { headers[headerKey(h)] = i; });

  const rows:   BatchRow[] = [];
  const errors: RowError[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row    = rawRows[i] as (string | number | boolean | null | undefined)[];
    const rowNum = i + 1;
    const errs:  string[] = [];

    const sku      = cellStr(row, headers, 'sku');
    const batch_no = cellStr(row, headers, 'batch_no');
    const qtyRaw   = cellStr(row, headers, 'quantity');
    const costRaw  = cellStr(row, headers, 'cost_price');

    // Skip entirely blank rows
    if (!sku && !batch_no && !qtyRaw && !costRaw) continue;

    if (!sku)      errs.push('sku is required');
    if (!batch_no) errs.push('batch_no is required');

    const quantity   = parseInt(qtyRaw.replace(/,/g, ''),   10);
    const cost_price = parseFloat(costRaw.replace(/,/g, ''));

    if (!qtyRaw  || isNaN(quantity)   || quantity   <= 0) errs.push('quantity must be a positive integer');
    if (!costRaw || isNaN(cost_price) || cost_price <= 0) errs.push('cost_price must be a positive number');

    if (errs.length) {
      errors.push({ row: rowNum, sku: sku || `row ${rowNum}`, errors: errs });
      continue;
    }

    rows.push({
      rowNum,
      sku,
      batch_no,
      quantity,
      cost_price,
      expiry_date: cellStr(row, headers, 'expiry_date') || undefined,
      notes:       cellStr(row, headers, 'notes')       || undefined,
    });
  }

  return { rows, errors };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    // Inventory is read-only for sales reps: they check stock while a
    // pharmacist is on the phone, but receiving and adjusting are the
    // warehouse's job. Reads (GET /api/inventory, /stats) stay open to STAFF.
    if (session.role !== 'ADMIN') {
      return apiForbidden('Only an administrator can bulk-receive stock.');
    }

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

    const buffer   = Buffer.from(await blob.arrayBuffer());
    const XLSX     = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return apiError('Spreadsheet appears to be empty', 400);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return apiError('Could not read spreadsheet', 400);

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    if (rawRows.length < 2) return apiError('No data rows found', 400);
    if (rawRows.length - 1 > MAX_ROWS)
      return apiError(`File has more than ${MAX_ROWS} rows. Split into smaller batches.`, 400);

    const { rows: allRows, errors: parseErrors } = parseRows(rawRows as unknown[][]);
    if (!allRows.length) return apiError('No valid rows found in the file.', 422);

    const failedRecords: RowError[] = [...parseErrors];

    // ── Phase 2: Validate SKUs exist (1 query) ───────────────────────────────

    const uniqueSkus = [...new Set(allRows.map(r => r.sku))];
    const foundProducts = await db.product.findMany({
      select: { id: true, sku: true },
      where:  { sku: { in: uniqueSkus }, deleted_at: null },
    });
    const productMap = new Map(foundProducts.map(p => [p.sku, p.id]));

    // Rows whose SKU doesn't exist → fail
    const validRows: BatchRow[] = [];
    for (const row of allRows) {
      if (!productMap.has(row.sku)) {
        failedRecords.push({
          row:    row.rowNum,
          sku:    row.sku,
          errors: [`Product with SKU "${row.sku}" not found`],
        });
      } else {
        validRows.push(row);
      }
    }

    if (!validRows.length) {
      return apiSuccess(
        { total_records: allRows.length, successful: 0, failed: failedRecords.length, failed_records: failedRecords },
        200,
        'No valid rows to process — all SKUs were not found.',
      );
    }

    // ── Phase 3: Identify already-existing batch numbers (1 query) ───────────

    const allBatchNos = validRows.map(r => r.batch_no);
    const existingBatches = await db.inventoryBatch.findMany({
      select: { batch_number: true },
      where:  { batch_number: { in: allBatchNos } },
    });
    const existingBatchSet = new Set(existingBatches.map(b => b.batch_number));

    // Split valid rows: new batches only
    const newBatchRows: BatchRow[]  = [];
    for (const row of validRows) {
      if (existingBatchSet.has(row.batch_no)) {
        failedRecords.push({
          row:    row.rowNum,
          sku:    row.sku,
          errors: [`Batch "${row.batch_no}" already exists`],
        });
      } else {
        newBatchRows.push(row);
      }
    }

    if (!newBatchRows.length) {
      return apiSuccess(
        {
          total_records:  allRows.length + parseErrors.length,
          successful:     0,
          failed:         failedRecords.length,
          failed_records: failedRecords,
        },
        200,
        'All batch numbers already exist — nothing to receive.',
      );
    }

    // ── Phase 4: Bulk-create inventory batches (1 query) ─────────────────────

    await db.inventoryBatch.createMany({
      data: newBatchRows.map(row => ({
        product_id:    productMap.get(row.sku) as number,
        batch_number:  row.batch_no,
        quantity:      row.quantity,
        cost_price:    row.cost_price,
        expiry_date:   parseDate(row.expiry_date ?? ''),
        created_by_id: session.userId,
      })),
      skipDuplicates: true, // guard against race conditions
    });

    // ── Phase 5: Fetch created batches to get IDs (1 query) ──────────────────

    const createdBatches = await db.inventoryBatch.findMany({
      select: { id: true, batch_number: true, product_id: true, quantity: true, cost_price: true },
      where:  { batch_number: { in: newBatchRows.map(r => r.batch_no) } },
    });

    // ── Phase 6: Bulk-create stock movements (1 query) ───────────────────────

    const batchNoteMap = new Map(newBatchRows.map(r => [r.batch_no, r.notes]));

    await db.stockMovement.createMany({
      data: createdBatches.map(batch => ({
        product_id:     batch.product_id,
        batch_id:       batch.id,
        type:           'IN' as const,
        quantity:       batch.quantity,
        reference_type: 'BULK_RECEIVE',
        notes:          batchNoteMap.get(batch.batch_number) ?? `Bulk receive: ${batch.batch_number}`,
        created_by_id:  session.userId,
      })),
    });

    // ── Phase 7: Update last_cost_price per product (serial, small set) ──────
    // Group by product_id — take the highest cost_price from this receive session
    // (approximates FIFO cost update without joining all historical batches).
    const costUpdateMap = new Map<number, number>();
    for (const batch of createdBatches) {
      const existing = costUpdateMap.get(batch.product_id) ?? 0;
      const cost     = Number(batch.cost_price);
      if (cost > existing) costUpdateMap.set(batch.product_id, cost);
    }

    for (const [productId, cost] of costUpdateMap) {
      await db.product.update({
        where: { id: productId },
        data:  { last_cost_price: cost, updated_by_id: session.userId },
      });
    }

    // ── Audit + response ─────────────────────────────────────────────────────

    const successful = createdBatches.length;

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'BULK_RECEIVE_STOCK',
      entityType:  'InventoryBatch',
      description: `Bulk receive: ${successful} batches created, ${failedRecords.length} failed`,
      req,
    });

    revalidateInventory();
    return apiSuccess(
      {
        total_records:  allRows.length + parseErrors.length,
        successful,
        failed:         failedRecords.length,
        failed_records: failedRecords,
      },
      200,
      `Bulk receive complete: ${successful} batches created, ${failedRecords.length} failed.`,
    );
  } catch (err) {
    console.error('[POST /api/inventory/bulk-receive]', err);
    return apiInternalError();
  }
}
