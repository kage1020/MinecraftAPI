# Minecraft Web API 仕様書

## 1. プロジェクト概要

### 1.1 目的

Minecraftの静的アセット（テクスチャ、モデル、サウンド）およびゲームデータ（アイテム、ブロック、レシピ、エンティティ等）を提供するWeb APIを構築する。

### 1.2 特徴

- **GraphQL API**: 柔軟なクエリで必要なデータのみを取得可能
- **RESTful 静的アセット**: キャッシュ最適化された静的ファイル配信
- **マルチバージョン対応**: 複数のMinecraftバージョンをサポート
- **多言語対応**: 各言語の翻訳データを提供
- **認証必須**: APIアクセストークンによるアクセス制御

### 1.3 対象バージョン

| 種別 | バージョン範囲 |
|------|---------------|
| Java Edition | 1.14 〜 最新リリース |
| スナップショット | オプション対応 |

---

## 2. 技術スタック

### 2.1 コア技術

| 項目 | 技術 | 備考 |
|------|------|------|
| ランタイム | Cloudflare Workers | `nodejs_compat` 最新 |
| 言語 | TypeScript | 5.x |
| フレームワーク | Hono | 4.x |
| GraphQL | Pylon | コードファーストなGraphQL |

> **Note**: Cloudflare Workers上で動作するため、Node.jsバージョンは参考値です。`nodejs_compat`フラグを最新に設定して互換性を確保します。

### 2.2 Pylon について

[Pylon](https://pylon.cronit.io/) はHonoベースのコードファーストGraphQLフレームワークです。

- TypeScriptの型定義からGraphQLスキーマを自動生成
- スキーマ定義不要で開発効率向上
- Honoのミドルウェア・ルーティング機能を活用可能
- Cloudflare Workersネイティブ対応

### 2.3 インフラストラクチャ

| 項目 | 技術 | 用途 |
|------|------|------|
| デプロイ | Cloudflare Workers | エッジでの低レイテンシ実行 |
| 静的アセット | Cloudflare R2 | オブジェクトストレージ |
| CDN | Cloudflare CDN | アセットキャッシュ |
| データストレージ | Cloudflare KV | ゲームデータの保存 |

### 2.4 開発ツール

| 項目 | 技術 |
|------|------|
| パッケージマネージャ | pnpm |
| リンター / フォーマッター | Biome |
| テスト | Vitest |
| API ドキュメント | GraphiQL |

---

## 3. システムアーキテクチャ

### 3.1 全体構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client                                   │
│                    (API Token 必須)                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare CDN / Edge                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Cache Layer                            │   │
│  │  • Static Assets Cache (長時間・immutable)               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────────┐
│   Cloudflare Workers      │   │      Cloudflare R2            │
│  ┌─────────────────────┐  │   │  ┌─────────────────────────┐  │
│  │      Hono App       │  │   │  │   Static Assets         │  │
│  │  ┌───────────────┐  │  │   │  │  • textures/            │  │
│  │  │    Pylon      │  │  │   │  │  • models/              │  │
│  │  │   (GraphQL)   │  │  │   │  │  • sounds/              │  │
│  │  └───────────────┘  │  │   │  └─────────────────────────┘  │
│  │  ┌───────────────┐  │  │   └───────────────────────────────┘
│  │  │  REST Routes  │  │  │
│  │  │  (Assets)     │  │  │
│  │  └───────────────┘  │  │
│  └─────────────────────┘  │
│            │              │
│            ▼              │
│  ┌─────────────────────┐  │
│  │   Cloudflare KV     │  │
│  │  • Game Data JSON   │  │
│  │  • API Tokens       │  │
│  │  • Rate Limit State │  │
│  └─────────────────────┘  │
└───────────────────────────┘
```

### 3.2 リクエストフロー

```
1. GraphQL クエリ
   Client → Auth Check → Rate Limit → Workers (Pylon) → KV → Response

2. 静的アセット (RESTful)
   Client → Auth Check → CDN (キャッシュヒット) → Response
   Client → Auth Check → CDN (キャッシュミス) → R2 → Response (キャッシュ保存)
```

---

## 4. 認証

### 4.1 API アクセストークン

すべてのAPIリクエストには有効なアクセストークンが必要です。

#### トークン形式

```
Authorization: Bearer mcapi_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### トークン取得方法

1. 開発者ポータルでアカウント登録
2. アプリケーション作成
3. APIトークン発行

#### トークンの種類

| 種類 | 用途 | 有効期限 |
|------|------|---------|
| Development | 開発・テスト用 | 90日 |
| Production | 本番環境用 | 1年 |

### 4.2 認証エラー

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API token"
  }
}
```

| HTTPステータス | コード | 説明 |
|---------------|--------|------|
| 401 | `UNAUTHORIZED` | トークンなし/無効 |
| 403 | `FORBIDDEN` | 権限不足 |
| 429 | `RATE_LIMITED` | レート制限超過 |

---

## 5. API エンドポイント

### 5.1 エンドポイント一覧

| エンドポイント | メソッド | 認証 | 用途 |
|---------------|---------|------|------|
| `/graphql` | POST | 必須 | GraphQL API |
| `/graphiql` | GET | 任意 | GraphQL Playground |
| `/v1/assets/{version}/{path}` | GET | 必須 | 静的アセット取得 |
| `/v1/versions` | GET | 必須 | バージョン一覧 |
| `/health` | GET | 不要 | ヘルスチェック |

### 5.2 静的アセット API (RESTful)

静的アセットはキャッシュ効率を最大化するためRESTfulエンドポイントで提供します。

#### エンドポイント構造

```
GET /v1/assets/{version}/{category}/{type}/{name}.{ext}
```

#### パス例

```
# テクスチャ
GET /v1/assets/1.21/textures/block/stone.png
GET /v1/assets/1.21/textures/item/diamond_sword.png
GET /v1/assets/1.21/textures/entity/zombie/zombie.png

