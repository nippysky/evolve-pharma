# EnvolveCare Express — API Reference

The HTTP surface behind both the web portal and the mobile app. Everything the
mobile client does goes through these routes; there is no second backend.

Base URL (production): `https://envolve-pharma.vercel.app`

---

## Conventions

### Response envelope

Every route returns the same shape. Clients should read `data`, not the root.

```jsonc
// Success
{ "success": true, "message": "Orders retrieved successfully.", "data": { /* ... */ } }

// Error
{ "success": false, "message": "Minimum order for \"Panadol\" is 10 packs.", "errors": { "field": ["..."] } }
```

`errors` is present only on validation failures and is keyed by field name.

### Pagination

Paginated routes return `records` — **not** `items`, `results` or `rows`.

```jsonc
{
  "data": {
    "records": [ /* ... */ ],
    "pagination": { "current_page": 1, "per_page": 20, "total": 137, "total_pages": 7 }
  }
}
```

Query params are `?page=1&limit=20`. Reading `data.items` is the single most
common integration mistake against this API — it silently yields `undefined`.

### Authentication

Two transports, same session:

| Client | Transport |
|---|---|
| Web portal | `httpOnly` cookie, set at login |
| Mobile / Postman | `Authorization: Bearer <access_token>` |

`getSession()` accepts either. Mobile clients should also send
`X-App-Client: mobile` so the API returns JSON errors instead of HTML redirects.

**Token lifecycle**

1. `POST /api/auth/customer/login` or `/api/auth/staff/login` → `{ user, tokens }`
2. Use `tokens.access_token` as the bearer.
3. On `401`, call `POST /api/auth/refresh` with the **refresh** token as the
   bearer → new pair. Retry once; do not loop.
4. `POST /api/auth/logout` with the refresh token in the body revokes it
   server-side. Dropping the token client-side alone leaves it valid.

### Roles

`ADMIN`, `STAFF`, `DRIVER`, `CUSTOMER`. Routes below list who may call them.
A wrong-role request returns `403`, not `404`.

---

## Public routes (no session)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/catalog/products` | `?search=&category=&sort=&page=&limit=` — sort: `newest`, `price_asc`, `price_desc`, `name_asc`, `name_desc` |
| `GET` | `/api/catalog/products/:sku` | Full detail incl. `images[]` |
| `GET` | `/api/catalog/categories` | With `product_count` per category |
| `GET` | `/api/track/:code` | Accepts a **delivery tracking code** *or* an **order number** |
| `POST` | `/api/payments/webhook` | Paystack only — signature-verified |

These are what make public browsing in the mobile app possible.

---

## Auth

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/customer/register` | `multipart/form-data`. See the field-name trap below. |
| `POST` | `/api/auth/customer/verify-otp` | `{ email, otp_code }` |
| `POST` | `/api/auth/customer/resend-otp` | `{ email }` |
| `POST` | `/api/auth/customer/create-password` | `{ email, password }` — completes registration |
| `POST` | `/api/auth/customer/login` | `{ email, password }` → `{ user, tokens }` |
| `POST` | `/api/auth/customer/forgot-password` | `{ email }` — always reports success |
| `POST` | `/api/auth/customer/reset-password` | `{ email, otp_code, new_password }` |
| `POST` | `/api/auth/customer/upload-pcn` | Session required |
| `POST` | `/api/auth/staff/login` | Same shape; serves `ADMIN`, `STAFF` and `DRIVER` |
| `POST` | `/api/auth/staff/forgot-password` · `/reset-password` | Mirrors the customer pair |
| `GET` | `/api/auth/me` | Current session user, from the JWT |
| `POST` | `/api/auth/refresh` | Refresh token as bearer |
| `POST` | `/api/auth/logout` | Send the refresh token to revoke it |

> **Field-name trap — customer register.**
> The upload field is **`file`**, which matches every other multipart route on
> this API. It also accepts `pcn_certificate` as an alias, because that is the
> key the endpoint reports its errors under. Prefer `file`.

`forgot-password` returns success whether or not the account exists. That is
deliberate — it stops the endpoint being used to enumerate registered emails.
Do not "improve" the client by saying "no account found".

---

## Customer

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/api/customers/me` | CUSTOMER | `{ profile, referral }` — see below |
| `PATCH` | `/api/customers/me` | CUSTOMER | `first_name`, `last_name`, `phone`, `gender`. Partial; audited as a diff. |
| `GET` | `/api/cart` | CUSTOMER | Full cart |
| `POST` | `/api/cart/items` | CUSTOMER | `{ product_id, quantity }` |
| `PATCH` | `/api/cart/items/:itemId` | CUSTOMER | `{ quantity }` |
| `DELETE` | `/api/cart/items/:itemId` | CUSTOMER | |
| `DELETE` | `/api/cart` | CUSTOMER | Clear |
| `GET` | `/api/orders/my` | CUSTOMER | Paginated summaries with `preview_items` (max 3) |
| `POST` | `/api/orders` | CUSTOMER | Place an order |
| `GET` | `/api/orders/:id` | any (ownership-checked) | Full detail |
| `POST` | `/api/payments/initiate` | CUSTOMER | → `{ reference, authorization_url, access_code }` |
| `GET` | `/api/payments/verify/:reference` | CUSTOMER | → `{ verified, amount, message }` |

> **Cart mutations do not return a cart.**
> `GET /api/cart` returns `{ cart: { items, subtotal, item_count } }`. The
> mutation routes return acknowledgements only — `POST` gives
> `{ cart_id, item_count, subtotal }`, `PATCH` gives `{ item_id, quantity }`,
> `DELETE` gives `{ removed: true }`. Re-read the cart after mutating; treating
> a mutation response as a cart blanks the basket.

