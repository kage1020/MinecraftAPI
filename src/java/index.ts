import { Hono } from 'hono';
import versions from '../const/version.json';
import dataVersions from '../const/data-version.json';
import v1 from './1.0';

const app = new Hono();

app.route('/1.0', v1);

app.get('/', (c) => {
  return c.json({ routes: [...versions.major, 'version', 'snapshot', 'data-version'] });
});

app.get('/version', (c) => {
  return c.json({ versions: versions.major });
});

app.get('/snapshot', (c) => {
  return c.json({ snapshots: versions.snapshot });
});

app.get('/data-version', (c) => {
  return c.json({ dataVersions });
});

export default app;
