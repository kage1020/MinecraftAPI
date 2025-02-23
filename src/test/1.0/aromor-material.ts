import { describe, expect, test, vi } from 'vitest';
import app from '../../';

const env = {
  R2: {
    get: vi.fn(async (path: string) => {
      if (path === '1.0/armor-materials.json') {
        return {
          json: () => [
            {
              id: 1,
              name: 'leather',
              maxDamageFactor: 5,
              damageReductionAmount: [1, 2, 3, 1],
              enchantability: 15,
            },
            {
              id: 2,
              name: 'chain',
              maxDamageFactor: 15,
              damageReductionAmount: [2, 5, 4, 1],
              enchantability: 12,
            },
          ],
        };
      }
    }),
  },
};

describe('java', () => {
  describe('1.0', () => {
    describe('armor-material', () => {
      test('GET /', async () => {
        const res = await app.request('/java/1.0/armor-material', undefined, env);
        const data = await res.json();
        expect(data).toBeInstanceOf(Array);
      });

      test('GET /:material', async () => {
        const res = await app.request('/java/1.0/armor-material/leather', undefined, env);
        const data = await res.json();
        expect(data).toHaveProperty('name', 'leather');
      });

      test('GET /:material - Material not found', async () => {
        const res = await app.request('/java/1.0/armor-material/ruby', undefined, env);
        const data = await res.json();
        expect(data).toHaveProperty('error', 'ruby not found');
      });

      test('GET /:material/:key', async () => {
        const res = await app.request(
          '/java/1.0/armor-material/leather/enchantability',
          undefined,
          env
        );
        const data = await res.json();
        expect(data).toHaveProperty('enchantability');
      });

      test('GET /:material/:key - Material not found', async () => {
        const res = await app.request('/java/1.0/armor-material/ruby/foo', undefined, env);
        const data = await res.json();
        expect(data).toHaveProperty('error', 'ruby not found');
      });

      test('GET /:material/:key - Key not found', async () => {
        const res = await app.request('/java/1.0/armor-material/leather/foo', undefined, env);
        const data = await res.json();
        expect(data).toHaveProperty('error', 'foo not found');
      });
    });
  });
});