# モデル
GET /v1/assets/1.21/models/block/stone.json
GET /v1/assets/1.21/models/item/diamond_sword.json

# サウンド
GET /v1/assets/1.21/sounds/block/stone/break.ogg
GET /v1/assets/1.21/sounds/entity/zombie/ambient.ogg

# 言語ファイル
GET /v1/assets/1.21/lang/ja_jp.json
GET /v1/assets/1.21/lang/en_us.json
```

#### レスポンスヘッダー

```http
HTTP/1.1 200 OK
Content-Type: image/png
Cache-Control: public, max-age=31536000, immutable
ETag: "a1b2c3d4e5f6"
X-Version: 1.21
X-RateLimit-Remaining: 59
```

#### キャッシュ戦略

| アセット種別 | Cache-Control | 理由 |
|-------------|---------------|------|
| テクスチャ | `public, max-age=31536000, immutable` | バージョン固定で不変 |
| モデル | `public, max-age=31536000, immutable` | バージョン固定で不変 |
| サウンド | `public, max-age=31536000, immutable` | バージョン固定で不変 |
| 言語ファイル | `public, max-age=86400` | 翻訳更新の可能性 |

### 5.3 バージョン API (RESTful)

```
GET /v1/versions
GET /v1/versions/latest
GET /v1/versions/{id}
```

#### レスポンス例

```json
// GET /v1/versions
{
  "versions": [
    {
      "id": "1.21",
      "name": "1.21 - Tricky Trials",
      "type": "release",
      "releaseDate": "2024-06-13",
      "protocol": 767,
      "dataVersion": 3953
    }
  ],
  "latest": {
    "release": "1.21",
    "snapshot": "24w21a"
  }
}
```

---

## 6. GraphQL スキーマ設計

### 6.1 Pylon サービス定義

PylonではTypeScriptの型からGraphQLスキーマが自動生成されます。

```typescript
// src/graphql/index.ts
import { app } from '@getcronit/pylon'

