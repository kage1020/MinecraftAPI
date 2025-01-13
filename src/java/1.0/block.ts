import { Hono } from 'hono';
import blocks from '../../const/1.0/blocks.json';

const app = new Hono();

app.get('/', (c) => {
  return c.json({ routes: blocks.map((b) => b.name) });
});

app.get('/:block', (c) => {
  const { block: blockName } = c.req.param();
  const block = blocks.find((b) => b.name === blockName);

  if (!block) return c.json({ error: 'Block not found' }, 404);

  return c.json(block);
});

app.get('/:block/:key', (c) => {
  const { block: blockName, key } = c.req.param();
  const block = blocks.find((b) => b.name === blockName);

  if (!block) return c.json({ error: 'Block not found' }, 404);
  if (!Object.keys(block).includes(key)) return c.json({ error: `${key} not found` }, 404);

  return c.json({ [key]: block[key as keyof typeof block] });
});

export default app;
