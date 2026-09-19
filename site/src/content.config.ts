import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { topics } from './data/topics';
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: process.env.CONTENT_DIR || './content-example' }),
  schema: z.object({
    title: z.string().trim().min(1), summary: z.string().trim().min(1),
    publishedAt: z.coerce.date(), status: z.enum(['draft', 'published']),
    topics: z.array(z.string().refine(id => topics.some(topic => topic.id === id), 'Unknown topic')).min(1),
    sample: z.boolean().default(false),
    order: z.number().int().positive().optional(),
    // Only same-origin media; never send the reader to a third-party tracking image.
    cover: z.string().regex(/^\/media\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpe?g|avif)$/).optional(),
    coverAlt: z.string().trim().min(1).optional(),
    tocDepth: z.union([z.literal(2), z.literal(3)]).default(2),
  }).refine(data => !data.cover || Boolean(data.coverAlt), {
    message: 'coverAlt is required when cover is set', path: ['coverAlt'],
  }),
});
export const collections = { articles };
