import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration.
 *
 * Exists for two reasons:
 *
 * 1. **Environment loading.** `.env` lives at the repository root so docker compose and
 *    both workspaces share one file, but the Prisma CLI runs with its cwd set to
 *    `server/` and only looks for `.env` there. Without this, every `prisma migrate`,
 *    `prisma studio` and `prisma db seed` fails with
 *    "Environment variable not found: DATABASE_URL".
 *
 * 2. **Replaces the deprecated `package.json#prisma` block**, which Prisma 7 removes.
 *
 * This mirrors src/config/loadEnv.ts, but cannot import it: the Prisma CLI loads this
 * file through its own loader, outside the app's module graph.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

// Server-local override first, then the repository root. dotenv never overwrites an
// existing value, so real environment variables always take precedence over both.
loadDotenv({ path: path.resolve(here, '.env') });
loadDotenv({ path: path.resolve(here, '../.env') });

export default defineConfig({
  schema: path.join(here, 'prisma', 'schema.prisma'),
  migrations: {
    path: path.join(here, 'prisma', 'migrations'),
    // Used by `prisma migrate reset` and `prisma db seed`.
    seed: 'tsx prisma/seed.ts',
  },
});
