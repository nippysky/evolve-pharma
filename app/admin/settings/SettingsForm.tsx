'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input, Select, Checkbox } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Building, Shield, ArrowRight, CheckCircle, Tag, Star, Basket } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';

export interface SettingsDefaults {
  company_name:        string;
  company_email:       string;
  company_phone:       string;
  hq_address:          string;
  currency:            string;
  timezone:            string;
  email_audit_summary: string; // 'true' | 'false'
  auto_logout:         string; // 'true' | 'false'
  vat_enabled:         string; // 'true' | 'false'
  vat_rate:            string; // e.g. '7.5'
  referral_threshold:  string; // naira, e.g. '500000'
  referral_reward:     string; // naira, e.g. '500'
  staff_order_scope:   string; // 'ALL' | 'ASSIGNED'
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon:        React.ReactNode;
  title:       string;
  description: string;
  children:    React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-7">
      <div className="mb-6">
        <h2 className="mb-1 flex items-center gap-2 text-base font-medium text-ink">
          {icon} {title}
        </h2>
        <p className="text-sm text-ink-3">{description}</p>
      </div>
      {children}
    </section>
  );
}

async function saveSettings(payload: Record<string, string>): Promise<void> {
  const res  = await fetch('/api/admin/settings', {
    method:      'PATCH',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(payload),
  });
  const json = await res.json() as { message?: string };
  if (!res.ok) throw new Error(json.message ?? 'Save failed.');
}

