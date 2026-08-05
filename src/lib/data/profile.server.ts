import { unstable_cache } from 'next/cache';
import { db }            from '@/lib/db';

export interface CustomerProfile {
  // From User
  userId:       number;
  first_name:   string;
  last_name:    string;
  email:        string;
  phone:        string | null;
  gender:       string | null;
  avatar_url:   string | null;
  member_since: string; // ISO date string
  // From Customer
  customerId:          number | null;
  company_name:        string | null;
  address:             string | null;
  city:                string | null;
  state:               string | null;
  pcn_certificate_url: string | null;
  pcn_verified:        boolean;
  referral_code:       string | null;
  customer_status:     string;
  // Computed
  total_orders:  number;
  total_spent:   number; // numeric
}

async function _fetchCustomerProfile(userId: number): Promise<CustomerProfile | null> {
  try {
    const user = await db.user.findUnique({
      where:   { id: userId },
      include: {
        customer: {
          include: {
            orders: {
              select: { total: true, payment_status: true },
            },
          },
        },
      },
    });

    if (!user) return null;

    const c = user.customer;
    const paidOrders  = (c?.orders ?? []).filter((o) => o.payment_status === 'PAID');
    const totalSpent  = paidOrders.reduce((s, o) => s + Number(o.total), 0);

    return {
      userId:              user.id,
      first_name:          user.first_name,
      last_name:           user.last_name,
      email:               user.email,
      phone:               user.phone,
      gender:              user.gender,
      avatar_url:          user.avatar_url,
      member_since:        user.created_at.toISOString(),
      customerId:          c?.id ?? null,
      company_name:        c?.company_name ?? null,
      address:             c?.address ?? null,
      city:                c?.city ?? null,
      state:               c?.state ?? null,
      pcn_certificate_url: c?.pcn_certificate_url ?? null,
      pcn_verified:        c?.pcn_verified ?? false,
      referral_code:       c?.referral_code ?? null,
      customer_status:     c?.status ?? 'UNKNOWN',
      total_orders:        c?.orders?.length ?? 0,
      total_spent:         totalSpent,
    };
  } catch (err) {
    console.error('[profile.server] fetchCustomerProfile error:', err);
    return null;
  }
}

/** Customer profile — cached 5 minutes per user. */
export const getCustomerProfile = (userId: number) =>
  unstable_cache(
    () => _fetchCustomerProfile(userId),
    [`profile-user-${userId}`],
    { tags: ['profile', `profile-user-${userId}`], revalidate: 300 },
  )();
