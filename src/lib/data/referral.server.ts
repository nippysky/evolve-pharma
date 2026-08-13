import { db }               from '@/lib/db';
import { unstable_cache }   from 'next/cache';
import { getReferralSettings } from '@/lib/data/settings.server';
import {
  getReferralWallet, getReferralLedger, getReferredCustomers, getReferrer,
  type LedgerEntry, type ReferredCustomer,
} from '@/lib/referral';

/**
 * Referral data for the portal.
 *
 * Everything monetary here is naira — the wallet, both awards, and the
 * threshold. `Customer.referral_points` is a naira balance despite the column
 * name; see `src/lib/referral.ts` for why and what guarantees it.
 */

export interface ReferralProgramme {
  /** Naira credited to the referrer when a pharmacy signs up with their code. */
  signup_bonus:    number;
  /** Paid orders a referee must accumulate to trigger the second award. */
  spend_threshold: number;
  /** Naira credited once that threshold is crossed. */
  spend_reward:    number;
  /** Whether the business currently lets customers spend their balance. */
  redemption_enabled: boolean;
  /** Balance required before any of it can be spent. */
  min_redemption:  number;
}

export interface ReferralData {
  referral_code:   string | null;
  /** Naira balance. */
  referral_points: number;
  referral_count:  number;
  /** Naira that can actually be applied to an order right now. */
  redeemable:      number;
  programme:       ReferralProgramme;
  /** Who referred this customer, if anyone. */
  referred_by:     { id: number; name: string; code: string | null } | null;
  /** Pharmacies this customer referred. */
  referrals:       ReferredCustomer[];
  /** Credit history, newest first. */
  ledger:          LedgerEntry[];
}

async function _getReferralData(userId: number): Promise<ReferralData> {
  const settings = await getReferralSettings();

  const programme: ReferralProgramme = {
    signup_bonus:       Math.round(settings.signupBonus),
    spend_threshold:    settings.threshold,
    spend_reward:       Math.round(settings.reward),
    redemption_enabled: settings.redemptionEnabled,
    min_redemption:     settings.minRedemption,
  };

  const customer = await db.customer.findUnique({
    where:  { user_id: userId },
    select: { id: true, referral_code: true },
  });

  if (!customer?.referral_code) {
    return {
      referral_code: null, referral_points: 0, referral_count: 0,
      redeemable: 0, programme, referred_by: null, referrals: [], ledger: [],
    };
  }

  // Sequential, not Promise.all: serverless runs a connection pool of one, so
  // parallelism buys nothing and only adds acquire contention.
  const wallet    = await getReferralWallet(customer.id);
  const referrer  = await getReferrer(customer.id);
  const referrals = await getReferredCustomers(customer.id);
  const ledger    = await getReferralLedger(customer.id, 30);

  return {
    referral_code:   customer.referral_code,
    referral_points: wallet.balance,
    referral_count:  referrals.length,
    redeemable:      wallet.redeemable,
    programme,
    referred_by:     referrer,
    referrals,
    ledger,
  };
}

export const getReferralData = (userId: number) =>
  unstable_cache(
    () => _getReferralData(userId),
    [`referral-user-${userId}`],
    { tags: [`referral-user-${userId}`, 'profile'], revalidate: 60 },
  )();
