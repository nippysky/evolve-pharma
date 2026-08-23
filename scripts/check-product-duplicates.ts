/**
 * Pre-flight check — run this BEFORE `prisma db push`.
 *
 * `products.identity_key` is about to become UNIQUE. If the catalogue already
 * contains two rows describing the same product, creating that index fails and
 * the push aborts partway. This reports them first so you can decide what to
 * do, rather than finding out from a half-applied migration.
 *
 * It only reads. Nothing here modifies the database.
 *
 *   npx tsx scripts/check-product-duplicates.ts
 *
 * Exit code 0 = safe to push. 1 = duplicates found, listed below.
 *
 * Merging duplicates is a business decision, not a scripted one: the copies can
 * have different prices, and one may have stock batches and order history
 * attached. The report shows both so you can pick the keeper, and prints the
 * exact SQL to retire the other.
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
      id: true, sku: true, brand_name: true,
      product_strength: true, pack_size: true,
      selling_price: true, status: true, created_at: true,
      manufacturer: { select: { name: true } },
      _count: { select: { inventoryBatches: true, orderItems: true } },
    },
    orderBy: { created_at: 'asc' },
  });

  const groups = new Map<string, typeof products>();
  for (const p of products) {
    const key = identityKey({
      manufacturer:     p.manufacturer?.name ?? null,
      brand_name:       p.brand_name,
      product_strength: p.product_strength,
      pack_size:        p.pack_size,
    });
    const g = groups.get(key) ?? [];
    g.push(p);
    groups.set(key, g);
  }

  const dupes = [...groups.values()].filter(g => g.length > 1);

  console.log(`Scanned ${products.length} active products.`);

  if (dupes.length === 0) {
    console.log('\n✓ No duplicates. Safe to run `npx prisma db push`.');
    await db.$disconnect();
    return;
  }

  console.log(`\n✗ ${dupes.length} duplicate group(s) found. `
            + 'The UNIQUE index cannot be created until each group has one active row.\n');

  for (const group of dupes) {
    const first = group[0];
    if (!first) continue; // groups are never empty; satisfies noUncheckedIndexedAccess
    console.log('─'.repeat(78));
    console.log(`${first.manufacturer?.name ?? '(no manufacturer)'} · ${first.brand_name}`
              + `${first.product_strength ? ` · ${first.product_strength}` : ''}`
              + `${first.pack_size ? ` · ${first.pack_size}` : ''}`);
    for (const p of group) {
      // Oldest first, so the top row is usually the one to keep.
      console.log(
        `   id=${String(p.id).padEnd(6)} sku=${p.sku.padEnd(28)} `
        + `${p.status.padEnd(12)} price=${Number(p.selling_price).toFixed(2).padStart(10)} `
        + `batches=${String(p._count.inventoryBatches).padStart(3)} `
        + `orders=${String(p._count.orderItems).padStart(3)}  ${p.created_at.toISOString().slice(0, 10)}`,
      );
    }
  }

  console.log('─'.repeat(78));
  console.log('\nTo resolve, for each group keep ONE row and retire the others:');
  console.log('  UPDATE products');
  console.log("     SET deleted_at   = NOW(),");
  console.log("         sku          = CONCAT(sku, '__DEL_', id),");
  console.log('         identity_key = NULL');
  console.log('   WHERE id = <id-to-remove>;');
  console.log('\nAll three matter. MySQL applies a unique index to deleted rows too,');
  console.log('so a retired row keeps holding its sku and identity slot unless both');
  console.log('are released — which would block the drug from ever being re-added.');
  console.log('\nPrefer keeping the row with order history and stock batches attached.');

  await db.$disconnect();
  process.exit(1);
}

main().catch(async e => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