export function SettingsForm({ defaults }: { defaults: SettingsDefaults }) {
  const toast  = useToast();
  const router = useRouter();

  const [saving, setSaving] = useState<string | null>(null);

  // ── Company info state ────────────────────────────────────────────────────
  const [companyName,  setCompanyName]  = useState(defaults.company_name);
  const [companyEmail, setCompanyEmail] = useState(defaults.company_email);
  const [companyPhone, setCompanyPhone] = useState(defaults.company_phone);
  const [hqAddress,    setHqAddress]    = useState(defaults.hq_address);
  const [currency,     setCurrency]     = useState(defaults.currency);
  const [timezone,     setTimezone]     = useState(defaults.timezone);

  // ── Security state ────────────────────────────────────────────────────────
  const [emailAudit,  setEmailAudit]  = useState(defaults.email_audit_summary === 'true');
  const [autoLogout,  setAutoLogout]  = useState(defaults.auto_logout         === 'true');

  // ── VAT state ─────────────────────────────────────────────────────────────
  const [vatEnabled, setVatEnabled] = useState(defaults.vat_enabled === 'true'); // default false
  const [vatRate,    setVatRate]    = useState(defaults.vat_rate || '7.5');

  // ── Referral state ────────────────────────────────────────────────────────
  const [referralThreshold, setReferralThreshold] = useState(defaults.referral_threshold || '500000');
  const [referralReward,    setReferralReward]    = useState(defaults.referral_reward    || '500');
  const [staffOrderScope,   setStaffOrderScope]   = useState(defaults.staff_order_scope  || 'ALL');

  // ── Submit handlers ───────────────────────────────────────────────────────

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('company');
    try {
      await saveSettings({
        company_name:  companyName.trim(),
        company_email: companyEmail.trim(),
        company_phone: companyPhone.trim(),
        hq_address:    hqAddress.trim(),
        currency,
        timezone,
      });
      toast.success('Company info saved', 'Changes will appear on emails and documents.');
      router.refresh(); // re-runs server component so SITE defaults stay in sync
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('security');
    try {
      await saveSettings({
        email_audit_summary: String(emailAudit),
        auto_logout:         String(autoLogout),
      });
      toast.success('Security settings saved');
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleVatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('vat');
    try {
      await saveSettings({
        vat_enabled: String(vatEnabled),
        vat_rate:    vatRate,
      });
      toast.success('VAT settings saved', vatEnabled ? `VAT set to ${vatRate}%` : 'VAT disabled on orders');
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleReferralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('referral');
    try {
      await saveSettings({
        referral_threshold: referralThreshold,
        referral_reward:    referralReward,
      });
      toast.success('Referral settings saved', `Referrers earn ₦${Number(referralReward).toLocaleString()} when referee buys ≥ ₦${Number(referralThreshold).toLocaleString()}`);
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleOrderingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('ordering');
    try {
      await saveSettings({ staff_order_scope: staffOrderScope });
      toast.success(
        'Ordering settings saved',
        staffOrderScope === 'ASSIGNED'
          ? 'Staff can now only order for customers assigned to them.'
          : 'Staff can order for any approved customer.',
      );
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">

        {/* Company information */}
        <Section
          icon={<Building size={14} className="text-ink-3" />}
          title="Company information"
          description="Appears on invoices, delivery slips, and customer-facing emails."
        >
          <form onSubmit={handleCompanySubmit}>
            <Field label="Company name" htmlFor="company_name">
              <Input
                id="company_name"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                required
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email" htmlFor="company_email">
                <Input
                  id="company_email"
                  type="email"
                  value={companyEmail}
                  onChange={e => setCompanyEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label="Phone" htmlFor="company_phone">
                <Input
                  id="company_phone"
                  type="tel"
                  value={companyPhone}
                  onChange={e => setCompanyPhone(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Headquarters address" htmlFor="hq_address">
              <Input
                id="hq_address"
                value={hqAddress}
                onChange={e => setHqAddress(e.target.value)}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Currency" htmlFor="currency">
                <Select
                  id="currency"
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                >
                  <option value="NGN">Nigerian Naira (₦)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="GBP">British Pound (£)</option>
                  <option value="EUR">Euro (€)</option>
                </Select>
              </Field>
              <Field label="Timezone" htmlFor="timezone">
                <Select
                  id="timezone"
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                >
                  <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="America/New_York">America/New York (ET)</option>
                </Select>
              </Field>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                loading={saving === 'company'}
                leadingIcon={<CheckCircle size={14} />}
              >
                Save changes
              </Button>
            </div>
          </form>
        </Section>

        {/* Security */}
        <Section
          icon={<Shield size={14} className="text-ink-3" />}
          title="Security"
          description="Access control and monitoring preferences."
        >
          <form onSubmit={handleSecuritySubmit}>
            <div className="flex flex-col gap-3">
              <Checkbox
                name="email_audit"
                checked={emailAudit}
                onChange={e => setEmailAudit(e.target.checked)}
              >
                Email weekly audit-log summary to admin
              </Checkbox>
              <Checkbox
                name="auto_logout"
                checked={autoLogout}
                onChange={e => setAutoLogout(e.target.checked)}
              >
                Auto-logout sessions after 8 hours of inactivity
              </Checkbox>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                loading={saving === 'security'}
                leadingIcon={<CheckCircle size={14} />}
              >
                Save changes
              </Button>
            </div>
          </form>
        </Section>

        {/* VAT */}
        <Section
          icon={<Tag size={14} className="text-ink-3" />}
          title="VAT / Tax"
          description="Controls whether VAT appears on orders, invoices, and documents."
        >
          <form onSubmit={handleVatSubmit}>
            <div className="mb-4 flex flex-col gap-3">
              <Checkbox
                name="vat_enabled"
                checked={vatEnabled}
                onChange={e => setVatEnabled(e.target.checked)}
              >
                Apply VAT to orders
              </Checkbox>
              {vatEnabled && (
                <Field label="VAT rate (%)" htmlFor="vat_rate" hint="e.g. 7.5 for 7.5%">
                  <Input
                    id="vat_rate"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={vatRate}
                    onChange={e => setVatRate(e.target.value)}
                    style={{ maxWidth: 120 }}
                  />
                </Field>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={saving === 'vat'} leadingIcon={<CheckCircle size={14} />}>
                Save changes
              </Button>
            </div>
          </form>
        </Section>

        {/* Referrals */}
        <Section
          icon={<Star size={14} className="text-ink-3" />}
          title="Referral Rewards"
          description="When a referred customer's total purchases reach the threshold, the referrer earns the reward amount."
        >
          <form onSubmit={handleReferralSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Purchase threshold (₦)" htmlFor="referral_threshold" hint="Referee must spend this much to trigger reward">
                <Input
                  id="referral_threshold"
                  type="number"
                  step="1000"
                  min="0"
                  value={referralThreshold}
                  onChange={e => setReferralThreshold(e.target.value)}
                />
              </Field>
              <Field label="Reward amount (₦)" htmlFor="referral_reward" hint="Credited to the referrer's account">
                <Input
                  id="referral_reward"
                  type="number"
                  step="50"
                  min="0"
                  value={referralReward}
                  onChange={e => setReferralReward(e.target.value)}
                />
              </Field>
            </div>
            <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              Current rule: when a referee&apos;s cumulative purchases reach{' '}
              <strong>₦{Number(referralThreshold).toLocaleString()}</strong>, the referrer earns{' '}
              <strong>₦{Number(referralReward).toLocaleString()}</strong> in referral points (one-time per referee).
            </p>
            <div className="flex justify-end pt-3">
              <Button type="submit" loading={saving === 'referral'} leadingIcon={<CheckCircle size={14} />}>
                Save changes
              </Button>
            </div>
          </form>
        </Section>

        {/* Ordering on behalf of customers */}
        <Section
          icon={<Basket size={14} className="text-ink-3" />}
          title="Staff Ordering"
          description="Controls which customers a staff member may place an order for. Admins are never restricted."
        >
          <form onSubmit={handleOrderingSubmit}>
            <Field
              label="Staff can place orders for"
              htmlFor="staff_order_scope"
              hint="Change this if you need to tighten who reps can sell to"
            >
              <select
                id="staff_order_scope"
                value={staffOrderScope}
                onChange={e => setStaffOrderScope(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="ALL">Any approved customer</option>
                <option value="ASSIGNED">Only customers assigned to them</option>
              </select>
            </Field>

            <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
              {staffOrderScope === 'ASSIGNED' ? (
                <>
                  Staff can only place orders for customers assigned to them. Useful for
                  strict account ownership, but a rep covering for an absent colleague
                  will be blocked and will need an admin to step in.
                </>
              ) : (
                <>
                  Any staff member can place an order for any approved customer. Best for
                  emergencies and holiday cover. Every order still records who placed it,
                  so accountability is preserved either way.
                </>
              )}
            </p>

            <div className="flex justify-end pt-3">
              <Button type="submit" loading={saving === 'ordering'} leadingIcon={<CheckCircle size={14} />}>
                Save changes
              </Button>
            </div>
          </form>
        </Section>

      </div>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="self-start space-y-4">

        <div className="rounded-xl border border-line bg-white p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            Need something else?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Billing, API keys, webhook endpoints, or integrations? Reach out and our
            ops team will set you up directly.
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
              { label: 'Audit trail',    href: '/admin/audit-logs'      },
              { label: 'Login activity', href: '/admin/login-activity'  },
              { label: 'Manage staff',   href: '/admin/staff'           },
              { label: 'Manage drivers', href: '/admin/drivers'         },
            ].map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="flex items-center gap-1.5 text-brand-600 hover:underline"
                >
                  <ArrowRight size={12} /> {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

      </aside>
    </div>
  );
}
