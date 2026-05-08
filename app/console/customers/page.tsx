'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Plus, Building, Shield } from '@/components/icons';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, Avatar, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { PageHead } from '@/components/shared/PageHead';
import { CUSTOMERS } from '@/lib/data/operational';
import { formatNaira, timeAgo } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function ConsoleCustomersPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('all');

  const filtered = useMemo(() => {
    return CUSTOMERS.filter((c) => {
      if (filter === 'verified' && !c.pcn_verified) return false;
      if (filter === 'pending' && c.pcn_verified) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        c.company_name.toLowerCase().includes(q) ||
        c.user.email.toLowerCase().includes(q) ||
        `${c.user.fname} ${c.user.lname}`.toLowerCase().includes(q)
      );
    });
  }, [query, filter]);

  return (
    <>
      <PageHead
        title="Customers"
        subtitle="Pharmacies that have onboarded to Envolve."
        actions={
          <ButtonLink href="/console/customers" leadingIcon={<Plus size={14} />}>
            Onboard customer
          </ButtonLink>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex rounded-md bg-bg-muted p-0.5">
          {[
            { value: 'all' as const, label: 'All' },
            { value: 'verified' as const, label: 'Verified' },
            { value: 'pending' as const, label: 'Pending' },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                filter === t.value ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by company, email, contact"
            aria-label="Search customers"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Building size={24} />} title="No customers match" description="Try a different search or filter." />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Pharmacy</Th>
                <Th>Contact</Th>
                <Th>PCN status</Th>
                <Th align="right">Orders</Th>
                <Th align="right">Spend</Th>
                <Th>Last order</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.company_name} />
                      <div className="min-w-0">
                        <Link
                          href={`/console/customers/${c.id}`}
                          className="block truncate font-medium text-ink hover:text-brand-600"
                        >
                          {c.company_name}
                        </Link>
                        <div className="mt-0.5 truncate text-xs text-ink-3">{c.address}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="text-sm text-ink">
                      {c.user.fname} {c.user.lname}
                    </div>
                    <div className="text-xs text-ink-3">{c.user.email}</div>
                  </Td>
                  <Td>
                    {c.pcn_verified ? (
                      <Badge tone="success" noDot>
                        <Shield size={11} /> Verified
                      </Badge>
                    ) : (
                      <Badge tone="warning">Pending</Badge>
                    )}
                  </Td>
                  <Td right num>{c.total_orders ?? 0}</Td>
                  <Td right num>{formatNaira(c.total_spent ?? 0)}</Td>
                  <Td muted>{c.last_order_at ? timeAgo(c.last_order_at) : '—'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
