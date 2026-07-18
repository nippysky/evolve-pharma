/**
 * Header — sticky top nav for the e-commerce site.
 * Commerce-first, minimal, and premium.
 *
 * Marketing pages live on the main brand site. This header keeps the shop
 * experience focused: catalog discovery, account access, and pharmacy onboarding.
 */

'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Logo } from '@/components/shared/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Layout';
import {
  ArrowRight,
  Basket,
  Lock,
  Menu,
  Search,
  Shield,
  Truck,
  X,
} from '@/components/icons';
import { cn } from '@/lib/utils';

const DRAWER_ID = 'mobile-commerce-drawer';

const commerceHighlights = [
  {
    label: 'Verified supply',
    description: 'Licensed pharmaceutical distribution',
    icon: Shield,
  },
  {
    label: 'Fast ordering',
    description: 'Built for pharmacies and buyers',
    icon: Truck,
  },
  {
    label: 'Secure access',
    description: 'Protected account checkout flow',
    icon: Lock,
  },
];

function subscribeToScroll(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener('scroll', callback, { passive: true });

  return () => {
    window.removeEventListener('scroll', callback);
  };
}

function getScrollSnapshot() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.scrollY > 8;
}

function getServerScrollSnapshot() {
  return false;
}

export function Header() {
  const scrolled = useSyncExternalStore(
    subscribeToScroll,
    getScrollSnapshot,
    getServerScrollSnapshot,
  );

  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header
        className={cn(
          'sticky top-0 z-40 border-b transition-[border-color,box-shadow,background-color] duration-300',
          'glass',
          scrolled
            ? 'border-line-subtle shadow-[0_18px_50px_rgba(15,23,42,0.06)]'
            : 'border-transparent shadow-none',
        )}
      >
        <Container>
          <div className="flex h-header items-center justify-between gap-3">
            <Link
              href="/"
              aria-label="Envolve home"
              className="group inline-flex shrink-0 items-center rounded-full outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand-300/70 focus-visible:ring-offset-2"
            >
              <Logo height={30} className="sm:h-8 lg:h-9" />
            </Link>

            <div className="flex items-center gap-2">
              <nav className="hidden items-center md:flex" aria-label="Primary navigation">
                <Link
                  href="/products"
                  className={cn(
                    'group inline-flex items-center gap-2 rounded-full border border-line-subtle bg-white/70 px-3.5 py-2 text-sm font-medium text-ink-2',
                    'shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl transition-all duration-200',
                    'hover:-translate-y-0.5 hover:border-line hover:bg-white hover:text-ink hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70 focus-visible:ring-offset-2',
                  )}
                >
                  <span className="grid size-7 place-items-center rounded-full bg-bg-muted text-ink transition-colors group-hover:bg-ink group-hover:text-white">
                    <Basket size={15} />
                  </span>
                  <span>Catalog</span>
                  <span className="hidden text-ink-4 lg:inline">Browse products</span>
                </Link>
              </nav>

              <div className="hidden items-center gap-2 md:flex">
                <ButtonLink href="/sign-in" variant="ghost" size="sm">
                  Sign in
                </ButtonLink>

                <ButtonLink href="/sign-up" size="sm" trailingIcon={<ArrowRight size={14} />}>
                  Get started
                </ButtonLink>
              </div>

              <div className="flex items-center gap-2 md:hidden">
                <Link
                  href="/products"
                  aria-label="Open catalog"
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-full border border-line-subtle bg-white/75 px-3 text-sm font-medium text-ink',
                    'shadow-[0_8px_22px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-200',
                    'hover:border-line hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70 focus-visible:ring-offset-2',
                  )}
                >
                  <Basket size={15} />
                  <span className="hidden min-[390px]:inline">Catalog</span>
                </Link>

                <Link
                  href="/sign-up"
                  className={cn(
                    'hidden h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(15,23,42,0.18)] transition-all duration-200',
                    'hover:-translate-y-0.5 hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70 focus-visible:ring-offset-2 sm:inline-flex',
                  )}
                >
                  Start
                </Link>

                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className={cn(
                    'grid h-10 w-10 place-items-center rounded-full border border-line-subtle bg-white/75 text-ink',
                    'shadow-[0_8px_22px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-200',
                    'hover:border-line hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70 focus-visible:ring-offset-2',
                  )}
                  aria-label="Open menu"
                  aria-controls={DRAWER_ID}
                  aria-expanded={drawerOpen}
                >
                  <Menu size={18} />
                </button>
              </div>
            </div>
          </div>
        </Container>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px] animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />

          <aside
            id={DRAWER_ID}
            className={cn(
              'absolute inset-y-0 right-0 flex w-[min(390px,92vw)] flex-col overflow-hidden bg-white shadow-2xl animate-slide-in-right',
              'border-l border-line-subtle',
            )}
            aria-label="Mobile navigation"
          >
            <div className="relative flex min-h-full flex-col">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-linear-to-b from-bg-muted via-white to-transparent" />
              <div className="pointer-events-none absolute -right-20 top-12 size-56 rounded-full bg-brand-300/20 blur-3xl" />

              <div className="relative flex items-center justify-between border-b border-line-subtle px-5 py-4">
                <Link
                  href="/"
                  aria-label="Envolve home"
                  onClick={() => setDrawerOpen(false)}
                  className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70 focus-visible:ring-offset-2"
                >
                  <Logo height={28} />
                </Link>

                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-line-subtle bg-white text-ink-3 transition-colors hover:bg-bg-muted hover:text-ink"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="relative flex-1 overflow-y-auto px-5 py-6">
                <div className="rounded-[28px] border border-line-subtle bg-white/80 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                  <div className="flex items-start gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink text-white">
                      <Basket size={19} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-4">
                        Commerce portal
                      </p>
                      <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
                        Order pharmaceutical supplies with confidence.
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-ink-2">
                        Browse available products, access your account, or onboard your pharmacy.
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/products"
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      'mt-5 flex items-center justify-between rounded-2xl border border-line-subtle bg-bg-subtle p-3.5 text-ink transition-all duration-200',
                      'hover:-translate-y-0.5 hover:border-line hover:bg-white hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70 focus-visible:ring-offset-2',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-white text-ink shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                        <Search size={17} />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">Browse catalog</span>
                        <span className="mt-0.5 block text-xs text-ink-3">
                          Find products and start ordering
                        </span>
                      </span>
                    </span>

                    <ArrowRight size={16} className="text-ink-3" />
                  </Link>
                </div>

                <div className="mt-5 grid gap-2">
                  {commerceHighlights.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.label}
                        className="flex items-center gap-3 rounded-2xl border border-line-subtle bg-white/75 p-3"
                      >
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-bg-muted text-ink">
                          <Icon size={17} />
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{item.label}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative border-t border-line-subtle bg-white/95 px-5 pb-5 pt-4">
                <div className="flex flex-col gap-2">
                  <ButtonLink
                    href="/sign-up"
                    fullWidth
                    trailingIcon={<ArrowRight size={14} />}
                    onClick={() => setDrawerOpen(false)}
                  >
                    Get started
                  </ButtonLink>

                  <ButtonLink
                    href="/sign-in"
                    variant="secondary"
                    fullWidth
                    onClick={() => setDrawerOpen(false)}
                  >
                    Sign in
                  </ButtonLink>
                </div>

                <p className="mt-4 text-center text-xs leading-relaxed text-ink-3">
                  EnvolveCare Express · Lagos, Nigeria
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}