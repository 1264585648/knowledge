import { Hono } from 'hono';
import { handleRequest } from './handler.ts';
import type { Env } from './types.ts';
const app = new Hono<{ Bindings: Env }>();
app.all('*', context => handleRequest(context.req.raw, context.env));
export default app;
