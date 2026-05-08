import Link from 'next/link';
import { Plus, Users, Calendar, Mail } from '@/components/icons';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, Avatar, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { PageHead } from '@/components/shared/PageHead';
import { AGENTS, CUSTOMERS } from '@/lib/data/operational';
import { formatDate, timeAgo } from '@/lib/utils';

export default function ConsoleAgentsPage() {
  const enriched = AGENTS.map((a) => {
    const onboarded = CUSTOMERS.filter((c) => c.onboarded_by === a.id);
    const lastActivity = onboarded
      .map((c) => c.last_order_at ?? c.created_at)
      .filter((d): d is string => Boolean(d))
      .sort()
      .reverse()[0];
    return { agent: a, onboardedCount: onboarded.length, lastActivity };
  });

  return (
    <>
      <PageHead
        title="Sales agents"
        subtitle="Field reps onboarding pharmacies across Nigeria."
        actions={
          <ButtonLink href="/console/agents" leadingIcon={<Plus size={14} />}>
            Invite agent
          </ButtonLink>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Total agents</div>
          <div className="num mt-1 font-display text-2xl tracking-tight text-ink">{AGENTS.length}</div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Active this month</div>
          <div className="num mt-1 font-display text-2xl tracking-tight text-ink">
            {AGENTS.filter((a) => a.status === 'active').length}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Customers onboarded</div>
          <div className="num mt-1 font-display text-2xl tracking-tight text-ink">
            {CUSTOMERS.filter((c) => c.onboarded_by).length}
          </div>
        </div>
      </div>

      {enriched.length === 0 ? (
        <EmptyState icon={<Users size={24} />} title="No agents yet" />
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
              {enriched.map(({ agent, onboardedCount, lastActivity }) => (
                <Tr key={agent.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${agent.fname} ${agent.lname}`} />
                      <div>
                        <div className="font-medium text-ink">
                          {agent.fname} {agent.lname}
                        </div>
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
                  <Td right num>{onboardedCount}</Td>
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
