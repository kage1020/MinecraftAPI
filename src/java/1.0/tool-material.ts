import { Hono } from 'hono';
import toolMaterial from '../../const/1.0/tool-materials.json';

const app = new Hono();

app.get('/', (c) => {
  return c.json(toolMaterial);
});

app.get('/:material', (c) => {
  const { material: materialName } = c.req.param();
  const material = toolMaterial.find((b) => b.name === materialName);

  if (!material) return c.json({ error: 'Material not found' }, 404);

  return c.json(material);
});

app.get('/:material/:key', (c) => {
  const { material: materialName, key } = c.req.param();
  const material = toolMaterial.find((b) => b.name === materialName);

  if (!material) return c.json({ error: 'Material not found' }, 404);
  if (!Object.keys(material).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: material[key as keyof typeof material] });
});

export default app;
