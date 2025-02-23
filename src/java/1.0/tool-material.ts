import { Bindings } from '@/types';
import { ToolMaterial } from '@/types/1.0';
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  const data = await c.env.R2.get('1.0/tool-material.json');
  if (!data) return c.json({ error: 'Failed to load tool material' }, 500);

  const toolMaterial = await data.json<ToolMaterial[]>();
  return c.json(toolMaterial);
});

app.get('/:material', async (c) => {
  const { material: materialName } = c.req.param();
  const data = await c.env.R2.get('1.0/tool-material.json');
  if (!data) return c.json({ error: 'Failed to load tool material' }, 500);

  const toolMaterial = await data.json<ToolMaterial[]>();
  const material = toolMaterial.find((b) => b.name === materialName);

  if (!material) return c.json({ error: `${materialName} not found` }, 404);

  return c.json(material);
});

app.get('/:material/:key', async (c) => {
  const { material: materialName, key } = c.req.param();
  const data = await c.env.R2.get('1.0/tool-material.json');
  if (!data) return c.json({ error: 'Failed to load tool material' }, 500);

  const toolMaterial = await data.json<ToolMaterial[]>();
  const material = toolMaterial.find((b) => b.name === materialName);

  if (!material) return c.json({ error: `${materialName} not found` }, 404);
  if (!Object.keys(material).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: material[key as keyof typeof material] });
});

export default app;
