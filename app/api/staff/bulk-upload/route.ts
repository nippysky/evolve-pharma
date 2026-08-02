/**
 * POST /api/staff/bulk-upload
 *
 * Accepts a multipart/form-data Excel (.xlsx) or CSV file.
 * Creates staff accounts in bulk (Admin only).
 *
 * Required columns: first_name, last_name, email, employee_code, role (STAFF|DRIVER)
 * Optional: phone, department, job_title, password (auto-generated if omitted)
 */

import { NextRequest }   from 'next/server';
import bcrypt            from 'bcryptjs';
import { db }            from '@/lib/db';
import { getSession }    from '@/lib/auth';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
} from '@/lib/api/response';
import { writeAuditLog } from '@/lib/audit';

interface StaffRow {
  first_name:    string;
  last_name:     string;
  email:         string;
  employee_code: string;
  role:          'STAFF' | 'DRIVER';
  phone?:        string;
  department?:   string;
  job_title?:    string;
  password?:     string;
}

interface RowError {
  row:    number;
  email:  string;
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

/** Safely read a cell as a trimmed string. Returns '' when column is absent. */
function cellStr(row: unknown[], headers: Record<string, number>, col: string): string {
  const i = headers[col];
  if (i === undefined) return '';
  const v = (row as (string | number | boolean | null | undefined)[])[i];
  return v != null ? String(v).trim() : '';
}

// ─── Parse rows ───────────────────────────────────────────────────────────────

function parseRows(rows: unknown[][]): { data: StaffRow[]; errors: RowError[] } {
  if (rows.length < 2) return { data: [], errors: [] };

  const headers  = buildHeaderMap(rows[0] as string[]);
  const data:    StaffRow[]  = [];
  const errors:  RowError[]  = [];
  const validRoles = new Set(['STAFF', 'DRIVER']);

  for (let i = 1; i < rows.length; i++) {
    const row     = rows[i] as unknown[];
    const rowNum  = i + 1;
    const rowErrs: string[] = [];

    const first_name    = cellStr(row, headers, 'first_name');
    const last_name     = cellStr(row, headers, 'last_name');
    const email         = cellStr(row, headers, 'email');
    const employee_code = cellStr(row, headers, 'employee_code');
    const roleRaw       = cellStr(row, headers, 'role').toUpperCase();

    if (!first_name)    rowErrs.push('first_name is required');
    if (!last_name)     rowErrs.push('last_name is required');
    if (!email || !email.includes('@')) rowErrs.push('valid email is required');
    if (!employee_code) rowErrs.push('employee_code is required');
    if (!validRoles.has(roleRaw)) rowErrs.push('role must be STAFF or DRIVER');

    if (rowErrs.length) {
      errors.push({ row: rowNum, email: email || `row ${rowNum}`, errors: rowErrs });
      continue;
    }

    data.push({
      first_name,
      last_name,
      email,
      employee_code,
      role:       roleRaw as 'STAFF' | 'DRIVER',
      phone:      cellStr(row, headers, 'phone')      || undefined,
      department: cellStr(row, headers, 'department') || undefined,
      job_title:  cellStr(row, headers, 'job_title')  || undefined,
      password:   cellStr(row, headers, 'password')   || undefined,
    });
  }

  return { data, errors };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'ADMIN') return apiForbidden();

    const formData = await req.formData().catch(() => null);
    if (!formData) return apiError('Multipart form data required', 400);

    const file = formData.get('file');
    if (!file || typeof file === 'string') return apiError('No file uploaded', 400);

    const blob = file as File;
    const name = blob.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.csv')) {
      return apiError('Only .xlsx and .csv files are supported', 415);
    }

    const buffer    = Buffer.from(await blob.arrayBuffer());
    const XLSX      = await import('xlsx');
    const workbook  = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return apiError('Spreadsheet appears to be empty', 400);
    const sheet     = workbook.Sheets[sheetName];
    if (!sheet) return apiError('Could not read spreadsheet sheet', 400);
    const rows      = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

    const { data: validRows, errors: rowErrors } = parseRows(rows as unknown[][]);

    let inserted = 0;
    const existingEmails: string[] = [];
    const failedRecords: RowError[] = [...rowErrors];

    for (const row of validRows) {
      try {
        const existing = await db.user.findUnique({ where: { email: row.email } });
        if (existing) {
          existingEmails.push(row.email);
          failedRecords.push({ row: 0, email: row.email, errors: ['Email already exists'] });
          continue;
        }

        const password      = row.password || (Math.random().toString(36).slice(-10) + 'A1!');
        const password_hash = await bcrypt.hash(password, 12);

        await db.$transaction(async (tx: any) => {
          const newUser = await tx.user.create({
            data: {
              first_name:        row.first_name,
              last_name:         row.last_name,
              email:             row.email,
              phone:             row.phone ?? null,
              password_hash,
              role:              row.role,
              status:            'ACTIVE',
              email_verified_at: new Date(),
            },
          });

          if (row.role === 'STAFF') {
            await tx.staff.create({
              data: {
                user_id:             newUser.id,
                employee_code:       row.employee_code,
                department:          row.department ?? null,
                job_title:           row.job_title  ?? null,
                verification_status: 'VERIFIED',
              },
            });
          } else {
            await tx.driver.create({
              data: {
                user_id:       newUser.id,
                employee_code: row.employee_code,
                driver_status: 'AVAILABLE',
              },
            });
          }
        });

        inserted++;
      } catch {
        failedRecords.push({ row: 0, email: row.email, errors: ['DB error — check for duplicate employee_code'] });
      }
    }

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'BULK_UPLOAD_STAFF',
      description: `Bulk uploaded ${inserted} staff/drivers`,
      req,
    });

    return apiSuccess({
      total_record_inserted: inserted,
      successful:            inserted,
      failed:                failedRecords.length,
      total_records:         validRows.length + rowErrors.length,
      existing_emails:       existingEmails,
      failed_records:        failedRecords,
    }, 200, `Bulk upload complete: ${inserted} created, ${failedRecords.length} failed`);
  } catch (err) {
    console.error('[POST /api/staff/bulk-upload]', err);
    return apiInternalError();
  }
}
