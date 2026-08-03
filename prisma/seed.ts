/**
 * Dev seed — inserts a default super-admin for local development.
 * Run:  npx tsx prisma/seed.ts
 *
 * Credentials (pre-filled on admin sign-in page):
 *   Email:    admin@gmail.com
 *   Password: Admin@2026
 *
 * Delete this user before going to production.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';

async function main() {
  const adapter = new PrismaMariaDb({
    host:            process.env.DB_HOST!,
    port:            Number(process.env.DB_PORT) || 3306,
    user:            process.env.DB_USER!,
    password:        process.env.DB_PASSWORD!,
    database:        process.env.DB_NAME!,
    connectionLimit: 3,
  });

  const db = new PrismaClient({ adapter });

  const EMAIL     = 'admin@gmail.com';
  const PASSWORD  = 'Admin@2026';
  const FIRSTNAME = 'Dev';
  const LASTNAME  = 'Admin';

  try {
    await db.$connect();
    console.log('✅  Connected to database');

    const existing = await db.user.findUnique({ where: { email: EMAIL } });
    if (existing) {
      console.log(`ℹ️   Admin already exists (id=${existing.id}) — skipping.`);
      return;
    }

    const password_hash = await bcrypt.hash(PASSWORD, 12);

    const user = await db.user.create({
      data: {
        email:             EMAIL,
        password_hash,
        first_name:        FIRSTNAME,
        last_name:         LASTNAME,
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

    console.log('');
    console.log('✅  Dev admin seeded!');
    console.log(`    Email:    ${EMAIL}`);
    console.log(`    Password: ${PASSWORD}`);
    console.log(`    User ID:  ${user.id}`);
    console.log('');
    console.log('⚠️   Delete this account before going to production!');
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
