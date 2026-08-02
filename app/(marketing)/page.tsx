/**
 * Home page — premium e-commerce landing for the Envolve online store.
 *
 * Sections:
 *   1. Hero with product preview (wired to DUMMY_PRODUCTS)
 *   2. Trust band
 *   3. Shop by category
 *   4. Featured products grid
 *   5. How to order
 *   6. Closing CTA (session-aware)
 */

import Image from 'next/image';
import Link from 'next/link';
import { Container, Section } from '@/components/ui/Layout';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Primitives';
import { ProductCard } from '@/components/shared/ProductCard';
import {
  ArrowRight, Shield, Truck, CreditCard, CheckCircle,
  Pill, Sparkle, Lock, Basket, ShoppingCart, User,
} from '@/components/icons';
import { PRODUCT_CATEGORIES }                from '@/lib/constants';
import { DUMMY_PRODUCTS }                    from '@/lib/data/dummy-products';
import { getSession }                        from '@/lib/auth';
import { formatNaira }                       from '@/lib/utils';

const TRUST_FEATURES = [
  { Icon: Shield,     title: 'Verified sourcing',  body: 'Products sourced through trusted pharmaceutical distribution channels.' },
  { Icon: Truck,      title: 'Reliable delivery',  body: 'Fast dispatch across Lagos and nationwide fulfillment through vetted partners.' },
  { Icon: CreditCard, title: 'Secure payments',    body: 'Pay safely through modern checkout, transfer, or approved account terms.' },
];

const STEPS = [
  { n: '01', t: 'Create your account',  d: 'Sign up and complete your buyer profile so your ordering experience is secure.' },
  { n: '02', t: 'Browse the catalogue', d: 'Explore medicines, supplements, industrial chemicals, and related supplies.' },
  { n: '03', t: 'Place your order',     d: 'Checkout securely and receive fulfillment updates until delivery.' },
];

