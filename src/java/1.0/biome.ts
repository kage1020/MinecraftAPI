import { Hono } from 'hono';
import { Biome } from '@/types/1.0';
import { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.get('1.0/biomes.json');
  if (!data) return c.json({ error: 'Failed to load biomes' }, 500);

  const biomes = await data.json<Biome[]>();
  return c.json(biomes);
});

app.get('/:biome', async (c) => {
  const { biome: biomeName } = c.req.param();
  const data = await c.env.R2.get('1.0/biomes.json');
  if (!data) return c.json({ error: 'Failed to load biomes' }, 500);

  const biomes = await data.json<Biome[]>();
  const biome = biomes.find((b) => b.name === biomeName);

  if (!biome) return c.json({ error: `${biomeName} not found` }, 404);

  return c.json(biome);
});

app.get('/:biome/:key', async (c) => {
  const { biome: biomeName, key } = c.req.param();
  const data = await c.env.R2.get('1.0/biomes.json');
  if (!data) return c.json({ error: 'Failed to load biomes' }, 500);

  const biomes = await data.json<Biome[]>();
  const biome = biomes.find((b) => b.name === biomeName);

  if (!biome) return c.json({ error: `${biomeName} not found` }, 404);
  if (!Object.keys(biome).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: biome[key as keyof typeof biome] });
});

export default app;