export const graphql = {
  Query: {
    // バージョン
    versions: (): Version[] => { /* ... */ },
    version: (id: string): Version | null => { /* ... */ },
    latestVersion: (): Version => { /* ... */ },

    // アイテム
    items: (version: string, filter?: ItemFilter, pagination?: Pagination): ItemConnection => { /* ... */ },
    item: (version: string, id: string): Item | null => { /* ... */ },

    // ブロック
    blocks: (version: string, filter?: BlockFilter, pagination?: Pagination): BlockConnection => { /* ... */ },
    block: (version: string, id: string): Block | null => { /* ... */ },

    // レシピ
    recipes: (version: string, filter?: RecipeFilter, pagination?: Pagination): RecipeConnection => { /* ... */ },

    // エンティティ
    entities: (version: string, filter?: EntityFilter, pagination?: Pagination): EntityConnection => { /* ... */ },
    entity: (version: string, id: string): Entity | null => { /* ... */ },

    // 検索
    search: (version: string, query: string, types?: SearchType[]): SearchResult => { /* ... */ },
  },
}

export default app
```

### 6.2 型定義

#### Version

```typescript
interface Version {
  id: string                    // "1.21"
  name: string                  // "1.21 - Tricky Trials"
  releaseDate: string
  type: VersionType
  protocol: number
  dataVersion: number

  // 統計
  itemCount: number
  blockCount: number
  entityCount: number
  recipeCount: number
}

enum VersionType {
  RELEASE = 'RELEASE',
  SNAPSHOT = 'SNAPSHOT',
  PRE_RELEASE = 'PRE_RELEASE',
  RELEASE_CANDIDATE = 'RELEASE_CANDIDATE',
}
```

#### Item

```typescript
interface Item {
  id: string                    // "minecraft:diamond_sword"
  name: string                  // "diamond_sword"
  displayName: (lang?: string) => string
  description: (lang?: string) => string | null

  stackSize: number
  durability: number | null
  fireResistant: boolean
  rarity: Rarity

  equipment: EquipmentData | null
  food: FoodData | null
  tool: ToolData | null

  // 関連データ（遅延解決）
  recipes: () => Recipe[]
  usedInRecipes: () => Recipe[]
  block: () => Block | null
  enchantments: () => Enchantment[]
  tags: () => Tag[]

  // アセットURL
  texture: string
  model: string | null
}

enum Rarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
}

interface EquipmentData {
  slot: EquipmentSlot
  armor: number | null
  armorToughness: number | null
  knockbackResistance: number | null
  attackDamage: number | null
  attackSpeed: number | null
}

interface FoodData {
  nutrition: number
  saturation: number
  canAlwaysEat: boolean
  effects: FoodEffect[]
}

interface ToolData {
  type: ToolType
  tier: ToolTier
  speed: number
  damage: number
  enchantmentValue: number
}
```

#### Block

```typescript
interface Block {
  id: string                    // "minecraft:stone"
  name: string                  // "stone"
  displayName: (lang?: string) => string

  // 物理属性
  hardness: number
  blastResistance: number
  friction: number
  speedFactor: number
  jumpFactor: number

  // 特性
  requiresCorrectTool: boolean
  hasGravity: boolean
  flammable: boolean
  replaceable: boolean
  luminance: number             // 0-15

  // ブロック状態
  states: BlockState[]
  defaultState: BlockStateValue

  // 関連データ
  item: () => Item | null
  drops: () => LootDrop[]
  preferredTool: ToolType | null
  minimumTool: ToolTier | null
  tags: () => Tag[]

  // アセット
  texture: BlockTexture
  model: string
}
```

#### Recipe

```typescript
type Recipe = ShapedRecipe | ShapelessRecipe | SmeltingRecipe | SmithingRecipe | StonecuttingRecipe

interface BaseRecipe {
  id: string
  type: RecipeType
  group: string | null
  result: ItemStack
}

