import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { topics } from './data/topics';
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: process.env.CONTENT_DIR || './content-example' }),
  schema: z.object({
    title: z.string().min(1), summary: z.string().min(1),
    publishedAt: z.coerce.date(), status: z.enum(['draft', 'published']),
    topics: z.array(z.string().refine(id => topics.some(topic => topic.id === id), 'Unknown topic')).min(1),
    sample: z.boolean().default(false),
  }),
});
export const collections = { articles };
