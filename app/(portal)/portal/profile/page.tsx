/**
 * Portal — My Profile
 * Server wrapper → cached profile data → ProfileClient form.
 */

import { Suspense }           from 'react';
import { redirect }           from 'next/navigation';
import { getSession }         from '@/lib/auth';
import { getCustomerProfile } from '@/lib/data/profile.server';
import { PageHead }           from '@/components/shared/PageHead';
import { ProfileClient }      from '@/components/portal/ProfileClient';
import { User }               from '@/components/icons';

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-6">
      <div className="h-48 rounded-2xl border border-line bg-white" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl border border-line bg-white" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-2xl border border-line bg-white" />
        <div className="space-y-4">
          <div className="h-44 rounded-2xl border border-line bg-white" />
          <div className="h-24 rounded-2xl border border-line bg-white" />
        </div>
      </div>
    </div>
  );
}

async function ProfileData({ userId }: { userId: number }) {
  const profile = await getCustomerProfile(userId);
  if (!profile) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-bg-muted text-ink-4">
          <User size={24} />
        </div>
        <p className="text-sm font-medium text-ink-3">Could not load profile</p>
        <p className="text-xs text-ink-4">Please refresh or sign out and back in.</p>
      </div>
    );
  }
  return <ProfileClient profile={profile} />;
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'CUSTOMER') redirect('/admin/overview');

  return (
    <>
      <PageHead title="My profile" subtitle="Manage your account details and preferences." />
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileData userId={session.userId} />
      </Suspense>
    </>
  );
}
