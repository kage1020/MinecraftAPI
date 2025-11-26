# Minecraft Web API アーキテクチャ設計書

## 1. ディレクトリ構造

```
minecraft-api/
├── src/
│   ├── index.ts                 # エントリーポイント
│   ├── app.ts                   # Honoアプリケーション設定
│   │
│   ├── graphql/
│   │   ├── index.ts             # GraphQL Yoga設定
│   │   ├── schema.ts            # Pothosスキーマビルダー
│   │   ├── context.ts           # GraphQLコンテキスト定義
│   │   │
│   │   ├── types/               # GraphQL型定義
│   │   │   ├── index.ts
│   │   │   ├── version.ts
│   │   │   ├── item.ts
│   │   │   ├── block.ts
│   │   │   ├── recipe.ts
│   │   │   ├── entity.ts
│   │   │   ├── enchantment.ts
│   │   │   ├── effect.ts
│   │   │   ├── biome.ts
│   │   │   ├── tag.ts
│   │   │   └── search.ts
│   │   │
│   │   ├── inputs/              # 入力型・フィルター
│   │   │   ├── index.ts
│   │   │   ├── pagination.ts
│   │   │   ├── item-filter.ts
│   │   │   ├── block-filter.ts
│   │   │   ├── recipe-filter.ts
│   │   │   └── entity-filter.ts
│   │   │
│   │   └── resolvers/           # リゾルバー
│   │       ├── index.ts
│   │       ├── query.ts         # ルートクエリ
│   │       ├── item.resolver.ts
│   │       ├── block.resolver.ts
│   │       ├── recipe.resolver.ts
│   │       ├── entity.resolver.ts
│   │       └── search.resolver.ts
│   │
│   ├── services/                # ビジネスロジック
│   │   ├── index.ts
│   │   ├── version.service.ts
│   │   ├── item.service.ts
│   │   ├── block.service.ts
│   │   ├── recipe.service.ts
│   │   ├── entity.service.ts
│   │   ├── enchantment.service.ts
│   │   ├── biome.service.ts
│   │   └── search.service.ts
│   │
│   ├── data/                    # データアクセス層
│   │   ├── index.ts
│   │   ├── loader.ts            # データローダー（DataLoader）
│   │   ├── cache.ts             # キャッシュ管理
│   │   ├── kv.ts                # Cloudflare KVアクセス
│   │   └── r2.ts                # Cloudflare R2アクセス
│   │
│   ├── routes/                  # Honoルート
│   │   ├── index.ts
│   │   ├── graphql.ts           # /graphql エンドポイント
│   │   ├── assets.ts            # /assets 静的アセット
│   │   └── health.ts            # /health ヘルスチェック
│   │
│   ├── middleware/              # ミドルウェア
│   │   ├── index.ts
│   │   ├── cors.ts
│   │   ├── rate-limit.ts
│   │   ├── cache.ts
│   │   └── error-handler.ts
│   │
│   ├── types/                   # TypeScript型定義
│   │   ├── index.ts
│   │   ├── minecraft.ts         # Minecraftデータ型
│   │   ├── env.ts               # 環境変数型
│   │   └── context.ts           # コンテキスト型
│   │
│   └── utils/                   # ユーティリティ
│       ├── index.ts
│       ├── id.ts                # ID変換
│       ├── pagination.ts        # ページネーション
│       └── validation.ts        # バリデーション
│
├── data/                        # 静的データ（ビルド時に生成）
│   ├── versions.json
│   └── {version}/
│       ├── items.json
│       ├── blocks.json
│       ├── recipes.json
│       ├── entities.json
│       ├── enchantments.json
│       ├── effects.json
│       ├── biomes.json
│       ├── tags/
│       │   ├── blocks.json
│       │   ├── items.json
│       │   └── entities.json
│       └── lang/
│           ├── en_us.json
│           └── ja_jp.json
│
├── scripts/                     # ビルド・データ生成スクリプト
│   ├── extract-data.ts          # Minecraft JARからデータ抽出
│   ├── generate-types.ts        # 型生成
│   ├── upload-assets.ts         # R2へのアセットアップロード
│   └── sync-versions.ts         # バージョン同期
│
├── tests/                       # テスト
│   ├── unit/
│   │   ├── services/
│   │   └── utils/
│   ├── integration/
│   │   ├── graphql/
│   │   └── routes/
│   └── fixtures/
│       └── data/
│
├── wrangler.toml                # Cloudflare Workers設定
├── tsconfig.json
├── package.json
├── biome.json                   # Biome設定
└── vitest.config.ts
```

