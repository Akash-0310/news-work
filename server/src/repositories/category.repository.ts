import { Prisma, prisma } from '../config/prisma.js';

/**
 * Category persistence.
 *
 * The taxonomy is small (a few dozen rows) and changes rarely, so reads are simple
 * and the service layer memoizes the slug tree rather than optimizing here.
 */

export const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  weight: true,
  position: true,
  isPrimary: true,
  colorHex: true,
  iconName: true,
  parent: { select: { slug: true } },
} satisfies Prisma.CategorySelect;

export type CategoryRecord = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;

const withChildrenSelect = {
  ...categorySelect,
  children: { select: categorySelect, orderBy: { position: 'asc' } },
} satisfies Prisma.CategorySelect;

export type CategoryWithChildren = Prisma.CategoryGetPayload<{ select: typeof withChildrenSelect }>;

export const findAllCategories = async (): Promise<CategoryRecord[]> =>
  prisma.category.findMany({ select: categorySelect, orderBy: [{ position: 'asc' }, { name: 'asc' }] });

/** Top-level categories with their children nested: the shape the nav needs. */
export const findCategoryTree = async (): Promise<CategoryWithChildren[]> =>
  prisma.category.findMany({
    where: { parentId: null },
    select: withChildrenSelect,
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
  });

export const findCategoryBySlug = async (slug: string): Promise<CategoryWithChildren | null> =>
  prisma.category.findUnique({ where: { slug }, select: withChildrenSelect });

/** Slug -> id and slug -> child slugs, loaded in one query for the pipeline and services. */
export const findSlugIndex = async (): Promise<
  { slug: string; id: string; weight: number; childSlugs: string[] }[]
> => {
  const rows = await prisma.category.findMany({
    select: {
      id: true,
      slug: true,
      weight: true,
      children: { select: { slug: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    weight: row.weight,
    childSlugs: row.children.map((child) => child.slug),
  }));
};

export const countCategories = async (): Promise<number> => prisma.category.count();
