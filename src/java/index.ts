import { Hono } from 'hono';
import versions from '../const/versions.json';
import dataVersions from '../const/data-versions.json';
import v1 from './1.0';

const app = new Hono();

app.route('/1.0', v1);

app.get('/', (c) => {
  return c.json({ routes: [...versions, 'release', 'snapshot', 'data-version'] });
});

app.get('/release', (c) => {
  return c.json({ versions: versions.filter((v) => v.type === 'release') });
});

app.get('/snapshot', (c) => {
  return c.json({ snapshots: versions.filter((v) => v.type === 'snapshot') });
});

app.get('/data-version', (c) => {
  return c.json({ dataVersions });
});

export default app;
