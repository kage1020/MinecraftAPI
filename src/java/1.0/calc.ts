import { Hono } from 'hono';
import { GrassColorBuffer } from '@/const/1.0/grass';

const app = new Hono();

app.get('/', (c) => {
  return c.json({ routes: ['grass-color'] });
});

app.get('/grass-color', (c) => {
  const { temperature, downfall, swamp } = c.req.query();
  if (!temperature || isNaN(parseFloat(temperature)))
    return c.json({ error: 'Invalid temperature' }, 400);
  if (!downfall || isNaN(parseFloat(downfall))) return c.json({ error: 'Invalid downfall' }, 400);

  function clamp(value: number) {
    return Math.min(Math.max(value, 0), 1);
  }
  const temp = clamp(parseFloat(temperature));
  const down = clamp(parseFloat(downfall));
  const tempFactor = Math.floor((1 - down * temp) * 255);
  const downFactor = Math.floor((1 - temp) * 255);

  const colorIndex = (tempFactor << 8) | downFactor;
  const colorSelected = GrassColorBuffer[colorIndex];
  const colorInt = swamp ? ((colorSelected & 16711422) + 5115470) / 2 + 16 ** 7 : colorSelected;
  return c.json({ color: `#${colorInt.toString(16).slice(2)}` });
});

export default app;
