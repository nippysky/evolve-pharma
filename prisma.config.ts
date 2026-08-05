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
