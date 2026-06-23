'use client';

import { useActionState } from 'react';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { PageHead } from '@/components/shared/PageHead';
import { CheckCircle, AlertTriangle, Logout, Shield } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { useUser } from '@/contexts/UserContext';
import { updateProfileAction } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';
import { initials } from '@/lib/utils';

const initial: ActionResult = { ok: false, message: '' };

export default function ProfilePage() {
  const { user, isLoading } = useUser();
  const toast = useToast();

  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await updateProfileAction(prev, fd);
    if (r.ok) toast.show({ tone: 'success', title: 'Profile updated' });
    else toast.show({ tone: 'error', title: 'Update failed', description: r.message });
    return r;
  }, initial);

  const fieldErrors = !state.ok ? state.fieldErrors : undefined;
  const error = !state.ok && !fieldErrors ? state.message : '';

  const fullName = user ? `${user.first_name} ${user.last_name ?? ''}`.trim() : '';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <PageHead title="Profile & settings" subtitle="Manage personal details and pharmacy information." />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <form action={action} className="rounded-xl border border-line bg-white p-7" noValidate>
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-danger-soft px-3.5 py-3 text-sm text-red-800">
                <AlertTriangle size={14} className="mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <h2 className="text-base font-medium tracking-tight text-ink">Personal details</h2>
            <p className="mb-6 mt-1 text-sm text-ink-3">
              This is the info we use when contacting you about your orders.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name" htmlFor="fname" required error={fieldErrors?.fname?.[0]}>
                <Input id="fname" name="fname" defaultValue={user?.first_name ?? ''} required />
              </Field>
              <Field label="Last name" htmlFor="lname" required error={fieldErrors?.lname?.[0]}>
                <Input id="lname" name="lname" defaultValue={user?.last_name ?? ''} required />
              </Field>
            </div>

            <Field label="Email" htmlFor="email" hint="To change email, contact support.">
              <Input id="email" name="email" defaultValue={user?.email ?? ''} disabled />
            </Field>

            <Field label="Phone" htmlFor="phone" required error={fieldErrors?.phone?.[0]}>
              <Input id="phone" name="phone" type="tel" defaultValue={user?.phone ?? ''} required />
            </Field>

            <div className="mt-2 flex justify-end">
              <Button type="submit" loading={pending} leadingIcon={<CheckCircle size={14} />}>
                Save changes
              </Button>
            </div>
          </form>

          <form action={action} className="rounded-xl border border-line bg-white p-7" noValidate>
            <h2 className="text-base font-medium tracking-tight text-ink">Pharmacy details</h2>
            <p className="mb-6 mt-1 text-sm text-ink-3">
              This information appears on your invoices and delivery slips.
            </p>

            <Field label="Pharmacy / company name">
              <Input defaultValue={user?.company_name ?? ''} disabled />
            </Field>

            <Field label="PCN certificate" hint="Contact support to update your certificate.">
              <div className="inline-flex items-center gap-2 rounded-md border border-line bg-bg-subtle px-3.5 py-2.5 text-sm text-ink">
                <Shield size={14} className="text-leaf-600" />
                <span>On file — pending verification</span>
              </div>
            </Field>

            {/* Hidden fields so Zod schema passes */}
            <input type="hidden" name="fname" value={user?.first_name ?? ''} />
            <input type="hidden" name="lname" value={user?.last_name ?? ''} />
            <input type="hidden" name="phone" value={user?.phone ?? ''} />

            <div className="mt-2 flex justify-end">
              <Button type="submit" loading={pending} leadingIcon={<CheckCircle size={14} />}>
                Save changes
              </Button>
            </div>
          </form>

          <div className="rounded-xl border border-line bg-white p-7">
            <h2 className="text-base font-medium tracking-tight text-ink">Sign out</h2>
            <p className="mb-6 mt-1 text-sm text-ink-3">
              You&apos;ll need to sign in again to access your account.
            </p>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                leadingIcon={<Logout size={14} />}
                onClick={() => (window.location.href = '/sign-in')}
              >
                Sign out of this device
              </Button>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-line bg-white p-6 text-center">
            <span className="mx-auto grid h-header w-header place-items-center rounded-full bg-linear-to-br from-brand-500 to-leaf-500 font-display text-2xl font-medium text-white">
              {fullName ? initials(fullName) : '?'}
            </span>
            <div className="mt-3.5 text-base font-medium tracking-tight text-ink">
              {fullName || '—'}
            </div>
            <div className="mt-1 text-sm text-ink-3">{user?.company_name ?? ''}</div>

            <dl className="mt-5 flex flex-col gap-2.5 border-t border-line-subtle pt-4 text-left">
              <div className="flex justify-between gap-2 text-sm">
                <dt className="text-ink-3">Email</dt>
                <dd className="truncate font-medium text-ink">{user?.email ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2 text-sm">
                <dt className="text-ink-3">Role</dt>
                <dd className="font-medium text-ink capitalize">{user?.role?.toLowerCase() ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2 text-sm">
                <dt className="text-ink-3">Account</dt>
                <dd className="font-medium text-leaf-600">Active</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}
