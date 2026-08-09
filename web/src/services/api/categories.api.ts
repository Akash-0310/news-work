import { getData } from './client';
import type { Category } from '@/types/api';

export const fetchCategories = (withCounts = false): Promise<Category[]> =>
  getData<Category[]>('/categories', { params: withCounts ? { withCounts: true } : undefined });

export const fetchCategory = (slug: string): Promise<Category> =>
  getData<Category>(`/categories/${encodeURIComponent(slug)}`);
