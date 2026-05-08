import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, Phone, MapPin, Shield, Building } from '@/components/icons';
import { Badge, Stat } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { CUSTOMERS, ORDERS, AGENTS } from '@/lib/data/operational';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from '@/lib/constants';
import { formatNaira, formatDate, initials } from '@/lib/utils';

export default async function ConsoleCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = CUSTOMERS.find((c) => c.id === Number(id));
  if (!customer) notFound();

  const customerOrders = ORDERS.filter((o) => o.customer_id === customer.id).sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
  const onboardingAgent = AGENTS.find((a) => a.id === customer.onboarded_by);

  return (
    <>
      <Link
        href="/console/customers"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={14} /> Back to customers
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-leaf-500 font-display text-xl text-white">
            {initials(customer.company_name)}
          </span>
          <div>
            <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-ink">
              {customer.company_name}
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              Customer ID #{customer.id} · onboarded {formatDate(customer.created_at)}
            </p>
          </div>
        </div>
        {customer.pcn_verified ? (
          <Badge tone="success" noDot>
            <Shield size={11} /> PCN verified
          </Badge>
        ) : (
          <Badge tone="warning">Pending verification</Badge>
        )}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <KvCard
          icon={<Mail size={14} />}
          label="Contact"
          lines={[`${customer.user.fname} ${customer.user.lname}`, customer.user.email, customer.user.phone]}
        />
        <KvCard icon={<MapPin size={14} />} label="Address" lines={[customer.address]} />
        <KvCard
          icon={<Building size={14} />}
          label="Onboarded by"
          lines={
            onboardingAgent
              ? [`${onboardingAgent.fname} ${onboardingAgent.lname}`, onboardingAgent.email]
              : ['Self-service signup']
          }
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-white p-5">
          <Stat label="Total orders" value={customer.total_orders ?? 0} />
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <Stat label="Total spend" value={formatNaira(customer.total_spent ?? 0)} />
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <Stat
            label="Average order"
            value={formatNaira((customer.total_spent ?? 0) / Math.max(1, customer.total_orders ?? 1))}
          />
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <Stat label="Member since" value={formatDate(customer.created_at)} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <header className="border-b border-line-subtle px-5 py-4 text-base font-medium tracking-tight text-ink">
          Order history
        </header>
        {customerOrders.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-3">No orders yet for this customer.</div>
        ) : (
          <TableWrap className="border-0">
            <Table compact>
              <Thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Payment</Th>
                  <Th align="right">Total</Th>
                </tr>
              </Thead>
              <Tbody>
                {customerOrders.map((o) => (
                  <Tr key={o.id}>
                    <Td>
                      <Link href={`/console/orders/${o.id}`} className="font-mono text-xs text-ink-2 hover:text-brand-600">
                        {o.order_number}
                      </Link>
                    </Td>
                    <Td muted>{formatDate(o.created_at)}</Td>
                    <Td>
                      <Badge tone={ORDER_STATUS_TONE[o.status]} noDot>
                        {ORDER_STATUS_LABEL[o.status]}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone={PAYMENT_STATUS_TONE[o.payment_status]} noDot>
                        {PAYMENT_STATUS_LABEL[o.payment_status]}
                      </Badge>
                    </Td>
                    <Td right num>{formatNaira(o.total_amount)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        )}
      </div>
    </>
  );
}

function KvCard({ icon, label, lines }: { icon: React.ReactNode; label: string; lines: string[] }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        {icon} {label}
      </div>
      <div className="mt-2 flex flex-col gap-0.5">
        {lines.map((l, i) => (
          <span key={i} className={i === 0 ? 'text-sm font-medium text-ink' : 'text-sm text-ink-2'}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
