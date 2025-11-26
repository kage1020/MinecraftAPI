# Minecraft Web API アーキテクチャ設計書

## 1. ディレクトリ構造

```
minecraft-api/
├── src/
│   ├── index.ts                 # エントリーポイント
│   │
│   ├── graphql/                 # GraphQL (Pylon)
│   │   ├── index.ts             # Pylonサービス定義
│   │   ├── resolvers/
│   │   │   ├── version.ts
│   │   │   ├── item.ts
│   │   │   ├── block.ts
│   │   │   ├── recipe.ts
│   │   │   ├── entity.ts
│   │   │   ├── enchantment.ts
│   │   │   └── search.ts
│   │   └── types/               # TypeScript型定義
│   │       ├── index.ts
│   │       ├── version.ts
│   │       ├── item.ts
│   │       ├── block.ts
│   │       ├── recipe.ts
│   │       ├── entity.ts
│   │       ├── enchantment.ts
│   │       ├── effect.ts
│   │       ├── biome.ts
│   │       └── tag.ts
│   │
│   ├── rest/                    # RESTful API
│   │   ├── index.ts             # RESTルート統合
│   │   ├── assets.ts            # 静的アセットAPI
│   │   ├── versions.ts          # バージョンAPI
│   │   └── health.ts            # ヘルスチェック
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
│   │   ├── asset.service.ts
│   │   └── search.service.ts
│   │
│   ├── data/                    # データアクセス層
│   │   ├── index.ts
│   │   ├── kv.ts                # Cloudflare KVアクセス
│   │   └── r2.ts                # Cloudflare R2アクセス
│   │
│   ├── middleware/              # ミドルウェア
│   │   ├── index.ts
│   │   ├── auth.ts              # 認証（APIトークン検証）
│   │   ├── rate-limit.ts        # レート制限
│   │   ├── cors.ts              # CORS
│   │   ├── cache.ts             # キャッシュヘッダー
│   │   └── error-handler.ts     # エラーハンドリング
│   │
│   ├── types/                   # 共通型定義
│   │   ├── index.ts
│   │   ├── env.ts               # 環境変数型
│   │   └── errors.ts            # エラー型
│   │
│   └── utils/                   # ユーティリティ
│       ├── index.ts
│       ├── id.ts                # ID正規化
│       ├── pagination.ts        # ページネーション
│       └── validation.ts        # バリデーション
│
├── scripts/                     # データ生成スクリプト
│   ├── extract-jar.ts           # JAR抽出
│   ├── process-items.ts         # アイテムデータ処理
│   ├── process-blocks.ts        # ブロックデータ処理
│   ├── process-recipes.ts       # レシピデータ処理
│   ├── process-entities.ts      # エンティティデータ処理
│   ├── process-loot-tables.ts   # ルートテーブル処理
│   ├── upload-kv.ts             # KVアップロード
│   ├── upload-r2.ts             # R2アップロード
│   └── sync-version.ts          # バージョン同期
│
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   └── utils/
│   └── integration/
│       ├── graphql/
│       └── rest/
│
├── wrangler.toml                # Cloudflare Workers設定
├── tsconfig.json
├── package.json
├── biome.json
└── vitest.config.ts
```

---

## 2. コンポーネント設計

### 2.1 エントリーポイント

```typescript
// src/index.ts
import { app } from '@getcronit/pylon'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { errorHandler } from './middleware/error-handler'
import { restRoutes } from './rest'
import { graphql } from './graphql'

import type { Env } from './types/env'

// Honoアプリを取得（Pylonが内部で使用）
const honoApp = app.honoApp as Hono<{ Bindings: Env }>

// グローバルミドルウェア
honoApp.use('*', secureHeaders())
honoApp.use('*', cors({
  origin: (origin, c) => {
    // 動的オリジン検証
    return origin
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))
honoApp.onError(errorHandler)

// ヘルスチェック（認証不要）
honoApp.get('/health', (c) => c.json({ status: 'ok' }))

// 認証・レート制限が必要なルート
honoApp.use('/graphql/*', authMiddleware)
honoApp.use('/graphql/*', rateLimitMiddleware)
honoApp.use('/v1/*', authMiddleware)
honoApp.use('/v1/*', rateLimitMiddleware)

// RESTルート
honoApp.route('/v1', restRoutes)

// GraphQL（Pylonが自動設定）
export { graphql }
export default app
```

### 2.2 Pylon GraphQL サービス

