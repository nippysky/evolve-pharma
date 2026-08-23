/**
 * What makes a product a product.
 *
 * ## Why this file exists
 *
 * The rule for "is this the same product?" was written three times — in the
 * manual create route, the full bulk importer and the quick importer — and the
 * three had drifted. All of them keyed identity on `MANUFACTURER-BRAND` alone,
 * which produced two opposite failures at once:
 *
 *   1. **Real variants collided.** "Emzor Paracetamol 500mg" and "Emzor
 *      Paracetamol 1000mg" derive the same key, so importing the second one
 *      was rejected as a duplicate of the first. Two genuinely different
 *      products, one of them unenterable.
 *
 *   2. **Real duplicates slipped through.** Manual creation appends a random
 *      suffix when a SKU is taken (`EMZOR-PARACETAMOL-A4F2`). An importer
 *      looking for `EMZOR-PARACETAMOL` never finds that row, so it happily
 *      creates a second copy of a product that already exists.
 *
 * Strength and pack size are what distinguish one sellable line from another,
 * so they belong in the identity. Everything now goes through here.
 *
 * ## Two layers, deliberately
 *
 * `deriveSku` builds a readable, stable code for *new* products. `identityKey`
 * is what we actually compare on, and it is derived from the real columns
 * rather than from the SKU — so a product created by any route, under any SKU,
 * is still recognised. The SKU is a label; the columns are the truth.
 *
 * Existing SKUs are never rewritten. Changing them would break every label,
 * export and integration already referring to them, and it isn't necessary:
 * matching happens on the columns.
 */

import { createHash } from 'node:crypto';
import { db } from '@/lib/db';

/** Uppercase alphanumeric, hyphen-separated, bounded — safe in a SKU. */
function slug(s: string, max = 20): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
}

/**
 * Normalise a value for *comparison* — not for display or storage.
 *
 * Case and inner whitespace are noise: "500 MG", "500mg" and "500 mg" are the
 * same strength typed by three different people. Null and empty string are
 * also the same thing, since the column is nullable and a spreadsheet cell can
 * be either.
 */
function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface ProductIdentity {
  manufacturer:     string | null;
  brand_name:       string;
  product_strength?: string | null;
  pack_size?:        string | null;
}

/**
 * The comparison key — also stored, so it has to survive a database column.
 *
 * Each part is length-prefixed rather than joined by a separator. Any
 * separator character can in principle appear inside a brand name, and if it
 * does, `"Para-500" + ""` and `"Para" + "500"` collapse to the same key — two
 * different products treated as one. Length prefixes cannot collide whatever
 * the content.
 *
 * The result is hashed. `products.identity_key` carries a UNIQUE index, and a
 * fixed 64-char hash indexes cleanly however long a manufacturer or pack
 * description runs — no truncation, no multi-byte index limits, and no NUL
 * bytes in a VarChar (the separator this used before, which was fine for an
 * in-memory Map and wrong for a stored column).
 */
export function identityKey(p: ProductIdentity): string {
  const parts = [
    norm(p.manufacturer),
    norm(p.brand_name),
    norm(p.product_strength),
    norm(p.pack_size),
  ];
  const canonical = parts.map(x => `${x.length}:${x}`).join('|');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * A readable SKU for a new product.
 *
 * Strength and pack size are included so the code stays human-meaningful when
 * a brand has several lines — `EMZOR-PARACETAMOL-500MG-10S` rather than three
 * products all called `EMZOR-PARACETAMOL`. Both are optional, and omitted
 * cleanly when absent rather than leaving dangling separators.
 */
export function deriveSku(p: ProductIdentity): string {
  const parts = [
    p.manufacturer ? slug(p.manufacturer) : '',
    slug(p.brand_name),
    p.product_strength ? slug(p.product_strength, 12) : '',
    p.pack_size ? slug(p.pack_size, 12) : '',
  ].filter(Boolean);

  // VarChar(100); leave room for the uniqueness suffix `ensureUniqueSku` adds.
  return parts.join('-').slice(0, 90);
}

/**
 * Look up products that could be any of `identities`, in one query.
 *
 * Candidates are narrowed in SQL by brand name, then matched exactly in JS.
 * Doing the final comparison in JS is deliberate: `product_strength` and
 * `pack_size` are nullable, and in SQL `NULL = NULL` is unknown rather than
 * true — so a WHERE clause would silently fail to match precisely the rows
 * where those fields are blank, which is most quick-imported stock.
 *
 * Returns a map of identity key → existing product.
 */
export async function findExistingByIdentity(
  identities: ProductIdentity[],
): Promise<Map<string, { id: number; sku: string }>> {
  const found = new Map<string, { id: number; sku: string }>();
  if (identities.length === 0) return found;

  const brands = [...new Set(identities.map(i => i.brand_name.trim()))];

  const candidates = await db.product.findMany({
    where: {
      deleted_at: null,
      brand_name: { in: brands },
    },
    select: {
      id: true,
      sku: true,
      brand_name: true,
      product_strength: true,
      pack_size: true,
      manufacturer: { select: { name: true } },
    },
  });

  for (const c of candidates) {
    const key = identityKey({
      manufacturer:     c.manufacturer?.name ?? null,
      brand_name:       c.brand_name,
      product_strength: c.product_strength,
      pack_size:        c.pack_size,
    });
    // First writer wins — if the database already contains duplicates, we
    // match the oldest rather than creating yet another.
    if (!found.has(key)) found.set(key, { id: c.id, sku: c.sku });
  }

  return found;
}

/**
 * Make a SKU unique, without changing what the product *is*.
 *
 * Only reached when two genuinely different products produce the same readable
 * code (a brand with an unlisted variant, say). Identity is already settled by
 * `identityKey` before this is called, so the suffix is cosmetic — it exists to
 * satisfy the column's unique constraint, not to distinguish products.
 */
export async function ensureUniqueSku(base: string): Promise<string> {
  const candidate = base.slice(0, 100);
  const clash = await db.product.findFirst({
    where: { sku: candidate },
    select: { id: true },
  });
  if (!clash) return candidate;

  for (let i = 2; i <= 20; i++) {
    const variant = `${base.slice(0, 95)}-${i}`;
    const taken = await db.product.findFirst({
      where: { sku: variant },
      select: { id: true },
    });
    if (!taken) return variant;
  }

  return `${base.slice(0, 88)}-${Date.now().toString(36).toUpperCase()}`;
}
