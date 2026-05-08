/**
 * Home page — marketing landing.
 *
 * Sections:
 *   1. Hero with serif headline + dual CTAs + supporting collage
 *   2. Trust band (cities served)
 *   3. Three feature cards
 *   4. Four-step process with image
 *   5. Closing CTA gradient band
 */

import Image from 'next/image';
import Link from 'next/link';
import { Container, Section } from '@/components/ui/Layout';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Primitives';
import {
  ArrowRight,
  Shield,
  Truck,
  Sparkle,
  CheckCircle,
  Building,
  Pill,
  Box,
} from '@/components/icons';
import { SITE } from '@/lib/constants';
import { formatNaira } from '@/lib/utils';

const CITIES = ['Abuja', 'Lagos', 'Port Harcourt', 'Kano', 'Ibadan', 'Enugu'];

const FEATURES = [
  {
    Icon: Shield,
    title: 'Authentic, batch-verified medicines',
    body:
      'Every order is sourced direct from manufacturers and tagged with batch and expiry data. Counterfeits never reach your shelves.',
  },
  {
    Icon: Truck,
    title: 'In-house cold-chain logistics',
    body:
      'Same-day dispatch in Abuja and 24–72hr nationwide via vetted partners. Cold-chain SKUs ride in temperature-monitored vans.',
  },
  {
    Icon: Sparkle,
    title: 'Pricing that doesn\'t play games',
    body:
      'No haggling, no wholesaler markups stacked five-deep. Bulk tiers are transparent and apply automatically at checkout.',
  },
];

const STEPS = [
  { n: '01', t: 'Sign up & verify', d: 'Upload your PCN certificate. Verified within 24 hours.' },
  { n: '02', t: 'Browse the catalog', d: 'Live pricing, stock, and expiry data. No phone calls needed.' },
  { n: '03', t: 'Place an order', d: 'Pay via Paystack, transfer, or COD for trusted accounts.' },
  { n: '04', t: 'Track to your door', d: 'Real-time updates, batch verification, and a clean tax invoice.' },
];

