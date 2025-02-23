import { Hono } from 'hono';
import { Bindings } from '@/types';
import { Potion } from '@/types/1.0';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.get('1.0/items.json');
  if (!data) return c.json({ error: 'Failed to load items' }, 500);

  const items = await data.json<Potion[]>();
  return c.json(items);
});

app.get('/:item', async (c) => {
  const { item: itemName } = c.req.param();
  const data = await c.env.R2.get('1.0/items.json');
  if (!data) return c.json({ error: 'Failed to load items' }, 500);

  const items = await data.json<Potion[]>();
  const item = items.find((b) => b.name === itemName);

  if (!item) return c.json({ error: `${itemName} not found` }, 404);

  return c.json(item);
});

app.get('/:item/:key', async (c) => {
  const { item: itemName, key } = c.req.param();
  const data = await c.env.R2.get('1.0/items.json');
  if (!data) return c.json({ error: 'Failed to load items' }, 500);

  const items = await data.json<Potion[]>();
  const item = items.find((b) => b.name === itemName);

  if (!item) return c.json({ error: `${itemName} not found` }, 404);
  if (!Object.keys(item).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: item[key as keyof typeof item] });
});

export default app;
