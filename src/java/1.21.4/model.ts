import { Hono } from 'hono';
import { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.list();
  const models = data.objects
    .map((o) => o.key)
    .filter((k) => k.startsWith('1.21.4/models'))
    .map((k) => k.replace('1.21.4/models/', '').replace('.json', ''));

  return c.json({ routes: models });
});

export default app;
