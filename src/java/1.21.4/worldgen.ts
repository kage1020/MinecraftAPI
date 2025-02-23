import { Hono } from 'hono';
import { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.list();
  const worldGens = data.objects
    .map((o) => o.key)
    .filter((k) => k.startsWith('1.21.4/worldgen'))
    .map((k) => k.replace('1.21.4/worldgen/', '').replace('.json', ''));

  return c.json({ routes: worldGens });
});

export default app;
