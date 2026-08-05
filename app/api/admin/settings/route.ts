import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
} from '@/lib/api/response';

async function ensureTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS app_settings (
      \`key\`       VARCHAR(100) NOT NULL PRIMARY KEY,
      \`value\`     TEXT         NOT NULL,
      updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

const ALLOWED_KEYS = new Set([
  'company_name', 'company_email', 'company_phone',
  'hq_address', 'currency', 'timezone',
  'email_audit_summary', 'auto_logout',
]);

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'ADMIN') return apiForbidden();

    await ensureTable();

    const rows = await db.$queryRaw<Array<{ key: string; value: string }>>`
      SELECT \`key\`, \`value\` FROM app_settings
    `;

    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;

    return apiSuccess(settings, 200, 'Settings retrieved.');
  } catch (err) {
    console.error('[GET /api/admin/settings]', err);
    return apiInternalError();
  }
}

const patchSchema = z.record(z.string(), z.string());

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'ADMIN') return apiForbidden();

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body.', 400); }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return apiError('Payload must be a flat key-value object.', 400);

    const updates = Object.entries(parsed.data).filter(([k]) => ALLOWED_KEYS.has(k));
    if (updates.length === 0) return apiError('No valid setting keys provided.', 400);

    await ensureTable();

    // Upsert each key sequentially (tiny pool — avoid parallel)
    for (const [key, value] of updates) {
      await db.$executeRawUnsafe(
        `INSERT INTO app_settings (\`key\`, \`value\`, updated_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updated_at = NOW()`,
        key,
        value,
      );
    }

    return apiSuccess({ updated: updates.map(([k]) => k) }, 200, 'Settings saved.');
  } catch (err) {
    console.error('[PATCH /api/admin/settings]', err);
    return apiInternalError();
  }
}
