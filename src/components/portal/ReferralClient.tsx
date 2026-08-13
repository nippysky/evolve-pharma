'use client';

import { useState }          from 'react';
import type { ReferralData } from '@/lib/data/referral.server';
import { Star, Users, Copy, Check } from '@/components/icons';
import { cn, formatNaira, formatDate } from '@/lib/utils';

/**
 * Referral panel.
 *
 * The balance is naira, not points — both awards credit money into one wallet,
 * and that wallet becomes spendable at checkout once the business enables it.
 *
 * Three things this shows that the old panel didn't:
 *
 *   • **Who referred you.** Attribution runs both ways now, so a pharmacy can
 *     see who brought them in as well as who they brought.
 *   • **What each referral earned.** A count alone doesn't explain a balance;
 *     naming the pharmacy beside the amount does.
 *   • **The ledger.** Every credit and every redemption, so the number at the
 *     top is never something the customer has to take on trust.
 */

interface Props {
  data:      ReferralData;
  shareLink: string;
}

const STATUS_LABEL: Record<string, string> = {
  APPROVED:          'Active',
  PENDING_REVIEW:    'Awaiting review',
  PCN_CERT_UPLOADED: 'Cert uploaded',
  OTP_CONFIRMED:     'Email confirmed',
  REGISTERED:        'Registered',
  REJECTED:          'Rejected',
};

export function ReferralClient({ data, shareLink }: Props) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  function copyToClipboard(text: string, which: 'code' | 'link') {
    navigator.clipboard.writeText(text).then(() => {
      if (which === 'code') {
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      } else {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    }).catch(() => {/* silent */});
  }

  const p = data.programme;

  if (!data.referral_code) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-white p-8 text-center">
        <p className="text-sm text-ink-3">
          Your referral code is issued once your pharmacy account is approved.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">

      {/* Hero — the code */}
      <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-cyan-50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">
              Your referral code
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-wider text-teal-800">
              {data.referral_code}
            </p>
            <p className="mt-1.5 max-w-md text-sm text-teal-700/70">
              Earn <strong>{formatNaira(p.signup_bonus)}</strong> the moment a pharmacy
              signs up with it, then <strong>{formatNaira(p.spend_reward)}</strong> more
              once their paid orders reach {formatNaira(p.spend_threshold)}.
            </p>
          </div>

          <button
            onClick={() => copyToClipboard(data.referral_code!, 'code')}
            title="Copy code"
            className={cn(
              'shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              codeCopied
                ? 'bg-teal-600 text-white'
                : 'bg-white text-teal-700 border border-teal-200 hover:bg-teal-50',
            )}
          >
            {codeCopied ? <Check size={14} /> : <Copy size={14} />}
            {codeCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Wallet */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex items-center gap-4 px-5 py-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50">
            <Star size={20} className="text-amber-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold text-ink">{formatNaira(data.referral_points)}</p>
            <p className="text-xs text-ink-3">Reward balance</p>
          </div>
          <div className="flex items-center gap-2 text-right">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50">
              <Users size={16} className="text-teal-600" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{data.referral_count}</p>
              <p className="text-xs text-ink-3">
                {data.referral_count === 1 ? 'referred' : 'referred'}
              </p>
            </div>
          </div>
        </div>

        {/* Whether it can be spent — the business decides, so say which it is. */}
        <div className={cn(
          'border-t px-5 py-3 text-xs',
          p.redemption_enabled
            ? 'border-teal-100 bg-teal-50/60 text-teal-800'
            : 'border-line bg-bg-muted text-ink-3',
        )}>
          {p.redemption_enabled ? (
            data.redeemable > 0 ? (
              <>
                <strong>{formatNaira(data.redeemable)}</strong> can be applied to your next
                order at checkout.
              </>
            ) : (
              <>
                Reach {formatNaira(p.min_redemption)} to start spending your balance at
                checkout.
              </>
            )
          ) : (
            <>
              Your balance keeps growing. Spending it against orders will be switched on
              soon — nothing expires in the meantime.
            </>
          )}
        </div>
      </div>

      {/* Who referred you */}
      {data.referred_by && (
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-ink">Who referred you</p>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-muted text-xs font-bold text-ink-2">
              {data.referred_by.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">{data.referred_by.name}</p>
              {data.referred_by.code && (
                <p className="truncate font-mono text-xs text-ink-3">{data.referred_by.code}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shareable link */}
      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-ink">Shareable sign-up link</p>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-line bg-bg-muted px-3 py-2">
            <p className="truncate font-mono text-xs text-ink-2">{shareLink}</p>
          </div>
          <button
            onClick={() => copyToClipboard(shareLink, 'link')}
            title="Copy link"
            className={cn(
              'shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              linkCopied
                ? 'bg-teal-600 text-white'
                : 'bg-white text-ink border border-line hover:bg-bg-muted',
            )}
          >
            {linkCopied ? <Check size={14} /> : <Copy size={14} />}
            {linkCopied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Your code is applied automatically when someone signs up through this link.
        </p>
      </div>

      {/* Pharmacies you referred */}
      {data.referrals.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <p className="border-b border-line px-5 py-4 text-sm font-semibold text-ink">
            Pharmacies you referred
          </p>
          <ul className="divide-y divide-line">
            {data.referrals.map(r => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{r.name}</p>
                  <p className="text-xs text-ink-3">
                    {STATUS_LABEL[r.status] ?? r.status.toLowerCase()} · joined {formatDate(r.joined_at)}
                  </p>
                </div>
                <span className={cn(
                  'shrink-0 text-sm font-semibold',
                  r.reward_earned > 0 ? 'text-teal-700' : 'text-ink-4',
                )}>
                  {r.reward_earned > 0 ? `+${formatNaira(r.reward_earned)}` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ledger */}
      {data.ledger.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <p className="border-b border-line px-5 py-4 text-sm font-semibold text-ink">
            Balance history
          </p>
          <ul className="divide-y divide-line">
            {data.ledger.map(entry => (
              <li key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{entry.description}</p>
                  <p className="text-xs text-ink-3">{formatDate(entry.created_at)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn(
                    'text-sm font-semibold',
                    entry.delta > 0 ? 'text-teal-700' : 'text-ink-2',
                  )}>
                    {entry.delta > 0 ? '+' : '−'}{formatNaira(Math.abs(entry.delta))}
                  </p>
                  <p className="text-xs text-ink-4">{formatNaira(entry.balance_after)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="mb-4 text-sm font-semibold text-ink">How it works</p>
        <ol className="space-y-3">
          {[
            'Share your code or sign-up link with another pharmacy.',
            `They register with it — you earn ${formatNaira(p.signup_bonus)} straight away, before they order anything.`,
            `Once their paid orders reach ${formatNaira(p.spend_threshold)}, you earn a further ${formatNaira(p.spend_reward)}. Paid once per pharmacy.`,
            p.redemption_enabled
              ? 'Apply your balance against any order at checkout.'
              : 'Your balance is held until spending is enabled — it never expires.',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-700">
                {i + 1}
              </span>
              <p className="text-sm text-ink-2">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
