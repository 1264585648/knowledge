/** Content-only helpers: deterministic ordering, navigation and editorial reading time. */
export interface ArticleMeta {
  title: string;
  summary: string;
  publishedAt: Date;
  status: 'draft' | 'published';
  topics: string[];
  order?: number;
  sample?: boolean;
}
export interface ArticleEntry { id: string; data: ArticleMeta; body?: string }
export const articleURL = (id: string) => `/articles/${encodeURIComponent(id)}/`;
export const dateLabel = (date: Date) => date.toISOString().slice(0, 10);
export function isPublished(article: ArticleEntry, now = Date.now()): boolean {
  return article.data.status === 'published' && article.data.publishedAt.getTime() <= now;
}
export function topicArticles<T extends ArticleEntry>(articles: T[], topicId: string): T[] {
  return articles.filter(a => a.data.topics.includes(topicId)).sort((a, b) =>
    (a.data.order ?? Number.MAX_SAFE_INTEGER) - (b.data.order ?? Number.MAX_SAFE_INTEGER) ||
    a.data.publishedAt.getTime() - b.data.publishedAt.getTime() || a.id.localeCompare(b.id));
}
export function adjacentArticles<T extends ArticleEntry>(articles: T[], current: T) {
  const entries = topicArticles(articles, current.data.topics[0]);
  const index = entries.findIndex(a => a.id === current.id);
  return { previous: index > 0 ? entries[index - 1] : undefined,
    next: index >= 0 ? entries[index + 1] : undefined };
}
export function readingMinutes(markdown = ''): number {
  const text = markdown.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[\s#>*_`~|]/g, '');
  return Math.max(1, Math.ceil(Array.from(text).length / 350));
}