---

## 2. コンポーネント設計

### 2.1 Honoアプリケーション

```typescript
// src/app.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

import { graphqlRoutes } from './routes/graphql'
import { assetRoutes } from './routes/assets'
import { healthRoutes } from './routes/health'
import { rateLimiter } from './middleware/rate-limit'
import { errorHandler } from './middleware/error-handler'

import type { Env } from './types/env'

const app = new Hono<{ Bindings: Env }>()

// グローバルミドルウェア
app.use('*', logger())
app.use('*', secureHeaders())
app.use('*', cors({
  origin: ['https://example.com'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))
app.use('*', rateLimiter())
app.onError(errorHandler)

// ルート
app.route('/graphql', graphqlRoutes)
app.route('/assets', assetRoutes)
app.route('/health', healthRoutes)

export default app
```

### 2.2 GraphQL Yoga + Pothos 設定

```typescript
// src/graphql/index.ts
import { createYoga } from 'graphql-yoga'
import { useResponseCache } from '@graphql-yoga/plugin-response-cache'
import { useDepthLimit } from '@envelop/depth-limit'
import { useComplexityLimit } from '@envelop/complexity'

import { schema } from './schema'
import { createContext } from './context'

import type { Env } from '../types/env'

export function createGraphQLHandler(env: Env) {
  return createYoga({
    schema,
    context: (ctx) => createContext(ctx, env),
    plugins: [
      useDepthLimit({ maxDepth: 10 }),
      useComplexityLimit({
        maxComplexity: 500,
        estimators: [
          // カスタム複雑度推定
        ],
      }),
      useResponseCache({
        session: () => null, // 公開API
        ttl: 1000 * 60 * 5,  // 5分
        invalidateViaMutation: false,
      }),
    ],
    graphiql: {
      title: 'Minecraft API',
    },
  })
}
```

```typescript
// src/graphql/schema.ts
import SchemaBuilder from '@pothos/core'
import RelayPlugin from '@pothos/plugin-relay'
import DataloaderPlugin from '@pothos/plugin-dataloader'
import ValidationPlugin from '@pothos/plugin-validation'

import type { Context } from './context'

export const builder = new SchemaBuilder<{
  Context: Context
  Scalars: {
    ID: { Input: string; Output: string }
  }
}>({
  plugins: [RelayPlugin, DataloaderPlugin, ValidationPlugin],
  relay: {
    clientMutationId: 'omit',
    cursorType: 'String',
  },
})

// 型定義をインポート
import './types'

export const schema = builder.toSchema()
```

```typescript
// src/graphql/context.ts
import type { YogaInitialContext } from 'graphql-yoga'
import { createDataLoaders } from '../data/loader'
import { ItemService } from '../services/item.service'
import { BlockService } from '../services/block.service'
import { RecipeService } from '../services/recipe.service'
import { EntityService } from '../services/entity.service'

import type { Env } from '../types/env'

export interface Context {
  env: Env
  loaders: ReturnType<typeof createDataLoaders>
  services: {
    item: ItemService
    block: BlockService
    recipe: RecipeService
    entity: EntityService
  }
}

export function createContext(
  ctx: YogaInitialContext,
  env: Env
): Context {
  const loaders = createDataLoaders(env)

  return {
    env,
    loaders,
    services: {
      item: new ItemService(env, loaders),
      block: new BlockService(env, loaders),
      recipe: new RecipeService(env, loaders),
      entity: new EntityService(env, loaders),
    },
  }
}
```

