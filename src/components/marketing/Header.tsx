/**
 * Marketing Header — sticky top nav with mobile drawer.
 * Adds a hairline border once the user scrolls past the hero (subtle
 * "the page is now scrollable" cue, à la Vercel/Linear).
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/shared/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Layout';
import { Menu, X, ArrowRight } from '@/components/icons';
import { PUBLIC_NAV } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header
        className={cn(
          'sticky top-0 z-40 transition-[box-shadow,background] duration-200',
          'glass',
          scrolled ? 'border-b border-line-subtle' : 'border-b border-transparent',
        )}
      >
        <Container>
          <div className="flex h-[var(--spacing-header)] items-center justify-between gap-6">
            <Link href="/" aria-label="Envolve home">
              <Logo />
            </Link>

            <nav className="hidden items-center gap-7 md:flex">
              {PUBLIC_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-ink-2 transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-2 md:flex">
              <ButtonLink href="/sign-in" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/sign-up" size="sm" trailingIcon={<ArrowRight size={14} />}>
                Get started
              </ButtonLink>
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-md border border-line text-ink md:hidden"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </Container>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink/40 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(320px,80vw)] flex-col bg-white p-5 shadow-xl animate-slide-in-right">
            <div className="flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-md text-ink-3 hover:bg-bg-muted hover:text-ink"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="mt-8 flex flex-col gap-1">
              {PUBLIC_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-md px-3 py-3 text-base font-medium text-ink hover:bg-bg-subtle"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-2 pt-6">
              <ButtonLink href="/sign-in" variant="secondary" fullWidth onClick={() => setDrawerOpen(false)}>
                Sign in
              </ButtonLink>
              <ButtonLink href="/sign-up" fullWidth trailingIcon={<ArrowRight size={14} />} onClick={() => setDrawerOpen(false)}>
                Get started
              </ButtonLink>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
