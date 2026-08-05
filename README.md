# Envolve Pharmaceuticals — Platform

B2B pharmaceutical commerce platform for licensed Nigerian pharmacies. Built with Next.js 15 App Router, Prisma, and MySQL.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, React 19) |
| Styling | Tailwind CSS v4 with `@theme` design tokens |
| Language | TypeScript (strict) |
| ORM | Prisma 6 |
| Database | MySQL |
| Auth | JWT (access + refresh) via `jose` |
| Payments | Paystack |
| Storage | Cloudinary |
| Email | Nodemailer (SMTP) |
| Validation | Zod |

## Project structure

```
app/                   # Next.js App Router
├── (auth)/            # Customer auth (sign-in, sign-up, OTP, forgot password)
├── (marketing)/       # Public marketing pages
├── (portal)/portal/   # Customer dashboard (catalog, basket, orders, tracking)
├── (staff-auth)/      # Staff/driver auth
├── admin/             # Admin & staff console
├── driver/            # Driver portal
└── api/               # API routes

src/
├── components/        # UI components
├── contexts/          # React contexts
├── hooks/             # React Query hooks
├── lib/               # Core logic (auth, db, mail, paystack, orders, utils)
├── providers/         # App providers
└── types/             # TypeScript types

prisma/
├── schema.prisma      # Database schema
└── seed.ts            # Seed script
```

## Getting started

```bash
npm install
# Copy and fill in env vars
npm run dev
```

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `JWT_ACCESS_SECRET` | Access token secret |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `JWT_SETUP_SECRET` | One-time setup token secret |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `PAYSTACK_SECRET_KEY` | Paystack secret key |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key |
| `SMTP_HOST` | SMTP host |
| `SMTP_PORT` | SMTP port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender address |
| `NEXT_PUBLIC_SITE_URL` | Public site URL |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Paystack public key (client-side) |

## User roles

| Role | Access |
|---|---|
| `ADMIN` | Full platform access |
| `STAFF` | Orders, customers, deliveries, inventory |
| `DRIVER` | Own delivery assignments only |
| `CUSTOMER` | Customer portal only |

## Scripts

```bash
npm run dev        # Dev server
npm run build      # Production build
npm run start      # Run production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

## License

Proprietary — Envolve Pharmaceuticals Ltd. All rights reserved.
