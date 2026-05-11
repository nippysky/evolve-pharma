/**
 * Settings form (client). Pure presentation + local state. Receives all
 * defaults as serializable props from the server page above.
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
  ArrowRight,
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

export function SettingsForm({ defaults }: SettingsFormProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setSaving(true);
    await sleep(700);
    setSaving(false);

    toast.show({ tone: 'success', title: 'Settings saved' });
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-4">
        {/* Company information */}
        <section className="rounded-xl border border-line bg-white p-7">
          <h2 className="mb-1 flex items-center gap-2 text-base font-medium tracking-tight text-ink">
            <Building size={14} className="text-ink-3" /> Company information
          </h2>

          <p className="mb-6 text-sm text-ink-3">
            Used on invoices, delivery slips, and emails.
          </p>

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
                <option value="Africa/Lagos">Africa/Lagos</option>
                <option value="UTC">UTC</option>
              </Select>
            </Field>
          </div>
        </section>

        {/* Notifications */}
        <section className="rounded-xl border border-line bg-white p-7">
          <h2 className="mb-1 flex items-center gap-2 text-base font-medium tracking-tight text-ink">
            <Bell size={14} className="text-ink-3" /> Notifications
          </h2>

          <p className="mb-6 text-sm text-ink-3">
            Choose which events trigger alerts.
          </p>

          <div className="flex flex-col gap-3">
            <Checkbox name="notif_orders" defaultChecked>
              New orders &mdash; instant email + dashboard alert
            </Checkbox>

            <Checkbox name="notif_payment" defaultChecked>
              Payment received or failed
            </Checkbox>

            <Checkbox name="notif_lowstock" defaultChecked>
              Low-stock and expiring inventory
            </Checkbox>

            <Checkbox name="notif_agents">
              Sales agent activity digest (weekly)
            </Checkbox>

            <Checkbox name="notif_marketing">
              Product updates and platform releases
            </Checkbox>
          </div>
        </section>

        {/* Security */}
        <section className="rounded-xl border border-line bg-white p-7">
          <h2 className="mb-1 flex items-center gap-2 text-base font-medium tracking-tight text-ink">
            <Shield size={14} className="text-ink-3" /> Security
          </h2>

          <p className="mb-6 text-sm text-ink-3">
            Account protection and access controls.
          </p>

          <div className="flex flex-col gap-3">
            <Checkbox name="sec_2fa" defaultChecked>
              Require two-factor authentication for admins
            </Checkbox>

            <Checkbox name="sec_ip">
              Restrict console access to allowed IPs only
            </Checkbox>

            <Checkbox name="sec_audit" defaultChecked>
              Email me a weekly audit-log summary
            </Checkbox>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary">
            Cancel
          </Button>

          <Button type="submit" loading={saving} leadingIcon={<CheckCircle size={14} />}>
            Save settings
          </Button>
        </div>
      </div>

      <aside className="self-start rounded-xl border border-line bg-white p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
          Need something else?
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Looking for billing, API access, or integrations? Reach out and our ops team will set
          you up directly.
        </p>

        <a
          href="mailto:ops@envolvepharm.com.ng"
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-sm text-ink hover:border-line-strong"
        >
          Email ops
          <ArrowRight size={12} />
        </a>
      </aside>
    </form>
  );
}