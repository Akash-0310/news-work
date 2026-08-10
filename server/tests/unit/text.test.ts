import { describe, expect, it } from 'vitest';
import {
  collapseWhitespace,
  estimateReadingMinutes,
  hashTitle,
  jaccardSimilarity,
  normalizeTitle,
  sha1,
  slugify,
  stripHtml,
  titleTokens,
  truncate,
} from '../../src/utils/text.js';

/**
 * These helpers decide which articles are considered the same story. A regression here
 * either splits one event into many stories or merges unrelated ones, and both failures
 * look like "the feed is a bit odd" rather than an error, so they are pinned tightly.
 */

describe('titleTokens', () => {
  it('drops stopwords and short tokens, then de-duplicates and sorts', () => {
    expect(titleTokens('The markets and the economy in India')).toEqual([
      'economy',
      'india',
      'markets',
    ]);
  });

  it('is order independent, which is the point of sorting', () => {
    expect(titleTokens('Markets rally as inflation cools')).toEqual(
      titleTokens('Inflation cools as markets rally'),
    );
  });

  it('strips a trailing publisher suffix', () => {
    // Feeds routinely append " - Reuters"; without stripping it, the same story from
    // two publishers would never match on title.
    expect(titleTokens('Markets rally today - Reuters')).toEqual(titleTokens('Markets rally today'));
    expect(titleTokens('Markets rally today | Bloomberg')).toEqual(
      titleTokens('Markets rally today'),
    );
  });

  it('folds accents so the same word matches across encodings', () => {
    expect(titleTokens('Zurich economy')).toEqual(titleTokens('Zürich economy'));
  });

  it('ignores apostrophe style differences', () => {
    expect(titleTokens("India's economy grows")).toEqual(titleTokens('India’s economy grows'));
  });

  it('returns an empty list for a title made only of stopwords', () => {
    expect(titleTokens('and the of to')).toEqual([]);
  });
});

describe('normalizeTitle and hashTitle', () => {
  it('produces the same hash for reordered headlines', () => {
    expect(hashTitle('Markets rally as inflation cools')).toBe(
      hashTitle('Inflation cools as markets rally'),
    );
  });

  it('produces different hashes for genuinely different headlines', () => {
    expect(hashTitle('India raises monsoon forecast')).not.toBe(
      hashTitle('Bitcoin steadies after volatile week'),
    );
  });

  it('is a stable 40 character sha1 hex digest', () => {
    const hash = hashTitle('Some headline about the economy');
    expect(hash).toMatch(/^[a-f0-9]{40}$/);
    expect(hash).toBe(sha1(normalizeTitle('Some headline about the economy')));
  });

  it('does not collapse reworded coverage into one exact key', () => {
    // "launches" vs "unveils" are different words, so exact matching correctly fails
    // and these must be caught by the similarity layer instead. This documents the
    // boundary between the two dedup stages.
    expect(hashTitle('OpenAI launches new AI model')).not.toBe(
      hashTitle('OpenAI unveils its latest AI model'),
    );
  });
});

describe('jaccardSimilarity', () => {
  it('is 1 for identical token sets', () => {
    expect(jaccardSimilarity(['a', 'b'], ['b', 'a'])).toBe(1);
  });

  it('is 0 for disjoint sets', () => {
    expect(jaccardSimilarity(['a'], ['b'])).toBe(0);
  });

  it('is 0 when either side is empty rather than dividing by zero', () => {
    expect(jaccardSimilarity([], ['a'])).toBe(0);
    expect(jaccardSimilarity(['a'], [])).toBe(0);
  });

  it('computes intersection over union', () => {
    // {a,b,c} vs {b,c,d}: intersection 2, union 4.
    expect(jaccardSimilarity(['a', 'b', 'c'], ['b', 'c', 'd'])).toBeCloseTo(0.5, 10);
  });

  it('scores reworded coverage of one event above unrelated headlines', () => {
    const reworded = jaccardSimilarity(
      titleTokens('OpenAI launches new AI model'),
      titleTokens('OpenAI unveils its latest AI model'),
    );
    const unrelated = jaccardSimilarity(
      titleTokens('OpenAI launches new AI model'),
      titleTokens('Indian markets close at record high'),
    );

    expect(reworded).toBeGreaterThan(unrelated);
    expect(unrelated).toBe(0);
  });
});

