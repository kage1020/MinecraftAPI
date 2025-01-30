import { Hono } from 'hono';
import biomes from '../../const/1.0/biomes.json';

const app = new Hono();

app.get('/', (c) => {
  return c.json(biomes);
});

app.get('/:biome', (c) => {
  const { biome: biomeName } = c.req.param();
  const biome = biomes.find((b) => b.name === biomeName);

  if (!biome) return c.json({ error: 'Biome not found' }, 404);

  return c.json(biome);
});

app.get('/:biome/:key', (c) => {
  const { biome: biomeName, key } = c.req.param();
  const biome = biomes.find((b) => b.name === biomeName);

  if (!biome) return c.json({ error: 'Biome not found' }, 404);
  if (!Object.keys(biome).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: biome[key as keyof typeof biome] });
});

export default app;
