import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Locates and loads the project's .env files.
 *
 * This is a monorepo: `.env` lives at the repository root so docker compose and both
 * workspaces share one file, but npm scripts run with their cwd set to `server/`.
 * Anything that relies on the default dotenv behaviour (look in cwd) therefore finds
 * nothing. Every entrypoint that needs configuration -- the API, the workers, the seed
 * script and the Prisma CLI -- calls this instead.
 *
 * Resolution is relative to this file rather than to `process.cwd()`, so it behaves
 * identically no matter which directory the command was invoked from.
 *
 * dotenv never overwrites variables that are already set, so real environment
 * variables (CI secrets, docker compose `environment:` blocks) always win over a file.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repository root, i.e. server/src/config -> server/src -> server -> <root>. */
const REPO_ROOT_ENV = path.resolve(here, '../../../.env');
/** Optional per-package override, useful for running two API instances locally. */
const SERVER_ENV = path.resolve(here, '../../.env');

let loaded = false;

export const loadEnvFiles = (): void => {
  // Importing this module from several entrypoints in one process is normal; parsing
  // the files repeatedly is wasted work.
  if (loaded) return;
  loaded = true;

  // Root first: the server-local file is the more specific override, but because
  // dotenv does not overwrite, the *first* loaded value wins. Load the override first.
  loadDotenv({ path: SERVER_ENV });
  loadDotenv({ path: REPO_ROOT_ENV });
};

export const envFilePaths = { repoRoot: REPO_ROOT_ENV, server: SERVER_ENV } as const;
