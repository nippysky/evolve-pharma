import { redirect }   from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db }         from '@/lib/db';
import CheckoutClient from './CheckoutClient';

export default async function CheckoutPage() {
  const session = await getSession();

  // Guard: must be a signed-in customer
  if (!session || session.role !== 'CUSTOMER') {
    redirect('/sign-in');
  }

  // Fetch profile data for pre-filling delivery fields
  const profile = await db.customer.findUnique({
    where:  { user_id: session.userId },
    select: {
      state: true,
      city:  true,
      address: true,
      user:  { select: { phone: true } },
    },
  });

  return (
    <CheckoutClient
      userEmail={session.email}
      prefill={{
        state:         profile?.state         ?? '',
        city:          profile?.city          ?? '',
        street_address: profile?.address      ?? '',
        contact_phone: profile?.user?.phone   ?? '',
      }}
    />
  );
}
