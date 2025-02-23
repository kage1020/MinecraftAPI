import { Hono } from 'hono';
import { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.list();
  const trialSpawners = data.objects
    .map((o) => o.key)
    .filter((k) => k.startsWith('1.21.4/trial_spawner'))
    .map((k) => k.replace('1.21.4/trial_spawner/', '').replace('.json', ''));

  return c.json({ routes: trialSpawners });
});

export default app;
