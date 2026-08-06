import { NextRequest }   from 'next/server';
import { v4 as uuidv4 }  from 'uuid';
import { db }            from '@/lib/db';
import { getSession }    from '@/lib/auth';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
} from '@/lib/api/response';
import { writeAuditLog }           from '@/lib/audit';
import { sendStaffVerificationEmail } from '@/lib/mail';

interface StaffRow {
  first_name:     string;
  middle_name?:   string;
  last_name:      string;
  email:          string;
  employee_code:  string;
  role:           'STAFF' | 'DRIVER';
  phone?:         string;
  department?:    string;
  job_title?:     string;
  // Driver-specific
  vehicle_plate?: string;
  vehicle_type?:  string;
}

interface RowError {
  row:    number;
  email:  string;
  errors: string[];
}

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

function parseRows(
  rows: unknown[][],
  forceRole?: 'STAFF' | 'DRIVER',
): { data: StaffRow[]; errors: RowError[] } {
  if (rows.length < 2) return { data: [], errors: [] };

  const headers  = buildHeaderMap(rows[0] as string[]);
  const data:    StaffRow[]  = [];
  const errors:  RowError[]  = [];
  const validRoles = new Set(['STAFF', 'DRIVER']);

  for (let i = 1; i < rows.length; i++) {
    const row     = rows[i] as unknown[];
    const rowNum  = i + 1;
    const rowErrs: string[] = [];

    const first_name = cellStr(row, headers, 'first_name');
    const last_name  = cellStr(row, headers, 'last_name');
    const email      = cellStr(row, headers, 'email');

    // If the caller forces a role (Staff page → STAFF, Drivers page → DRIVER),
    // use that; otherwise fall back to the role column, defaulting to STAFF.
    const roleRaw = forceRole ?? (cellStr(row, headers, 'role').toUpperCase() || 'STAFF');
    const role    = validRoles.has(roleRaw) ? (roleRaw as 'STAFF' | 'DRIVER') : 'STAFF';

    // employee_code: auto-generate if column absent or blank (same as single invite)
    const codeFromSheet = cellStr(row, headers, 'employee_code');
    const employee_code = codeFromSheet
      || `${role.slice(0, 2)}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    if (!first_name)    rowErrs.push('first_name is required');
    if (!last_name)     rowErrs.push('last_name is required');
    if (!email || !email.includes('@')) rowErrs.push('valid email is required');

    if (rowErrs.length) {
      errors.push({ row: rowNum, email: email || `row ${rowNum}`, errors: rowErrs });
      continue;
    }

    data.push({
      first_name,
      middle_name:   cellStr(row, headers, 'middle_name')   || undefined,
      last_name,
      email,
      employee_code,
      role,
      phone:         cellStr(row, headers, 'phone')         || undefined,
      department:    cellStr(row, headers, 'department')    || undefined,
      job_title:     cellStr(row, headers, 'job_title')     || undefined,
      vehicle_plate: cellStr(row, headers, 'vehicle_plate') || undefined,
      vehicle_type:  cellStr(row, headers, 'vehicle_type')  || undefined,
    });
  }

  return { data, errors };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    // Optional ?force_role=STAFF|DRIVER — when set, every row is treated as
    // that role regardless of what's in the sheet.  The Staff page passes
    // force_role=STAFF; the Drivers page passes force_role=DRIVER.
    const forceRoleParam = req.nextUrl.searchParams.get('force_role')?.toUpperCase();
    const forceRole: 'STAFF' | 'DRIVER' | undefined =
      forceRoleParam === 'STAFF' || forceRoleParam === 'DRIVER'
        ? forceRoleParam
        : undefined;

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

    const { data: validRows, errors: rowErrors } = parseRows(rows as unknown[][], forceRole);

    let inserted = 0;
    const existingEmails: string[] = [];
    const failedRecords: RowError[] = [...rowErrors];
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://www.envolvepharm.com.ng';

    for (const row of validRows) {
      try {
        const existing = await db.user.findUnique({ where: { email: row.email } });
        if (existing) {
          existingEmails.push(row.email);
          failedRecords.push({ row: 0, email: row.email, errors: ['Email already exists'] });
          continue;
        }

        // ── Invitation flow (same as single POST /api/staff) ─────────────────
        // Account starts INACTIVE; user sets their own password via the link.
        const verifyToken = uuidv4();
        const expiresAt   = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await db.$transaction(async (tx: any) => {
          const newUser = await tx.user.create({
            data: {
              first_name:    row.first_name,
              middle_name:   row.middle_name ?? null,
              last_name:     row.last_name,
              email:         row.email,
              phone:         row.phone ?? null,
              password_hash: 'UNSET',          // set by the user after email verification
              role:          row.role,
              status:        'INACTIVE',        // activated after they set a password
            },
          });

          if (row.role === 'STAFF') {
            await tx.staff.create({
              data: {
                user_id:             newUser.id,
                employee_code:       row.employee_code,
                department:          row.department ?? null,
                job_title:           row.job_title  ?? null,
                verification_status: 'UNVERIFIED', // set to VERIFIED after password creation
              },
            });
          } else {
            await tx.driver.create({
              data: {
                user_id:       newUser.id,
                employee_code: row.employee_code,
                vehicle_plate: row.vehicle_plate ?? null,
                vehicle_type:  row.vehicle_type  ?? null,
                driver_status: 'AVAILABLE',
              },
            });
          }

          // Verification token so they can click the link in the email
          await tx.otpToken.create({
            data: {
              user_id:    newUser.id,
              token:      verifyToken,
              type:       'EMAIL_VERIFICATION',
              expires_at: expiresAt,
            },
          });
        });

        const verificationUrl = `${frontendUrl}/staff/verify?token=${verifyToken}`;
        try {
          await sendStaffVerificationEmail({
            to:              row.email,
            name:            row.first_name,
            verificationUrl,
          });
        } catch (mailErr) {
          console.error(`[bulk-upload] email failed for ${row.email}:`, mailErr);
        }

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
