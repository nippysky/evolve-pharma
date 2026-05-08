/**
 * Marketing Footer — 4-column layout with brand block, link groups,
 * and a bottom strip with legal + region. The shimmering gradient
 * underline at the very bottom mirrors the hero's accent line.
 */

import Link from 'next/link';
import { Logo } from '@/components/shared/Logo';
import { Container } from '@/components/ui/Layout';
import { Mail, Phone, MapPin } from '@/components/icons';
import { SITE } from '@/lib/constants';

const NAV = {
  Platform: [
    { label: 'How it works', href: '/about' },
    { label: 'Catalog', href: '/products' },
    { label: 'For pharmacies', href: '/sign-up' },
    { label: 'For agents', href: '/sign-up/agent' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'FAQ', href: '/faq' },
  ],
  Legal: [
    { label: 'Terms of service', href: '/legal' },
    { label: 'Privacy policy', href: '/legal' },
    { label: 'Cookies', href: '/legal' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-line-subtle bg-bg">
      <Container>
        <div className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-2">
              A B2B pharmaceutical commerce platform for licensed Nigerian pharmacies.
              Authentic medicines. Transparent pricing. In-house logistics.
            </p>
            <ul className="mt-6 flex flex-col gap-2 text-sm text-ink-2">
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-ink-3" />
                <a href={`mailto:${SITE.email}`} className="hover:text-ink">
                  {SITE.email}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-ink-3" />
                <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="hover:text-ink">
                  {SITE.phone}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 text-ink-3" />
                <span>{SITE.address}</span>
              </li>
            </ul>
          </div>

          {Object.entries(NAV).map(([title, items]) => (
            <div key={title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                {title}
              </h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {items.map((it) => (
                  <li key={it.label}>
                    <Link
                      href={it.href}
                      className="text-sm text-ink-2 transition-colors hover:text-ink"
                    >
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-line-subtle py-6 text-xs text-ink-3 sm:flex-row">
          <span>© {new Date().getFullYear()} Envolve Pharmaceuticals Ltd. All rights reserved.</span>
          <span>Abuja, Nigeria 🇳🇬 · Licensed by PCN</span>
        </div>
      </Container>

      {/* Bottom accent shimmer */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-brand-300 to-transparent opacity-50" />
    </footer>
  );
}
