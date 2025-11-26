# Minecraft Web API 仕様書

## 1. プロジェクト概要

### 1.1 目的

Minecraftの静的アセット（テクスチャ、モデル、サウンド）およびゲームデータ（アイテム、ブロック、レシピ、エンティティ等）を提供するWeb APIを構築する。

### 1.2 特徴

- **GraphQL API**: 柔軟なクエリで必要なデータのみを取得可能
- **マルチバージョン対応**: 複数のMinecraftバージョンをサポート
- **多言語対応**: 各言語の翻訳データを提供
- **静的アセット配信**: テクスチャ、サウンド、モデルをCDN経由で高速配信

### 1.3 対象バージョン

| 種別 | バージョン範囲 |
|------|---------------|
| Java Edition | 1.14 〜 最新リリース |
| スナップショット | オプション対応 |

---

## 2. 技術スタック

### 2.1 コア技術

| 項目 | 技術 | バージョン | 選定理由 |
|------|------|-----------|---------|
| ランタイム | Node.js | 20 LTS | 安定性、エコシステム |
| 言語 | TypeScript | 5.x | 型安全性、開発体験 |
| フレームワーク | Hono | 4.x | 軽量、高速、マルチランタイム対応 |
| GraphQL | graphql-yoga | 5.x | Hono統合、モダンな設計 |
| スキーマ | Pothos | 4.x | コードファーストなスキーマ定義 |

### 2.2 インフラストラクチャ

| 項目 | 技術 | 用途 |
|------|------|------|
| デプロイ | Cloudflare Workers | エッジでの低レイテンシ実行 |
| 静的アセット | Cloudflare R2 | オブジェクトストレージ |
| CDN | Cloudflare CDN | アセットキャッシュ |
| データストレージ | JSON ファイル / KV | ゲームデータの保存 |

### 2.3 開発ツール

| 項目 | 技術 |
|------|------|
| パッケージマネージャ | pnpm |
| リンター | ESLint + Biome |
| フォーマッター | Biome |
| テスト | Vitest |
| API ドキュメント | GraphiQL |

---

## 3. システムアーキテクチャ

### 3.1 全体構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare CDN / Edge                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Cache Layer                            │   │
│  │  • GraphQL Response Cache (短時間)                       │   │
│  │  • Static Assets Cache (長時間)                          │   │
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
│  │  │ GraphQL Yoga  │  │  │   │  │  • models/              │  │
│  │  │   + Pothos    │  │  │   │  │  • sounds/              │  │
│  │  └───────────────┘  │  │   │  └─────────────────────────┘  │
│  └─────────────────────┘  │   └───────────────────────────────┘
│            │              │
│            ▼              │
│  ┌─────────────────────┐  │
│  │   Cloudflare KV     │  │
│  │  • Game Data JSON   │  │
│  │  • Version Metadata │  │
│  └─────────────────────┘  │
└───────────────────────────┘
```

### 3.2 リクエストフロー

```
1. GraphQL クエリ
   Client → CDN → Workers → KV (データ取得) → Response

2. 静的アセット
   Client → CDN (キャッシュヒット) → Response
   Client → CDN (キャッシュミス) → R2 → Response
