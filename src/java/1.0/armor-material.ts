import { Hono } from 'hono';
import { ArmorMaterial } from '@/types/1.0';
import { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.get('1.0/armor-materials.json');
  if (!data) return c.json({ error: 'Failed to load armor materials' }, 500);

  const armorMaterial = await data.json<ArmorMaterial[]>();
  return c.json(armorMaterial);
});

app.get('/:material', async (c) => {
  const { material: materialName } = c.req.param();
  const data = await c.env.R2.get('1.0/armor-materials.json');
  if (!data) return c.json({ error: 'Failed to load armor materials' }, 500);

  const armorMaterial = await data.json<ArmorMaterial[]>();
  const material = armorMaterial.find((b) => b.name === materialName);

  if (!material) return c.json({ error: `${materialName} not found` }, 404);

  return c.json(material);
});

app.get('/:material/:key', async (c) => {
  const { material: materialName, key } = c.req.param();
  const data = await c.env.R2.get('1.0/armor-materials.json');
  if (!data) return c.json({ error: 'Failed to load armor materials' }, 500);

  const armorMaterial = await data.json<ArmorMaterial[]>();
  const material = armorMaterial.find((b) => b.name === materialName);

  if (!material) return c.json({ error: `${materialName} not found` }, 404);
  if (!Object.keys(material).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: material[key as keyof typeof material] });
});

export default app;