```typescript
// src/graphql/index.ts
import { app, ServiceError } from '@getcronit/pylon'
import { getContext } from './context'
import * as resolvers from './resolvers'
import type {
  Version,
  Item,
  Block,
  Recipe,
  Entity,
  Enchantment,
  ItemFilter,
  BlockFilter,
  RecipeFilter,
  EntityFilter,
  Pagination,
  ItemConnection,
  BlockConnection,
  RecipeConnection,
  EntityConnection,
  SearchResult,
  SearchType,
} from './types'

export const graphql = {
  Query: {
    // バージョン
    versions: async (): Promise<Version[]> => {
      const ctx = getContext()
      return resolvers.version.getAll(ctx)
    },

    version: async (id: string): Promise<Version | null> => {
      const ctx = getContext()
      return resolvers.version.getById(ctx, id)
    },

    latestVersion: async (): Promise<Version> => {
      const ctx = getContext()
      return resolvers.version.getLatest(ctx)
    },

    // アイテム
    items: async (
      version: string,
      filter?: ItemFilter,
      pagination?: Pagination
    ): Promise<ItemConnection> => {
      const ctx = getContext()
      validateVersion(ctx, version)
      return resolvers.item.getAll(ctx, version, filter, pagination)
    },

    item: async (version: string, id: string): Promise<Item | null> => {
      const ctx = getContext()
      validateVersion(ctx, version)
      return resolvers.item.getById(ctx, version, id)
    },

    // ブロック
    blocks: async (
      version: string,
      filter?: BlockFilter,
      pagination?: Pagination
    ): Promise<BlockConnection> => {
      const ctx = getContext()
      validateVersion(ctx, version)
      return resolvers.block.getAll(ctx, version, filter, pagination)
    },

    block: async (version: string, id: string): Promise<Block | null> => {
      const ctx = getContext()
      validateVersion(ctx, version)
      return resolvers.block.getById(ctx, version, id)
    },

    // レシピ
    recipes: async (
      version: string,
      filter?: RecipeFilter,
      pagination?: Pagination
    ): Promise<RecipeConnection> => {
      const ctx = getContext()
      validateVersion(ctx, version)
      return resolvers.recipe.getAll(ctx, version, filter, pagination)
    },

    // エンティティ
    entities: async (
      version: string,
      filter?: EntityFilter,
      pagination?: Pagination
    ): Promise<EntityConnection> => {
      const ctx = getContext()
      validateVersion(ctx, version)
      return resolvers.entity.getAll(ctx, version, filter, pagination)
    },

    entity: async (version: string, id: string): Promise<Entity | null> => {
      const ctx = getContext()
      validateVersion(ctx, version)
      return resolvers.entity.getById(ctx, version, id)
    },

    // エンチャント
    enchantments: async (version: string): Promise<Enchantment[]> => {
      const ctx = getContext()
      validateVersion(ctx, version)
      return resolvers.enchantment.getAll(ctx, version)
    },

    enchantment: async (version: string, id: string): Promise<Enchantment | null> => {
      const ctx = getContext()
      validateVersion(ctx, version)
      return resolvers.enchantment.getById(ctx, version, id)
    },

    // 検索
    search: async (
      version: string,
      query: string,
      types?: SearchType[]
    ): Promise<SearchResult> => {
      const ctx = getContext()
      validateVersion(ctx, version)
      return resolvers.search.search(ctx, version, query, types)
    },
  },
}

function validateVersion(ctx: any, version: string): void {
  if (!ctx.versions.includes(version)) {
    throw new ServiceError(`Invalid version: ${version}`, {
      code: 'INVALID_VERSION',
      statusCode: 400,
    })
  }
}
```

### 2.3 REST API ルート

```typescript
// src/rest/index.ts
import { Hono } from 'hono'
import { assetsRoutes } from './assets'
import { versionsRoutes } from './versions'

import type { Env } from '../types/env'

export const restRoutes = new Hono<{ Bindings: Env }>()

restRoutes.route('/assets', assetsRoutes)
restRoutes.route('/versions', versionsRoutes)
```