```

---

## 4. API エンドポイント

### 4.1 エンドポイント一覧

| エンドポイント | メソッド | 用途 |
|---------------|---------|------|
| `/graphql` | POST, GET | GraphQL API |
| `/graphiql` | GET | GraphQL Playground |
| `/assets/{version}/{path}` | GET | 静的アセット取得 |
| `/health` | GET | ヘルスチェック |

### 4.2 静的アセットパス構造

```
/assets/{version}/textures/block/{name}.png
/assets/{version}/textures/item/{name}.png
/assets/{version}/textures/entity/{entity}/{name}.png
/assets/{version}/models/block/{name}.json
/assets/{version}/models/item/{name}.json
/assets/{version}/sounds/{category}/{name}.ogg
```

---

## 5. GraphQL スキーマ設計

### 5.1 ルートクエリ

```graphql
type Query {
  # バージョン情報
  versions: [Version!]!
  version(id: String!): Version
  latestVersion: Version!

  # アイテム
  items(version: String!, filter: ItemFilter, pagination: Pagination): ItemConnection!
  item(version: String!, id: String!): Item

  # ブロック
  blocks(version: String!, filter: BlockFilter, pagination: Pagination): BlockConnection!
  block(version: String!, id: String!): Block

  # レシピ
  recipes(version: String!, filter: RecipeFilter, pagination: Pagination): RecipeConnection!
  recipe(version: String!, id: String!): Recipe

  # エンティティ
  entities(version: String!, filter: EntityFilter, pagination: Pagination): EntityConnection!
  entity(version: String!, id: String!): Entity

  # エンチャント
  enchantments(version: String!, filter: EnchantmentFilter): [Enchantment!]!
  enchantment(version: String!, id: String!): Enchantment

  # ポーション効果
  effects(version: String!): [Effect!]!
  effect(version: String!, id: String!): Effect

  # バイオーム
  biomes(version: String!, filter: BiomeFilter): [Biome!]!
  biome(version: String!, id: String!): Biome

  # タグ
  tags(version: String!, type: TagType!): [Tag!]!
  tag(version: String!, type: TagType!, id: String!): Tag

  # 検索
  search(version: String!, query: String!, types: [SearchType!]): SearchResult!
}
```

### 5.2 型定義

#### Version

```graphql
type Version {
  id: String!                    # "1.21"
  name: String!                  # "1.21 - Tricky Trials"
  releaseDate: String!
  type: VersionType!             # RELEASE, SNAPSHOT
  protocol: Int!                 # プロトコルバージョン
  dataVersion: Int!              # データバージョン

  # 統計情報
  itemCount: Int!
  blockCount: Int!
  entityCount: Int!
  recipeCount: Int!
}

enum VersionType {
  RELEASE
  SNAPSHOT
  PRE_RELEASE
  RELEASE_CANDIDATE
}
```

#### Item

```graphql
type Item {
  id: ID!                        # "minecraft:diamond_sword"
  name: String!                  # "diamond_sword"
  displayName(lang: String = "en_us"): String!
  description(lang: String = "en_us"): String

  # 基本属性
  stackSize: Int!
  durability: Int
  fireResistant: Boolean!
  rarity: Rarity!

  # 装備属性（該当する場合）
  equipment: EquipmentData

  # 食料属性（該当する場合）
  food: FoodData

  # ツール属性（該当する場合）
  tool: ToolData

  # 関連データ
  recipes: [Recipe!]!            # このアイテムを作るレシピ
  usedInRecipes: [Recipe!]!      # このアイテムを材料とするレシピ
  block: Block                   # 対応するブロック（ブロックアイテムの場合）
  enchantments: [Enchantment!]!  # 付与可能なエンチャント
  tags: [Tag!]!                  # 所属するタグ

  # アセット
  texture: String!               # テクスチャURL
  model: String                  # モデルURL
}

enum Rarity {
  COMMON
  UNCOMMON
  RARE
  EPIC
}

type EquipmentData {
  slot: EquipmentSlot!
  armor: Int
  armorToughness: Float
  knockbackResistance: Float
  attackDamage: Float
  attackSpeed: Float
}

enum EquipmentSlot {
  HEAD
  CHEST
  LEGS
  FEET
  MAINHAND
  OFFHAND
}

type FoodData {
  nutrition: Int!
  saturation: Float!
  canAlwaysEat: Boolean!
  effects: [FoodEffect!]!
}

type FoodEffect {
  effect: Effect!
  duration: Int!
  amplifier: Int!
  probability: Float!
}

type ToolData {
  type: ToolType!
  tier: ToolTier!
  speed: Float!
  damage: Float!
  enchantmentValue: Int!
}

