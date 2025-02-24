import { Hono } from 'hono';
import { Bindings } from '@/types';
import { Advancement } from '@/types/1.21.4';
import { list } from '@/libs/fetch';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await list(c.env.R2, { prefix: '1.21.4/advancement' });
  const advancements = data
    .map((o) => o.key)
    .map((k) => k.replace('1.21.4/advancement/', '').replace('.json', ''));
  return c.json({ routes: advancements });
});

app.get('/:category', async (c) => {
  const { category } = c.req.param();
  const data = await list(c.env.R2, { prefix: `1.21.4/advancement/${category}/` });
  const advancements = data
    .map((o) => o.key)
    .map((k) => k.replace(`1.21.4/advancement/${category}/`, '').replace('.json', ''));

  return c.json({ routes: advancements });
});

app.get('/recipes/:category', async (c) => {
  const { category } = c.req.param();
  const data = await list(c.env.R2, { prefix: `1.21.4/advancement/recipes/${category}/` });
  const advancements = data
    .map((o) => o.key)
    .map((k) => k.replace(`1.21.4/advancement/recipes/${category}/`, '').replace('.json', ''));

  return c.json({ routes: advancements });
});

app.get('/recipes/:category/:advancement', async (c) => {
  const { category, advancement: advancementName } = c.req.param();
  const data = await c.env.R2.get(`1.21.4/advancement/recipes/${category}/${advancementName}.json`);
  if (!data) return c.json({ error: 'Failed to load advancement' }, 500);

  const advancement = await data.json<Advancement>();
  return c.json(advancement);
});

app.get('/:category/:advancement', async (c) => {
  const { category, advancement: advancementName } = c.req.param();
  const data = await c.env.R2.get(`1.21.4/advancement/${category}/${advancementName}.json`);
  if (!data) return c.json({ error: 'Failed to load advancement' }, 500);

  const advancement = await data.json<Advancement>();
  return c.json(advancement);
});

export default app;