```typescript
// src/rest/assets.ts
import { Hono } from 'hono'
import { cache } from 'hono/cache'
import { AssetService } from '../services/asset.service'
import { NotFoundError } from '../types/errors'

import type { Env } from '../types/env'

export const assetsRoutes = new Hono<{ Bindings: Env }>()

// 静的アセットのキャッシュ設定
assetsRoutes.use('/*', async (c, next) => {
  await next()

  // 成功時のみキャッシュヘッダー設定
  if (c.res.status === 200) {
    const path = c.req.path

    // 言語ファイルは短めのキャッシュ
    if (path.includes('/lang/')) {
      c.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600')
    } else {
      // テクスチャ、モデル、サウンドは長期キャッシュ
      c.header('Cache-Control', 'public, max-age=31536000, immutable')
    }
  }
})

// GET /v1/assets/:version/*path
assetsRoutes.get('/:version/*', async (c) => {
  const version = c.req.param('version')
  const path = c.req.param('*') || ''

  const assetService = new AssetService(c.env)

  // バージョン検証
  const isValidVersion = await assetService.isValidVersion(version)
  if (!isValidVersion) {
    throw new NotFoundError('version', version)
  }

  // アセット取得
  const asset = await assetService.getAsset(version, path)
  if (!asset) {
    throw new NotFoundError('asset', `${version}/${path}`)
  }

  // Content-Type設定
  const contentType = getContentType(path)
  c.header('Content-Type', contentType)
  c.header('X-Version', version)
  c.header('ETag', `"${asset.etag}"`)

  return c.body(asset.body)
})

function getContentType(path: string): string {
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.ogg')) return 'audio/ogg'
  if (path.endsWith('.mcmeta')) return 'application/json'
  return 'application/octet-stream'
}
```

```typescript
// src/rest/versions.ts
import { Hono } from 'hono'
import { VersionService } from '../services/version.service'

import type { Env } from '../types/env'

export const versionsRoutes = new Hono<{ Bindings: Env }>()

// GET /v1/versions
versionsRoutes.get('/', async (c) => {
  const versionService = new VersionService(c.env)
  const data = await versionService.getAll()

  c.header('Cache-Control', 'public, max-age=3600')
  return c.json(data)
})

// GET /v1/versions/latest
versionsRoutes.get('/latest', async (c) => {
  const versionService = new VersionService(c.env)
  const latest = await versionService.getLatest()

  c.header('Cache-Control', 'public, max-age=3600')
  return c.json(latest)
})

// GET /v1/versions/:id
versionsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const versionService = new VersionService(c.env)
  const version = await versionService.getById(id)

  if (!version) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Version not found: ${id}` } }, 404)
  }

  c.header('Cache-Control', 'public, max-age=3600')
  return c.json(version)
})
```

### 2.4 認証ミドルウェア

```typescript
// src/middleware/auth.ts
import type { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Env } from '../types/env'

interface TokenData {
  id: string
  plan: 'free' | 'basic' | 'pro' | 'enterprise'
  createdAt: string
  expiresAt: string
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    throw new HTTPException(401, {
      message: 'Authorization header is required',
    })
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, {
      message: 'Invalid authorization format. Use: Bearer <token>',
    })
  }

  const token = authHeader.slice(7)

  // トークン形式チェック
  if (!token.startsWith('mcapi_')) {
    throw new HTTPException(401, {
      message: 'Invalid token format',
    })
  }

  // KVからトークン情報取得
  const tokenData = await c.env.KV.get<TokenData>(`token:${token}`, 'json')

  if (!tokenData) {
    throw new HTTPException(401, {
      message: 'Invalid or expired token',
    })
  }

  // 有効期限チェック
  if (new Date(tokenData.expiresAt) < new Date()) {
    throw new HTTPException(401, {
      message: 'Token has expired',
    })
  }

  // コンテキストにトークン情報を保存
  c.set('token', tokenData)
  c.set('tokenId', tokenData.id)
  c.set('plan', tokenData.plan)

  await next()
}
```

### 2.5 レート制限ミドルウェア

```typescript
// src/middleware/rate-limit.ts
import type { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Env } from '../types/env'

interface RateLimitConfig {
  requestsPerMinute: number
  requestsPerDay: number
}

const PLAN_LIMITS: Record<string, RateLimitConfig> = {
  free: { requestsPerMinute: 60, requestsPerDay: 10000 },
  basic: { requestsPerMinute: 300, requestsPerDay: 100000 },
  pro: { requestsPerMinute: 1000, requestsPerDay: 1000000 },
  enterprise: { requestsPerMinute: 10000, requestsPerDay: 10000000 },
}

