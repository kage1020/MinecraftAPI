import { Hono } from 'hono';
import armorMaterial from './armor-material';
import biome from './biome';
import block from './block';
import calc from './calc';
import color from './color';
import death from './death';
import potion from './potion';
import toolMaterial from './tool-material';

const app = new Hono();

app.route('/armor-material', armorMaterial);
app.route('/biome', biome);
app.route('/block', block);
app.route('/calc', calc);
app.route('/color', color);
app.route('/death', death);
app.route('/potion', potion);
app.route('/tool-material', toolMaterial);

app.get('/', (c) => {
  return c.json({
    routes: ['armor-material', 'biome', 'block', 'calc', 'color', 'potion', 'tool-material'],
  });
});

export default app;
