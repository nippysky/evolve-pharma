/**
 * wipe-and-seed.ts
 *
 * Drops ALL data from every table (FK-safe, correct order),
 * then creates the super-admin account.
 *
 * Run from project root:
 *   npx tsx prisma/wipe-and-seed.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';

// ── Wipe order respects FK constraints (children before parents) ─────────────

const WIPE_ORDER = [
  'notifications',
  'audit_logs',
  'login_history',
  'otp_tokens',
  'refresh_tokens',
  'deliveries',
  'order_items',
  'orders',
  'stock_movements',
  'inventory_batches',
  'product_images',
  'products',
  'categories',
  'manufacturers',
  'drivers',
  'staff',
  'customers',
  'users',
  'app_settings',
] as const;

// ── Super-admin credentials ───────────────────────────────────────────────────

const ADMIN = {
  email:      'admin@gmail.com',
  password:   'Admin@2026',
  first_name: 'Dev',
  last_name:  'Admin',
} as const;

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

  try {
    await db.$connect();
    console.log('✅  Connected to database\n');

    // ── 1. Delete all data in child-before-parent order ──────────────────────
    // DELETE FROM (not TRUNCATE) works without disabling FK checks as long as
    // children are deleted before parents. TRUNCATE is refused on any table
    // with an inbound FK, even when the referencing table is already empty.
    for (const table of WIPE_ORDER) {
      await db.$executeRawUnsafe(`DELETE FROM \`${table}\``);
      console.log(`   🗑  Wiped: ${table}`);
    }

    console.log('\n✅  All tables wiped\n');

    // ── 2. Seed super-admin ──────────────────────────────────────────────────
    const password_hash = await bcrypt.hash(ADMIN.password, 12);

    const user = await db.user.create({
      data: {
        email:             ADMIN.email,
        password_hash,
        first_name:        ADMIN.first_name,
        last_name:         ADMIN.last_name,
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

    console.log('✅  Super-admin seeded!');
    console.log(`   Email:    ${ADMIN.email}`);
    console.log(`   Password: ${ADMIN.password}`);
    console.log(`   User ID:  ${user.id}`);
    console.log('\n🚀  Database is clean and ready for testing.\n');
  } catch (err) {
    console.error('\n❌  Error:', err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