export async function rateLimitMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const tokenId = c.get('tokenId') as string
  const plan = c.get('plan') as string
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free

  const now = Date.now()
  const minuteKey = `ratelimit:minute:${tokenId}:${Math.floor(now / 60000)}`
  const dayKey = `ratelimit:day:${tokenId}:${Math.floor(now / 86400000)}`

  // 現在のカウント取得
  const [minuteCount, dayCount] = await Promise.all([
    c.env.KV.get<number>(minuteKey, 'json') || 0,
    c.env.KV.get<number>(dayKey, 'json') || 0,
  ])

  // 制限チェック
  if (minuteCount >= limits.requestsPerMinute) {
    const resetTime = Math.ceil((Math.floor(now / 60000) + 1) * 60000 / 1000)
    c.header('X-RateLimit-Limit', String(limits.requestsPerMinute))
    c.header('X-RateLimit-Remaining', '0')
    c.header('X-RateLimit-Reset', String(resetTime))
    c.header('Retry-After', String(Math.ceil((resetTime * 1000 - now) / 1000)))

    throw new HTTPException(429, {
      message: 'Rate limit exceeded. Please wait before making another request.',
    })
  }

  if (dayCount >= limits.requestsPerDay) {
    throw new HTTPException(429, {
      message: 'Daily rate limit exceeded. Please try again tomorrow.',
    })
  }

  // カウント更新（非同期）
  c.executionCtx.waitUntil(
    Promise.all([
      c.env.KV.put(minuteKey, JSON.stringify(minuteCount + 1), { expirationTtl: 120 }),
      c.env.KV.put(dayKey, JSON.stringify(dayCount + 1), { expirationTtl: 172800 }),
    ])
  )

  // レート制限ヘッダー設定
  c.header('X-RateLimit-Limit', String(limits.requestsPerMinute))
  c.header('X-RateLimit-Remaining', String(limits.requestsPerMinute - minuteCount - 1))
  c.header('X-RateLimit-Reset', String(Math.ceil((Math.floor(now / 60000) + 1) * 60000 / 1000)))

  await next()
}
```

### 2.6 サービス層

```typescript
// src/services/item.service.ts
import type { Env } from '../types/env'
import type { Item, ItemFilter } from '../graphql/types'

export class ItemService {
  constructor(private env: Env) {}

  async getById(version: string, id: string): Promise<Item | null> {
    const normalizedId = this.normalizeId(id)
    const items = await this.getAllRaw(version)
    return items.find(item => item.id === normalizedId) || null
  }

  async getAll(version: string): Promise<Item[]> {
    return this.getAllRaw(version)
  }

  async filter(version: string, filter: ItemFilter): Promise<Item[]> {
    let items = await this.getAllRaw(version)

    if (filter.search) {
      const searchLower = filter.search.toLowerCase()
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.id.toLowerCase().includes(searchLower)
      )
    }

    if (filter.rarity !== undefined) {
      items = items.filter(item => item.rarity === filter.rarity)
    }

    if (filter.stackable !== undefined) {
      items = items.filter(item =>
        filter.stackable ? item.stackSize > 1 : item.stackSize === 1
      )
    }

    if (filter.hasRecipe !== undefined) {
      const recipeService = new RecipeService(this.env)
      const recipeResults = await recipeService.getAllRaw(version)
      const resultItemIds = new Set(recipeResults.map(r => r.result.item))

      items = items.filter(item =>
        filter.hasRecipe ? resultItemIds.has(item.id) : !resultItemIds.has(item.id)
      )
    }

    if (filter.hasDurability !== undefined) {
      items = items.filter(item =>
        filter.hasDurability ? item.durability !== null : item.durability === null
      )
    }

    if (filter.isFood !== undefined) {
      items = items.filter(item =>
        filter.isFood ? item.food !== null : item.food === null
      )
    }

    if (filter.isEquipment !== undefined) {
      items = items.filter(item =>
        filter.isEquipment ? item.equipment !== null : item.equipment === null
      )
    }

    if (filter.isTool !== undefined) {
      items = items.filter(item =>
        filter.isTool ? item.tool !== null : item.tool === null
      )
    }

    return items
  }

  async getDisplayName(version: string, id: string, lang: string): Promise<string> {
    const langData = await this.env.KV.get<Record<string, string>>(
      `lang:${version}:${lang}`,
      'json'
    )
    if (!langData) return id

    const key = `item.minecraft.${this.stripNamespace(id)}`
    return langData[key] || id
  }

  private async getAllRaw(version: string): Promise<Item[]> {
    const data = await this.env.KV.get<Item[]>(`items:${version}`, 'json')
    return data || []
  }

  private normalizeId(id: string): string {
    if (id.includes(':')) return id
    return `minecraft:${id}`
  }

  private stripNamespace(id: string): string {
    return id.replace('minecraft:', '')
  }
}
```

```typescript
// src/services/asset.service.ts
import type { Env } from '../types/env'

