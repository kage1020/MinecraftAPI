import { Hono } from 'hono';
import achievement from './achievement';
import armorMaterial from './armor-material';
import biome from './biome';
import block from './block';
import calc from './calc';
import color from './color';
import death from './death';
import item from './item';
import potion from './potion';
import toolMaterial from './tool-material';

const app = new Hono();

app.route('/achievement', achievement);
app.route('/armor-material', armorMaterial);
app.route('/biome', biome);
app.route('/block', block);
app.route('/calc', calc);
app.route('/color', color);
app.route('/death', death);
app.route('/item', item);
app.route('/potion', potion);
app.route('/tool-material', toolMaterial);

app.get('/', (c) => {
  return c.json({
    routes: Object.values(app.routes).map((route) => route.path),
  });
});

export default app;
