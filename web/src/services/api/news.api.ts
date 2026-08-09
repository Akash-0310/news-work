import { cleanParams, getData, getPage } from './client';
import type {
  Article,
  ArticleDetail,
  HomeFeed,
  NewsQueryParams,
  Page,
  Story,
} from '@/types/api';

/**
 * News resource. One function per API endpoint, no caching or React concerns here --
 * that belongs to the hooks layer.
 */

export const fetchNews = (params: NewsQueryParams = {}): Promise<Page<Article>> =>
  getPage<Article>('/news', { params: cleanParams({ ...params }) });

export const fetchLatestNews = (
  params: Pick<NewsQueryParams, 'page' | 'limit' | 'category' | 'country'> = {},
): Promise<Page<Article>> => getPage<Article>('/news/latest', { params: cleanParams({ ...params }) });

export const fetchNewsByCategory = (
  category: string,
  params: Omit<NewsQueryParams, 'category'> = {},
): Promise<Page<Article>> =>
  getPage<Article>(`/news/category/${encodeURIComponent(category)}`, {
    params: cleanParams({ ...params }),
  });

export const fetchNewsByCountry = (
  country: string,
  params: Omit<NewsQueryParams, 'country'> = {},
): Promise<Page<Article>> =>
  getPage<Article>(`/news/country/${encodeURIComponent(country)}`, {
    params: cleanParams({ ...params }),
  });

export const fetchHomeFeed = (params: { perSection?: number; topStories?: number } = {}) =>
  getData<HomeFeed>('/news/home', { params: cleanParams({ ...params }) });

export const fetchTopStories = (
  params: { limit?: number; category?: string; country?: string; hours?: number } = {},
): Promise<Story[]> => getData<Story[]>('/news/top-stories', { params: cleanParams({ ...params }) });

export const fetchArticle = (id: string): Promise<ArticleDetail> =>
  getData<ArticleDetail>(`/news/${encodeURIComponent(id)}`);

export const fetchStory = (slug: string): Promise<Story> =>
  getData<Story>(`/news/stories/${encodeURIComponent(slug)}`);