interface Asset {
  body: ReadableStream | ArrayBuffer
  etag: string
}

export class AssetService {
  constructor(private env: Env) {}

  async isValidVersion(version: string): Promise<boolean> {
    const versions = await this.env.KV.get<string[]>('versions:list', 'json')
    return versions?.includes(version) || false
  }

  async getAsset(version: string, path: string): Promise<Asset | null> {
    const key = `${version}/${path}`
    const object = await this.env.ASSETS.get(key)

    if (!object) {
      return null
    }

    return {
      body: object.body,
      etag: object.etag,
    }
  }
}
```

---

## 3. 環境変数・設定

### 3.1 環境変数型定義

```typescript
// src/types/env.ts
export interface Env {
  // Cloudflare KV
  KV: KVNamespace

  // Cloudflare R2
  ASSETS: R2Bucket

  // 設定
  ENVIRONMENT: 'development' | 'staging' | 'production'
}
```

### 3.2 Wrangler 設定

```toml
# wrangler.toml
name = "minecraft-api"
main = "src/index.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"

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

[observability]
enabled = true
```

---

## 4. エラーハンドリング

### 4.1 カスタムエラー

```typescript
// src/types/errors.ts
import { ServiceError } from '@getcronit/pylon'

export class NotFoundError extends ServiceError {
  constructor(resourceType: string, resourceId: string) {
    super(`${resourceType} not found: ${resourceId}`, {
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  }
}

export class InvalidVersionError extends ServiceError {
  constructor(version: string) {
    super(`Invalid version: ${version}`, {
      code: 'INVALID_VERSION',
      statusCode: 400,
    })
  }
}

export class RateLimitError extends ServiceError {
  constructor(retryAfter: number) {
    super('Rate limit exceeded', {
      code: 'RATE_LIMITED',
      statusCode: 429,
    })
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message = 'Unauthorized') {
    super(message, {
      code: 'UNAUTHORIZED',
      statusCode: 401,
    })
  }
}
```

### 4.2 エラーハンドラ

```typescript
// src/middleware/error-handler.ts
import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ServiceError } from '@getcronit/pylon'

export const errorHandler: ErrorHandler = (err, c) => {
  console.error('Error:', err)

  // HTTP例外
  if (err instanceof HTTPException) {
    return c.json({
      error: {
        code: getErrorCode(err.status),
        message: err.message,
      },
    }, err.status)
  }

  // Pylonサービスエラー
  if (err instanceof ServiceError) {
    return c.json({
      error: {
        code: (err as any).code || 'UNKNOWN_ERROR',
        message: err.message,
      },
    }, (err as any).statusCode || 500)
  }

  // 未知のエラー
  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  }, 500)
}

