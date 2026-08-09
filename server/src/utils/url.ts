import { sha1 } from './text.js';

/**
 * URL canonicalization for deduplication.
 *
 * The same article shared through different channels arrives with different tracking
 * parameters, protocols and AMP variants. Reducing all of those to one canonical form
 * lets a unique index on the hash make ingestion idempotent.
 */

/** Query parameters that identify a campaign, not a document. */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^ga_/i,
  /^mc_/i,
  /^pk_/i,
  /^hsa_/i,
  /^_hs/i,
  /^ref$/i,
  /^referrer$/i,
  /^source$/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^dclid$/i,
  /^msclkid$/i,
  /^igshid$/i,
  /^cmpid$/i,
  /^ncid$/i,
  /^smid$/i,
  /^spm$/i,
  /^at_medium$/i,
  /^at_campaign$/i,
  /^feature$/i,
  /^sh$/i,
];

const isTrackingParam = (name: string): boolean =>
  TRACKING_PARAMS.some((pattern) => pattern.test(name));

/** Path suffixes AMP and print variants add to an otherwise identical article. */
const AMP_SUFFIX = /\/(amp|amp\.html|amp\/?)$/i;
const PRINT_SUFFIX = /\/(print|printable)$/i;

export const canonicalizeUrl = (input: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    // Not a parseable URL: return it trimmed so the caller's validation can reject it.
    return input.trim();
  }

  // Only http(s) articles are meaningful here.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return input.trim();
  }

  // Normalize scheme and host. http/https of the same page are the same page.
  parsed.protocol = 'https:';
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  parsed.port = '';
  parsed.hash = '';
  parsed.username = '';
  parsed.password = '';

  for (const name of [...parsed.searchParams.keys()]) {
    if (isTrackingParam(name)) parsed.searchParams.delete(name);
  }
  // Sort the survivors so parameter order cannot create a second identity.
  parsed.searchParams.sort();

  parsed.pathname = parsed.pathname
    .replace(AMP_SUFFIX, '')
    .replace(PRINT_SUFFIX, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/$/, '');

  if (parsed.pathname === '') parsed.pathname = '/';

  return parsed.toString().replace(/\?$/, '');
};

export const hashUrl = (url: string): string => sha1(canonicalizeUrl(url));

/** Registrable-ish host used to link an article to a `Source` row. */
export const extractDomain = (input: string): string | null => {
  try {
    return new URL(input).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};

export const isValidHttpUrl = (input: string): boolean => {
  try {
    const parsed = new URL(input);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};
