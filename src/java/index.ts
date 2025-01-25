import { Hono } from 'hono';
import versions from '../const/version.json';
import v1 from './1.0';

const app = new Hono();

app.route('/1.0', v1);

app.get('/', (c) => {
  return c.json({ routes: versions.major });
});

app.get('/version', (c) => {
  return c.json({ versions });
});

app.get('/snapshot', (c) => {
  return c.json({ snapshots: versions.snapshot });
});

export default app;
