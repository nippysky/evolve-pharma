# Envolve Pharmaceuticals

A Next.js 15 + React 19 + Tailwind CSS v4 frontend for **Envolve Pharmaceuticals**, a B2B pharmaceutical commerce platform for licensed Nigerian pharmacies. Frontend-only — designed to plug into any backend (Laravel/PHP, Node, Go) via a clean API boundary.

## What's inside

```
src/
├── app/
│   ├── (marketing)/         # Public pages — home, products, about, faq, contact, legal
│   ├── (auth)/              # Sign in, sign up (customer + agent), verify, forgot password
│   ├── (portal)/portal/     # Customer dashboard — catalog, basket, checkout, orders, profile
│   └── console/             # Staff dashboard (admin + sales agent) — RBAC, KPIs, all CRUD shells
│
├── components/
│   ├── ui/                  # Button, Field, Dialog, Table, Layout, Primitives
│   ├── shared/              # Logo, ProductCard, RoleSwitcher, Timeline, PageHead
│   ├── marketing/           # Header, Footer
│   ├── portal/              # PortalSidebar, PortalTopbar
│   ├── console/             # ConsoleSidebar, ConsoleTopbar, ProductForm
│   └── icons/               # Icon shim (lucide-react under the hood)
│
├── lib/
│   ├── actions/             # Server actions (sign in, signup, checkout, contact, …)
│   ├── data/                # Mock data — products, customers, orders, deliveries, etc.
│   ├── hooks/               # useBasket (Zustand)
│   ├── auth.ts              # Cookie-based mock session
│   └── utils/               # cn(), formatNaira, formatDate, timeAgo, …
│
├── contexts/                # ToastProvider
├── styles/globals.css       # Tailwind v4 + brand @theme tokens
└── types/                   # All TypeScript types
```

## Stack

- **Next.js 15** (App Router, Server Actions, React 19)
- **Tailwind CSS v4** with `@theme` design tokens (the recommended Next.js default)
- **TypeScript** strict mode
- **Zod** for schema validation
- **Zustand** for the basket store
- **lucide-react** for icons (wrapped via `src/components/icons/index.tsx` for swappable defaults)
- **Custom UI primitives** — no shadcn/ui or other component libraries. Everything is hand-built and themeable.

## Getting started

```bash
# 1. Install
npm install

# 2. Run dev server
npm run dev          # http://localhost:3000

# 3. Build for production
npm run build
npm run start

# Other scripts
npm run lint
npm run typecheck
npm run format
```

## Demo credentials

The app uses a cookie-based mock session. There is **no real authentication backend** — everything routes through a `envolve_demo_role` cookie set by `src/lib/actions/role.ts`.

**Default sign-in form** (autofilled):

```
Email:    amaka@greenleaf.ng
Password: demoPass123
```

Submitting the form sets the role to `customer` and redirects to `/portal/catalog`.

## The role switcher (demo only)

A floating widget at the bottom-right of every authenticated page lets you flip between the three roles **without going through real auth**:

- **Customer (Pharmacy)** → routes to `/portal/*`
- **Sales Agent** → routes to `/console/*` with a filtered nav (no products, agents, reports, settings)
- **Admin** → routes to `/console/*` with full nav

The switcher lives in `src/components/shared/RoleSwitcher.tsx`. To remove it from production, just delete its render in:

- `src/app/(portal)/layout.tsx`
- `src/app/console/layout.tsx`

## Branding & design tokens

All design tokens live in `src/styles/globals.css` inside an `@theme` block, which Tailwind v4 turns into utility classes automatically.

Brand palettes:

- `brand-50` to `brand-900` — primary brand (cyan)
- `leaf-50` to `leaf-900` — accent (green, for success and pharmacy/health nuances)

Surfaces, text, borders, and statuses are all tokenized — `bg-bg`, `text-ink`, `border-line`, `bg-success-soft`, etc. Just edit `globals.css` to rebrand the entire app.

Fonts are loaded via `next/font/google` from `src/app/layout.tsx`:

