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
  // leaf / child tables first (FK checks disabled below, but order kept logical)
  'notifications',
  'audit_logs',
  'login_history',
  'otp_tokens',
  'refresh_tokens',
  'cart_items',            // child of carts + products
  'payment_transactions',  // child of orders
  'deliveries',
  'order_items',
  'orders',
  'carts',                 // child of customers
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

    // ── 1. Delete all data ───────────────────────────────────────────────────
    // Disable FK checks for the duration of the wipe so that tables present in
    // the live DB but not yet in the Prisma schema (e.g. payment_transactions)
    // can't block deletion. Re-enabled immediately after.
    await db.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of WIPE_ORDER) {
      try {
        await db.$executeRawUnsafe(`DELETE FROM \`${table}\``);
        // Reset auto-increment so IDs start from 1 on a clean DB.
        // (DELETE does not reset the counter; only TRUNCATE would, but TRUNCATE
        // is blocked by FK constraints even with checks disabled in some engines.)
        await db.$executeRawUnsafe(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
        console.log(`   🗑  Wiped: ${table}`);
      } catch {
        console.log(`   ⚠️  Skipped: ${table} (table may not exist)`);
      }
    }
    await db.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

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
