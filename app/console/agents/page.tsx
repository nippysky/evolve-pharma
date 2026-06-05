/**
 * Console · Sales agents (admin-only, server-rendered).
 * Table renders to static HTML; the create/import actions hydrate as an
 * isolated client island in the header.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { Badge, Avatar, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Users, Calendar, Mail } from '@/components/icons';
import { AgentsActions } from '@/components/console/AgentsActions';
import { AGENTS, CUSTOMERS } from '@/lib/data/operational';
import { formatDate, timeAgo } from '@/lib/utils';

export const metadata = {
  title: 'Sales agents',
};

export default async function ConsoleAgentsPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'admin') redirect('/console/overview');

  const rows = AGENTS.map((agent) => {
    const onboarded = CUSTOMERS.filter((c) => c.onboarded_by === agent.id);
    const lastActivity = onboarded
      .map((c) => c.last_order_at ?? c.created_at)
      .filter((d): d is string => Boolean(d))
      .sort()
      .reverse()[0];
    return { agent, onboardedCount: onboarded.length, lastActivity };
  });

  const totals = {
    agents: AGENTS.length,
    active: AGENTS.filter((a) => a.status === 'active').length,
    onboarded: CUSTOMERS.filter((c) => c.onboarded_by).length,
  };

  return (
    <>
      <PageHead
        title="Sales agents"
        subtitle="Field reps onboarding pharmacies across Nigeria."
        actions={<AgentsActions />}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total agents" value={totals.agents} />
        <StatCard label="Active this month" value={totals.active} />
        <StatCard label="Customers onboarded" value={totals.onboarded} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users size={24} />}
          title="No agents yet"
          description="When you invite sales agents, they'll appear here."
        />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Agent</Th>
                <Th>Contact</Th>
                <Th>Status</Th>
                <Th align="right">Customers onboarded</Th>
                <Th>Joined</Th>
                <Th>Last activity</Th>
              </tr>
            </Thead>
            <Tbody>
              {rows.map(({ agent, onboardedCount, lastActivity }) => (
                <Tr key={agent.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${agent.fname} ${agent.lname}`} />
                      <div>
                        <Link
                          href={`/console/agents/${agent.id}`}
                          className="font-medium text-ink hover:text-brand-600"
                        >
                          {agent.fname} {agent.lname}
                        </Link>
                        <div className="mt-0.5 text-xs text-ink-3">Agent #{agent.id}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5 text-sm text-ink">
                      <Mail size={12} className="text-ink-3" />
                      {agent.email}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-3">{agent.phone}</div>
                  </Td>
                  <Td>
                    <Badge tone={agent.status === 'active' ? 'success' : 'neutral'} noDot>
                      {agent.status}
                    </Badge>
                  </Td>
                  <Td right num>
                    {onboardedCount}
                  </Td>
                  <Td muted>
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} /> {formatDate(agent.created_at)}
                    </span>
                  </Td>
                  <Td muted>{lastActivity ? timeAgo(lastActivity) : '—'}</Td>
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