### 2.3 型定義（Pothos）

```typescript
// src/graphql/types/item.ts
import { builder } from '../schema'

// Enum定義
export const RarityEnum = builder.enumType('Rarity', {
  values: ['COMMON', 'UNCOMMON', 'RARE', 'EPIC'] as const,
})

export const EquipmentSlotEnum = builder.enumType('EquipmentSlot', {
  values: ['HEAD', 'CHEST', 'LEGS', 'FEET', 'MAINHAND', 'OFFHAND'] as const,
})

// オブジェクト型定義
export const EquipmentDataType = builder.objectType('EquipmentData', {
  fields: (t) => ({
    slot: t.field({ type: EquipmentSlotEnum, resolve: (parent) => parent.slot }),
    armor: t.int({ nullable: true, resolve: (parent) => parent.armor }),
    armorToughness: t.float({ nullable: true, resolve: (parent) => parent.armorToughness }),
    knockbackResistance: t.float({ nullable: true, resolve: (parent) => parent.knockbackResistance }),
    attackDamage: t.float({ nullable: true, resolve: (parent) => parent.attackDamage }),
    attackSpeed: t.float({ nullable: true, resolve: (parent) => parent.attackSpeed }),
  }),
})

export const FoodDataType = builder.objectType('FoodData', {
  fields: (t) => ({
    nutrition: t.int({ resolve: (parent) => parent.nutrition }),
    saturation: t.float({ resolve: (parent) => parent.saturation }),
    canAlwaysEat: t.boolean({ resolve: (parent) => parent.canAlwaysEat }),
    // effects は別途定義
  }),
})

// Item Node（Relay Connection対応）
export const ItemType = builder.node('Item', {
  id: { resolve: (item) => item.id },
  fields: (t) => ({
    name: t.exposeString('name'),
    displayName: t.string({
      args: {
        lang: t.arg.string({ defaultValue: 'en_us' }),
      },
      resolve: async (item, args, ctx) => {
        return ctx.services.item.getDisplayName(item.id, args.lang)
      },
    }),
    stackSize: t.exposeInt('stackSize'),
    durability: t.int({ nullable: true, resolve: (item) => item.durability }),
    fireResistant: t.exposeBoolean('fireResistant'),
    rarity: t.field({ type: RarityEnum, resolve: (item) => item.rarity }),

    // 装備データ
    equipment: t.field({
      type: EquipmentDataType,
      nullable: true,
      resolve: (item) => item.equipment,
    }),

    // 食料データ
    food: t.field({
      type: FoodDataType,
      nullable: true,
      resolve: (item) => item.food,
    }),

    // 関連: レシピ
    recipes: t.field({
      type: [RecipeInterface],
      resolve: async (item, _args, ctx) => {
        return ctx.services.recipe.findByResult(item.id)
      },
    }),

    // 関連: このアイテムを使うレシピ
    usedInRecipes: t.field({
      type: [RecipeInterface],
      resolve: async (item, _args, ctx) => {
        return ctx.services.recipe.findByIngredient(item.id)
      },
    }),

    // 関連: ブロック
    block: t.field({
      type: BlockType,
      nullable: true,
      resolve: async (item, _args, ctx) => {
        return ctx.loaders.block.load(item.id)
      },
    }),

    // 関連: エンチャント
    enchantments: t.field({
      type: [EnchantmentType],
      resolve: async (item, _args, ctx) => {
        return ctx.services.enchantment.findApplicableTo(item.id)
      },
    }),

    // 関連: タグ
    tags: t.field({
      type: [TagType],
      resolve: async (item, _args, ctx) => {
        return ctx.services.tag.findByItem(item.id)
      },
    }),

    // アセット
    texture: t.string({
      resolve: (item, _args, ctx) => {
        return `/assets/${ctx.version}/textures/item/${item.name}.png`
      },
    }),
    model: t.string({
      nullable: true,
      resolve: (item, _args, ctx) => {
        return `/assets/${ctx.version}/models/item/${item.name}.json`
      },
    }),
  }),
})

// Item Connection
export const ItemConnection = builder.connectionType(ItemType, {
  name: 'ItemConnection',
})
```

