/**
 * Retire duplicate products by id.
 *
 *   npm run db:retire-product -- 43 769           # dry run — shows what it would do
 *   npm run db:retire-product -- 43 769 --confirm # actually does it
 *
 * Nothing is deleted. Each row is soft-deleted the same way the admin console
 * does it: `deleted_at` set, SKU mangled, `identity_key` cleared. Order history
 * and any batches stay attached, and the row is still there if you need it.
 *
 * ## Why a script rather than raw SQL
 *
 * Hand-running an UPDATE against production means trusting that the ids in the
 * command are the ones you meant. This refuses to touch a product that has
 * order history or stock batches unless you say so explicitly, and it prints
 * the surviving twin for each one so you can see the swap before it happens.
 *
 * ## Clearing identity_key matters
 *
 * MySQL applies a unique index to soft-deleted rows too. A retired product that
 * kept its key would hold that identity for ever, so the same drug could never
 * be re-added. The SKU is mangled for exactly the same reason.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { createHash } from 'node:crypto';

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
  return createHash('sha256')
    .update(parts.map(x => `${x.length}:${x}`).join('|'), 'utf8')
    .digest('hex');
}

async function main() {
  const args    = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  const force   = args.includes('--force');
  const ids     = args.filter(a => /^\d+$/.test(a)).map(Number);

  if (ids.length === 0) {
    console.log('Usage: npm run db:retire-product -- <id> [<id>...] [--confirm] [--force]');
    console.log('  --confirm  apply the change (without it, this is a dry run)');
    console.log('  --force    allow retiring a product that has stock or order history');
    await db.$disconnect();
    process.exit(1);
  }

  const targets = await db.product.findMany({
    where:  { id: { in: ids } },
    select: {
      id: true, sku: true, brand_name: true, deleted_at: true,
      product_strength: true, pack_size: true, selling_price: true,
      manufacturer: { select: { name: true } },
      _count: { select: { inventoryBatches: true, orderItems: true } },
    },
  });

  const missing = ids.filter(id => !targets.some(t => t.id === id));
  if (missing.length) {
    console.log(`✗ No product with id: ${missing.join(', ')}`);
    await db.$disconnect();
    process.exit(1);
  }

  let blocked = false;

  for (const t of targets) {
    const label = [t.manufacturer?.name, t.brand_name, t.product_strength, t.pack_size]
      .filter(Boolean).join(' · ');

    console.log('─'.repeat(78));
    console.log(`id=${t.id}  ${label}`);
    console.log(`  sku=${t.sku}  price=${Number(t.selling_price).toFixed(2)}  `
              + `batches=${t._count.inventoryBatches}  orders=${t._count.orderItems}`);

    if (t.deleted_at) {
      console.log('  → already retired, nothing to do');
      continue;
    }

    // Show the row that will survive, so the swap is visible before it happens.
    const key = identityKey({
      manufacturer:     t.manufacturer?.name ?? null,
      brand_name:       t.brand_name,
      product_strength: t.product_strength,
      pack_size:        t.pack_size,
    });
    const survivors = (await db.product.findMany({
      where:  { deleted_at: null, brand_name: t.brand_name, id: { not: t.id } },
      select: {
        id: true, sku: true, brand_name: true, product_strength: true, pack_size: true,
        manufacturer: { select: { name: true } },
        _count: { select: { inventoryBatches: true, orderItems: true } },
      },
    })).filter(s => identityKey({
      manufacturer:     s.manufacturer?.name ?? null,
      brand_name:       s.brand_name,
      product_strength: s.product_strength,
      pack_size:        s.pack_size,
    }) === key);

    if (survivors.length === 0) {
      console.log('  ⚠ no other active product shares this identity — retiring this one');
      console.log('    would remove the drug from the catalogue entirely.');
      if (!force) { blocked = true; console.log('    refusing without --force'); continue; }
    } else {
      for (const s of survivors) {
        console.log(`  → keeps: id=${s.id} sku=${s.sku} `
                  + `(batches=${s._count.inventoryBatches}, orders=${s._count.orderItems})`);
      }
    }

    if ((t._count.inventoryBatches > 0 || t._count.orderItems > 0) && !force) {
      console.log('  ⚠ has stock batches or order history — refusing without --force');
      blocked = true;
      continue;
    }

    if (!confirm) {
      console.log('  → would retire (dry run)');
      continue;
    }

    await db.product.update({
      where: { id: t.id },
      data: {
        deleted_at:   new Date(),
        sku:          `${t.sku}__DEL_${t.id}`,
        identity_key: null,
        status:       'DISCONTINUED',
      },
    });
    console.log('  ✓ retired');
  }

  console.log('─'.repeat(78));

  if (blocked) {
    console.log('\nSome products were skipped. Re-run with --force if that is intended.');
    await db.$disconnect();
    process.exit(1);
  }

  if (!confirm) {
    console.log('\nDry run — nothing changed. Re-run with --confirm to apply.');
  } else {
    console.log('\n✓ Done. Now run: npm run db:backfill-identity');
  }

  await db.$disconnect();
}

main().catch(async e => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
