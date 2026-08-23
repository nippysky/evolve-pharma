/**
 * Backfill `products.identity_key` — run AFTER `prisma db push`.
 *
 * The column is added nullable so it can land on a table that already has
 * rows. This fills it in for every active product, which is what turns the
 * UNIQUE index into a real guarantee rather than one that only applies to
 * products created from now on.
 *
 *   npx tsx scripts/backfill-identity-keys.ts
 *
 * Safe to run more than once — it only writes rows whose key is missing or
 * out of date, so a second run reports 0 updated.
 *
 * Soft-deleted products are deliberately left NULL. MySQL's unique index
 * covers deleted rows, and multiple NULLs are allowed while multiple equal
 * values are not — so a retired product keeping its key would permanently
 * block that drug from being re-added.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { createHash } from 'node:crypto';

/** Same adapter setup as prisma/seed.ts — this project uses a driver adapter,
 *  so a bare `new PrismaClient()` has no connection. */
function connect() {
  const adapter = new PrismaMariaDb({
    host:            process.env.DB_HOST!,
    port:            Number(process.env.DB_PORT) || 3306,
    user:            process.env.DB_USER!,
    password:        process.env.DB_PASSWORD!,
    database:        process.env.DB_NAME!,
    connectionLimit: 3,
  });
  return new PrismaClient({ adapter });
}

const db = connect();

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Must stay identical to identityKey() in src/lib/products/identity.ts. */
function identityKey(p: {
  manufacturer: string | null;
  brand_name: string;
  product_strength: string | null;
  pack_size: string | null;
}): string {
  const parts = [
    norm(p.manufacturer), norm(p.brand_name),
    norm(p.product_strength), norm(p.pack_size),
  ];
  const canonical = parts.map(x => `${x.length}:${x}`).join('|');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

async function main() {
  const products = await db.product.findMany({
    where: { deleted_at: null },
    select: {
      id: true, brand_name: true, product_strength: true,
      pack_size: true, identity_key: true,
      manufacturer: { select: { name: true } },
    },
  });

  let updated = 0;
  let alreadyCorrect = 0;

  /**
   * Rows the unique index refused.
   *
   * Reached when the catalogue still holds two products with the same
   * identity: the first gets the key, the second collides. Collecting them
   * instead of throwing means one run keys everything it legitimately can and
   * finishes with a complete list of what needs deciding — rather than dying
   * on the first clash and leaving the rest untouched.
   */
  const clashes: { id: number; label: string }[] = [];

  // Serial, and over a remote database that is ~800 round trips. The progress
  // line is there so a slow run doesn't look like a hung one.
  for (const [i, p] of products.entries()) {
    if (i > 0 && i % 100 === 0) {
      process.stdout.write(`  …${i}/${products.length}\n`);
    }

    const key = identityKey({
      manufacturer:     p.manufacturer?.name ?? null,
      brand_name:       p.brand_name,
      product_strength: p.product_strength,
      pack_size:        p.pack_size,
    });

    if (p.identity_key === key) { alreadyCorrect++; continue; }

    try {
      await db.product.update({
        where: { id: p.id },
        data:  { identity_key: key },
      });
      updated++;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== 'P2002') throw err;   // anything else is a real failure

      clashes.push({
        id:    p.id,
        label: [p.manufacturer?.name, p.brand_name, p.product_strength, p.pack_size]
          .filter(Boolean).join(' · '),
      });
    }
  }

  // Retired rows must not hold an identity slot — see the note at the top.
  const { count: cleared } = await db.product.updateMany({
    where: { deleted_at: { not: null }, identity_key: { not: null } },
    data:  { identity_key: null },
  });

  console.log(`\nActive products scanned : ${products.length}`);
  console.log(`  keys written          : ${updated}`);
  console.log(`  already correct       : ${alreadyCorrect}`);
  console.log(`  rejected as duplicate : ${clashes.length}`);
  console.log(`Retired rows cleared    : ${cleared}`);

  if (clashes.length === 0) {
    console.log('\n✓ Done. Every active product now has a unique identity.');
    await db.$disconnect();
    return;
  }

  console.log(`\n✗ ${clashes.length} product(s) could not be keyed — a product with the`);
  console.log('  same manufacturer, brand, strength and pack size already holds it.\n');
  for (const c of clashes) {
    console.log(`   id=${String(c.id).padEnd(6)} ${c.label}`);
  }

  console.log('\nRun `npm run db:check-dupes` to see each pair side by side with its');
  console.log('stock and order counts, then retire the copy you do not want:');
  console.log('  UPDATE products');
  console.log("     SET deleted_at = NOW(), sku = CONCAT(sku, '__DEL_', id), identity_key = NULL");
  console.log(`   WHERE id IN (${clashes.map(c => c.id).join(', ')});   -- verify these first`);
  console.log('\nThen run this script again to finish the remaining rows.');

  await db.$disconnect();
  process.exit(1);
}

main().catch(async e => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
