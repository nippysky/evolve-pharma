import { db }                  from '@/lib/db';
import { DEFAULT_REFERRAL_CODE } from '@/lib/constants';
import { unstable_cache }      from 'next/cache';

export interface ReferralData {
  referral_code:   string | null;
  referral_points: number;
  referral_count:  number;
}

async function _getReferralData(userId: number): Promise<ReferralData> {
  // 1. Get customer's referral code + points
  // referral_points: added in schema — run `npx prisma generate` if types lag
  const customer = await (db.customer.findUnique as any)({
    where:  { user_id: userId },
    select: { referral_code: true, referral_points: true },
  }) as { referral_code: string | null; referral_points: number } | null;

  if (!customer?.referral_code) {
    return { referral_code: null, referral_points: 0, referral_count: 0 };
  }

  // 2. Count how many others signed up using this code
  const referral_count = await db.customer.count({
    where: {
      referred_by: customer.referral_code,
    },
  });

  return {
    referral_code:   customer.referral_code,
    referral_points: customer.referral_points ?? 0,
    referral_count,
  };
}

export const getReferralData = (userId: number) =>
  unstable_cache(
    () => _getReferralData(userId),
    [`referral-user-${userId}`],
    { tags: [`referral-user-${userId}`], revalidate: 60 },
  )();
