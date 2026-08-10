import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, extractDomain, hashUrl, isValidHttpUrl } from '../../src/utils/url.js';

/**
 * URL canonicalization is the primary dedup key: `urlHash` carries a unique constraint,
 * so these functions decide whether re-ingesting a feed is idempotent or creates a
 * duplicate row on every cycle.
 */

describe('canonicalizeUrl', () => {
  it('strips tracking parameters', () => {
    expect(canonicalizeUrl('https://example.com/story?utm_source=twitter&utm_medium=social')).toBe(
      'https://example.com/story',
    );
    expect(canonicalizeUrl('https://example.com/story?fbclid=abc123')).toBe(
      'https://example.com/story',
    );
    expect(canonicalizeUrl('https://example.com/story?gclid=x&igshid=y&ncid=z')).toBe(
      'https://example.com/story',
    );
  });

  it('keeps meaningful query parameters', () => {
    // Some publishers genuinely paginate or identify content via the query string.
    expect(canonicalizeUrl('https://example.com/story?id=42')).toBe(
      'https://example.com/story?id=42',
    );
  });

  it('sorts surviving parameters so order cannot create a second identity', () => {
    expect(canonicalizeUrl('https://example.com/s?b=2&a=1')).toBe(
      canonicalizeUrl('https://example.com/s?a=1&b=2'),
    );
  });

  it('normalises scheme and host', () => {
    expect(canonicalizeUrl('http://WWW.Example.COM/story')).toBe('https://example.com/story');
    expect(canonicalizeUrl('https://m.example.com/story')).toBe('https://example.com/story');
  });

  it('removes the fragment, which never identifies a different article', () => {
    expect(canonicalizeUrl('https://example.com/story#comments')).toBe(
      'https://example.com/story',
    );
  });

  it('removes a trailing slash', () => {
    expect(canonicalizeUrl('https://example.com/story/')).toBe('https://example.com/story');
  });

  it('collapses AMP and print variants onto the canonical article', () => {
    expect(canonicalizeUrl('https://example.com/story/amp')).toBe('https://example.com/story');
    expect(canonicalizeUrl('https://example.com/story/print')).toBe('https://example.com/story');
  });

  it('collapses duplicate path separators', () => {
    expect(canonicalizeUrl('https://example.com//a///b')).toBe('https://example.com/a/b');
  });

  it('preserves path case, which some CMSs are sensitive to', () => {
    expect(canonicalizeUrl('https://example.com/Story/Detail')).toBe(
      'https://example.com/Story/Detail',
    );
  });

  it('strips embedded credentials', () => {
    expect(canonicalizeUrl('https://user:pass@example.com/story')).toBe(
      'https://example.com/story',
    );
  });

  it('leaves a bare root path intact', () => {
    expect(canonicalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('returns non-http input trimmed so validation can reject it', () => {
    // Must not throw: a malformed URL from a provider is data, not a crash.
    expect(canonicalizeUrl('  not a url  ')).toBe('not a url');
    expect(canonicalizeUrl('ftp://example.com/file')).toBe('ftp://example.com/file');
    expect(canonicalizeUrl('javascript:alert(1)')).toBe('javascript:alert(1)');
  });
});

describe('hashUrl', () => {
  it('is a stable sha1 hex digest', () => {
    expect(hashUrl('https://example.com/story')).toMatch(/^[a-f0-9]{40}$/);
  });

  it('collapses every equivalent variant to one hash, making ingestion idempotent', () => {
    const variants = [
      'https://example.com/story',
      'http://example.com/story',
      'https://www.example.com/story/',
      'https://example.com/story?utm_source=news',
      'https://example.com/story#top',
      'https://example.com/story/amp',
    ];

    const hashes = new Set(variants.map(hashUrl));
    expect(hashes.size).toBe(1);
  });

  it('distinguishes genuinely different articles', () => {
    expect(hashUrl('https://example.com/a')).not.toBe(hashUrl('https://example.com/b'));
  });
});

describe('extractDomain', () => {
  it('returns the host without a www prefix', () => {
    expect(extractDomain('https://www.thehindu.com/news/story')).toBe('thehindu.com');
  });

  it('lowercases the host', () => {
    expect(extractDomain('https://Reuters.COM/x')).toBe('reuters.com');
  });

  it('returns null for unparseable input', () => {
    expect(extractDomain('not a url')).toBeNull();
  });
});

describe('isValidHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isValidHttpUrl('http://example.com')).toBe(true);
    expect(isValidHttpUrl('https://example.com')).toBe(true);
  });

  it('rejects other schemes and malformed input', () => {
    // javascript: in particular must never reach an href in the UI.
    expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('data:text/html,<script>')).toBe(false);
    expect(isValidHttpUrl('')).toBe(false);
  });
});
