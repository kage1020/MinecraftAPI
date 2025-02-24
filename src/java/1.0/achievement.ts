import { list } from '@/libs/fetch';
import { Bindings } from '@/types';
import { Achievement } from '@/types/1.0';
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await list(c.env.R2, { prefix: '1.0/achievement' });
  const achievements = data
    .map((o) => o.key)
    .map((k) => k.replace('1.0/achievement/', '').replace('.json', ''));
  return c.json({ routes: achievements });
});

app.get('/:achievement', async (c) => {
  const { achievement: achievementName } = c.req.param();
  const data = await c.env.R2.get(`1.0/achievement/${achievementName}.json`);
  if (!data) return c.json({ error: `${achievementName} not found` }, 500);

  const achievement = await data.json<Achievement>();
  return c.json(achievement);
});

app.get('/:achievement/:key', async (c) => {
  const { achievement: achievementName, key } = c.req.param();
  const data = await c.env.R2.get(`1.0/achievement/${achievementName}.json`);
  if (!data) return c.json({ error: `${achievementName} not found` }, 500);

  const achievement = await data.json<Achievement>();
  if (!Object.keys(achievement).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: achievement[key as keyof typeof achievement] });
});

export default app;
