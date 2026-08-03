/**
 * POST /api/customers/bulk
 *
 * Bulk-import customers from an Excel or CSV file (Admin / Staff).
 *
 * ─── Processing pipeline ──────────────────────────────────────────────────────
 *   1. Parse XLSX / XLS / CSV with the `xlsx` package (server-side)
 *   2. Validate every row with `customerImportRowSchema` (Zod)
 *   3. Skip rows that fail validation — collect them in `failed_records`
 *   4. For every valid row:
 *        a. Check email uniqueness (already-imported rows are skipped)
 *        b. Create User + Customer + 48-hour OTP in one DB transaction
 *        c. Fire invitation email (non-blocking, errors logged not thrown)
 *   5. Return a structured summary — callers can display per-row error detail
 *
 * ─── Concurrency ──────────────────────────────────────────────────────────────
 *   Rows are processed in batches of MAX_CONCURRENCY to avoid overwhelming
 *   the DB connection pool and SMTP server on large imports.
 *
 * Body: multipart/form-data
 *   file — .xlsx / .xls / .csv (max 5 MB)
 *
 * Response 200:
 *   {
 *     total_records : number,
 *     successful    : number,
 *     failed        : number,
 *     failed_records: Array<{ row: number; email?: string; errors: string[] }>
 *   }
 */

import { NextRequest }                 from 'next/server';
import * as XLSX                       from 'xlsx';
import { db }                          from '@/lib/db';
import { getSession }                  from '@/lib/auth';
import { sendCustomerInvitationEmail } from '@/lib/mail';
import { generateOtp }                 from '@/lib/api/issue-tokens';
import { customerImportRowSchema }     from '@/lib/schemas';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_CONCURRENCY     = 5;                // parallel DB+email ops
const INVITE_OTP_TTL_MS   = 48 * 60 * 60 * 1000; // 48 hours

const ACCEPTED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
  'text/csv',
  'application/csv',
  'text/plain', // some browsers send CSV as text/plain
]);

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulkFailRecord {
  row:    number;
  email?: string;
  errors: string[];
}

interface BulkResult {
  total_records:  number;
  successful:     number;
  failed:         number;
  failed_records: BulkFailRecord[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inviteOtpExpiresAt(): Date {
  return new Date(Date.now() + INVITE_OTP_TTL_MS);
}

function generateReferralCode(): string {
  return 'ENV' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

/** Parse file buffer into an array of raw row objects (header row → keys). */
function parseWorkbook(buffer: Buffer, fileName: string): Record<string, unknown>[] {
  const wb    = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) throw new Error('The file appears to be empty or has no sheets.');

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',         // missing cells → empty string (not undefined)
    raw:    false,      // coerce everything to string first, Zod will coerce numbers
  });

  if (rows.length === 0) {
    throw new Error('No data rows found in the file. Make sure the first row is a header row.');
  }

  return rows;
}

/**
 * Process a batch of raw rows, returning partial results.
 * Accepts an already-known set of emails to detect within-file duplicates.
 */
