/**
 * Console · Staff (admin-only). Internal employees who run the back office.
 * Mirrors the agents page structure: server-rendered table + a client
 * island for the add/import actions.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { Badge, Avatar, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Users, Calendar, Mail } from '@/components/icons';
import { StaffActions } from '@/components/console/StaffActions';
import { STAFF } from '@/lib/data/staff';
import { formatDate } from '@/lib/utils';

export const metadata = {
  title: 'Staff',
};

export default async function ConsoleStaffPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'admin') redirect('/console/overview');

  const totals = {
    staff: STAFF.length,
    active: STAFF.filter((s) => s.status === 'active').length,
    departments: new Set(STAFF.map((s) => s.department)).size,
  };

  return (
    <>
      <PageHead
        title="Staff"
        subtitle="Internal team members managing products, agents, and operations."
        actions={<StaffActions />}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total staff" value={totals.staff} />
        <StatCard label="Active" value={totals.active} />
        <StatCard label="Departments" value={totals.departments} />
      </div>

      {STAFF.length === 0 ? (
        <EmptyState
          icon={<Users size={24} />}
          title="No staff yet"
          description="Add your first team member to get started."
        />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Name</Th>
                <Th>Contact</Th>
                <Th>Department</Th>
                <Th>Title</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
              </tr>
            </Thead>
            <Tbody>
              {STAFF.map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${s.fname} ${s.lname}`} />
                      <div>
                        <div className="font-medium text-ink">
                          {s.fname} {s.lname}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-3">Staff #{s.id}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5 text-sm text-ink">
                      <Mail size={12} className="text-ink-3" />
                      {s.email}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-3">{s.phone}</div>
                  </Td>
                  <Td>
                    <Badge tone="brand" noDot>
                      {s.department}
                    </Badge>
                  </Td>
                  <Td>{s.job_title}</Td>
                  <Td>
                    <Badge tone={s.status === 'active' ? 'success' : 'neutral'} noDot>
                      {s.status}
                    </Badge>
                  </Td>
                  <Td muted>
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} /> {formatDate(s.created_at)}
                    </span>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}
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