'use client';

import { useState } from 'react';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { PageHead } from '@/components/shared/PageHead';
import {
  CheckCircle, Shield, Mail, Phone, User, Building,
  Calendar, MapPin,
} from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { signOutAction } from '@/lib/actions/role';
import { initials } from '@/lib/utils';

/* ── Demo profile data ─────────────────────────────────────────────────── */
const DEMO_USER = {
  first_name: 'Adaeze',
  last_name:  'Nwosu',
  email:      'adaeze.nwosu@greenleafpharmacy.ng',
  phone:      '08034 567 890',
  company_name: 'Greenleaf Pharmacy Ltd.',
  role:       'Customer',
  address:    '12 Lagos Street, Wuse 2, Abuja FCT',
  pcn_number: 'PCN/PH/2024/08134',
  member_since: 'January 2024',
  total_orders: 4,
  total_spent:  '₦309,550',
};

export default function ProfilePage() {
  const toast = useToast();
  const [fname, setFname] = useState(DEMO_USER.first_name);
  const [lname, setLname] = useState(DEMO_USER.last_name);
  const [phone, setPhone] = useState(DEMO_USER.phone);
  const [saving, setSaving] = useState(false);

  const fullName = `${fname} ${lname}`.trim();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 900));
    setSaving(false);
    toast.show({ tone: 'success', title: 'Profile updated', description: 'Your details have been saved.' });
  };

  return (
    <>
      <PageHead title="My profile" subtitle="Manage your personal details and account settings." />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* ── Left column ── */}
        <div className="flex flex-col gap-4">

          {/* Avatar + status */}
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {/* Teal top banner */}
            <div className="h-20 bg-gradient-to-br from-[#042a36] via-teal-700 to-cyan-600" />
            <div className="-mt-10 flex flex-col items-center px-6 pb-6">
              <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-gradient-to-br from-teal-400 to-cyan-500 font-display text-2xl font-bold text-white shadow-lg">
                {initials(fullName)}
              </div>
              <p className="mt-3 text-base font-semibold tracking-tight text-ink">{fullName}</p>
              <p className="mt-0.5 text-sm text-ink-3">{DEMO_USER.company_name}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                Active account
              </span>
            </div>
          </div>

          {/* Account snapshot */}
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Account details</p>
            <dl className="flex flex-col gap-3.5">
              {[
                { Icon: Mail,     label: 'Email',    value: DEMO_USER.email },
                { Icon: Phone,    label: 'Phone',    value: DEMO_USER.phone },
                { Icon: Building, label: 'Pharmacy', value: DEMO_USER.company_name },
                { Icon: User,     label: 'Role',     value: DEMO_USER.role },
                { Icon: MapPin,   label: 'Address',  value: DEMO_USER.address },
                { Icon: Calendar, label: 'Member since', value: DEMO_USER.member_since },
              ].map(({ Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2.5">
                  <Icon size={14} className="mt-0.5 shrink-0 text-teal-500" />
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-4">{label}</dt>
                    <dd className="truncate text-sm text-ink">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          {/* Order stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-white p-4 text-center">
              <p className="num text-2xl font-bold text-ink">{DEMO_USER.total_orders}</p>
              <p className="mt-0.5 text-xs text-ink-3">Orders placed</p>
            </div>
            <div className="rounded-xl border border-line bg-white p-4 text-center">
              <p className="num text-lg font-bold text-teal-700">{DEMO_USER.total_spent}</p>
              <p className="mt-0.5 text-xs text-ink-3">Total spent</p>
            </div>
          </div>

          {/* PCN */}
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">PCN certificate</p>
            <div className="flex items-start gap-2.5 rounded-lg border border-teal-100 bg-teal-50 px-3.5 py-3">
              <Shield size={16} className="mt-0.5 shrink-0 text-teal-600" />
              <div>
                <p className="text-sm font-semibold text-teal-900">Verified</p>
                <p className="text-xs text-teal-700">{DEMO_USER.pcn_number}</p>
              </div>
            </div>
            <p className="mt-2.5 text-xs text-ink-3">
              To update your certificate,{' '}
              <a href="mailto:support@evolvepharm.ng" className="text-teal-600 hover:underline">
                contact support
              </a>.
            </p>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-4">

          {/* Personal details */}
          <form onSubmit={handleSave} className="rounded-2xl border border-line bg-white p-6">
            <h2 className="mb-1 text-base font-semibold tracking-tight text-ink">Personal details</h2>
            <p className="mb-5 text-sm text-ink-3">
              This information is used when we contact you about your orders.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name" htmlFor="fname" required>
                <Input
                  id="fname"
                  name="fname"
                  value={fname}
                  onChange={(e) => setFname(e.target.value)}
                  required
                />
              </Field>
              <Field label="Last name" htmlFor="lname" required>
                <Input
                  id="lname"
                  name="lname"
                  value={lname}
                  onChange={(e) => setLname(e.target.value)}
                  required
                />
              </Field>
            </div>

            <Field label="Email address" htmlFor="email" hint="To change your email, contact support.">
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={DEMO_USER.email}
                disabled
              />
            </Field>

            <Field label="Phone number" htmlFor="phone" required>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </Field>

            <div className="mt-1 flex justify-end">
              <Button
                type="submit"
                loading={saving}
                leadingIcon={<CheckCircle size={14} />}
                className="bg-[#042a36] hover:bg-teal-900"
              >
                Save changes
              </Button>
            </div>
          </form>

          {/* Pharmacy details */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <h2 className="mb-1 text-base font-semibold tracking-tight text-ink">Pharmacy details</h2>
            <p className="mb-5 text-sm text-ink-3">
              These details appear on your invoices and delivery slips.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pharmacy / company name">
                <Input defaultValue={DEMO_USER.company_name} disabled />
              </Field>
              <Field label="PCN number">
                <Input defaultValue={DEMO_USER.pcn_number} disabled />
              </Field>
            </div>

            <Field label="Primary address">
              <Input defaultValue={DEMO_USER.address} disabled />
            </Field>

            <p className="text-xs text-ink-3">
              To update pharmacy details or your PCN certificate,{' '}
              <a href="mailto:support@evolvepharm.ng" className="text-teal-600 hover:underline">
                contact our team
              </a>.
            </p>
          </div>

          {/* Delivery preferences */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <h2 className="mb-1 text-base font-semibold tracking-tight text-ink">Delivery preferences</h2>
            <p className="mb-5 text-sm text-ink-3">Your saved default delivery address.</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Default state">
                <Input defaultValue="Abuja FCT" disabled />
              </Field>
              <Field label="Default city / LGA">
                <Input defaultValue="Wuse 2" disabled />
              </Field>
            </div>
            <Field label="Default street address">
              <Input defaultValue="12 Lagos Street" disabled />
            </Field>

            <p className="text-xs text-ink-3">
              Delivery address can be updated at checkout for each order.
            </p>
          </div>

          {/* Sign out */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <h2 className="mb-1 text-base font-semibold tracking-tight text-ink">Sign out</h2>
            <p className="mb-5 text-sm text-ink-3">
              You&apos;ll need your email and password to sign back in.
            </p>
            <form action={signOutAction}>
              <Button type="submit" variant="secondary">
                Sign out of this device
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
