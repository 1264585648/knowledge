import { getCollection } from 'astro:content';
import { isPublished } from './article-utils';
export { articleURL, dateLabel, topicArticles, adjacentArticles, readingMinutes } from './article-utils';
export async function publishedArticles() {
  const entries = await getCollection('articles');
  for (const entry of entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) throw new Error('Article IDs must be lowercase slugs.');
    if (process.env.CONTENT_MODE === 'private' && entry.data.sample) throw new Error('Remove sample content before production build.');
  }
  const now = Date.now();
  return entries.filter(entry => isPublished(entry, now))
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime() || a.id.localeCompare(b.id));
}
