import Link from 'next/link';
import { Container, Section } from '@/components/ui/Layout';
import { ButtonLink } from '@/components/ui/Button';
import { ProductsCatalog } from '@/components/marketing/ProductsCatalog';
import { ArrowRight, Basket, Shield, Truck, ShoppingCart } from '@/components/icons';
import { getActiveProducts } from '@/lib/data/products.server';
import { getSession } from '@/lib/auth';

// Cache for 5 minutes — same TTL as the product list cache.
export const revalidate = 300;

const CATALOG_FEATURES = [
  { label: 'Verified catalog',  description: 'Organized product discovery for approved buyers.',       Icon: Shield },
  { label: 'Fast fulfillment',  description: 'Built for practical ordering across Nigeria.',            Icon: Truck },
  { label: 'Clean ordering',    description: 'Search, filter, review, and proceed with confidence.',   Icon: Basket },
];

interface Props {
  searchParams: Promise<{ category?: string }>;
}

export default async function MarketingProductsPage({ searchParams }: Props) {
  const session    = await getSession();
  const params     = await searchParams;

  const products      = await getActiveProducts();
  const role          = session?.role ?? null;
  const isCustomer    = role === 'CUSTOMER';
  const isAdminStaff  = role === 'ADMIN' || role === 'STAFF';
  const portalHref    = '/portal/catalog';

  return (
    <>
      {/* ── Page hero ── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_12%_-8%,rgba(0,166,212,0.12),transparent_62%),radial-gradient(760px_360px_at_88%_4%,rgba(22,163,74,0.08),transparent_62%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,1)_78%)]"
        />

        <Container>
          <div className="grid gap-8 pb-10 pt-10 sm:pt-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-end lg:gap-14 lg:pb-14 lg:pt-header">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-line-subtle bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl">
                <span className="h-1.5 w-1.5 rounded-full bg-leaf-500" />
                Catalogue · {products.length} products
              </span>

              <h1 className="display-serif mt-5 max-w-3xl text-[clamp(2.4rem,5.2vw,5rem)] leading-[0.96] tracking-[-0.065em] text-ink">
                Browse what&apos;s available.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-2 sm:text-lg">
                Explore pharmaceuticals, supplements, industrial chemicals, and related supplies in
                one clean catalogue.{' '}
                {isCustomer ? (
                  <Link href={portalHref} className="font-semibold text-teal-600 underline-offset-4 hover:underline">
                    Head to your portal
                  </Link>
                ) : !isAdminStaff ? (
                  <Link href="/sign-up" className="font-semibold text-brand-600 underline-offset-4 hover:underline">
                    Create your buyer account
                  </Link>
                ) : null}{' '}
                {!isAdminStaff && 'to place orders.'}
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {isCustomer ? (
                  <Link
                    href={portalHref}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-[#042a36] px-6 text-sm font-semibold text-white shadow-[0_10px_32px_rgba(4,42,54,0.28)] transition-all hover:-translate-y-0.5 hover:bg-teal-900"
                  >
                    <ShoppingCart size={16} />
                    Order from my portal
                    <ArrowRight size={14} />
                  </Link>
                ) : isAdminStaff ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                    <Shield size={14} />
                    Viewing as staff — purchasing requires a customer account
                  </div>
                ) : (
                  <>
                    <ButtonLink href="/sign-up" trailingIcon={<ArrowRight size={14} />}>Create account</ButtonLink>
                    <ButtonLink href="/sign-in" variant="secondary">Sign in</ButtonLink>
                  </>
                )}
              </div>
            </div>

            {/* Feature cards */}
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {CATALOG_FEATURES.map(({ label, description, Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-line-subtle bg-white/78 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.055)] backdrop-blur-xl"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-bg-muted text-ink">
                    <Icon size={17} />
                  </span>
                  <h2 className="mt-3 text-sm font-semibold tracking-[-0.02em] text-ink">{label}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-ink-3">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── Product grid (client component: search + filter) ── */}
      <Section tight>
        <Container>
          <ProductsCatalog
            products={products}
            initialCategory={params.category}
          />
        </Container>
      </Section>
    </>
  );
}
