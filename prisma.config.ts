/**
 * Prisma 7 Configuration
 *
 * This file replaces the DATABASE_URL in schema.prisma for CLI operations.
 * The datasource URL is loaded from .env.local via dotenv so that
 * `prisma migrate dev`, `prisma db push`, and `prisma studio` all
 * pick up the correct Hostinger MySQL connection string.
 *
 * Env vars required for CLI:
 *   DATABASE_URL=mysql://user:pass@srv1429.hstgr.io:3306/u143295213_envolve_db
 */

import { config } from 'dotenv';
// Next.js uses .env.local — load it explicitly so prisma CLI picks it up
config({ path: '.env.local' });
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
