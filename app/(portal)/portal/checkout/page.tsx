import { redirect }        from 'next/navigation';
import { getSession }      from '@/lib/auth';
import { db }              from '@/lib/db';
import { getVatSettings }  from '@/lib/data/settings.server';
import CheckoutClient      from './CheckoutClient';

export default async function CheckoutPage() {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    redirect('/sign-in');
  }

  const [profile, vatSettings] = await Promise.all([
    db.customer.findUnique({
      where:  { user_id: session.userId },
      select: {
        state:   true,
        city:    true,
        address: true,
        user:    { select: { phone: true } },
      },
    }),
    getVatSettings(),
  ]);

  return (
    <CheckoutClient
      userEmail={session.email}
      vatEnabled={vatSettings.enabled}
      vatRate={vatSettings.rate}
      prefill={{
        state:          profile?.state       ?? '',
        city:           profile?.city        ?? '',
        street_address: profile?.address     ?? '',
        contact_phone:  profile?.user?.phone ?? '',
      }}
    />
  );
}