### 2.4 サービス層

```typescript
// src/services/item.service.ts
import type { Env } from '../types/env'
import type { DataLoaders } from '../data/loader'
import type { Item, ItemFilter } from '../types/minecraft'

export class ItemService {
  constructor(
    private env: Env,
    private loaders: DataLoaders
  ) {}

  async getById(version: string, id: string): Promise<Item | null> {
    const normalizedId = this.normalizeId(id)
    return this.loaders.item(version).load(normalizedId)
  }

  async getAll(version: string): Promise<Item[]> {
    const data = await this.env.KV.get(`items:${version}`, 'json')
    return data as Item[] ?? []
  }

  async filter(
    version: string,
    filter: ItemFilter
  ): Promise<Item[]> {
    let items = await this.getAll(version)

    if (filter.search) {
      const searchLower = filter.search.toLowerCase()
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.id.toLowerCase().includes(searchLower)
      )
    }

    if (filter.rarity) {
      items = items.filter(item => item.rarity === filter.rarity)
    }

    if (filter.stackable !== undefined) {
      items = items.filter(item =>
        filter.stackable ? item.stackSize > 1 : item.stackSize === 1
      )
    }

    if (filter.hasRecipe !== undefined) {
      // レシピサービスと連携
      const recipeLookup = await this.getRecipeLookup(version)
      items = items.filter(item =>
        filter.hasRecipe ? recipeLookup.has(item.id) : !recipeLookup.has(item.id)
      )
    }

    if (filter.isFood !== undefined) {
      items = items.filter(item =>
        filter.isFood ? item.food !== undefined : item.food === undefined
      )
    }

    if (filter.isEquipment !== undefined) {
      items = items.filter(item =>
        filter.isEquipment ? item.equipment !== undefined : item.equipment === undefined
      )
    }

    if (filter.tags && filter.tags.length > 0) {
      const tagLookup = await this.getTagLookup(version)
      items = items.filter(item =>
        filter.tags!.some(tag => tagLookup.get(item.id)?.includes(tag))
      )
    }

    return items
  }

  async getDisplayName(
    version: string,
    id: string,
    lang: string
  ): Promise<string> {
    const langData = await this.loaders.lang(version).load(lang)
    const key = `item.minecraft.${this.stripNamespace(id)}`
    return langData[key] ?? id
  }

  private normalizeId(id: string): string {
    if (id.includes(':')) return id
    return `minecraft:${id}`
  }

  private stripNamespace(id: string): string {
    return id.replace('minecraft:', '')
  }

  private async getRecipeLookup(version: string): Promise<Set<string>> {
    // キャッシュまたは計算
    const recipes = await this.env.KV.get(`recipes:${version}`, 'json')
    const resultIds = new Set<string>()
    for (const recipe of recipes as any[]) {
      resultIds.add(recipe.result.item)
    }
    return resultIds
  }

  private async getTagLookup(version: string): Promise<Map<string, string[]>> {
    const tags = await this.env.KV.get(`tags:items:${version}`, 'json')
    const lookup = new Map<string, string[]>()
    for (const tag of tags as any[]) {
      for (const entry of tag.entries) {
        const existing = lookup.get(entry) ?? []
        existing.push(tag.id)
        lookup.set(entry, existing)
      }
    }
    return lookup
  }
}
```

### 2.5 DataLoader

