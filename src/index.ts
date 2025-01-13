import { Hono } from 'hono';
import java from './java';

const app = new Hono();

app.route('/java', java);

app.get('/', (c) => {
  return c.json({ routes: ['java', 'bedrock'] });
});

app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

export default app;
