import { Hono } from 'hono';
import { Versions } from '../const/version';
import v1 from './1.0';

const app = new Hono();

app.route('/1.0', v1);

app.get('/', (c) => {
  return c.json({ routes: Versions });
});

export default app;