```typescript
// src/data/loader.ts
import DataLoader from 'dataloader'
import type { Env } from '../types/env'
import type { Item, Block, Entity, Recipe } from '../types/minecraft'

export function createDataLoaders(env: Env) {
  // バージョン別キャッシュ
  const itemLoaders = new Map<string, DataLoader<string, Item | null>>()
  const blockLoaders = new Map<string, DataLoader<string, Block | null>>()
  const entityLoaders = new Map<string, DataLoader<string, Entity | null>>()
  const langLoaders = new Map<string, DataLoader<string, Record<string, string>>>()

  const getItemLoader = (version: string) => {
    if (!itemLoaders.has(version)) {
      itemLoaders.set(version, new DataLoader(async (ids) => {
        const allItems = await env.KV.get(`items:${version}`, 'json') as Item[]
        const itemMap = new Map(allItems.map(item => [item.id, item]))
        return ids.map(id => itemMap.get(id) ?? null)
      }))
    }
    return itemLoaders.get(version)!
  }

  const getBlockLoader = (version: string) => {
    if (!blockLoaders.has(version)) {
      blockLoaders.set(version, new DataLoader(async (ids) => {
        const allBlocks = await env.KV.get(`blocks:${version}`, 'json') as Block[]
        const blockMap = new Map(allBlocks.map(block => [block.id, block]))
        return ids.map(id => blockMap.get(id) ?? null)
      }))
    }
    return blockLoaders.get(version)!
  }

  const getEntityLoader = (version: string) => {
    if (!entityLoaders.has(version)) {
      entityLoaders.set(version, new DataLoader(async (ids) => {
        const allEntities = await env.KV.get(`entities:${version}`, 'json') as Entity[]
        const entityMap = new Map(allEntities.map(entity => [entity.id, entity]))
        return ids.map(id => entityMap.get(id) ?? null)
      }))
    }
    return entityLoaders.get(version)!
  }

  const getLangLoader = (version: string) => {
    if (!langLoaders.has(version)) {
      langLoaders.set(version, new DataLoader(async (langs) => {
        return Promise.all(langs.map(async (lang) => {
          const data = await env.KV.get(`lang:${version}:${lang}`, 'json')
          return (data as Record<string, string>) ?? {}
        }))
      }))
    }
    return langLoaders.get(version)!
  }

  return {
    item: getItemLoader,
    block: getBlockLoader,
    entity: getEntityLoader,
    lang: getLangLoader,
  }
}

export type DataLoaders = ReturnType<typeof createDataLoaders>
```

---

## 3. データフロー

### 3.1 GraphQLリクエスト処理

```
┌──────────────────────────────────────────────────────────────────┐
│                        GraphQL Request                           │
│  POST /graphql                                                   │
│  { query: "{ item(version: \"1.21\", id: \"diamond\") {...} }" } │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Middleware                               │
│  1. CORS Check                                                   │
│  2. Rate Limit Check                                             │
│  3. Request Logging                                              │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                       GraphQL Yoga                               │
│  1. Parse Query                                                  │
│  2. Validate (Depth Limit, Complexity Limit)                     │
│  3. Check Response Cache                                         │
└──────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │ Cache Hit?            │
                    └───────────┬───────────┘
                          │           │
                        Yes          No
                          │           │
                          ▼           ▼
              ┌─────────────────┐  ┌─────────────────────────────┐
              │ Return Cached   │  │     Create Context          │
              │ Response        │  │  - Initialize DataLoaders   │
              └─────────────────┘  │  - Initialize Services      │
                                   └─────────────────────────────┘
                                                │
                                                ▼
                                   ┌─────────────────────────────┐
                                   │      Execute Resolvers      │
                                   │  1. Root Query Resolver     │
                                   │  2. Field Resolvers         │
                                   │  3. DataLoader Batching     │
                                   └─────────────────────────────┘
                                                │
                                                ▼
                                   ┌─────────────────────────────┐
                                   │     Data Access Layer       │
                                   │  - Cloudflare KV Get        │
                                   │  - Batch by DataLoader      │
                                   └─────────────────────────────┘
                                                │
                                                ▼
                                   ┌─────────────────────────────┐
                                   │    Format Response          │
                                   │  - Build GraphQL Response   │
                                   │  - Cache Response           │
                                   └─────────────────────────────┘
                                                │
                                                ▼
                                   ┌─────────────────────────────┐
                                   │     Return Response         │
                                   └─────────────────────────────┘
```