interface ShapedRecipe extends BaseRecipe {
  type: RecipeType.CRAFTING_SHAPED
  pattern: string[]
  key: RecipeKey[]
  width: number
  height: number
}

interface ShapelessRecipe extends BaseRecipe {
  type: RecipeType.CRAFTING_SHAPELESS
  ingredients: Ingredient[]
}

interface SmeltingRecipe extends BaseRecipe {
  type: RecipeType.SMELTING | RecipeType.BLASTING | RecipeType.SMOKING | RecipeType.CAMPFIRE_COOKING
  ingredient: Ingredient
  experience: number
  cookingTime: number
}

interface SmithingRecipe extends BaseRecipe {
  type: RecipeType.SMITHING
  template: Ingredient
  base: Ingredient
  addition: Ingredient
}

interface StonecuttingRecipe extends BaseRecipe {
  type: RecipeType.STONECUTTING
  ingredient: Ingredient
}
```

#### Entity

```typescript
interface Entity {
  id: string                    // "minecraft:zombie"
  name: string                  // "zombie"
  displayName: (lang?: string) => string

  category: EntityCategory
  health: number
  width: number
  height: number
  fireImmune: boolean

  mob: MobData | null
  drops: () => LootDrop[]
  spawnConditions: SpawnCondition | null
  tags: () => Tag[]

  texture: string
}
```

### 6.3 フィルター・ページネーション

```typescript
interface ItemFilter {
  search?: string
  rarity?: Rarity
  stackable?: boolean
  hasRecipe?: boolean
  hasDurability?: boolean
  isFood?: boolean
  isEquipment?: boolean
  isTool?: boolean
  tags?: string[]
}

interface Pagination {
  first?: number    // default: 20, max: 100
  after?: string
  last?: number
  before?: string
}

interface PageInfo {
  hasNextPage: boolean
  hasPreviousPage: boolean
  startCursor: string | null
  endCursor: string | null
  totalCount: number
}

interface ItemConnection {
  edges: ItemEdge[]
  pageInfo: PageInfo
}

interface ItemEdge {
  node: Item
  cursor: string
}
```

---

## 7. クエリ例

### 7.1 基本的なクエリ

```graphql
# アイテム一覧（ページネーション付き）
query GetItems {
  items(version: "1.21", pagination: { first: 10 }) {
    edges {
      node {
        id
        displayName(lang: "ja_jp")
        stackSize
        texture
      }
    }
    pageInfo {
      hasNextPage
      endCursor
      totalCount
    }
  }
}
```

### 7.2 関連データの取得

```graphql
# アイテムとそのレシピ、材料の詳細を一括取得
query GetItemWithRecipes {
  item(version: "1.21", id: "diamond_sword") {
    displayName(lang: "ja_jp")
    durability
    equipment {
      attackDamage
      attackSpeed
    }
    recipes {
      ... on ShapedRecipe {
        pattern
        key {
          key
          ingredient {
            items {
              displayName(lang: "ja_jp")
              texture
            }
          }
        }
      }
    }
    enchantments {
      displayName(lang: "ja_jp")
      maxLevel
    }
  }
}
```

### 7.3 静的アセット取得（REST）

```bash
# テクスチャ取得
curl -H "Authorization: Bearer mcapi_xxx" \
  https://api.example.com/v1/assets/1.21/textures/item/diamond_sword.png

# モデル取得
curl -H "Authorization: Bearer mcapi_xxx" \
  https://api.example.com/v1/assets/1.21/models/item/diamond_sword.json
```

---

## 8. レート制限

### 8.1 制限値

| プラン | リクエスト/分 | リクエスト/日 | クエリ深度 | クエリ複雑度 |
|--------|-------------|--------------|-----------|-------------|
| Free | 60 | 10,000 | 5 | 100 |
| Basic | 300 | 100,000 | 10 | 500 |
| Pro | 1,000 | 1,000,000 | 15 | 1,000 |
| Enterprise | カスタム | カスタム | カスタム | カスタム |

### 8.2 レート制限ヘッダー

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1699900000
X-RateLimit-Policy: 60;w=60
```

