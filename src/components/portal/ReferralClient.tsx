'use client';

import { useState }       from 'react';
import type { ReferralData } from '@/lib/data/referral.server';
import { Star, Users, Copy, Check, ArrowRight } from '@/components/icons';
import { cn }             from '@/lib/utils';
import { REFERRAL_POINTS_PER_SIGNUP } from '@/lib/constants';

interface Props {
  data:      ReferralData;
  shareLink: string;
}

export function ReferralClient({ data, shareLink }: Props) {
  const [codeCopied,  setCodeCopied]  = useState(false);
  const [linkCopied,  setLinkCopied]  = useState(false);

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

  if (!data.referral_code) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-white p-8 text-center">
        <p className="text-sm text-ink-3">Your referral code is being generated. Please refresh the page in a moment.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">

      {/* Hero — code display */}
      <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-cyan-50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">Your referral code</p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-wider text-teal-800">
              {data.referral_code}
            </p>
            <p className="mt-1.5 text-sm text-teal-700/70">
              Share this code and earn <strong>{REFERRAL_POINTS_PER_SIGNUP} points</strong> for every new customer who signs up with it.
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
          Send this link to pharmacies and buyers. When they sign up, your referral code is applied automatically.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
            <Star size={18} className="text-amber-500" />
          </span>
          <div>
            <p className="text-2xl font-bold text-ink">{data.referral_points.toLocaleString()}</p>
            <p className="text-xs text-ink-3">Points earned</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50">
            <Users size={18} className="text-teal-600" />
          </span>
          <div>
            <p className="text-2xl font-bold text-ink">{data.referral_count}</p>
            <p className="text-xs text-ink-3">Successful referrals</p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="mb-4 text-sm font-semibold text-ink">How it works</p>
        <ol className="space-y-3">
          {[
            'Share your unique referral code or sign-up link with other pharmacies and buyers.',
            'They enter your code when registering on EnvolveCare Express.',
            `You earn ${REFERRAL_POINTS_PER_SIGNUP} points instantly — viewable right here.`,
            'Points can be redeemed for discounts on future orders (coming soon).',
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
