import { Hono } from 'hono';
import { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.list();
  const blockStates = data.objects
    .map((o) => o.key)
    .filter((k) => k.startsWith('1.21.4/blockstate'))
    .map((k) => k.replace('1.21.4/blockstate/', '').replace('.json', ''));

  return c.json({ routes: blockStates });
});

export default app;
