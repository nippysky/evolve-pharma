# Manual migrations — SUPERSEDED

The three `.sql` files in this folder added columns that are now declared
directly in `prisma/schema.prisma`:

| Column | Table | Now in schema as |
|---|---|---|
| `assigned_staff_id` | `customers` | `Customer.assigned_staff_id` + `assigned_staff` relation |
| `referral_threshold_awarded` | `customers` | `Customer.referral_threshold_awarded` |
| `placed_by_user_id` | `orders` | `Order.placed_by_user_id` + `placed_by` relation |

## You almost certainly do NOT need these files

For a fresh database, `prisma db push` creates all three columns from the
schema. Just run:

```bash
npx prisma db push --force-reset
npx prisma generate
npx tsx prisma/wipe-and-seed.ts
```

## When you WOULD use them

Only to patch a live database in place, where dropping data isn't an option
and you can't run `db push`. They are written to be idempotent (`IF NOT
EXISTS`, plus a guard around the foreign keys, since MySQL has no
`ADD CONSTRAINT IF NOT EXISTS`), so re-running them is safe.

Kept for reference rather than deleted, in case a production database needs
upgrading without a reset.
