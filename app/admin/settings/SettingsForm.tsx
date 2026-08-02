/**
 * Settings form (client). Pure presentation + local state.
 * API-ready: each section's submit can be wired to a separate endpoint.
 */

'use client';

import { type FormEvent, useState } from 'react';
import { Field, Input, Select, Checkbox } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import {
  CheckCircle,
  Building,
  Bell,
  Shield,
  Truck,
  ArrowRight,
  Users,
} from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { sleep } from '@/lib/utils';

interface SettingsFormProps {
  defaults: {
    companyName: string;
    companyEmail: string;
    companyPhone: string;
    headquarters: string;
  };
}

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="mb-1 flex items-center gap-2 text-base font-medium tracking-tight text-ink">
        {icon} {title}
      </h2>
      <p className="text-sm text-ink-3">{description}</p>
    </div>
  );
}

export function SettingsForm({ defaults }: SettingsFormProps) {
  const toast = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  const save = (section: string) => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(section);
    await sleep(700);
    setSaving(null);
    toast.show({ tone: 'success', title: `${section} saved` });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-4">

        {/* ── Company information ─────────────────────────────────────── */}
        <section className="rounded-xl border border-line bg-white p-7">
          <SectionHeader
            icon={<Building size={14} className="text-ink-3" />}
            title="Company information"
            description="Appears on invoices, delivery slips, and customer-facing emails."
          />

          <form onSubmit={save('Company information')}>
            <Field label="Company name" htmlFor="company_name">
              <Input id="company_name" defaultValue={defaults.companyName} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email" htmlFor="company_email">
                <Input id="company_email" type="email" defaultValue={defaults.companyEmail} />
              </Field>
              <Field label="Phone" htmlFor="company_phone">
                <Input id="company_phone" type="tel" defaultValue={defaults.companyPhone} />
              </Field>
            </div>

            <Field label="Headquarters address" htmlFor="hq">
              <Input id="hq" defaultValue={defaults.headquarters} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Currency" htmlFor="currency">
                <Select id="currency" defaultValue="NGN">
                  <option value="NGN">Nigerian Naira (₦)</option>
                  <option value="USD">US Dollar ($)</option>
                </Select>
              </Field>
              <Field label="Timezone" htmlFor="tz">
                <Select id="tz" defaultValue="Africa/Lagos">
                  <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                  <option value="UTC">UTC</option>
                </Select>
              </Field>
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={saving === 'Company information'} leadingIcon={<CheckCircle size={14} />}>
                Save changes
              </Button>
            </div>
          </form>
        </section>

        {/* ── Order defaults ──────────────────────────────────────────── */}
        <section className="rounded-xl border border-line bg-white p-7">
          <SectionHeader
            icon={<CheckCircle size={14} className="text-ink-3" />}
            title="Order defaults"
            description="Default values applied to new orders and customer-facing order views."
          />

          <form onSubmit={save('Order defaults')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Default order status (new orders)" htmlFor="default_status">
                <Select id="default_status" defaultValue="processing">
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                </Select>
              </Field>
              <Field label="Default payment method" htmlFor="default_payment">
                <Select id="default_payment" defaultValue="bank_transfer">
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="paystack">Paystack</option>
                  <option value="cash_on_delivery">Cash on delivery</option>
                </Select>
              </Field>
            </div>

            <div className="flex flex-col gap-3">
              <Checkbox name="auto_confirm" defaultChecked>
                Auto-confirm orders when payment is received
              </Checkbox>
              <Checkbox name="require_po">
                Require a PO number for all orders
              </Checkbox>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="submit" loading={saving === 'Order defaults'} leadingIcon={<CheckCircle size={14} />}>
                Save changes
              </Button>
            </div>
          </form>
        </section>

        {/* ── Delivery & Drivers ──────────────────────────────────────── */}
        <section className="rounded-xl border border-line bg-white p-7">
          <SectionHeader
            icon={<Truck size={14} className="text-ink-3" />}
            title="Delivery & drivers"
            description="Configure how deliveries are dispatched and tracked."
          />

          <form onSubmit={save('Delivery settings')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Default lead time (days)" htmlFor="lead_time">
                <Input id="lead_time" type="number" defaultValue="2" min="1" max="30" />
              </Field>
              <Field label="Low-stock alert threshold (units)" htmlFor="low_stock">
                <Input id="low_stock" type="number" defaultValue="50" min="1" />
              </Field>
            </div>

            <div className="flex flex-col gap-3">
              <Checkbox name="driver_ack_required" defaultChecked>
                Require driver acknowledgement before dispatch
              </Checkbox>
              <Checkbox name="customer_notify_dispatch" defaultChecked>
                Notify customer when order is dispatched
              </Checkbox>
              <Checkbox name="customer_notify_delivered" defaultChecked>
                Notify customer when order is delivered
              </Checkbox>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="submit" loading={saving === 'Delivery settings'} leadingIcon={<CheckCircle size={14} />}>
                Save changes
              </Button>
            </div>
          </form>
        </section>

        {/* ── Notifications ───────────────────────────────────────────── */}
        <section className="rounded-xl border border-line bg-white p-7">
          <SectionHeader
            icon={<Bell size={14} className="text-ink-3" />}
            title="Notifications"
            description="Choose which events trigger admin alerts."
          />

          <form onSubmit={save('Notification settings')}>
            <div className="flex flex-col gap-3">
              <Checkbox name="notif_orders"   defaultChecked>New orders — instant email + dashboard alert</Checkbox>
              <Checkbox name="notif_payment"  defaultChecked>Payment received or failed</Checkbox>
              <Checkbox name="notif_lowstock" defaultChecked>Low-stock and expiring inventory alerts</Checkbox>
              <Checkbox name="notif_drivers"  defaultChecked>Driver assignment and delivery completion</Checkbox>
              <Checkbox name="notif_agents">Staff activity digest (weekly)</Checkbox>
              <Checkbox name="notif_marketing">Product updates and platform releases</Checkbox>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="submit" loading={saving === 'Notification settings'} leadingIcon={<CheckCircle size={14} />}>
                Save changes
              </Button>
            </div>
          </form>
        </section>

        {/* ── Access & Security ───────────────────────────────────────── */}
        <section className="rounded-xl border border-line bg-white p-7">
          <SectionHeader
            icon={<Shield size={14} className="text-ink-3" />}
            title="Access & security"
            description="Control how staff and admins authenticate."
          />

          <form onSubmit={save('Security settings')}>
            <div className="flex flex-col gap-3">
              <Checkbox name="sec_2fa"    defaultChecked>Require 2FA for admin accounts</Checkbox>
              <Checkbox name="sec_2fa_staff">Require 2FA for all staff accounts</Checkbox>
              <Checkbox name="sec_ip">Restrict console access to approved IPs only</Checkbox>
              <Checkbox name="sec_audit"  defaultChecked>Email weekly audit-log summary to admin</Checkbox>
              <Checkbox name="sec_session_timeout" defaultChecked>Auto-logout after 8 hours of inactivity</Checkbox>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="submit" loading={saving === 'Security settings'} leadingIcon={<CheckCircle size={14} />}>
                Save changes
              </Button>
            </div>
          </form>
        </section>

        {/* ── Staff & Roles ───────────────────────────────────────────── */}
        <section className="rounded-xl border border-line bg-white p-7">
          <SectionHeader
            icon={<Users size={14} className="text-ink-3" />}
            title="Staff & roles"
            description="Global defaults for newly-invited staff members."
          />

          <form onSubmit={save('Staff settings')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Default permission preset for new staff" htmlFor="default_preset">
                <Select id="default_preset" defaultValue="sales_rep">
                  <option value="sales_rep">Sales Rep</option>
                  <option value="product_manager">Product Manager</option>
                  <option value="operations_lead">Operations Lead</option>
                  <option value="senior_staff">Senior Staff</option>
                </Select>
              </Field>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <Checkbox name="staff_self_edit" defaultChecked>Allow staff to edit their own profile</Checkbox>
              <Checkbox name="staff_invite_customers">Allow staff to send customer email invites directly</Checkbox>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="submit" loading={saving === 'Staff settings'} leadingIcon={<CheckCircle size={14} />}>
                Save changes
              </Button>
            </div>
          </form>
        </section>

      </div>

      {/* Sidebar */}
      <aside className="self-start space-y-4">
        <div className="rounded-xl border border-line bg-white p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            Need something else?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Billing, API keys, webhook endpoints, or integrations? Reach out and our ops team will set you up directly.
          </p>
          <a
            href="mailto:ops@ece.envolvepharm.com.ng"
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-sm text-ink hover:border-line-strong"
          >
            Email ops <ArrowRight size={12} />
          </a>
        </div>

        <div className="rounded-xl border border-line bg-white p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            Quick links
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              { label: 'Manage staff roles',  href: '/admin/roles'   },
              { label: 'View staff list',     href: '/admin/staff'   },
              { label: 'Manage drivers',      href: '/admin/drivers' },
              { label: 'View reports',        href: '/admin/reports' },
            ].map((l) => (
              <li key={l.href}>
                <a href={l.href} className="flex items-center gap-1.5 text-brand-600 hover:underline">
                  <ArrowRight size={12} /> {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm">
          <p className="font-medium text-amber-800">API-ready settings</p>
          <p className="mt-1 text-amber-700">
            Each settings section submits independently. Wire each{' '}
            <code className="rounded bg-amber-100 px-1 text-xs">onSubmit</code> to its matching
            backend endpoint when the PHP API is ready.
          </p>
        </div>
      </aside>
    </div>
  );
}
