/**
 * Console · Roles & Permissions (admin-only)
 *
 * Documents what each staff permission preset grants. Admin can see
 * the full permission matrix at a glance. Individual role changes are
 * done on the Staff page (per-person dropdown).
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { CheckCircle, ArrowRight } from '@/components/icons';
import {
  STAFF_PRESET_PERMISSIONS,
  STAFF_PRESET_LABELS,
  type StaffPermissionPreset,
  type StaffPermissionKey,
} from '@/types';

export const metadata = { title: 'Roles & Permissions' };

const ALL_PERMISSIONS: StaffPermissionKey[] = [
  'onboard_customers',
  'manage_products',
  'manage_inventory',
  'assign_drivers',
  'view_reports',
];

const PERMISSION_LABELS: Record<StaffPermissionKey, { label: string; description: string }> = {
  onboard_customers: { label: 'Onboard customers',  description: 'Create, review, and approve new pharmacy accounts' },
  manage_products:   { label: 'Manage products',    description: 'Add, edit, archive products and set pricing' },
  manage_inventory:  { label: 'Manage inventory',   description: 'Receive stock, adjust batches, view expiry alerts' },
  assign_drivers:    { label: 'Assign drivers',     description: 'Assign drivers to deliveries and track shipments' },
  view_reports:      { label: 'View reports',       description: 'Access the reports page and business analytics' },
};

const PRESETS = Object.keys(STAFF_PRESET_LABELS) as StaffPermissionPreset[];

const PRESET_DESCRIPTIONS: Record<StaffPermissionPreset, string> = {
  sales_rep:       'Field reps onboarding pharmacies and tracking their orders.',
  product_manager: 'Back-office team managing the product catalog and stock levels.',
  operations_lead: 'Ops team coordinating drivers, deliveries and warehouse stock.',
  senior_staff:    'Experienced staff with broad access across sales and operations.',
};

const PRESET_COLOR: Record<StaffPermissionPreset, string> = {
  sales_rep:       'border-blue-200 bg-blue-50',
  product_manager: 'border-purple-200 bg-purple-50',
  operations_lead: 'border-amber-200 bg-amber-50',
  senior_staff:    'border-brand-200 bg-brand-50',
};

const BADGE_COLOR: Record<StaffPermissionPreset, string> = {
  sales_rep:       'bg-blue-100 text-blue-700',
  product_manager: 'bg-purple-100 text-purple-700',
  operations_lead: 'bg-amber-100 text-amber-700',
  senior_staff:    'bg-brand-100 text-brand-700',
};

export default async function ConsoleRolesPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'admin') redirect('/console/overview');

  // Staff counts will populate via API when integrated
  const staffByPreset: Record<string, number> = {};

  return (
    <>
      <PageHead
        title="Roles & Permissions"
        subtitle="Four simple permission presets cover every staff function at this stage. Assign them per-person on the Staff page."
        actions={
          <Link
            href="/console/staff"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Manage staff <ArrowRight size={13} />
          </Link>
        }
      />

      {/* Permission matrix */}
      <div className="mb-8 overflow-hidden rounded-xl border border-line bg-white">
        <div className="border-b border-line-subtle px-5 py-4">
          <h2 className="text-base font-medium tracking-tight text-ink">Permission matrix</h2>
          <p className="mt-0.5 text-sm text-ink-3">✓ = granted &nbsp;·&nbsp; — = not granted &nbsp;·&nbsp; Admin always has all permissions.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-subtle">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 w-64">
                  Permission
                </th>
                {PRESETS.map((p) => (
                  <th key={p} className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                    <span className={`inline-block rounded-md px-2 py-0.5 ${BADGE_COLOR[p]}`}>
                      {STAFF_PRESET_LABELS[p]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {ALL_PERMISSIONS.map((perm) => (
                <tr key={perm} className="hover:bg-bg-subtle/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-ink">{PERMISSION_LABELS[perm].label}</div>
                    <div className="mt-0.5 text-xs text-ink-3">{PERMISSION_LABELS[perm].description}</div>
                  </td>
                  {PRESETS.map((p) => {
                    const has = STAFF_PRESET_PERMISSIONS[p].includes(perm);
                    return (
                      <td key={p} className="px-5 py-3.5 text-center">
                        {has ? (
                          <CheckCircle size={16} className="mx-auto text-leaf-500" />
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preset cards */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-ink-3">
        Preset details
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {PRESETS.map((p) => {
          const perms = STAFF_PRESET_PERMISSIONS[p];
          const count = staffByPreset[p] ?? 0;
          return (
            <div key={p} className={`rounded-xl border p-5 ${PRESET_COLOR[p]}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${BADGE_COLOR[p]}`}>
                    {STAFF_PRESET_LABELS[p]}
                  </span>
                  <p className="mt-2 text-sm text-ink-2">{PRESET_DESCRIPTIONS[p]}</p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-ink-3">
                  {count} {count === 1 ? 'person' : 'people'}
                </span>
              </div>
              <ul className="mt-4 space-y-1.5">
                {perms.map((perm) => (
                  <li key={perm} className="flex items-center gap-2 text-xs text-ink-2">
                    <CheckCircle size={12} className="shrink-0 text-leaf-500" />
                    {PERMISSION_LABELS[perm].label}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-5">
        <h3 className="text-sm font-medium text-ink">Need a custom role?</h3>
        <p className="mt-1 text-sm text-ink-3">
          As the team grows, new presets can be added to the codebase in minutes.
          Add a key to <code className="rounded bg-bg-muted px-1 py-0.5 text-xs">STAFF_PRESET_PERMISSIONS</code> in{' '}
          <code className="rounded bg-bg-muted px-1 py-0.5 text-xs">src/types/index.ts</code>.
        </p>
      </div>
    </>
  );
}