function getErrorCode(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST'
    case 401: return 'UNAUTHORIZED'
    case 403: return 'FORBIDDEN'
    case 404: return 'NOT_FOUND'
    case 429: return 'RATE_LIMITED'
    default: return 'INTERNAL_ERROR'
  }
}
```

---

## 5. データフロー

### 5.1 GraphQL リクエスト

```
┌──────────────────────────────────────────────────────────────────┐
│  POST /graphql                                                   │
│  Authorization: Bearer mcapi_xxx                                 │
│  { query: "{ item(version: \"1.21\", id: \"diamond\") {...} }"  │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Middleware Stack                             │
│  1. secureHeaders                                                │
│  2. cors                                                         │
│  3. authMiddleware (トークン検証)                                │
│  4. rateLimitMiddleware (レート制限チェック)                     │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Pylon GraphQL                              │
│  1. クエリパース                                                 │
│  2. リゾルバ実行                                                 │
│  3. サービス層呼び出し                                           │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
│  ItemService.getById(version, id)                                │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Cloudflare KV                                │
│  GET items:1.21 → JSON parse → filter                            │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Response                                    │
│  { "data": { "item": { ... } } }                                 │
│  X-RateLimit-Remaining: 59                                       │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 静的アセットリクエスト

```
┌──────────────────────────────────────────────────────────────────┐
│  GET /v1/assets/1.21/textures/item/diamond.png                   │
│  Authorization: Bearer mcapi_xxx                                 │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Cloudflare CDN Edge                           │
│  Cache-Key: /v1/assets/1.21/textures/item/diamond.png            │
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
              │ (immutable)     │  │   1. authMiddleware         │
              └─────────────────┘  │   2. rateLimitMiddleware    │
                                   │   3. AssetService.getAsset  │
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
                                   │  Response + Cache Headers   │
                                   │  Cache-Control: immutable   │
                                   │  → CDNにキャッシュ保存      │
                                   └─────────────────────────────┘
```

---

## 6. テスト

### 6.1 ユニットテスト

```typescript
// tests/unit/services/item.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ItemService } from '../../../src/services/item.service'

describe('ItemService', () => {
  let service: ItemService
  let mockEnv: any

  beforeEach(() => {
    mockEnv = {
      KV: {
        get: vi.fn(),
      },
    }
    service = new ItemService(mockEnv)
  })

  describe('getById', () => {
    it('should return item by id', async () => {
      const mockItems = [
        { id: 'minecraft:diamond', name: 'diamond', stackSize: 64 },
        { id: 'minecraft:stone', name: 'stone', stackSize: 64 },
      ]
      mockEnv.KV.get.mockResolvedValue(mockItems)

      const result = await service.getById('1.21', 'diamond')

      expect(result).toEqual(mockItems[0])
      expect(mockEnv.KV.get).toHaveBeenCalledWith('items:1.21', 'json')
    })

    it('should normalize id without namespace', async () => {
      const mockItems = [{ id: 'minecraft:diamond', name: 'diamond' }]
      mockEnv.KV.get.mockResolvedValue(mockItems)

      const result = await service.getById('1.21', 'diamond')

      expect(result?.id).toBe('minecraft:diamond')
    })

    it('should return null for non-existent item', async () => {
      mockEnv.KV.get.mockResolvedValue([])

      const result = await service.getById('1.21', 'invalid')

      expect(result).toBeNull()
    })
  })

  describe('filter', () => {
    it('should filter by search term', async () => {
      const mockItems = [
        { id: 'minecraft:diamond', name: 'diamond', stackSize: 64 },
        { id: 'minecraft:diamond_sword', name: 'diamond_sword', stackSize: 1 },
        { id: 'minecraft:stone', name: 'stone', stackSize: 64 },
      ]
      mockEnv.KV.get.mockResolvedValue(mockItems)

      const result = await service.filter('1.21', { search: 'diamond' })

      expect(result).toHaveLength(2)
    })

    it('should filter stackable items', async () => {
      const mockItems = [
        { id: 'minecraft:diamond', name: 'diamond', stackSize: 64 },
        { id: 'minecraft:diamond_sword', name: 'diamond_sword', stackSize: 1 },
      ]
      mockEnv.KV.get.mockResolvedValue(mockItems)

      const result = await service.filter('1.21', { stackable: false })

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('diamond_sword')
    })
  })
})
```

### 6.2 インテグレーションテスト

```typescript
// tests/integration/rest/assets.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { unstable_dev } from 'wrangler'
import type { UnstableDevWorker } from 'wrangler'

describe('Assets REST API', () => {
  let worker: UnstableDevWorker

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    })
  })

  afterAll(async () => {
    await worker.stop()
  })

  it('should return 401 without auth header', async () => {
    const resp = await worker.fetch('/v1/assets/1.21/textures/item/diamond.png')
    expect(resp.status).toBe(401)
  })

  it('should return asset with valid token', async () => {
    const resp = await worker.fetch('/v1/assets/1.21/textures/item/diamond.png', {
      headers: {
        Authorization: 'Bearer mcapi_test_token',
      },
    })

    expect(resp.status).toBe(200)
    expect(resp.headers.get('Content-Type')).toBe('image/png')
    expect(resp.headers.get('Cache-Control')).toContain('immutable')
  })

  it('should return 404 for non-existent asset', async () => {
    const resp = await worker.fetch('/v1/assets/1.21/textures/item/invalid.png', {
      headers: {
        Authorization: 'Bearer mcapi_test_token',
      },
    })

    expect(resp.status).toBe(404)
  })
})
```

---

## 7. デプロイメント

### 7.1 CI/CD

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
      - uses: pnpm/action-setup@v4
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
      - uses: pnpm/action-setup@v4
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

### 7.2 デプロイコマンド

```bash
# 開発環境
pnpm dev

# ビルド
pnpm build

# デプロイ
pnpm wrangler deploy
```
