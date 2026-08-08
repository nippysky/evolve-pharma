'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Logo } from '@/components/shared/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Layout';
import {ArrowRight, Basket, Lock, Menu, Search, Shield, Truck, X, ShoppingCart} from '@/components/icons';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/types';

interface HeaderProps {
  session?: SessionUser | null;
}

const DRAWER_ID = 'mobile-commerce-drawer';

const commerceHighlights = [
  { label: 'Verified supply',   description: 'Licensed pharmaceutical distribution',  icon: Shield },
  { label: 'Fast ordering',     description: 'Built for pharmacies and buyers',         icon: Truck },
  { label: 'Secure access',     description: 'Protected account checkout flow',         icon: Lock },
];

function subscribeToScroll(cb: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('scroll', cb, { passive: true });
  return () => window.removeEventListener('scroll', cb);
}
function getScrollSnapshot() {
  return typeof window !== 'undefined' ? window.scrollY > 8 : false;
}
function getServerScrollSnapshot() { return false; }

const DEMO_FALLBACK = {
  full_name: 'Adaeze Nwosu',
  email: 'adaeze.nwosu@greenleafpharmacy.ng',
};

function resolvedName(session: SessionUser): string {
  return session.full_name || DEMO_FALLBACK.full_name;
}
function resolvedEmail(session: SessionUser): string {
  return session.email || DEMO_FALLBACK.email;
}
function avatarInitials(session: SessionUser): string {
  const name = resolvedName(session);
  return name.split(' ').filter(Boolean).map((p) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}
function displayName(session: SessionUser): string {
  const full = resolvedName(session);
  if (full) return full.split(' ')[0] ?? full;
  return resolvedEmail(session).split('@')[0] ?? 'You';
}

export function Header({ session }: HeaderProps) {
  const isLoggedIn = !!session;
  const isCustomer = session?.role === 'CUSTOMER';
  const portalHref = isCustomer ? '/portal/catalog' : '/admin/overview';

  const scrolled = useSyncExternalStore(subscribeToScroll, getScrollSnapshot, getServerScrollSnapshot);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>

      <header
        className={cn(
          'sticky top-0 z-40 border-b transition-[border-color,box-shadow,background-color] duration-300 glass',
          scrolled ? 'border-line-subtle shadow-[0_18px_50px_rgba(15,23,42,0.06)]' : 'border-transparent shadow-none',
        )}
      >
        <Container>
          <div className="flex h-header items-center justify-between gap-3">
            {/* Logo */}
            <Link
              href="/"
              aria-label="Envolve home"
              className="group inline-flex shrink-0 items-center rounded-full outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand-300/70 focus-visible:ring-offset-2"
            >
              <Logo height={30} className="sm:h-8 lg:h-9" />
            </Link>

            <div className="flex items-center gap-2">
              {/* Catalog link — always visible on desktop */}
              <nav className="hidden items-center md:flex" aria-label="Primary navigation">
                <Link
                  href="/products"
                  className={cn(
                    'group inline-flex items-center gap-2 rounded-full border border-line-subtle bg-white/70 px-3.5 py-2 text-sm font-medium text-ink-2',
                    'shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl transition-all duration-200',
                    'hover:-translate-y-0.5 hover:border-line hover:bg-white hover:text-ink hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]',
                  )}
                >
                  <span className="grid size-7 place-items-center rounded-full bg-bg-muted text-ink transition-colors group-hover:bg-ink group-hover:text-white">
                    <Basket size={15} />
                  </span>
                  <span>Catalog</span>
                  <span className="hidden text-ink-4 lg:inline">Browse products</span>
                </Link>
              </nav>

              {/* Auth area — desktop */}
              <div className="hidden items-center gap-2 md:flex">
                {isLoggedIn ? (
                  /* ── Logged-in state ── */
                  <div className="flex items-center gap-2">
                    {/* "Welcome back" chip */}
                    <div className="flex items-center gap-2 rounded-full border border-line-subtle bg-white/70 px-3 py-1.5 backdrop-blur-xl">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-[10px] font-bold text-white shadow-sm">
                        {avatarInitials(session!)}
                      </span>
                      <span className="text-xs font-semibold text-ink-2">
                        Hi, {displayName(session!)}
                      </span>
                    </div>

                    {/* Go to portal */}
                    <Link
                      href={portalHref}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full bg-[#042a36] px-4 py-2 text-sm font-semibold text-white',
                        'shadow-[0_8px_24px_rgba(4,42,54,0.30)] transition-all duration-200',
                        'hover:-translate-y-0.5 hover:bg-teal-900 hover:shadow-[0_12px_32px_rgba(4,42,54,0.40)]',
                      )}
                    >
                      <ShoppingCart size={14} />
                      My portal
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                ) : (
                  /* ── Logged-out state ── */
                  <>
                    <ButtonLink href="/sign-in" variant="ghost" size="sm">Sign in</ButtonLink>
                    <ButtonLink href="/sign-up" size="sm" trailingIcon={<ArrowRight size={14} />}>Get started</ButtonLink>
                  </>
                )}
              </div>

              {/* Mobile: catalog + hamburger */}
              <div className="flex items-center gap-2 md:hidden">
                <Link
                  href="/products"
                  aria-label="Open catalog"
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-line-subtle bg-white/75 px-3 text-sm font-medium text-ink shadow-[0_8px_22px_rgba(15,23,42,0.06)] backdrop-blur-xl"
                >
                  <Basket size={15} />
                  <span className="hidden min-[390px]:inline">Catalog</span>
                </Link>

                {isLoggedIn ? (
                  <Link
                    href={portalHref}
                    className="hidden h-10 items-center gap-1.5 rounded-full bg-[#042a36] px-4 text-sm font-semibold text-white shadow-md sm:inline-flex"
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-400 text-[9px] font-bold text-[#042a36]">
                      {avatarInitials(session!)}
                    </span>
                    Portal
                  </Link>
                ) : (
                  <Link
                    href="/sign-up"
                    className="hidden h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(15,23,42,0.18)] transition-all sm:inline-flex hover:-translate-y-0.5 hover:bg-ink/90"
                  >
                    Start
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-line-subtle bg-white/75 text-ink shadow-[0_8px_22px_rgba(15,23,42,0.06)] backdrop-blur-xl"
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

      {/* ── Mobile drawer ── */}
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
            className="absolute inset-y-0 right-0 flex w-[min(390px,92vw)] flex-col overflow-hidden bg-white shadow-2xl border-l border-line-subtle animate-slide-in-right"
            aria-label="Mobile navigation"
          >
            <div className="relative flex min-h-full flex-col">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-linear-to-b from-bg-muted via-white to-transparent" />
              <div className="pointer-events-none absolute -right-20 top-12 size-56 rounded-full bg-brand-300/20 blur-3xl" />

              {/* Drawer header */}
              <div className="relative flex items-center justify-between border-b border-line-subtle px-5 py-4">
                <Link href="/" onClick={() => setDrawerOpen(false)} className="inline-flex">
                  <Logo height={28} />
                </Link>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-line-subtle bg-white text-ink-3 hover:bg-bg-muted hover:text-ink"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="relative flex-1 overflow-y-auto px-5 py-6">
                {/* Session chip inside drawer */}
                {isLoggedIn && (
                  <Link
                    href={portalHref}
                    onClick={() => setDrawerOpen(false)}
                    className="mb-4 flex items-center gap-3 rounded-2xl border border-teal-200 bg-gradient-to-br from-[#042a36] to-teal-900 p-4 text-white shadow-lg"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-400 text-lg font-bold text-[#042a36]">
                      {avatarInitials(session!)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300">Signed in as</p>
                      <p className="truncate text-sm font-semibold">{displayName(session!)}</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-teal-400 px-2.5 py-1 text-[10px] font-bold text-[#042a36]">
                      Portal <ArrowRight size={10} />
                    </div>
                  </Link>
                )}

                <div className="rounded-[28px] border border-line-subtle bg-white/80 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                  <div className="flex items-start gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink text-white">
                      <Basket size={19} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-4">Commerce portal</p>
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
                    className="mt-5 flex items-center justify-between rounded-2xl border border-line-subtle bg-bg-subtle p-3.5 text-ink hover:-translate-y-0.5 hover:border-line hover:bg-white hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition-all"
                  >
                    <span className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-white text-ink shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                        <Search size={17} />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">Browse catalog</span>
                        <span className="mt-0.5 block text-xs text-ink-3">Find products and start ordering</span>
                      </span>
                    </span>
                    <ArrowRight size={16} className="text-ink-3" />
                  </Link>
                </div>

                <div className="mt-5 grid gap-2">
                  {commerceHighlights.map(({ label, description, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-3 rounded-2xl border border-line-subtle bg-white/75 p-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-bg-muted text-ink">
                        <Icon size={17} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{label}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drawer footer */}
              <div className="relative border-t border-line-subtle bg-white/95 px-5 pb-5 pt-4">
                {isLoggedIn ? (
                  <div className="flex flex-col gap-2">
                    <Link
                      href={portalHref}
                      onClick={() => setDrawerOpen(false)}
                      className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#042a36] text-sm font-semibold text-white hover:bg-teal-900"
                    >
                      <ShoppingCart size={15} />
                      Go to my portal
                      <ArrowRight size={14} />
                    </Link>
                    <Link
                      href="/products"
                      onClick={() => setDrawerOpen(false)}
                      className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-line-subtle text-sm font-medium text-ink-2 hover:bg-bg-subtle"
                    >
                      <Basket size={14} />
                      Browse catalog
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <ButtonLink href="/sign-up" fullWidth trailingIcon={<ArrowRight size={14} />} onClick={() => setDrawerOpen(false)}>
                      Get started
                    </ButtonLink>
                    <ButtonLink href="/sign-in" variant="secondary" fullWidth onClick={() => setDrawerOpen(false)}>
                      Sign in
                    </ButtonLink>
                  </div>
                )}
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