export default function HomePage() {
  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        {/* Subtle ambient gradient behind the hero */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_15%_-10%,rgba(0,166,212,0.10),transparent_60%),radial-gradient(700px_300px_at_85%_10%,rgba(22,163,74,0.07),transparent_60%)]"
        />
        <Container>
          <div className="grid gap-12 pb-16 pt-20 sm:pt-28 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="flex flex-col justify-center">
              <Badge tone="brand" className="self-start">
                <span className="h-1.5 w-1.5 rounded-full bg-leaf-500" />
                Built for Nigerian pharmacies
              </Badge>

              <h1 className="display-serif mt-5 text-[clamp(2.4rem,5vw,4.25rem)] leading-[1.05] tracking-[-0.02em] text-ink">
                Pharmaceutical wholesale,{' '}
                <span className="italic text-brand-600">quietly modernized</span>.
              </h1>

              <p className="mt-6 max-w-[44ch] text-base leading-relaxed text-ink-2">
                Envolve is the procurement platform for licensed Nigerian pharmacies.
                Authentic medicines, transparent pricing, in-house logistics — all the
                infrastructure of a national distributor, none of the friction.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <ButtonLink href="/sign-up" size="lg" trailingIcon={<ArrowRight size={16} />}>
                  Onboard your pharmacy
                </ButtonLink>
                <ButtonLink href="/products" size="lg" variant="secondary">
                  Browse catalog
                </ButtonLink>
              </div>

              <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-leaf-500" /> NAFDAC-registered
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-leaf-500" /> PCN-verified pharmacies only
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-leaf-500" /> Paystack secured
                </li>
              </ul>
            </div>

            {/* Collage */}
            <div className="relative">
              <div className="grid grid-cols-12 grid-rows-6 gap-3 sm:gap-4">
                <div className="col-span-8 row-span-4 overflow-hidden rounded-2xl border border-line bg-white shadow-md">
                  <Image
                    src="https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=900&q=80"
                    alt="Pharmacist organizing medicine"
                    width={900}
                    height={600}
                    className="h-full w-full object-cover"
                    priority
                  />
                </div>
                <div className="col-span-4 row-span-3 flex flex-col justify-between rounded-2xl border border-line bg-white p-4 shadow-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                    Lifetime spend
                  </span>
                  <div>
                    <div className="font-display text-2xl tracking-tight text-ink num">
                      {formatNaira(1_485_400)}
                    </div>
                    <div className="mt-0.5 text-xs text-leaf-600">+12.4% mtd</div>
                  </div>
                </div>
                <div className="col-span-4 row-span-3 flex flex-col justify-between rounded-2xl border border-line bg-ink p-4 text-white shadow-md">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                    EVP-2025-00148
                  </span>
                  <div>
                    <div className="text-sm font-medium">Out for delivery</div>
                    <div className="mt-0.5 text-xs text-white/60">ETA today, 14:32</div>
                  </div>
                  <Truck size={18} className="self-end text-white/80" />
                </div>
                <div className="col-span-8 row-span-2 flex items-center justify-between rounded-2xl border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-50 text-brand-600">
                      <Pill size={16} />
                    </span>
                    <div>
                      <div className="text-sm font-medium tracking-tight text-ink">Paracetamol 500mg</div>
                      <div className="text-xs text-ink-3">×120 packs · ₦144,000</div>
                    </div>
                  </div>
                  <Badge tone="success" noDot>
                    Paid
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------- Trust band ---------- */}
      <Container>
        <div className="flex flex-col items-center gap-4 border-y border-line-subtle py-8 sm:flex-row sm:justify-between">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink-3">
            Serving 320+ pharmacies across
          </span>
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-medium text-ink-2">
            {CITIES.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </Container>

      {/* ---------- Features ---------- */}
      <Section>
        <Container>
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
              Why Envolve
            </span>
            <h2 className="display-serif mt-3 text-[clamp(1.875rem,4vw,3rem)] leading-[1.1] tracking-tight text-ink">
              Wholesale shouldn&apos;t feel like detective work.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-2">
              We replace the spreadsheets, WhatsApp threads, and middleman markups with one
              clean platform — built specifically for the regulatory and logistical realities
              of operating a pharmacy in Nigeria.
            </p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {FEATURES.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-line bg-white p-7 transition-colors hover:border-line-strong">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-lg font-medium tracking-tight text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* ---------- Process ---------- */}
      <Section>
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-md">
              <Image
                src="https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=900&q=80"
                alt="Modern pharmacy interior"
                width={900}
                height={700}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
                How it works
              </span>
              <h2 className="display-serif mt-3 text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.15] tracking-tight text-ink">
                From signup to your shelf in four steps.
              </h2>

              <ol className="mt-10 flex flex-col gap-7">
                {STEPS.map((s) => (
                  <li key={s.n} className="flex gap-5">
                    <span className="font-display text-2xl tracking-tight text-brand-500 num">
                      {s.n}
                    </span>
                    <div>
                      <h3 className="text-base font-medium tracking-tight text-ink">{s.t}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Container>
      </Section>

      {/* ---------- CTA ---------- */}
      <Section>
        <Container>
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-500 via-brand-600 to-leaf-600 p-10 text-white sm:p-16">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(700px_300px_at_85%_120%,rgba(255,255,255,0.18),transparent_60%)]"
            />
            <div className="relative">
              <h2 className="display-serif max-w-2xl text-[clamp(1.875rem,4vw,3rem)] leading-[1.1] tracking-tight">
                Ready to make procurement the easiest part of your week?
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85">
                Onboard in 24 hours. No setup fees, no minimums, no contracts.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink
                  href="/sign-up"
                  size="lg"
                  className="bg-white! text-ink! hover:bg-bg-subtle!"
                  trailingIcon={<ArrowRight size={16} />}
                >
                  Onboard your pharmacy
                </ButtonLink>
                <Link
                  href="/contact"
                  className="inline-flex h-12 items-center gap-2 rounded-md border border-white/20 px-5 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  Talk to our team
                </Link>
              </div>
              <div className="mt-12 flex items-center gap-6 text-sm text-white/70">
                <span className="flex items-center gap-2">
                  <Building size={14} /> {SITE.address.split(',')[0]}
                </span>
                <span className="flex items-center gap-2">
                  <Box size={14} /> 14 categories · 1,400+ SKUs
                </span>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
