import { Hono } from 'hono';
import { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.list();
  const recipes = data.objects
    .map((o) => o.key)
    .filter((k) => k.startsWith('1.21.4/recipe'))
    .map((k) => k.replace('1.21.4/recipe/', '').replace('.json', ''));

  return c.json({ routes: recipes });
});

export default app;
