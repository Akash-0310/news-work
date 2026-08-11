/// <reference types="vite/client" />

/**
 * Typed build-time environment.
 *
 * `vite/client` declares `ImportMetaEnv` with an `[key: string]: any` index signature,
 * so every `import.meta.env.X` access is implicitly `any` and silently defeats strict
 * mode. Declaring the variables this app actually reads restores type safety at the
 * one place untyped values enter the bundle.
 *
 * Both are optional: Vite only inlines a variable if it is present in the environment
 * at build time, so the `??` fallbacks at the call sites are load-bearing.
 */
interface ImportMetaEnv {
  /** Base URL of the NewsFlow REST API, e.g. http://localhost:4000/api */
  readonly VITE_API_BASE_URL?: string;
  /** WebSocket origin for breaking-news updates (Phase 10). */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
