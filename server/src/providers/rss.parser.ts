import { XMLParser } from 'fast-xml-parser';
import type { RawArticle } from './NewsProvider.js';
import { stripHtml, truncate } from '../utils/text.js';

/**
 * RSS / Atom parsing.
 *
 * Separated from the provider so it is a pure function of a string and can be unit
 * tested against real-world feed samples without any network access.
 *
 * Feeds are messy in practice: RSS 2.0 and Atom differ, a field may be a string or an
 * object depending on whether attributes were present, and single-item feeds collapse
 * arrays to a scalar. Every accessor below tolerates all of those shapes.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Keep values as strings: a headline like "2024" must not silently become a number.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  // CDATA is extremely common in feed descriptions.
  cdataPropName: '__cdata',
  removeNSPrefix: true,
});

/** A parsed XML node: a string, an object of unknown fields, or a list of either. */
type XmlNode = unknown;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Feeds with exactly one entry parse to an object rather than an array. */
const toArray = (value: XmlNode): unknown[] => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

/**
 * Reads a node's text, whether it arrived as a bare string, a CDATA block, or an
 * object with a `#text` property (which happens whenever attributes are present).
 */
const text = (value: XmlNode): string | null => {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = text(entry);
      if (found) return found;
    }
    return null;
  }
  if (isRecord(value)) {
    const cdata = value['__cdata'];
    if (typeof cdata === 'string' && cdata.trim()) return cdata.trim();
    const inner = value['#text'];
    if (typeof inner === 'string' && inner.trim()) return inner.trim();
  }
  return null;
};

const attr = (value: XmlNode, name: string): string | null => {
  if (!isRecord(value)) return null;
  const found = value[`@_${name}`];
  return typeof found === 'string' && found.trim() ? found.trim() : null;
};

/**
 * Atom `<link>` handling. Atom uses `<link rel="alternate" href="...">` and often
 * carries several links (self, enclosure, alternate); the article URL is the
 * `alternate` one, or the first link with an href if no rel is given.
 */
const atomLink = (value: XmlNode): string | null => {
  const links = toArray(value);
  let fallback: string | null = null;

  for (const link of links) {
    const href = attr(link, 'href');
    if (!href) continue;
    const rel = attr(link, 'rel');
    if (rel === 'alternate' || rel === null) return href;
    fallback ??= href;
  }

  return fallback ?? text(value);
};

/**
 * Image extraction, in descending order of reliability. Feeds advertise images through
 * at least five different conventions, and most publishers use only one of them.
 */
const extractImage = (item: Record<string, unknown>): string | null => {
  // media:content / media:thumbnail (namespace prefixes are stripped by the parser).
  for (const key of ['thumbnail', 'content'] as const) {
    for (const node of toArray(item[key])) {
      const url = attr(node, 'url');
      if (url) return url;
    }
  }

  // <enclosure url="..." type="image/jpeg">
  for (const node of toArray(item['enclosure'])) {
    const type = attr(node, 'type');
    const url = attr(node, 'url');
    if (url && (type === null || type.startsWith('image/'))) return url;
  }

  // <image><url>...</url></image>
  const image = item['image'];
  if (isRecord(image)) {
    const url = text(image['url']) ?? text(image);
    if (url) return url;
  }

  // Last resort: the first <img src> inside the HTML description.
  const html = text(item['description']) ?? text(item['encoded']) ?? '';
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return match?.[1] ?? null;
};

/** Description length cap: feeds sometimes inline an entire article here. */
const MAX_DESCRIPTION = 600;

const cleanDescription = (raw: string | null): string | null => {
  if (!raw) return null;
  const clean = stripHtml(raw);
  if (!clean) return null;
  return truncate(clean, MAX_DESCRIPTION);
};

export interface ParsedFeed {
  /** Feed-level title, used as a fallback publisher name. */
  feedTitle: string | null;
  articles: RawArticle[];
}

/**
 * Parses an RSS 2.0 or Atom document into RawArticles.
 *
 * Throws only when the payload is not a feed at all (so the caller can record a
 * partial error for that URL); individual malformed entries are skipped.
 */
export const parseFeed = (xml: string, fallbackSourceName: string): ParsedFeed => {
  const parsed: unknown = parser.parse(xml);
  if (!isRecord(parsed)) throw new Error('Feed is not valid XML');

  const rss = parsed['rss'];
  const channel = isRecord(rss) ? rss['channel'] : undefined;
  const atomFeed = parsed['feed'];

  if (isRecord(channel)) {
    return {
      feedTitle: text(channel['title']),
      articles: toArray(channel['item'])
        .map((item) => parseRssItem(item, fallbackSourceName, text(channel['title'])))
        .filter((article): article is RawArticle => article !== null),
    };
  }

  if (isRecord(atomFeed)) {
    return {
      feedTitle: text(atomFeed['title']),
      articles: toArray(atomFeed['entry'])
        .map((entry) => parseAtomEntry(entry, fallbackSourceName, text(atomFeed['title'])))
        .filter((article): article is RawArticle => article !== null),
    };
  }

  throw new Error('Unrecognised feed format: expected an RSS channel or an Atom feed');
};

const parseRssItem = (
  node: unknown,
  fallbackSourceName: string,
  feedTitle: string | null,
): RawArticle | null => {
  if (!isRecord(node)) return null;

  const title = text(node['title']);
  const link = text(node['link']) ?? attr(node['link'], 'href');
  // An entry without a title or a link cannot become an article.
  if (!title || !link) return null;

  return {
    externalId: text(node['guid']),
    title: stripHtml(title),
    description: cleanDescription(text(node['description'])),
    // `content:encoded` is the only place a feed reliably licenses fuller text, and
    // even then it is stored as an excerpt by the pipeline.
    content: cleanDescription(text(node['encoded'])),
    url: link,
    imageUrl: extractImage(node),
    // <source> names the origin when a feed aggregates others.
    sourceName: text(node['source']) ?? feedTitle ?? fallbackSourceName,
    author: text(node['creator']) ?? text(node['author']),
    publishedAt: text(node['pubDate']) ?? text(node['date']),
    category: firstCategory(node['category']),
  };
};

const parseAtomEntry = (
  node: unknown,
  fallbackSourceName: string,
  feedTitle: string | null,
): RawArticle | null => {
  if (!isRecord(node)) return null;

  const title = text(node['title']);
  const link = atomLink(node['link']);
  if (!title || !link) return null;

  const author = node['author'];
  const authorName = isRecord(author) ? text(author['name']) : text(author);

  return {
    externalId: text(node['id']),
    title: stripHtml(title),
    description: cleanDescription(text(node['summary'])),
    content: cleanDescription(text(node['content'])),
    url: link,
    imageUrl: extractImage(node),
    sourceName: feedTitle ?? fallbackSourceName,
    author: authorName,
    // Atom prefers `updated`, but `published` is the original publication time.
    publishedAt: text(node['published']) ?? text(node['updated']),
    category: attr(node['category'], 'term') ?? firstCategory(node['category']),
  };
};

const firstCategory = (value: XmlNode): string | null => {
  for (const entry of toArray(value)) {
    const label = text(entry) ?? attr(entry, 'term');
    if (label) return label;
  }
  return null;
};
