import { Hono } from 'hono';
import { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.list();
  const equipments = data.objects
    .map((o) => o.key)
    .filter((k) => k.startsWith('1.21.4/equipment'))
    .map((k) => k.replace('1.21.4/equipment/', '').replace('.json', ''));

  return c.json({ routes: equipments });
});

export default app;