enum ToolType {
  PICKAXE
  AXE
  SHOVEL
  HOE
  SWORD
  SHEARS
  TRIDENT
  FISHING_ROD
  BOW
  CROSSBOW
}

enum ToolTier {
  WOOD
  STONE
  IRON
  GOLD
  DIAMOND
  NETHERITE
}
```

#### Block

```graphql
type Block {
  id: ID!                        # "minecraft:stone"
  name: String!                  # "stone"
  displayName(lang: String = "en_us"): String!

  # 物理属性
  hardness: Float!
  blastResistance: Float!
  friction: Float!
  speedFactor: Float!
  jumpFactor: Float!

  # 特性
  requiresCorrectTool: Boolean!
  hasGravity: Boolean!
  flammable: Boolean!
  replaceable: Boolean!

  # 光源
  luminance: Int!                # 0-15

  # ブロック状態
  states: [BlockState!]!
  defaultState: BlockStateValue!

  # 関連データ
  item: Item                     # 対応するアイテム
  drops: [LootDrop!]!           # ドロップ
  preferredTool: ToolType
  minimumTool: ToolTier
  tags: [Tag!]!

  # アセット
  texture: BlockTexture!
  model: String!
}

type BlockState {
  name: String!                  # "facing", "lit", "waterlogged"
  type: BlockStateType!
  values: [String!]!             # ["north", "south", "east", "west"]
  defaultValue: String!
}

enum BlockStateType {
  BOOLEAN
  INTEGER
  ENUM
  DIRECTION
}

type BlockStateValue {
  state: String!                 # "facing=north,lit=false"
  properties: [BlockStateProperty!]!
}

type BlockStateProperty {
  name: String!
  value: String!
}

type BlockTexture {
  default: String!
  top: String
  bottom: String
  side: String
  front: String
  back: String
}
```

#### Recipe

```graphql
interface Recipe {
  id: ID!
  type: RecipeType!
  group: String
  result: ItemStack!
}

enum RecipeType {
  CRAFTING_SHAPED
  CRAFTING_SHAPELESS
  SMELTING
  BLASTING
  SMOKING
  CAMPFIRE_COOKING
  STONECUTTING
  SMITHING
  BREWING
}

type ShapedRecipe implements Recipe {
  id: ID!
  type: RecipeType!
  group: String
  result: ItemStack!

  pattern: [String!]!            # ["DDD", " S ", " S "]
  key: [RecipeKey!]!
  width: Int!
  height: Int!
}

type ShapelessRecipe implements Recipe {
  id: ID!
  type: RecipeType!
  group: String
  result: ItemStack!

  ingredients: [Ingredient!]!
}

type SmeltingRecipe implements Recipe {
  id: ID!
  type: RecipeType!
  group: String
  result: ItemStack!

  ingredient: Ingredient!
  experience: Float!
  cookingTime: Int!              # ticks
}

type SmithingRecipe implements Recipe {
  id: ID!
  type: RecipeType!
  group: String
  result: ItemStack!

  template: Ingredient!
  base: Ingredient!
  addition: Ingredient!
}

type StonecuttingRecipe implements Recipe {
  id: ID!
  type: RecipeType!
  group: String
  result: ItemStack!

  ingredient: Ingredient!
}

type RecipeKey {
  key: String!                   # "D", "S"
  ingredient: Ingredient!
}

type Ingredient {
  items: [Item!]!                # 単一アイテムまたは複数（タグの場合）
  tag: Tag                       # タグ参照の場合
}

type ItemStack {
  item: Item!
  count: Int!
}
```

#### Entity

```graphql
type Entity {
  id: ID!                        # "minecraft:zombie"
  name: String!                  # "zombie"
  displayName(lang: String = "en_us"): String!

  # 分類
  category: EntityCategory!

  # 基本属性
  health: Float!
  width: Float!
  height: Float!
  fireImmune: Boolean!

  # モブ属性（該当する場合）
  mob: MobData

  # 関連データ
  drops: [LootDrop!]!
  spawnConditions: SpawnCondition
  tags: [Tag!]!

  # アセット
  texture: String!
}