async function processBatch(
  rows: Array<{ rawRow: Record<string, unknown>; rowIndex: number }>,
  seenEmails: Set<string>,
  siteUrl: string,
): Promise<{ successCount: number; fails: BulkFailRecord[] }> {
  let successCount = 0;
  const fails: BulkFailRecord[] = [];

  await Promise.all(
    rows.map(async ({ rawRow, rowIndex }) => {
      // ── Zod validation ──────────────────────────────────────────────────
      const parsed = customerImportRowSchema.safeParse(rawRow);
      if (!parsed.success) {
        const errs = parsed.error.flatten();
        const messages = [
          ...Object.entries(errs.fieldErrors).flatMap(([field, msgs]) =>
            (msgs ?? []).map((m) => `${field}: ${m}`),
          ),
          ...(errs.formErrors ?? []),
        ];
        fails.push({
          row:    rowIndex,
          email:  String(rawRow.email ?? ''),
          errors: messages,
        });
        return;
      }

      const {
        first_name, middle_name, last_name,
        company_name, email, phone,
        address, city, state,
      } = parsed.data;

      const normalEmail = email.toLowerCase();

      // ── Within-file duplicate guard ──────────────────────────────────────
      if (seenEmails.has(normalEmail)) {
        fails.push({
          row:    rowIndex,
          email:  normalEmail,
          errors: ['Duplicate email — this address appears more than once in the file.'],
        });
        return;
      }
      seenEmails.add(normalEmail);

      // ── DB duplicate guard ───────────────────────────────────────────────
      try {
        const existing = await db.user.findUnique({
          where:  { email: normalEmail },
          select: { id: true },
        });
        if (existing) {
          fails.push({
            row:    rowIndex,
            email:  normalEmail,
            errors: ['An account with this email already exists.'],
          });
          return;
        }
      } catch (dbErr) {
        console.error(`[bulk] DB lookup failed for row ${rowIndex}:`, dbErr);
        fails.push({ row: rowIndex, email: normalEmail, errors: ['Database lookup error.'] });
        return;
      }

      // ── Create records ───────────────────────────────────────────────────
      const otp          = generateOtp();
      const otpExpiresAt = inviteOtpExpiresAt();
      const referralCode = generateReferralCode();

      try {
        await db.$transaction(async (tx: any) => {
          const u = await tx.user.create({
            data: {
              first_name,
              middle_name: middle_name ?? null,
              last_name,
              email:         normalEmail,
              phone:         phone ?? null,
              password_hash: 'UNSET',
              role:          'CUSTOMER',
              status:        'INACTIVE',
            },
          });

          await tx.customer.create({
            data: {
              user_id:      u.id,
              company_name,
              address,
              city,
              state,
              referral_code: referralCode,
              status:        'REGISTERED',
            },
          });

          await tx.otpToken.create({
            data: {
              user_id:    u.id,
              token:      otp,
              type:       'EMAIL_VERIFICATION',
              expires_at: otpExpiresAt,
            },
          });
        });
      } catch (txErr) {
        console.error(`[bulk] Transaction failed for row ${rowIndex} (${normalEmail}):`, txErr);
        fails.push({ row: rowIndex, email: normalEmail, errors: ['Failed to create account record.'] });
        return;
      }

      // ── Fire invitation email (non-blocking) ─────────────────────────────
      const inviteUrl = `${siteUrl}/sign-up/invited?email=${encodeURIComponent(normalEmail)}`;
      void sendCustomerInvitationEmail({
        to:          normalEmail,
        name:        first_name,
        otp,
        companyName: company_name,
        inviteUrl,
      }).catch((e) => console.error(`[bulk] Email failed for row ${rowIndex} (${normalEmail}):`, e));

      successCount++;
    }),
  );

  return { successCount, fails };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    let formData: FormData;
    try { formData = await req.formData(); }
    catch { return apiError('Multipart form data required', 400); }

    const file = formData.get('file') as File | null;
    if (!file) return apiError('No file uploaded.', 422);

    // ── File type validation ────────────────────────────────────────────────
    const fileName  = file.name.toLowerCase();
    const extOk     = ACCEPTED_EXTENSIONS.some((e) => fileName.endsWith(e));
    const mimeOk    = ACCEPTED_MIME_TYPES.has(file.type);
    if (!extOk && !mimeOk) {
      return apiError(
        'Unsupported file type. Please upload a .xlsx, .xls, or .csv file.',
        415,
      );
    }

    // ── File size guard ─────────────────────────────────────────────────────
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return apiError('File must be under 5 MB.', 413);
    }

    // ── Parse workbook ──────────────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    let rawRows: Record<string, unknown>[];
    try {
      rawRows = parseWorkbook(buffer, fileName);
    } catch (parseErr) {
      return apiError((parseErr as Error).message ?? 'Could not read file.', 422);
    }

    if (rawRows.length > 1000) {
      return apiError(
        `File contains ${rawRows.length} rows. Maximum allowed in a single import is 1,000. Please split into smaller files.`,
        422,
      );
    }

    // ── Process in batches ──────────────────────────────────────────────────
    const siteUrl    = process.env.FRONTEND_URL ?? 'https://www.envolvepharm.com.ng';
    const seenEmails = new Set<string>(); // within-file dedup
    const result: BulkResult = {
      total_records:  rawRows.length,
      successful:     0,
      failed:         0,
      failed_records: [],
    };

    // Chunk into batches of MAX_CONCURRENCY
    for (let i = 0; i < rawRows.length; i += MAX_CONCURRENCY) {
      const chunk = rawRows.slice(i, i + MAX_CONCURRENCY).map((rawRow, j) => ({
        rawRow,
        rowIndex: i + j + 2, // +2 = 1-indexed + skip header row
      }));

      const { successCount, fails } = await processBatch(chunk, seenEmails, siteUrl);
      result.successful        += successCount;
      result.failed_records.push(...fails);
    }

    result.failed = result.failed_records.length;

    console.log(
      `[POST /api/customers/bulk] Import complete: ` +
      `${result.successful}/${result.total_records} ok, ${result.failed} failed ` +
      `(by ${session.email})`,
    );

    return apiSuccess(result, 200, 'Bulk import complete.');
  } catch (err) {
    console.error('[POST /api/customers/bulk]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
