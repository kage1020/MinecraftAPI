import { Hono } from 'hono';
import potions from '../../const/1.0/potions.json';

const app = new Hono();

app.get('/', (c) => {
  return c.json(potions);
});

app.get('/:potion', (c) => {
  const { potion: potionName } = c.req.param();
  const potion = potions.find((b) => b.name === potionName);

  if (!potion) return c.json({ error: 'Potion not found' }, 404);

  return c.json(potion);
});

app.get('/:potion/:key', (c) => {
  const { potion: potionName, key } = c.req.param();
  const potion = potions.find((b) => b.name === potionName);

  if (!potion) return c.json({ error: 'Potion not found' }, 404);
  if (!Object.keys(potion).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: potion[key as keyof typeof potion] });
});

export default app;
