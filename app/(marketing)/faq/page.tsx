'use client';

import { useState } from 'react';
import { Container, Section } from '@/components/ui/Layout';
import { ChevronDown } from '@/components/icons';
import { cn } from '@/lib/utils';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Who can sign up for Envolve?',
    a: 'Envolve is exclusively for licensed Nigerian community pharmacies. During sign-up you upload your PCN (Pharmacists Council of Nigeria) certificate. Once verified — typically within 24 hours — your account is activated for ordering.',
  },
  {
    q: 'How is product authenticity guaranteed?',
    a: 'We onboard manufacturers directly, not through middlemen. Every batch in our warehouse is logged with manufacture and expiry dates. Each delivery includes a verification slip you can scan to confirm the batch number against our records.',
  },
  {
    q: 'What payment methods are supported?',
    a: 'We accept Paystack (cards, bank transfer, USSD), direct bank transfer, and cash-on-delivery for verified accounts above a certain order value. All transactions are reconciled in your dashboard within minutes.',
  },
  {
    q: 'How fast is delivery?',
    a: 'Within Abuja, we offer same-day dispatch on orders placed before 14:00 WAT. For other states, expect 24–72 hours via our in-house fleet or vetted logistics partners. Cold-chain products are routed through specialized handlers.',
  },
  {
    q: 'Is there a minimum order?',
    a: 'No. You can order a single pack or a full carton. Bulk pricing tiers kick in automatically — visible at checkout — with no negotiation needed.',
  },
  {
    q: 'How do sales agents fit in?',
    a: 'Sales agents are field reps who help onboard pharmacies, especially in regions where digital verification is friction-heavy. Agents do not see pricing or place orders on a customer\'s behalf without explicit authorization.',
  },
  {
    q: 'What if a product arrives damaged or expired?',
    a: 'Photograph the issue and report it via the order page within 48 hours. Our quality team will arrange a replacement or refund — no negotiation needed for verified shipping or batch issues.',
  },
  {
    q: 'Can I integrate Envolve with my pharmacy software?',
    a: 'A read-only API for orders and invoices is in private beta. Reach out via the Contact page and our team will share access details.',
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section tight>
      <Container narrow>
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
            Help center
          </span>
          <h1 className="display-serif mt-3 text-[clamp(2rem,5vw,3.25rem)] leading-[1.1] tracking-[-0.02em] text-ink">
            Frequently asked questions.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-2">
            Quick answers to the questions community pharmacies most often raise. For anything
            else, reach our team directly.
          </p>
        </div>

        <ul className="mt-14 border-t border-line-subtle">
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <li key={faq.q} className="border-b border-line-subtle">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left text-base font-medium tracking-tight text-ink transition-colors hover:text-brand-600"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={18}
                    className={cn('shrink-0 text-ink-3 transition-transform duration-300', isOpen && 'rotate-180')}
                  />
                </button>
                <div
                  className={cn(
                    'grid overflow-hidden transition-[grid-template-rows,padding] duration-300 ease-out',
                    isOpen ? 'grid-rows-[1fr] pb-7' : 'grid-rows-[0fr]',
                  )}
                >
                  <div className="min-h-0">
                    <p className="max-w-[64ch] text-sm leading-relaxed text-ink-2">{faq.a}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
