/**
 * Console · Staff (admin-only)
 *
 * Shows all sales_agent (staff) users. Admin can:
 *   - See each member's current permission preset at a glance
 *   - Change the preset instantly via a dropdown → triggers updateStaffPermissionAction
 *   - Invite new staff or bulk-import via the header actions
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Users, Calendar, Mail } from '@/components/icons';
import { StaffActions } from '@/components/console/StaffActions';
import { StaffRoleRow } from '@/components/console/StaffRoleRow';
import { STAFF_MEMBERS } from '@/lib/data/staff';
import { CUSTOMERS } from '@/lib/data/operational';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Staff' };

export default async function ConsoleStaffPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'admin') redirect('/console/overview');

  const rows = STAFF_MEMBERS.map((member) => {
    const onboarded = CUSTOMERS.filter((c) => c.onboarded_by === member.id).length;
    return { member, onboarded };
  });

  const totals = {
    total:   STAFF_MEMBERS.length,
    active:  STAFF_MEMBERS.filter((s) => s.status === 'active').length,
    pending: STAFF_MEMBERS.filter((s) => s.status === 'pending').length,
  };

  return (
    <>
      <PageHead
        title="Staff"
        subtitle="Manage staff access and permissions. Use the Role column to instantly adjust what each person can do."
        actions={<StaffActions />}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total staff"   value={totals.total}   />
        <StatCard label="Active"        value={totals.active}  />
        <StatCard label="Pending setup" value={totals.pending} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users size={24} />}
          title="No staff yet"
          description="Invite your first team member to get started."
        />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Name</Th>
                <Th>Contact</Th>
                <Th>Region</Th>
                <Th>Role / Permissions</Th>
                <Th>Account</Th>
                <Th align="right">Customers</Th>
                <Th>Joined</Th>
              </tr>
            </Thead>
            <Tbody>
              {rows.map(({ member, onboarded }) => (
                <Tr key={member.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                        {member.fname[0]}{member.lname[0]}
                      </span>
                      <div>
                        <div className="font-medium text-ink">
                          {member.fname} {member.lname}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-3">Staff #{member.id}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5 text-sm text-ink">
                      <Mail size={12} className="text-ink-3" />
                      {member.email}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-3">{member.phone}</div>
                  </Td>
                  <Td muted>{member.region ?? '—'}</Td>
                  {/* Interactive role dropdown */}
                  <Td>
                    <StaffRoleRow staffId={member.id} currentPreset={member.permission_preset} />
                  </Td>
                  <Td>
                    <span
                      className={
                        member.status === 'active'
                          ? 'inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2 py-0.5 text-xs font-medium text-leaf-700'
                          : 'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700'
                      }
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${member.status === 'active' ? 'bg-leaf-500' : 'bg-amber-400'}`} />
                      {member.status === 'active' ? 'Active' : 'Pending'}
                    </span>
                  </Td>
                  <Td right num>{onboarded}</Td>
                  <Td muted>
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} /> {formatDate(member.created_at)}
                    </span>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}

      <p className="mt-4 text-xs text-ink-4">
        Role changes take effect immediately on next login. Current sessions are unaffected until refresh.
      </p>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
      <div className="num mt-1 font-display text-2xl tracking-tight text-ink">{value}</div>
    </div>
  );
}
