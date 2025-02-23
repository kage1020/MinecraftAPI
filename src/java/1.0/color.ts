import { Hono } from 'hono';
import { Bindings } from '@/types';
import { Color } from '@/types/1.0';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.get('1.0/colors.json');
  if (!data) return c.json({ error: 'Failed to load colors' }, 500);

  const colors = await data.json<Color[]>();
  return c.json(colors);
});

app.get('/:color', async (c) => {
  const { color: colorName } = c.req.param();
  const data = await c.env.R2.get('1.0/colors.json');
  if (!data) return c.json({ error: 'Failed to load colors' }, 500);

  const colors = await data.json<Color[]>();
  const color = colors.find((b) => b.name === colorName);

  if (!color) return c.json({ error: `${colorName} not found` }, 404);

  return c.json(color);
});

app.get('/:color/:key', async (c) => {
  const { color: colorName, key } = c.req.param();
  const data = await c.env.R2.get('1.0/colors.json');
  if (!data) return c.json({ error: 'Failed to load colors' }, 500);

  const colors = await data.json<Color[]>();
  const color = colors.find((b) => b.name === colorName);

  if (!color) return c.json({ error: `${colorName} not found` }, 404);
  if (!Object.keys(color).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: color[key as keyof typeof color] });
});

export default app;