- **Geist Sans** — body
- **Geist Mono** — monospace (SKUs, references)
- **Instrument Serif** — display (`font-display` / `.display-serif`)

## Routes

| Path | Role | Notes |
|---|---|---|
| `/` | Public | Marketing home |
| `/products`, `/products/[sku]` | Public | Catalog preview |
| `/about`, `/faq`, `/contact`, `/legal` | Public | Static-ish pages |
| `/sign-in`, `/sign-up`, `/sign-up/agent`, `/verify`, `/forgot-password` | Public | Auth flow |
| `/portal/catalog`, `/portal/catalog/[sku]` | Customer | Browse & add to basket |
| `/portal/basket`, `/portal/checkout` | Customer | Basket & checkout flow |
| `/portal/orders`, `/portal/orders/[id]` | Customer | Order history & detail |
| `/portal/notifications`, `/portal/profile` | Customer | Notifications & profile |
| `/console/overview` | Admin + Agent | KPI dashboard (different metrics per role) |
| `/console/customers`, `/console/customers/[id]` | Admin + Agent | Pharmacy directory |
| `/console/orders`, `/console/orders/[id]` | Admin + Agent | All orders |
| `/console/products`, `/console/products/new`, `/console/products/[sku]` | Admin only | Catalog CRUD |
| `/console/inventory` | Admin only | Stock + expiry |
| `/console/deliveries` | Admin + Agent | Shipment tracking |
| `/console/agents` | Admin only | Sales-rep directory |
| `/console/reports`, `/console/settings` | Admin only | Analytics + config |
| `/console/notifications` | Admin + Agent | All system alerts |

Role-based routing is enforced in the layout files (`src/app/(portal)/layout.tsx`, `src/app/console/layout.tsx`) via `getSession()` and `redirect()`.

## Mock data

All operational data lives in `src/lib/data/operational.ts`:

- `AGENTS` — sales staff
- `CUSTOMERS` — pharmacies
- `ORDERS` — order history with line items
- `DELIVERIES` — shipments with event timelines
- `INVENTORY` — stock levels with batch info and pre-computed `is_low_stock` / `is_expiring_soon` flags
- `NOTIFICATIONS`, `REVIEWS`, `MOCK_SESSION`

Products live in `src/lib/data/products.ts` (~24 SKUs across 14 categories, all with Unsplash photos).

To swap to a real backend, replace the data accessors (`getAllProducts()`, etc.) with API/database calls. The page components don't need to change.

## Environment

No env vars required for the demo build. For production:

```env
# Optional
NEXT_PUBLIC_SITE_URL=https://envolvepharm.com.ng
```

## Deploying to Vercel

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "Envolve initial commit"
git remote add origin <your-repo>
git push -u origin main

# 2. Import in Vercel
# - Framework: Next.js
# - Build command: next build (default)
# - Output: .next (default)
# - Root: /
# - Image domains: already configured in next.config.mjs
```

The image whitelist in `next.config.mjs` permits `images.unsplash.com`, which is what the catalog placeholder photos use. Add your CDN host to that list when you swap in real product imagery.

## Notable design decisions

- **Tailwind v4** instead of v3: smaller config (`@theme` replaces the entire `tailwind.config.js`), faster, and what Next.js currently recommends.
- **No external UI library**: Button, Field, Dialog, Table, etc. are all hand-built so brand changes never fight a vendor's defaults. Tailwind utilities + a small `globals.css` for animations and prose helpers.
- **Server Actions** instead of API routes for auth/checkout: simpler types end-to-end (`useActionState` ↔ Zod-validated action). Easy to swap to fetch-based POSTs when you wire the PHP backend.
- **Shared `Timeline` component** drives both the order-progress and delivery-shipment timelines — same shape, two stage maps.
- **`tailwind-merge`** wrapped inside `cn()` so prop overrides (`className="bg-red-500"`) reliably win against base classes without specificity bugs.

## Scripts at a glance

```bash
npm run dev        # Turbopack dev server
npm run build      # Production build
npm run start      # Run prod build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run format     # Prettier (with tailwind plugin)
```

## License

Proprietary — Envolve Pharmaceuticals Ltd.