enum EntityCategory {
  MONSTER
  CREATURE
  AMBIENT
  WATER_CREATURE
  WATER_AMBIENT
  UNDERGROUND_WATER_CREATURE
  MISC
}

type MobData {
  attackDamage: Float
  attackKnockback: Float
  movementSpeed: Float
  followRange: Float
  knockbackResistance: Float
  armor: Float
  spawnGroup: SpawnGroup!
}

enum SpawnGroup {
  MONSTER
  CREATURE
  AMBIENT
  WATER_CREATURE
  WATER_AMBIENT
  UNDERGROUND_WATER_CREATURE
  MISC
  AXOLOTLS
}

type LootDrop {
  item: Item!
  minCount: Int!
  maxCount: Int!
  chance: Float!                 # 0.0 - 1.0
  conditions: [LootCondition!]!
  lootingBonus: Float            # ドロップ増加エンチャント倍率
}

type LootCondition {
  type: String!
  description: String!
}

type SpawnCondition {
  biomes: [Biome!]!
  minLightLevel: Int
  maxLightLevel: Int
  minY: Int
  maxY: Int
  spawnWeight: Int!
  minGroupSize: Int!
  maxGroupSize: Int!
}
```

#### Enchantment

```graphql
type Enchantment {
  id: ID!                        # "minecraft:sharpness"
  name: String!                  # "sharpness"
  displayName(lang: String = "en_us"): String!
  description(lang: String = "en_us"): String!

  maxLevel: Int!
  minCost: EnchantmentCost!
  maxCost: EnchantmentCost!

  rarity: EnchantmentRarity!
  category: EnchantmentCategory!

  # 適用対象
  applicableItems: [Item!]!
  applicableTags: [Tag!]!

  # 競合
  incompatibleWith: [Enchantment!]!

  # 入手方法
  tradeable: Boolean!
  discoverable: Boolean!         # エンチャントテーブル
  treasureOnly: Boolean!
  curse: Boolean!
}

type EnchantmentCost {
  base: Int!
  perLevel: Int!
}

enum EnchantmentRarity {
  COMMON
  UNCOMMON
  RARE
  VERY_RARE
}

enum EnchantmentCategory {
  ARMOR
  ARMOR_FEET
  ARMOR_LEGS
  ARMOR_CHEST
  ARMOR_HEAD
  WEAPON
  DIGGER
  FISHING_ROD
  TRIDENT
  BREAKABLE
  BOW
  WEARABLE
  CROSSBOW
  VANISHABLE
}
```

#### Effect (ポーション効果)

```graphql
type Effect {
  id: ID!                        # "minecraft:speed"
  name: String!                  # "speed"
  displayName(lang: String = "en_us"): String!
  description(lang: String = "en_us"): String!

  category: EffectCategory!
  color: String!                 # hex color
  instant: Boolean!

  # このエフェクトを持つポーション
  potions: [Potion!]!
}

enum EffectCategory {
  BENEFICIAL
  HARMFUL
  NEUTRAL
}

type Potion {
  id: ID!
  name: String!
  displayName(lang: String = "en_us"): String!
  effects: [PotionEffect!]!

  # 醸造レシピ
  brewingRecipe: BrewingRecipe
}

type PotionEffect {
  effect: Effect!
  duration: Int!                 # ticks
  amplifier: Int!
}

type BrewingRecipe {
  base: Potion!
  ingredient: Item!
  result: Potion!
}
```

#### Biome

```graphql
type Biome {
  id: ID!                        # "minecraft:plains"
  name: String!
  displayName(lang: String = "en_us"): String!

  # 環境
  temperature: Float!
  downfall: Float!               # 降水量
  precipitation: Precipitation!

  # 色
  fogColor: String!
  waterColor: String!
  waterFogColor: String!
  skyColor: String!
  foliageColor: String
  grassColor: String

  # スポーン
  spawns: [BiomeSpawn!]!

  # 生成構造物
  structures: [Structure!]!

  # カテゴリ
  category: BiomeCategory!
}

