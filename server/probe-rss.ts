/**
 * Throwaway probe: exercises provider -> normalize -> validate against the real public
 * feeds in the Source table. Deleted before commit; not part of the codebase.
 */
import { prisma } from './src/config/prisma.js';
import { normalizeBatch } from './src/pipeline/normalize.js';
import { partitionValid } from './src/pipeline/validate.js';
import { getEnabledProviders } from './src/providers/index.js';

const run = async (): Promise<void> => {
  const providers = await getEnabledProviders();
  console.log('enabled providers:', providers.map((p) => p.key).join(', ') || '(none)');

  for (const provider of providers) {
    const started = Date.now();
    const result = await provider.fetchLatestNews({ limitPerSource: 15 });

    console.log(`\n=== ${provider.displayName} ===`);
    console.log('  feeds requested :', result.requestCount);
    console.log('  raw articles    :', result.articles.length);
    console.log('  partial errors  :', result.partialErrors.length);
    for (const e of result.partialErrors.slice(0, 8)) {
      console.log(`     ! ${e.target} -> ${e.message}`);
    }

    const { articles, rejected } = normalizeBatch(result.articles, { providerKey: provider.key });
    const { accepted, reasonCounts } = partitionValid(articles, { maxAgeDays: 45 });

    console.log('  normalized      :', articles.length, `(dropped ${rejected})`);
    console.log('  valid           :', accepted.length);
    console.log('  rejected reasons:', JSON.stringify(reasonCounts));

    const tally = (pick: (a: (typeof accepted)[number]) => string): string => {
      const map = new Map<string, number>();
      for (const a of accepted) map.set(pick(a), (map.get(pick(a)) ?? 0) + 1);
      return [...map.entries()]
        .sort((x, y) => y[1] - x[1])
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
    };

    console.log('  categories      :', tally((a) => a.category));
    console.log('  publishers      :', tally((a) => a.sourceName));
    console.log('  with images     :', accepted.filter((a) => a.imageUrl).length, '/', accepted.length);

    console.log('  sample headlines:');
    for (const a of accepted.slice(0, 10)) {
      console.log(`     [${a.category}] ${a.title.slice(0, 76)}`);
      console.log(`        ${a.sourceName} | ${a.publishedAt.toISOString()}`);
    }

    // Identical normalized titles across publishers are exactly what story
    // clustering will group in the next step.
    const byTitleHash = new Map<string, string[]>();
    for (const a of accepted) {
      byTitleHash.set(a.titleHash, [...(byTitleHash.get(a.titleHash) ?? []), a.sourceName]);
    }
    const clusters = [...byTitleHash.values()].filter((v) => v.length > 1);
    console.log('  exact-title clusters in batch:', clusters.length);
    for (const c of clusters.slice(0, 3)) console.log('     ->', c.join(' + '));

    console.log('  elapsed ms      :', Date.now() - started);
  }

  await prisma.$disconnect();
};

run().catch((error: unknown) => {
  console.error('probe failed:', error);
  process.exitCode = 1;
});
