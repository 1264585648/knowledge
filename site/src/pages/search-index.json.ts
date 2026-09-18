import { publishedArticles, articleURL } from '../data/articles';
export async function GET() {
  const articles = await publishedArticles();
  return new Response(JSON.stringify(articles.map(article => ({
    title: article.data.title, summary: article.data.summary, url: articleURL(article.id),
  }))), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
