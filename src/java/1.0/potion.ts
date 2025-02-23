import { Hono } from 'hono';
import { Bindings } from '@/types';
import { Potion } from '@/types/1.0';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.get('1.0/potions.json');
  if (!data) return c.json({ error: 'Failed to load potions' }, 500);

  const potions = await data.json<Potion[]>();
  return c.json(potions);
});

app.get('/:potion', async (c) => {
  const { potion: potionName } = c.req.param();
  const data = await c.env.R2.get('1.0/potions.json');
  if (!data) return c.json({ error: 'Failed to load potions' }, 500);

  const potions = await data.json<Potion[]>();
  const potion = potions.find((b) => b.name === potionName);

  if (!potion) return c.json({ error: `${potionName} not found` }, 404);

  return c.json(potion);
});

app.get('/:potion/:key', async (c) => {
  const { potion: potionName, key } = c.req.param();
  const data = await c.env.R2.get('1.0/potions.json');
  if (!data) return c.json({ error: 'Failed to load potions' }, 500);

  const potions = await data.json<Potion[]>();
  const potion = potions.find((b) => b.name === potionName);

  if (!potion) return c.json({ error: `${potionName} not found` }, 404);
  if (!Object.keys(potion).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: potion[key as keyof typeof potion] });
});

export default app;
