import { Hono } from 'hono';
import { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.list();
  const enchantments = data.objects
    .map((o) => o.key)
    .filter((k) => k.startsWith('1.21.4/enchantment'))
    .map((k) => k.replace('1.21.4/enchantment/', '').replace('.json', ''));

  return c.json({ routes: enchantments });
});

export default app;
