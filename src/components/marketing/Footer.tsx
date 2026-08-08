import Link from 'next/link';
import { Logo } from '@/components/shared/Logo';
import { Container } from '@/components/ui/Layout';
import { Mail, Phone, MapPin, ArrowUpRight } from '@/components/icons';
import { SITE } from '@/lib/constants';

// The corporate site, not this B2B platform. Pages verified to exist:
// /about, /our-services, /contact. There is no /faq — don't link one.
const MAIN_SITE = 'https://envolvepharm.com.ng';

const SHOP_LINKS: { label: string; href: string }[] = [
  { label: 'Catalog', href: '/products' },
  { label: 'Sign in', href: '/sign-in' },
  { label: 'Onboard your pharmacy', href: '/sign-up' },
];

const COMPANY_LINKS: { label: string; href: string }[] = [
  { label: 'About us',     href: `${MAIN_SITE}/about` },
  { label: 'Our services', href: `${MAIN_SITE}/our-services` },
  { label: 'Contact',      href: `${MAIN_SITE}/contact` },
  { label: 'Main site',    href: MAIN_SITE },
];

const LEGAL_LINKS: { label: string; href: string }[] = [
  { label: 'Terms of service', href: '/legal' },
  { label: 'Privacy policy', href: '/legal' },
  { label: 'Cookies', href: '/legal' },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-line-subtle bg-bg">
      <Container>
        <div className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          {/* Brand block */}
          <div>
            <Logo height={32} />

            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-2">
              The online ordering platform of EnvolveCare Express — distribution and sales of
              pharmaceuticals, industrial chemicals, and related products across Nigeria.
            </p>

            <ul className="mt-6 flex flex-col gap-2 text-sm text-ink-2">
              <li className="flex items-center gap-2">
                <Mail size={14} className="shrink-0 text-ink-3" />
                <a href={`mailto:${SITE.email}`} className="transition-colors hover:text-ink">
                  {SITE.email}
                </a>
              </li>

              <li className="flex items-center gap-2">
                <Phone size={14} className="shrink-0 text-ink-3" />
                <a
                  href={`tel:${SITE.phoneHref}`}
                  className="transition-colors hover:text-ink"
                >
                  {SITE.phone}
                </a>
              </li>

              <li className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 shrink-0 text-ink-3" />
                <span>{SITE.address}</span>
              </li>
            </ul>
          </div>

          {/* Shop links */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              Shop
            </h3>

            <ul className="mt-4 flex flex-col gap-2.5">
              {SHOP_LINKS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-ink-2 transition-colors hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links — point to main marketing site */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              Company
            </h3>

            <ul className="mt-4 flex flex-col gap-2.5">
              {COMPANY_LINKS.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-ink-2 transition-colors hover:text-ink"
                  >
                    {item.label}
                    <ArrowUpRight size={11} className="text-ink-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              Legal
            </h3>

            <ul className="mt-4 flex flex-col gap-2.5">
              {LEGAL_LINKS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-ink-2 transition-colors hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-line-subtle py-6 text-xs text-ink-3 sm:flex-row">
          <span>© {currentYear} EnvolveCare Express. All rights reserved.</span>
          <span>Lagos, Nigeria 🇳🇬 · Licensed by PCN</span>
        </div>
      </Container>

      {/* Bottom accent shimmer */}
      <div className="h-px w-full bg-linear-to-r from-transparent via-brand-300 to-transparent opacity-50" />
    </footer>
  );
}