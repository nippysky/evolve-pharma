'use client';

import { useState } from 'react';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import {
  CheckCircle, Shield, User, Building,
  MapPin,
} from '@/components/icons';
import { useToast }      from '@/contexts/ToastContext';
import { signOutAction } from '@/lib/actions/role';
import { initials, formatNaira, formatDate } from '@/lib/utils';
import type { CustomerProfile } from '@/lib/data/profile.server';

interface Props {
  profile: CustomerProfile;
}

export function ProfileClient({ profile }: Props) {
  const toast = useToast();
  const [fname,  setFname]  = useState(profile.first_name);
  const [lname,  setLname]  = useState(profile.last_name);
  const [phone,  setPhone]  = useState(profile.phone ?? '');
  const [saving, setSaving] = useState(false);

  const fullName = `${fname} ${lname}`.trim();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/auth/customer/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ first_name: fname, last_name: lname, phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Update failed');
      toast.show({ tone: 'success', title: 'Profile updated', description: 'Your details have been saved.' });
    } catch (err) {
      toast.show({ tone: 'error', title: 'Update failed', description: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Account card */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        {/* Header band */}
        <div className="relative h-24 bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-400">
          <div className="absolute -bottom-10 left-6 h-20 w-20 overflow-hidden rounded-2xl border-4 border-white bg-[#042a36] shadow-lg">
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-white">
              {initials(fullName)}
            </div>
          </div>
        </div>

        <div className="pb-6 pl-32 pr-6 pt-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-ink">{fullName}</h1>
              <p className="mt-0.5 text-sm text-ink-3">{profile.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.pcn_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 ring-1 ring-teal-200">
                    <CheckCircle size={11} /> PCN Verified
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-bg-muted px-2.5 py-1 text-[11px] font-semibold text-ink-3">
                  <Shield size={11} /> {profile.customer_status}
                </span>
              </div>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="text-xs text-ink-4">Member since</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{formatDate(profile.member_since)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total orders',  value: profile.total_orders },
          { label: 'Total spent',   value: formatNaira(profile.total_spent) },
          { label: 'Company',       value: profile.company_name ?? '—' },
          { label: 'Referral code', value: profile.referral_code ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-line bg-white px-4 py-3.5">
            <p className="text-xs font-medium text-ink-3">{label}</p>
            <p className="num mt-1 truncate text-sm font-semibold text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Edit form */}
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="mb-5 text-sm font-semibold text-ink">Personal information</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="fname">
                <Input id="fname" value={fname} onChange={(e) => setFname(e.target.value)} />
              </Field>
              <Field label="Last name" htmlFor="lname">
                <Input id="lname" value={lname} onChange={(e) => setLname(e.target.value)} />
              </Field>
            </div>
            <Field label="Email address" htmlFor="email">
              <Input id="email" type="email" value={profile.email} readOnly
                className="cursor-not-allowed opacity-60" />
            </Field>
            <Field label="Phone number" htmlFor="phone">
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Button type="submit" loading={saving} fullWidth>Save changes</Button>
          </form>
        </section>

        {/* Read-only info */}
        <section className="space-y-4">
          {/* Business info */}
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Business details</h2>
            <div className="space-y-3">
              {[
                { Icon: Building, label: 'Company',       value: profile.company_name ?? '—' },
                { Icon: MapPin,   label: 'Address',        value: [profile.address, profile.city, profile.state].filter(Boolean).join(', ') || '—' },
                { Icon: Shield,   label: 'PCN Certificate', value: profile.pcn_verified ? 'Verified ✓' : profile.pcn_certificate_url ? 'Under review' : 'Not uploaded' },
              ].map(({ Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-muted">
                    <Icon size={14} className="text-ink-3" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-ink-4">{label}</p>
                    <p className="text-sm font-medium text-ink">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Account</h2>
            <form action={signOutAction}>
              <Button type="submit" variant="danger" fullWidth>Sign out</Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
