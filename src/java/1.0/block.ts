import { Hono } from 'hono';
import { Bindings } from '@/types';
import { Block } from '@/types/1.0';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.get('1.0/blocks.json');
  if (!data) return c.json({ error: 'Failed to load blocks' }, 500);

  const blocks = await data.json<Block[]>();
  return c.json(blocks);
});

app.get('/:block', async (c) => {
  const { block: blockName } = c.req.param();
  const data = await c.env.R2.get('1.0/blocks.json');
  if (!data) return c.json({ error: 'Failed to load blocks' }, 500);

  const blocks = await data.json<Block[]>();
  const block = blocks.find((b) => b.name === blockName);

  if (!block) return c.json({ error: `${blockName} not found` }, 404);

  return c.json(block);
});

app.get('/:block/:key', async (c) => {
  const { block: blockName, key } = c.req.param();

  const data = await c.env.R2.get('1.0/blocks.json');
  if (!data) return c.json({ error: 'Failed to load blocks' }, 500);

  const blocks = await data.json<Block[]>();
  const block = blocks.find((b) => b.name === blockName);

  if (!block) return c.json({ error: `${blockName} not found` }, 404);
  if (!Object.keys(block).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: block[key as keyof typeof block] });
});

export default app;