### 3.2 静的アセットリクエスト処理

```
┌──────────────────────────────────────────────────────────────────┐
│                      Asset Request                               │
│  GET /assets/1.21/textures/item/diamond.png                      │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Cloudflare CDN                              │
│  1. Check Edge Cache                                             │
└──────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │ Cache Hit?            │
                    └───────────┬───────────┘
                          │           │
                        Yes          No
                          │           │
                          ▼           ▼
              ┌─────────────────┐  ┌─────────────────────────────┐
              │ Return Cached   │  │   Cloudflare Workers        │
              │ Asset           │  │   Route: /assets/*          │
              └─────────────────┘  └─────────────────────────────┘
                                                │
                                                ▼
                                   ┌─────────────────────────────┐
                                   │     Parse Path              │
                                   │  - Version: 1.21            │
                                   │  - Type: textures/item      │
                                   │  - Name: diamond.png        │
                                   └─────────────────────────────┘
                                                │
                                                ▼
                                   ┌─────────────────────────────┐
                                   │     Cloudflare R2           │
                                   │  GET 1.21/textures/item/    │
                                   │      diamond.png            │
                                   └─────────────────────────────┘
                                                │
                                                ▼
                                   ┌─────────────────────────────┐
                                   │  Return with Cache Headers  │
                                   │  Cache-Control: public,     │
                                   │    max-age=31536000,        │
                                   │    immutable                │
                                   └─────────────────────────────┘
```

---

## 4. 環境変数・設定

### 4.1 環境変数型定義

```typescript
// src/types/env.ts
export interface Env {
  // Cloudflare KV
  KV: KVNamespace

  // Cloudflare R2
  ASSETS: R2Bucket

  // 設定
  ENVIRONMENT: 'development' | 'staging' | 'production'

  // レート制限
  RATE_LIMIT_REQUESTS: number
  RATE_LIMIT_WINDOW: number

  // CORS
  ALLOWED_ORIGINS: string
}
```

### 4.2 Wrangler設定

```toml
# wrangler.toml
name = "minecraft-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"
RATE_LIMIT_REQUESTS = 60
RATE_LIMIT_WINDOW = 60
ALLOWED_ORIGINS = "https://example.com"

[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "minecraft-api-assets"
preview_bucket_name = "minecraft-api-assets-preview"

[build]
command = "pnpm build"

[dev]
port = 8787
local_protocol = "http"
```

---

## 5. エラーハンドリング

### 5.1 カスタムエラークラス

```typescript
// src/utils/errors.ts
export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public extensions?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export class NotFoundError extends APIError {
  constructor(
    resourceType: string,
    resourceId: string,
    version?: string
  ) {
    super(
      `${resourceType} not found: ${resourceId}`,
      'NOT_FOUND',
      404,
      { resourceType, resourceId, version }
    )
  }
}

export class InvalidVersionError extends APIError {
  constructor(version: string) {
    super(
      `Invalid version: ${version}`,
      'INVALID_VERSION',
      400,
      { version }
    )
  }
}

export class RateLimitError extends APIError {
  constructor(retryAfter: number) {
    super(
      'Rate limit exceeded',
      'RATE_LIMITED',
      429,
      { retryAfter }
    )
  }
}
```

### 5.2 エラーハンドラミドルウェア

