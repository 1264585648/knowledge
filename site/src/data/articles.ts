import { getCollection } from 'astro:content';
export async function publishedArticles() {
  const entries = await getCollection('articles', ({ data }) =>
    data.status === 'published' && data.publishedAt.getTime() <= Date.now());
  for (const entry of entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) throw new Error('Article IDs must be lowercase slugs.');
    if (process.env.CONTENT_MODE === 'private' && entry.data.sample) throw new Error('Remove sample content before production build.');
  }
  return entries.sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}
export const articleURL = (id: string) => `/articles/${encodeURIComponent(id)}/`;
export const dateLabel = (date: Date) => date.toISOString().slice(0, 10);