### Payment ordering

`POST /api/orders` re-verifies the Paystack reference server-side before it
touches inventory. The correct sequence is therefore:

```
initiate → pay in browser → verify → POST /api/orders (with paystack_reference)
```

Not "create the order, then pay". Creating first leaves an unpaid order holding
stock every time someone abandons the payment sheet.

`bank_transfer` and `cash_on_delivery` skip straight to `POST /api/orders` —
there is nothing to verify yet, and staff settle those manually.

### `GET /api/customers/me`

```jsonc
{
  "data": {
    "profile": {
      "user_id": 12, "first_name": "…", "last_name": "…", "email": "…",
      "phone": "…", "gender": null, "avatar_url": null, "member_since": "…",
      "customer_id": 5, "company_name": "…", "address": "…", "city": "…", "state": "…",
      "pcn_certificate_url": "…", "pcn_verified": true, "status": "APPROVED",
      "total_orders": 14, "total_paid_orders": 12, "total_spent": 842000
    },
    "referral": {
      "referral_code": "ENV58A5D112",
      "referral_points": 1600,
      "referral_count": 3,
      "programme": {
        "points_per_signup": 100,
        "spend_threshold": 500000,
        "spend_reward": 500
      }
    }
  }
}
```

> **Referral unit caveat.**
> `referral_points` is one column accumulating two differently-denominated
> awards: `points_per_signup` is a dimensionless point value credited at
> signup, while `spend_reward` is credited **in naira** once a referred
> pharmacy's paid orders cross `spend_threshold`. Render each award in its own
> unit and label the balance "reward points" — do not put a ₦ sign in front of
> the total. Reconciling these into one unit is an open product decision.

`programme` is `null` until the customer has a referral code.

---

## Notifications (all roles)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/notifications` | `?page=&limit=&unread=true`. Returns `records`, `pagination`, `unread_count`. |
| `PATCH` | `/api/notifications` | `{ ids: [1,2] }` to mark specific, or `{}` to mark all |
| `GET` | `/api/notifications/unread-count` | One indexed `COUNT`, for badge polling |

`link` is a **web** path (e.g. `/portal/orders/12`). Native clients should
translate it to their own route rather than opening a browser.

---

## Admin & staff

| Method | Path | Role |
|---|---|---|
| `GET` `POST` | `/api/products` | ADMIN, STAFF (write: ADMIN) |
| `GET` `PATCH` `DELETE` | `/api/products/:sku` | ADMIN, STAFF (write: ADMIN) |
| `GET` `POST` | `/api/products/:sku/images` | ADMIN |
| `PATCH` `DELETE` | `/api/products/:sku/images/:imageId` | ADMIN |
| `POST` | `/api/products/bulk-import` | ADMIN |
| `POST` | `/api/products/quick-import` | ADMIN — 6 columns, lands as `DRAFT` |
| `POST` | `/api/products/bulk-actions` | ADMIN |
| `GET` `POST` | `/api/products/categories` · `/manufacturers` | ADMIN, STAFF |
| `GET` `POST` | `/api/customers` | ADMIN, STAFF |
| `GET` | `/api/customers/:id` | ADMIN, STAFF |
| `PATCH` | `/api/customers/:id/review` | ADMIN, STAFF |
| `PATCH` | `/api/customers/:id/assign-staff` | ADMIN — body key is **`staff_user_id`** |
| `GET` | `/api/customers/:id/pcn-url` | ADMIN, STAFF |
| `GET` | `/api/orders` | ADMIN, STAFF |
| `PATCH` | `/api/orders/:id/status` | ADMIN, STAFF |
| `POST` | `/api/orders/on-behalf` | ADMIN, STAFF |
| `PATCH` | `/api/orders/:id/confirm-payment` | ADMIN, STAFF — **on-behalf orders only** |
| `GET` `PATCH` | `/api/deliveries` · `/api/deliveries/:id` | ADMIN, STAFF, DRIVER |
| `GET` | `/api/inventory` · `/inventory/stats` | ADMIN, STAFF |
| `POST` | `/api/inventory/receive` · `/bulk-receive` · `/adjust` | ADMIN, STAFF |
| `GET` `POST` | `/api/staff` | ADMIN |
| `PATCH` `DELETE` | `/api/staff/:id` | ADMIN |
| `POST` | `/api/staff/:id/resend-invite` | ADMIN |
| `GET` | `/api/reports/summary` | ADMIN, STAFF |
| `GET` | `/api/search` | ADMIN, STAFF |
| `GET` `PATCH` | `/api/admin/settings` | ADMIN |
| `GET` | `/api/admin/audit-logs` · `/login-history` | ADMIN |

> **`confirm-payment` is deliberately narrow.**
> It returns `403` for any order the customer placed themselves — those are
> settled by the Paystack webhook and must not be set by hand. It exists only
> for orders staff placed on a customer's behalf, where payment may have been
> taken in cash or by transfer before the order was entered.

> **Staff list responses.**
> `/api/staff` is paginated, so the array is at `data.records`. Reading
> `data.items` returns `undefined` and renders an empty dropdown.

---

## Internal

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/cron/prune-notifications` | Requires `CRON_SECRET`; fails closed without it |
| `ALL` | `/api/proxy/:path*` | Internal proxy |

---

## Postman

An importable collection lives at `postman/envolvecare.postman_collection.json`.

After importing, set the collection variables:

| Variable | Value |
|---|---|
| `baseUrl` | `https://envolve-pharma.vercel.app` |
| `accessToken` | paste from a login response |
| `refreshToken` | paste from a login response |

Collection-level auth is bearer `{{accessToken}}`, so authenticated requests
work as soon as that variable is set. Public routes override it to "no auth".
