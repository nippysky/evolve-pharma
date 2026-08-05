import { Suspense }           from 'react';
import { redirect }           from 'next/navigation';
import { getSession }         from '@/lib/auth';
import { getReferralData }    from '@/lib/data/referral.server';
import { PageHead }           from '@/components/shared/PageHead';
import { ReferralClient }     from '@/components/portal/ReferralClient';
import { SITE }               from '@/lib/constants';

function ReferralSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-4">
      <div className="h-48 rounded-2xl border border-line bg-white" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-24 rounded-xl border border-line bg-white" />
        <div className="h-24 rounded-xl border border-line bg-white" />
      </div>
    </div>
  );
}

async function ReferralData({ userId }: { userId: number }) {
  const data       = await getReferralData(userId);
  const shareLink  = `${SITE.url}/sign-up${data.referral_code ? `?ref=${data.referral_code}` : ''}`;
  return <ReferralClient data={data} shareLink={shareLink} />;
}

export default async function ReferralPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'CUSTOMER') redirect('/admin/overview');

  return (
    <>
      <PageHead
        title="Referrals"
        subtitle="Share your referral code — earn points every time a new customer signs up with it."
      />
      <Suspense fallback={<ReferralSkeleton />}>
        <ReferralData userId={session.userId} />
      </Suspense>
    </>
  );
}
