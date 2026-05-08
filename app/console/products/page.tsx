'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Search, Plus, Pill } from '@/components/icons';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { PageHead } from '@/components/shared/PageHead';
import { getAllProducts } from '@/lib/data/products';
import { INVENTORY } from '@/lib/data/operational';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { formatNaira } from '@/lib/utils';
import { cn } from '@/lib/utils';

const ALL = 'All';

export default function ConsoleProductsPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(ALL);
  const products = getAllProducts();

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (category !== ALL && p.category !== category) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.manufacturer.toLowerCase().includes(q)
      );
    });
  }, [products, query, category]);

  return (
    <>
      <PageHead
        title="Products"
        subtitle="Catalog SKUs available for order. Edit pricing, photos, and prescription flags."
        actions={
          <ButtonLink href="/console/products/new" leadingIcon={<Plus size={14} />}>
            New product
          </ButtonLink>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SKU, manufacturer"
            aria-label="Search"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategory(ALL)}
          className={cn(
            'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            category === ALL ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-line-strong',
          )}
        >
          All
        </button>
        {PRODUCT_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              category === c ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-line-strong',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Pill size={24} />} title="No products" description="Adjust filters or add a new product." />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th>Form</Th>
                <Th>Stock</Th>
                <Th>Status</Th>
                <Th align="right">Price</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((p) => {
                const inv = INVENTORY.find((i) => i.product.id === p.id);
                return (
                  <Tr key={p.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-bg-muted">
                          <Image src={p.image_url} alt={p.name} width={72} height={72} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/console/products/${p.sku}`}
                            className="block truncate font-medium tracking-tight text-ink hover:text-brand-600"
                          >
                            {p.name}
                          </Link>
                          <div className="mt-0.5 truncate font-mono text-xs text-ink-3">{p.sku}</div>
                        </div>
                      </div>
                    </Td>
                    <Td muted>{p.category}</Td>
                    <Td muted>{p.form} · {p.strength}</Td>
                    <Td num>{inv?.total_quantity ?? 0}</Td>
                    <Td>
                      {inv?.is_low_stock ? (
                        <Badge tone="warning" noDot>Low stock</Badge>
                      ) : inv?.is_expiring_soon ? (
                        <Badge tone="warning" noDot>Expiring soon</Badge>
                      ) : p.prescription_required ? (
                        <Badge tone="info" noDot>Rx</Badge>
                      ) : (
                        <Badge tone="success" noDot>Healthy</Badge>
                      )}
                    </Td>
                    <Td right num>{formatNaira(p.price)}</Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
