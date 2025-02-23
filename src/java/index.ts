import { Hono } from 'hono';
import v1_0 from './1.0';
import v1_21_4 from './1.21.4';
import { Bindings } from '@/types';
import { DataVersion, Version } from '@/types/1.0';

const app = new Hono<{ Bindings: Bindings }>();

app.route('/1.0', v1_0);
app.route('/1.21.4', v1_21_4);

app.get('/', async (c) => {
  const versionData = await c.env.R2.get('versions.json');
  if (!versionData) return c.json({ error: 'Failed to load versions' });

  const versions = await versionData.json<Version[]>();
  return c.json({ routes: ['release', 'snapshot', 'data-version', ...versions.map((v) => v.id)] });
});

app.get('/release', async (c) => {
  const versionData = await c.env.R2.get('versions.json');
  if (!versionData) return c.json({ error: 'Failed to load versions' });

  const versions = await versionData.json<Version[]>();
  return c.json({ versions: versions.filter((v) => v.type === 'release') });
});

app.get('/snapshot', async (c) => {
  const versionData = await c.env.R2.get('versions.json');
  if (!versionData) return c.json({ error: 'Failed to load versions' });

  const versions = await versionData.json<Version[]>();
  return c.json({ snapshots: versions.filter((v) => v.type === 'snapshot') });
});

app.get('/data-version', async (c) => {
  const dataVersionData = await c.env.R2.get('data-versions.json');
  if (!dataVersionData) return c.json({ error: 'Failed to load data versions' });

  const dataVersions = await dataVersionData.json<DataVersion>();
  return c.json({ dataVersions });
});

export default app;
