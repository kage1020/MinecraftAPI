import { Hono } from 'hono';
import deaths from '../../const/1.0/deaths.json';

const app = new Hono();

app.get('/', (c) => {
  return c.json({ routes: deaths.map((b) => b.name) });
});

app.get('/:death', (c) => {
  const { death: deathName } = c.req.param();
  const death = deaths.find((b) => b.name === deathName);

  if (!death) return c.json({ error: 'Death not found' }, 404);

  return c.json(death);
});

app.get('/:death/:key', (c) => {
  const { death: deathName, key } = c.req.param();
  const death = deaths.find((b) => b.name === deathName);

  if (!death) return c.json({ error: 'Death not found' }, 404);
  if (!Object.keys(death).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: death[key as keyof typeof death] });
});

export default app;