enum Precipitation {
  NONE
  RAIN
  SNOW
}

enum BiomeCategory {
  NONE
  TAIGA
  EXTREME_HILLS
  JUNGLE
  MESA
  PLAINS
  SAVANNA
  ICY
  THE_END
  BEACH
  FOREST
  OCEAN
  DESERT
  RIVER
  SWAMP
  MUSHROOM
  NETHER
  UNDERGROUND
  MOUNTAIN
}

type BiomeSpawn {
  entity: Entity!
  weight: Int!
  minCount: Int!
  maxCount: Int!
}

type Structure {
  id: ID!
  name: String!
  displayName(lang: String = "en_us"): String!
}
```

#### Tag

```graphql
type Tag {
  id: ID!                        # "minecraft:planks"
  name: String!
  type: TagType!

  # 含まれるエントリ
  entries: [TagEntry!]!

  # このタグを使用するレシピ
  usedInRecipes: [Recipe!]!
}

enum TagType {
  BLOCK
  ITEM
  ENTITY
  FLUID
  BIOME
  STRUCTURE
}

union TagEntry = Item | Block | Entity | Tag
```

#### 検索

```graphql
type SearchResult {
  items: [Item!]!
  blocks: [Block!]!
  entities: [Entity!]!
  recipes: [Recipe!]!
  enchantments: [Enchantment!]!

  totalCount: Int!
}

enum SearchType {
  ITEM
  BLOCK
  ENTITY
  RECIPE
  ENCHANTMENT
}
```

### 5.3 フィルター・ページネーション

```graphql
input ItemFilter {
  search: String
  category: ItemCategory
  rarity: Rarity
  stackable: Boolean
  hasRecipe: Boolean
  hasDurability: Boolean
  isFood: Boolean
  isEquipment: Boolean
  isTool: Boolean
  tags: [String!]
}

input BlockFilter {
  search: String
  minHardness: Float
  maxHardness: Float
  hasGravity: Boolean
  isFlammable: Boolean
  luminance: Int
  tags: [String!]
}

input RecipeFilter {
  type: RecipeType
  resultItem: String
  ingredient: String
  ingredientTag: String
  group: String
}

input EntityFilter {
  search: String
  category: EntityCategory
  minHealth: Float
  maxHealth: Float
  isHostile: Boolean
  tags: [String!]
}

input EnchantmentFilter {
  search: String
  category: EnchantmentCategory
  rarity: EnchantmentRarity
  maxLevel: Int
  isCurse: Boolean
  isTreasure: Boolean
  applicableToItem: String
}

input BiomeFilter {
  search: String
  category: BiomeCategory
  precipitation: Precipitation
  minTemperature: Float
  maxTemperature: Float
  hasStructure: String
}

input Pagination {
  first: Int = 20
  after: String
  last: Int
  before: String
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
  totalCount: Int!
}

type ItemConnection {
  edges: [ItemEdge!]!
  pageInfo: PageInfo!
}

type ItemEdge {
  node: Item!
  cursor: String!
}

# 他のConnectionタイプも同様の構造
```

---

## 6. クエリ例

### 6.1 基本的なクエリ

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

# 特定アイテムの詳細
query GetItem {
  item(version: "1.21", id: "diamond_sword") {
    displayName(lang: "ja_jp")
    durability
    rarity
    equipment {
      attackDamage
      attackSpeed
    }
    enchantments {
      displayName(lang: "ja_jp")
      maxLevel
    }
  }
}
```

### 6.2 関連データの取得