```typescript
// src/middleware/error-handler.ts
import type { ErrorHandler } from 'hono'
import { APIError } from '../utils/errors'

export const errorHandler: ErrorHandler = (err, c) => {
  console.error('Error:', err)

  if (err instanceof APIError) {
    return c.json({
      error: {
        message: err.message,
        code: err.code,
        ...err.extensions,
      },
    }, err.statusCode as any)
  }

  // GraphQLエラーはYogaが処理
  if (err.name === 'GraphQLError') {
    throw err
  }

  // 未知のエラー
  return c.json({
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  }, 500)
}
```

---

## 6. テスト戦略

### 6.1 ユニットテスト

```typescript
// tests/unit/services/item.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ItemService } from '../../../src/services/item.service'

describe('ItemService', () => {
  let service: ItemService
  let mockEnv: any
  let mockLoaders: any

  beforeEach(() => {
    mockEnv = {
      KV: {
        get: vi.fn(),
      },
    }
    mockLoaders = {
      item: vi.fn(() => ({
        load: vi.fn(),
      })),
      lang: vi.fn(() => ({
        load: vi.fn(),
      })),
    }
    service = new ItemService(mockEnv, mockLoaders)
  })

  describe('getById', () => {
    it('should normalize ID without namespace', async () => {
      const mockLoader = { load: vi.fn().mockResolvedValue({ id: 'minecraft:diamond' }) }
      mockLoaders.item.mockReturnValue(mockLoader)

      await service.getById('1.21', 'diamond')

      expect(mockLoader.load).toHaveBeenCalledWith('minecraft:diamond')
    })

    it('should not modify ID with namespace', async () => {
      const mockLoader = { load: vi.fn().mockResolvedValue({ id: 'minecraft:diamond' }) }
      mockLoaders.item.mockReturnValue(mockLoader)

      await service.getById('1.21', 'minecraft:diamond')

      expect(mockLoader.load).toHaveBeenCalledWith('minecraft:diamond')
    })
  })

  describe('filter', () => {
    it('should filter by search term', async () => {
      mockEnv.KV.get.mockResolvedValue([
        { id: 'minecraft:diamond', name: 'diamond' },
        { id: 'minecraft:gold_ingot', name: 'gold_ingot' },
        { id: 'minecraft:diamond_sword', name: 'diamond_sword' },
      ])

      const result = await service.filter('1.21', { search: 'diamond' })

      expect(result).toHaveLength(2)
      expect(result.map(i => i.name)).toContain('diamond')
      expect(result.map(i => i.name)).toContain('diamond_sword')
    })
  })
})
```

### 6.2 インテグレーションテスト

```typescript
// tests/integration/graphql/items.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestClient } from '../helpers/test-client'

describe('GraphQL Items', () => {
  let client: ReturnType<typeof createTestClient>

  beforeAll(() => {
    client = createTestClient()
  })

  it('should fetch item by id', async () => {
    const query = `
      query GetItem($version: String!, $id: String!) {
        item(version: $version, id: $id) {
          id
          name
          displayName(lang: "en_us")
          stackSize
        }
      }
    `

    const result = await client.execute(query, {
      version: '1.21',
      id: 'diamond',
    })

    expect(result.errors).toBeUndefined()
    expect(result.data.item).toMatchObject({
      id: 'minecraft:diamond',
      name: 'diamond',
      displayName: 'Diamond',
      stackSize: 64,
    })
  })

  it('should return null for non-existent item', async () => {
    const query = `
      query GetItem($version: String!, $id: String!) {
        item(version: $version, id: $id) {
          id
        }
      }
    `

    const result = await client.execute(query, {
      version: '1.21',
      id: 'not_a_real_item',
    })

    expect(result.data.item).toBeNull()
  })
})
```

---

## 7. デプロイメント

### 7.1 CI/CDパイプライン

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test
      - run: pnpm lint

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
```

### 7.2 デプロイ手順

```bash
# 開発環境
pnpm dev

# ビルド
pnpm build

# ステージングデプロイ
pnpm wrangler deploy --env staging

# 本番デプロイ
pnpm wrangler deploy --env production
```