export default async function HomePage() {
  const session    = await getSession();
  const isLoggedIn = !!session;
  const isCustomer = session?.role === 'CUSTOMER';
  const portalHref = isCustomer ? '/portal/catalog' : '/admin/overview';

  const heroPreview    = DUMMY_PRODUCTS.slice(0, 4);
  const primaryProduct = DUMMY_PRODUCTS[0]!;
  const sidePreviews   = heroPreview.slice(1, 4);
  const featured       = DUMMY_PRODUCTS.slice(0, 8);
  const categories     = PRODUCT_CATEGORIES.slice(0, 8);

  return (
    <>
      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(900px_440px_at_12%_-8%,rgba(0,166,212,0.12),transparent_62%),radial-gradient(760px_360px_at_88%_8%,rgba(22,163,74,0.09),transparent_62%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,1)_72%)]"
        />
        <div
          aria-hidden
          className="absolute left-1/2 top-0 -z-10 h-px w-screen -translate-x-1/2 bg-linear-to-r from-transparent via-line-subtle to-transparent"
        />

        <Container>
          <div className="grid min-h-[calc(100svh-5rem)] gap-12 pb-16 pt-12 sm:pt-header lg:grid-cols-[0.94fr_1.06fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-20">

            {/* Left — copy */}
            <div className="flex flex-col justify-center">
              {isLoggedIn ? (
                /* ── Signed-in hero pill ── */
                <div className="self-start flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-[9px] font-bold text-white">
                    {(session.full_name || session.email).split(' ').map(p => p[0]?.toUpperCase()).slice(0, 2).join('')}
                  </span>
                  <span className="text-xs font-semibold text-teal-700">
                    Welcome back{session.full_name ? `, ${session.full_name.split(' ')[0]}` : ''}
                  </span>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
                </div>
              ) : (
                <Badge tone="brand" className="self-start rounded-full px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-leaf-500" />
                  Online ordering · For verified buyers
                </Badge>
              )}

              <h1 className="display-serif mt-6 max-w-[10ch] text-[clamp(2.75rem,6vw,5.65rem)] leading-[0.93] tracking-[-0.065em] text-ink">
                Pharmacy supply, made effortless.
              </h1>

              <p className="mt-6 max-w-[47ch] text-base leading-relaxed text-ink-2 sm:text-lg">
                Browse authentic pharmaceuticals, industrial chemicals, and related supplies from
                one clean ordering platform. Built for speed, trust, and reliable fulfillment.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {isLoggedIn ? (
                  <>
                    <Link
                      href={portalHref}
                      className="inline-flex h-12 items-center gap-2 rounded-full bg-[#042a36] px-6 text-sm font-semibold text-white shadow-[0_10px_32px_rgba(4,42,54,0.30)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-900 hover:shadow-[0_16px_40px_rgba(4,42,54,0.40)]"
                    >
                      <ShoppingCart size={16} />
                      Go to my portal
                      <ArrowRight size={16} />
                    </Link>
                    <ButtonLink href="/products" size="lg" variant="secondary">
                      Browse catalogue
                    </ButtonLink>
                  </>
                ) : (
                  <>
                    <ButtonLink href="/products" size="lg" trailingIcon={<ArrowRight size={16} />}>
                      Browse catalogue
                    </ButtonLink>
                    <ButtonLink href="/sign-up" size="lg" variant="secondary">
                      Create account
                    </ButtonLink>
                  </>
                )}
              </div>

              <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
                {['Licensed buyers', 'Secure checkout', 'Nationwide delivery'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-leaf-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — product preview card */}
            <div className="relative">
              <div aria-hidden className="absolute -left-8 top-10 h-64 w-64 rounded-full bg-brand-300/20 blur-3xl" />
              <div aria-hidden className="absolute -right-8 bottom-10 h-72 w-72 rounded-full bg-leaf-400/10 blur-3xl" />

              <div className="relative rounded-4xl border border-line-subtle bg-white/70 p-2 shadow-[0_30px_100px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:rounded-[2.35rem] sm:p-3">
                <div className="overflow-hidden rounded-[1.55rem] border border-line-subtle bg-white sm:rounded-[1.9rem]">
                  {/* Preview header */}
                  <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#042a36] text-white">
                        <Basket size={15} />
                      </span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-4">Store preview</p>
                        <p className="text-sm font-semibold tracking-[-0.02em] text-ink">Popular products</p>
                      </div>
                    </div>
                    <Link
                      href="/products"
                      className="hidden items-center gap-1 text-xs font-semibold text-teal-600 transition-colors hover:text-teal-700 sm:inline-flex"
                    >
                      Shop all <ArrowRight size={12} />
                    </Link>
                  </div>

                  <div className="grid gap-0 lg:grid-cols-[1.12fr_0.88fr]">
                    {/* Primary hero product */}
                    <Link
                      href={`/products/${primaryProduct.sku}`}
                      className="group relative min-h-96 overflow-hidden border-b border-line-subtle bg-bg-muted lg:border-b-0 lg:border-r"
                    >
                      <Image
                        src={primaryProduct.images[0]?.url ?? ''}
                        alt={primaryProduct.brand_name}
                        width={760}
                        height={820}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                        priority
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-ink/70 via-ink/12 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75">
                          {primaryProduct.category?.name ?? ''}
                        </span>
                        <h2 className="mt-2 line-clamp-2 max-w-sm text-2xl font-semibold leading-tight tracking-[-0.04em]">
                          {primaryProduct.brand_name}
                        </h2>
                        <div className="mt-4 flex items-center justify-between gap-4">
                          <span className="num font-display text-2xl tracking-[-0.04em]">
                            {formatNaira(parseFloat(primaryProduct.selling_price))}
                          </span>
                          <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-ink transition-transform duration-200 group-hover:translate-x-0.5">
                            View <ArrowRight size={13} />
                          </span>
                        </div>
                      </div>
                    </Link>

                    {/* Side previews */}
                    <div className="grid gap-0 sm:grid-cols-3 lg:grid-cols-1">
                      {sidePreviews.map((product) => (
                        <Link
                          key={product.id}
                          href={`/products/${product.sku}`}
                          className="group flex gap-3 border-b border-line-subtle p-3.5 transition-colors last:border-b-0 hover:bg-bg-subtle sm:flex-col sm:border-b-0 sm:border-r sm:last:border-r-0 lg:flex-row lg:border-b lg:border-r-0 lg:last:border-b-0"
                        >
                          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-bg-muted sm:h-28 sm:w-full lg:h-20 lg:w-20">
                            {product.images[0]?.url ? (
                              <Image
                                src={product.images[0].url}
                                alt={product.brand_name}
                                width={240}
                                height={240}
                                priority
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                              />
                            ) : null}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col justify-center">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-teal-600">
                              {product.category?.name ?? ''}
                            </span>
                            <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug tracking-[-0.02em] text-ink">
                              {product.brand_name}
                            </h3>
                            <p className="num mt-2 font-display text-base tracking-[-0.03em] text-ink">
                              {formatNaira(parseFloat(product.selling_price))}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══════════════════ TRUST BAND ═══════════════════ */}
      <Container>
        <div className="grid gap-3 border-y border-line-subtle py-6 sm:grid-cols-3 sm:gap-4 sm:py-8">
          {TRUST_FEATURES.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="group rounded-2xl border border-transparent bg-white/40 p-4 transition-all duration-300 hover:border-line-subtle hover:bg-white hover:shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-[#042a36] group-hover:text-white">
                  <Icon size={17} />
                </span>
                <div>
                  <strong className="text-sm font-semibold tracking-[-0.02em] text-ink">{title}</strong>
                  <p className="mt-1 text-xs leading-relaxed text-ink-3 sm:text-[13px]">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>

      {/* ═══════════════════ CATEGORIES ═══════════════════ */}
      <Section tight>
        <Container>
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                <Sparkle size={13} />
                Categories
              </span>
              <h2 className="display-serif mt-3 text-[clamp(1.85rem,3.4vw,3rem)] leading-tight tracking-[-0.055em] text-ink">
                Find what your pharmacy needs.
              </h2>
            </div>
            <Link href="/products" className="hidden items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 sm:inline-flex">
              View all <ArrowRight size={13} />
            </Link>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category}
                href={`/products?category=${encodeURIComponent(category)}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-line-subtle bg-white p-3.5 text-sm font-semibold text-ink shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_18px_55px_rgba(15,23,42,0.08)]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-bg-muted text-ink-2 transition-colors group-hover:bg-teal-50 group-hover:text-teal-600">
                    <Pill size={16} />
                  </span>
                  <span className="truncate">{category}</span>
                </span>
                <ArrowRight size={14} className="shrink-0 text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-teal-600" />
              </Link>
            ))}
          </div>

          <div className="mt-5 flex sm:hidden">
            <Link href="/products" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
              View all categories <ArrowRight size={13} />
            </Link>
          </div>
        </Container>
      </Section>

      {/* ═══════════════════ FEATURED PRODUCTS ═══════════════════ */}
      <Section tight>
        <Container>
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                <Pill size={13} />
                Featured
              </span>
              <h2 className="display-serif mt-3 text-[clamp(1.85rem,3.4vw,3rem)] leading-tight tracking-[-0.055em] text-ink">
                Popular this month.
              </h2>
            </div>
            <Link href="/products" className="hidden items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 sm:inline-flex">
              Shop all <ArrowRight size={13} />
            </Link>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                href={`/products/${product.sku}`}
              />
            ))}
          </div>

          {/* Bottom CTA strip */}
          <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-line-subtle bg-white p-4 sm:p-5">
            <p className="text-sm font-medium text-ink-2">
              <span className="font-semibold text-ink">{DUMMY_PRODUCTS.length} products</span> available in our catalogue — browse the full range
            </p>
            <Link
              href="/products"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-ink/90"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
        </Container>
      </Section>

      {/* ═══════════════════ HOW TO ORDER ═══════════════════ */}
      <Section>
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16">
            <div className="relative overflow-hidden rounded-4xl border border-line-subtle bg-white p-2 shadow-[0_28px_90px_rgba(15,23,42,0.10)]">
              <div className="overflow-hidden rounded-[1.55rem] bg-bg-muted">
                <Image
                  src="https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1200&q=80"
                  alt="Pharmacy fulfillment"
                  width={1200}
                  height={900}
                  priority
                  className="aspect-4/3 h-full w-full object-cover"
                />
              </div>
              <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/20 bg-white/88 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#042a36] text-white">
                    <Lock size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold tracking-[-0.02em] text-ink">Secure pharmacy ordering</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-3">Account-based checkout for verified buyers.</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">How to order</span>
              <h2 className="display-serif mt-3 max-w-xl text-[clamp(2rem,4vw,3.25rem)] leading-[1.02] tracking-[-0.06em] text-ink">
                From signup to supplied shelf.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2">
                A cleaner way for pharmacies and approved buyers to discover products, place orders, and manage supply with confidence.
              </p>

              <ol className="mt-8 grid gap-3">
                {STEPS.map((step) => (
                  <li
                    key={step.n}
                    className="group rounded-[1.35rem] border border-line-subtle bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_18px_55px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex gap-4">
                      <span className="num grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-bg-muted font-display text-sm font-semibold tracking-[-0.02em] text-brand-600 transition-colors group-hover:bg-[#042a36] group-hover:text-white">
                        {step.n}
                      </span>
                      <div>
                        <h3 className="text-base font-semibold tracking-[-0.03em] text-ink">{step.t}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-ink-2">{step.d}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {isLoggedIn ? (
                  <Link
                    href={portalHref}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-[#042a36] px-6 text-sm font-semibold text-white shadow-[0_10px_32px_rgba(4,42,54,0.30)] transition-all hover:-translate-y-0.5 hover:bg-teal-900"
                  >
                    <ShoppingCart size={16} />
                    Go to my dashboard
                    <ArrowRight size={14} />
                  </Link>
                ) : (
                  <>
                    <ButtonLink href="/sign-up" trailingIcon={<ArrowRight size={14} />}>Create account</ButtonLink>
                    <ButtonLink href="/sign-in" variant="secondary">I have an account</ButtonLink>
                  </>
                )}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* ═══════════════════ CLOSING CTA ═══════════════════ */}
      <Section tight>
        <Container>
          <div className="relative overflow-hidden rounded-4xl bg-[#042a36] p-7 text-white shadow-[0_30px_100px_rgba(4,42,54,0.30)] sm:p-10 lg:p-14">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(760px_360px_at_88%_110%,rgba(45,212,191,0.28),transparent_62%),radial-gradient(600px_280px_at_8%_-10%,rgba(22,163,74,0.22),transparent_58%)]"
            />
            <div
              aria-hidden
              className="absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-teal-400/40 to-transparent"
            />

            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-teal-300">
                  <Sparkle size={13} />
                  {isLoggedIn ? 'Your account is active' : 'Ready to order'}
                </span>

                <h2 className="display-serif mt-5 max-w-2xl text-[clamp(2rem,4.4vw,4rem)] leading-[0.98] tracking-[-0.065em]">
                  {isLoggedIn
                    ? 'Your portal is ready — start placing orders today.'
                    : 'Start buying with a cleaner pharmacy supply experience.'}
                </h2>

                <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/72 sm:text-base">
                  {isLoggedIn
                    ? 'Browse our full catalogue, manage your orders, and track deliveries all from your personal portal.'
                    : 'Create your account, browse the catalog, and place your first order through a fast, secure, modern commerce flow.'}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                {isLoggedIn ? (
                  <>
                    <Link
                      href={portalHref}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-teal-400 px-6 text-sm font-bold text-[#042a36] shadow-[0_12px_32px_rgba(45,212,191,0.40)] transition-all hover:-translate-y-0.5 hover:bg-teal-300"
                    >
                      <ShoppingCart size={16} />
                      Go to my portal
                      <ArrowRight size={16} />
                    </Link>
                    <Link
                      href="/products"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-5 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      Browse catalogue
                      <ArrowRight size={14} />
                    </Link>
                  </>
                ) : (
                  <>
                    <ButtonLink
                      href="/sign-up"
                      size="lg"
                      className="bg-white! text-ink! hover:bg-bg-subtle!"
                      trailingIcon={<ArrowRight size={16} />}
                    >
                      Create account
                    </ButtonLink>
                    <Link
                      href="/products"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-5 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      Browse catalogue
                      <ArrowRight size={14} />
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Session info bar when logged in */}
            {isLoggedIn && (
              <div className="relative mt-8 flex items-center gap-3 rounded-2xl border border-teal-400/20 bg-white/5 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-400 text-sm font-bold text-[#042a36]">
                  {(session.full_name || session.email).split(' ').map(p => p[0]?.toUpperCase()).slice(0, 2).join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {session.full_name || session.email}
                  </p>
                  <p className="text-xs text-teal-300">
                    {isCustomer ? 'Customer account · Verified' : 'Staff account'}
                  </p>
                </div>
                <Link
                  href="/sign-out"
                  className="text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
                >
                  Sign out
                </Link>
              </div>
            )}
          </div>
        </Container>
      </Section>
    </>
  );
}