```graphql
# アイテムとそのレシピ、材料の詳細を一括取得
query GetItemWithRecipes {
  item(version: "1.21", id: "diamond_sword") {
    displayName(lang: "ja_jp")

    recipes {
      ... on ShapedRecipe {
        pattern
        key {
          key
          ingredient {
            items {
              displayName(lang: "ja_jp")
              texture

              # 材料の入手方法も取得
              recipes {
                ... on ShapedRecipe {
                  pattern
                }
                ... on SmeltingRecipe {
                  ingredient {
                    items { name }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### 6.3 複雑な検索

```graphql
# ダイヤモンドを材料として使うレシピをすべて取得
query GetDiamondRecipes {
  recipes(
    version: "1.21"
    filter: { ingredient: "diamond" }
  ) {
    edges {
      node {
        ... on ShapedRecipe {
          pattern
          result {
            item {
              displayName(lang: "ja_jp")
              rarity
            }
            count
          }
        }
        ... on ShapelessRecipe {
          ingredients {
            items { name }
          }
          result {
            item { displayName(lang: "ja_jp") }
            count
          }
        }
      }
    }
  }
}

# 特定のバイオームにスポーンするモブとそのドロップ
query GetBiomeEntities {
  biome(version: "1.21", id: "plains") {
    displayName(lang: "ja_jp")
    spawns {
      entity {
        displayName(lang: "ja_jp")
        health
        drops {
          item {
            displayName(lang: "ja_jp")
            usedInRecipes {
              result {
                item { name }
              }
            }
          }
          chance
          minCount
          maxCount
        }
      }
      weight
    }
  }
}
```

### 6.4 横断検索

```graphql
# 全カテゴリ横断検索
query Search {
  search(version: "1.21", query: "diamond", types: [ITEM, BLOCK, RECIPE]) {
    items {
      displayName(lang: "ja_jp")
      texture
    }
    blocks {
      displayName(lang: "ja_jp")
      hardness
    }
    recipes {
      result {
        item { name }
      }
    }
    totalCount
  }
}
```

---

## 7. エラーハンドリング

### 7.1 エラーレスポンス形式

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

### 7.2 エラーコード

| コード | 説明 |
|--------|------|
| `NOT_FOUND` | リソースが見つからない |
| `INVALID_VERSION` | 無効なバージョン指定 |
| `INVALID_ARGUMENT` | 無効な引数 |
| `RATE_LIMITED` | レート制限超過 |
| `INTERNAL_ERROR` | 内部エラー |

---

## 8. レート制限

| プラン | リクエスト/分 | クエリ深度 | クエリ複雑度 |
|--------|-------------|-----------|-------------|
| Free | 60 | 5 | 100 |
| Basic | 300 | 10 | 500 |
| Pro | 1000 | 15 | 1000 |

---

## 9. キャッシュ戦略

### 9.1 GraphQL レスポンス

| データ種別 | TTL | 条件 |
|-----------|-----|------|
| バージョン情報 | 1時間 | - |
| アイテム/ブロック | 24時間 | バージョン固定 |
| レシピ | 24時間 | バージョン固定 |
| 検索結果 | 5分 | - |

### 9.2 静的アセット

| アセット種別 | TTL | Cache-Control |
|-------------|-----|---------------|
| テクスチャ | 1年 | `public, max-age=31536000, immutable` |
| モデル | 1年 | `public, max-age=31536000, immutable` |
| サウンド | 1年 | `public, max-age=31536000, immutable` |

---

## 10. セキュリティ

### 10.1 対策

| 脅威 | 対策 |
|------|------|
| DoS攻撃 | レート制限、クエリ複雑度制限 |
| クエリ深度攻撃 | 深度制限（最大15） |
| 大量データ取得 | ページネーション必須、最大100件 |

### 10.2 CORS設定

```typescript
{
  origin: ['https://example.com'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}
```

---

## 11. 法的考慮事項

### 11.1 Minecraft EULA準拠

- Mojangの商標・著作権を尊重
- 公式アセットの再配布に関するガイドラインに準拠
- 商用利用時の制限を明記

### 11.2 免責事項

- 非公式APIであることを明示
- Mojang/Microsoftとの関係がないことを明記
- データの正確性は保証しない
