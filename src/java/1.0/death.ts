import { Hono } from 'hono';
import { Bindings } from '@/types';
import { Death } from '@/types/1.0';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.get('1.0/deaths.json');
  if (!data) return c.json({ error: 'Failed to load deaths' }, 500);

  const deaths = await data.json<Death[]>();
  return c.json(deaths);
});

app.get('/:death', async (c) => {
  const { death: deathName } = c.req.param();
  const data = await c.env.R2.get('1.0/deaths.json');
  if (!data) return c.json({ error: 'Failed to load deaths' }, 500);

  const deaths = await data.json<Death[]>();
  const death = deaths.find((b) => b.name === deathName);

  if (!death) return c.json({ error: `${deathName} not found` }, 404);

  return c.json(death);
});

app.get('/:death/:key', async (c) => {
  const { death: deathName, key } = c.req.param();
  const deaths = await c.env.R2.get('1.0/deaths.json');
  if (!deaths) return c.json({ error: 'Failed to load deaths' }, 500);

  const deathList = await deaths.json<Death[]>();
  const death = deathList.find((b) => b.name === deathName);

  if (!death) return c.json({ error: `${deathName} not found` }, 404);
  if (!Object.keys(death).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: death[key as keyof typeof death] });
});

export default app;