### 8.3 制限超過時のレスポンス

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Please wait before making another request.",
    "retryAfter": 30
  }
}
```

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

---

## 9. エラーハンドリング

### 9.1 GraphQL エラー

```json
{
  "errors": [
    {
      "message": "Item not found: invalid_item",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["item"],
      "extensions": {
        "code": "NOT_FOUND",
        "version": "1.21",
        "resourceType": "item",
        "resourceId": "invalid_item"
      }
    }
  ],
  "data": null
}
```

### 9.2 REST API エラー

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Asset not found: textures/item/invalid.png",
    "version": "1.21",
    "path": "textures/item/invalid.png"
  }
}
```

### 9.3 エラーコード一覧

| コード | HTTPステータス | 説明 |
|--------|---------------|------|
| `UNAUTHORIZED` | 401 | 認証エラー |
| `FORBIDDEN` | 403 | 権限不足 |
| `NOT_FOUND` | 404 | リソースが見つからない |
| `INVALID_VERSION` | 400 | 無効なバージョン指定 |
| `INVALID_ARGUMENT` | 400 | 無効な引数 |
| `RATE_LIMITED` | 429 | レート制限超過 |
| `QUERY_TOO_COMPLEX` | 400 | クエリ複雑度超過 |
| `QUERY_TOO_DEEP` | 400 | クエリ深度超過 |
| `INTERNAL_ERROR` | 500 | 内部エラー |

---

## 10. キャッシュ戦略

### 10.1 静的アセット（REST）

| アセット種別 | TTL | Cache-Control | 備考 |
|-------------|-----|---------------|------|
| テクスチャ | 1年 | `public, max-age=31536000, immutable` | バージョン別URL |
| モデル | 1年 | `public, max-age=31536000, immutable` | バージョン別URL |
| サウンド | 1年 | `public, max-age=31536000, immutable` | バージョン別URL |
| 言語ファイル | 1日 | `public, max-age=86400, stale-while-revalidate=3600` | 翻訳更新対応 |

### 10.2 GraphQL レスポンス

GraphQLレスポンスはクエリ内容が動的なため、CDNキャッシュは行いません。
クライアント側でのキャッシュを推奨します。

| データ種別 | 推奨クライアントTTL |
|-----------|-------------------|
| バージョン情報 | 1時間 |
| アイテム/ブロック | 24時間 |
| レシピ | 24時間 |
| 検索結果 | 5分 |

---

## 11. セキュリティ

### 11.1 認証・認可

- すべてのAPIリクエストにアクセストークン必須
- トークンはKVに保存、検証はエッジで実行
- 不正トークンは即座にブロック

### 11.2 DoS対策

| 脅威 | 対策 |
|------|------|
| リクエスト過多 | レート制限（トークン単位） |
| クエリ深度攻撃 | 深度制限（最大15） |
| クエリ複雑度攻撃 | 複雑度制限 |
| 大量データ取得 | ページネーション必須（最大100件） |

### 11.3 CORS設定

```typescript
{
  origin: (origin) => {
    // 登録済みオリジンのみ許可
    return allowedOrigins.includes(origin)
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
  credentials: false,
}
```

---

## 12. 法的考慮事項

### 12.1 公式アセット再配布について

本APIはMinecraftの公式アセットを再配布するため、以下を遵守します：

- Mojang/MicrosoftのEULAおよびブランドガイドラインに準拠
- 商用利用に関する制限を明記
- アクセストークンによる利用者管理
- 不正利用の監視・対応

### 12.2 利用規約

APIの利用には以下への同意が必要です：

1. 非公式APIであることの理解
2. 商用利用時の制限事項
3. レート制限の遵守
4. 著作権表示の義務

### 12.3 免責事項

- 本APIはMojang AB / Microsoft Corporationとは無関係の非公式プロジェクトです
- Minecraftは Mojang AB の商標です
- データの正確性・完全性は保証しません
- サービスの継続性は保証しません