describe('stripHtml', () => {
  it('removes tags and decodes common entities', () => {
    expect(stripHtml('<p>Markets &amp; bonds</p>')).toBe('Markets & bonds');
  });

  it('removes script and style bodies entirely', () => {
    // RSS descriptions do contain embedded markup; leaking script text into a headline
    // would be both wrong and a rendering hazard.
    expect(stripHtml('<script>alert(1)</script>Real text')).toBe('Real text');
    expect(stripHtml('<style>.a{color:red}</style>Real text')).toBe('Real text');
  });

  it('collapses the whitespace left behind by removed tags', () => {
    expect(stripHtml('<div>a</div>   <div>b</div>')).toBe('a b');
  });
});

describe('truncate', () => {
  it('leaves short strings untouched', () => {
    expect(truncate('short', 50)).toBe('short');
  });

  it('cuts on a word boundary and appends an ellipsis', () => {
    const source = 'the quick brown fox jumps over the lazy dog';
    const result = truncate(source, 20);

    expect(result).toBe('the quick brown fox...');
    expect(result.endsWith('...')).toBe(true);

    // The real invariant: the kept text is a prefix of the source that ends at a word
    // boundary, i.e. the source continues with a space rather than mid-word.
    const kept = result.slice(0, -3);
    expect(source.startsWith(kept)).toBe(true);
    expect(source.charAt(kept.length)).toBe(' ');
  });

  it('cuts hard when a single word exceeds the limit', () => {
    // No word boundary exists to cut on, so the guard falls back to a raw slice
    // rather than returning an empty string.
    const result = truncate('averyveryverylongsingleword', 10);
    expect(result).toBe('averyveryv...');
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('India Unveils National Compute Mission')).toBe(
      'india-unveils-national-compute-mission',
    );
  });

  it('strips punctuation and collapses separators', () => {
    expect(slugify("RBI's rate decision: what's next?!")).toBe('rbis-rate-decision-whats-next');
  });

  it('never emits leading or trailing hyphens', () => {
    expect(slugify('  ...hello...  ')).toBe('hello');
  });

  it('respects the length cap without leaving a trailing hyphen', () => {
    const slug = slugify('a'.repeat(30) + ' ' + 'b'.repeat(30), 32);
    expect(slug.length).toBeLessThanOrEqual(32);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('falls back to "untitled" rather than an empty slug', () => {
    // An empty slug would produce a route like /story/ and a unique-constraint clash.
    expect(slugify('!!!')).toBe('untitled');
    expect(slugify('')).toBe('untitled');
  });
});

describe('estimateReadingMinutes', () => {
  it('is at least 1 minute even for a bare headline', () => {
    expect(estimateReadingMinutes('Short headline')).toBe(1);
  });

  it('scales with word count at roughly 220 words per minute', () => {
    expect(estimateReadingMinutes('word '.repeat(660))).toBe(3);
  });

  it('ignores null and undefined parts', () => {
    expect(estimateReadingMinutes('word '.repeat(440), null, undefined)).toBe(2);
  });

  it('counts text across all parts, not just the first', () => {
    const combined = estimateReadingMinutes('word '.repeat(220), 'word '.repeat(220));
    expect(combined).toBe(2);
  });
});

describe('collapseWhitespace', () => {
  it('normalises newlines and tabs to single spaces', () => {
    expect(collapseWhitespace('a\n\n b\t\tc  ')).toBe('a b c');
  });
});
