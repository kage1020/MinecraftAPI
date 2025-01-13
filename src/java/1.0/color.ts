import { Hono } from 'hono';
import colors from '../../const/1.0/colors.json';

const app = new Hono();

app.get('/', (c) => {
  return c.json({ routes: colors.map((b) => b.name) });
});

app.get('/:color', (c) => {
  const { color: colorName } = c.req.param();
  const color = colors.find((b) => b.name === colorName);

  if (!color) return c.json({ error: 'Color not found' }, 404);

  return c.json(color);
});

app.get('/:color/:key', (c) => {
  const { color: colorName, key } = c.req.param();
  const color = colors.find((b) => b.name === colorName);

  if (!color) return c.json({ error: 'Color not found' }, 404);
  if (!Object.keys(color).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: color[key as keyof typeof color] });
});

export default app;
