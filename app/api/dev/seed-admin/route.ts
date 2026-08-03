/**
 * DEV-ONLY route — seeds the default admin account.
 * Hit once: GET /api/dev/seed-admin
 *
 * Disabled in production (returns 404).
 * Delete this file before going to production.
 *
 * Credentials seeded:
 *   Email:    admin@gmail.com
 *   Password: Admin@2026
 */

import { NextResponse } from 'next/server';
import bcrypt           from 'bcryptjs';
import { db }           from '@/lib/db';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const EMAIL     = 'admin@gmail.com';
  const PASSWORD  = 'Admin@2026';

  try {
    const existing = await db.user.findUnique({ where: { email: EMAIL } });

    if (existing) {
      return NextResponse.json({
        status:  'already_exists',
        message: `Admin already exists (id=${existing.id})`,
        email:   EMAIL,
      });
    }

    const password_hash = await bcrypt.hash(PASSWORD, 12);

    const user = await db.user.create({
      data: {
        email:             EMAIL,
        password_hash,
        first_name:        'Dev',
        last_name:         'Admin',
        role:              'ADMIN',
        status:            'ACTIVE',
        email_verified_at: new Date(),
      },
    });

    await db.staff.create({
      data: {
        user_id:       user.id,
        employee_code: `DEV-${user.id}-ADMIN`,
        department:    'Technology',
        job_title:     'Super Admin',
      },
    });

    return NextResponse.json({
      status:   'seeded',
      message:  'Dev admin created successfully',
      email:    EMAIL,
      password: PASSWORD,
      userId:   user.id,
      warning:  'Delete /app/api/dev/ before going to production!',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
