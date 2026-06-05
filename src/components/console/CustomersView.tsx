'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Plus, Upload, Building, Shield } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Badge, Avatar, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { PageHead } from '@/components/shared/PageHead';
import { CreateEntityModal, type EntityField } from './CreateEntityModal';
import { SheetImporter } from './SheetImporter';
import { useToast } from '@/contexts/ToastContext';
import {
  customerOnboardSchema,
  customerImportRowSchema,
  type CustomerOnboardInput,
} from '@/lib/schemas';
import {
  onboardCustomerAction,
  importCustomersAction,
  reviewCustomerAction,
} from '@/lib/actions/console';
import { formatNaira, timeAgo, cn } from '@/lib/utils';
import type { CustomerWithUser, Role } from '@/types';

const ONBOARD_FIELDS: EntityField[] = [
  { name: 'first_name', label: 'Contact first name', required: true, placeholder: 'Chinedu' },
  { name: 'middle_name', label: 'Middle name', placeholder: 'Optional' },
  { name: 'last_name', label: 'Contact last name', required: true, placeholder: 'Okafor' },
  { name: 'company_name', label: 'Pharmacy / company name', required: true, placeholder: 'Greenleaf Pharmacy Ltd.', full: true },
  { name: 'email', label: 'Work email', type: 'email', required: true, placeholder: 'orders@pharmacy.ng' },
  { name: 'phone', label: 'Phone', type: 'tel', required: true, placeholder: '+234 800 000 0000' },
  { name: 'address', label: 'Street address', required: true, placeholder: '12 Lagos St., Wuse 2', full: true },
  { name: 'city', label: 'City', required: true, placeholder: 'Abuja' },
  { name: 'state', label: 'State', required: true, placeholder: 'FCT' },
  { name: 'country', label: 'Country', required: true, defaultValue: 'Nigeria' },
];

const IMPORT_COLUMNS = [
  { key: 'first_name', label: 'First name', required: true },
  { key: 'middle_name', label: 'Middle name' },
  { key: 'last_name', label: 'Last name', required: true },
  { key: 'company_name', label: 'Company', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'address', label: 'Address', required: true },
  { key: 'city', label: 'City', required: true },
  { key: 'state', label: 'State', required: true },
  { key: 'country', label: 'Country', required: true },
];

export function CustomersView({
  role,
  customers,
}: {
  role: Role;
  customers: CustomerWithUser[];
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [onboard, setOnboard] = useState(false);
  const [importing, setImporting] = useState(false);
  const isAdmin = role === 'admin';

  const filtered = useMemo(() => {
    return customers.filter((c) => {
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
  }, [customers, query, filter]);

  return (
    <>
      <PageHead
        title="Customers"
        subtitle="Pharmacies that have onboarded to Envolve."
        actions={
          <>
            <Button variant="secondary" leadingIcon={<Upload size={14} />} onClick={() => setImporting(true)}>
              Import
            </Button>
            <Button leadingIcon={<Plus size={14} />} onClick={() => setOnboard(true)}>
              Onboard customer
            </Button>
          </>
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
                      <>
                        <Badge tone="warning">Pending</Badge>
                        {isAdmin && <ReviewButtons id={c.id} />}
                      </>
                    )}
                  </Td>
                  <Td right num>
                    {c.total_orders ?? 0}
                  </Td>
                  <Td right num>
                    {formatNaira(c.total_spent ?? 0)}
                  </Td>
                  <Td muted>{c.last_order_at ? timeAgo(c.last_order_at) : '—'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}

      <CreateEntityModal
        open={onboard}
        onClose={() => setOnboard(false)}
        title="Onboard a customer"
        description="Create the pharmacy account and email them an invite to set a password."
        fields={ONBOARD_FIELDS}
        schema={customerOnboardSchema}
        action={onboardCustomerAction}
        submitLabel="Create & invite"
        successTitle="Customer onboarded"
        size="xl"
      />

      <SheetImporter<CustomerOnboardInput>
        open={importing}
        onClose={() => setImporting(false)}
        title="Import customers"
        columns={IMPORT_COLUMNS}
        schema={customerImportRowSchema}
        action={importCustomersAction}
        templateName="customers_template.xlsx"
      />
    </>
  );
}

function ReviewButtons({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const act = (decision: 'approve' | 'reject') =>
    start(async () => {
      const r = await reviewCustomerAction(id, decision);
      if (r.ok) {
        toast.show({
          tone: decision === 'approve' ? 'success' : 'info',
          title: decision === 'approve' ? 'Customer approved' : 'Customer rejected',
        });
        router.refresh();
      } else {
        toast.show({ tone: 'error', title: 'Action failed', description: r.message });
      }
    });

  return (
    <div className="mt-1.5 flex gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => act('approve')}
        className="rounded-md bg-success-soft px-2 py-1 text-xs font-medium text-green-800 transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => act('reject')}
        className="rounded-md bg-danger-soft px-2 py-1 text-xs font-medium text-red-800 transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}