# データパイプライン設計書

## 1. 概要

Minecraft Web APIで提供するデータは、Minecraft公式クライアントJARファイルから抽出し、API用のJSON形式に変換して使用する。

### 1.1 データソース

| ソース | 内容 | 用途 |
|--------|------|------|
| Minecraft JAR | アセット、データ | 主要データソース |
| Version Manifest | バージョン情報 | バージョン管理 |
| minecraft-data | 補完データ | 不足データの補完 |

### 1.2 処理フロー概要

```
┌─────────────────┐
│ Version Manifest│
│ (Mojang API)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Download JAR    │────▶│ Extract Assets  │
│ (per version)   │     │ & Data          │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ Process  │ │ Process  │ │ Process  │
              │ Items    │ │ Blocks   │ │ Entities │
              └────┬─────┘ └────┬─────┘ └────┬─────┘
                   │            │            │
                   └────────────┼────────────┘
                                ▼
                        ┌──────────────┐
                        │ Merge &      │
                        │ Normalize    │
                        └──────┬───────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
              ┌──────────┐ ┌────────┐ ┌────────┐
              │ Upload   │ │ Upload │ │ Upload │
              │ to KV    │ │ to R2  │ │ Types  │
              └──────────┘ └────────┘ └────────┘
```

---

## 2. Version Manifest

### 2.1 Mojang Version Manifest API

```
https://piston-meta.mojang.com/mc/game/version_manifest_v2.json
```

### 2.2 レスポンス構造

```typescript
interface VersionManifest {
  latest: {
    release: string      // "1.21"
    snapshot: string     // "24w21a"
  }
  versions: VersionEntry[]
}

interface VersionEntry {
  id: string             // "1.21"
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string            // バージョン詳細JSONのURL
  time: string           // ISO 8601
  releaseTime: string    // ISO 8601
  sha1: string
  complianceLevel: number
}
```

### 2.3 バージョン詳細

```typescript
interface VersionDetail {
  id: string
  type: string
  downloads: {
    client: {
      sha1: string
      size: number
      url: string
    }
    server: {
      sha1: string
      size: number
      url: string
    }
  }
  assetIndex: {
    id: string
    sha1: string
    size: number
    totalSize: number
    url: string
  }
}
```

---

## 3. JAR抽出処理

### 3.1 JARファイル構造

```
minecraft-{version}.jar
├── assets/
│   └── minecraft/
│       ├── textures/
│       │   ├── block/
│       │   ├── item/
│       │   ├── entity/
│       │   ├── gui/
│       │   └── particle/
│       ├── models/
│       │   ├── block/
│       │   └── item/
│       ├── sounds/
│       ├── lang/
│       │   ├── en_us.json
│       │   └── ja_jp.json
│       └── blockstates/
│
├── data/
│   └── minecraft/
│       ├── recipes/
│       ├── loot_tables/
│       │   ├── blocks/
│       │   ├── entities/
│       │   └── chests/
│       ├── tags/
│       │   ├── blocks/
│       │   ├── items/
│       │   └── entity_types/
│       ├── advancements/
│       └── worldgen/
│           └── biome/
│
└── META-INF/
```

### 3.2 抽出スクリプト

```typescript
// scripts/extract-data.ts
import { execSync } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import AdmZip from 'adm-zip'

interface ExtractionConfig {
  version: string
  jarPath: string
  outputDir: string
}

export async function extractMinecraftData(config: ExtractionConfig) {
  const { version, jarPath, outputDir } = config

  console.log(`Extracting data for version ${version}...`)

  const zip = new AdmZip(jarPath)
  const entries = zip.getEntries()

  // 抽出対象パターン
  const patterns = {
    textures: /^assets\/minecraft\/textures\//,
    models: /^assets\/minecraft\/models\//,
    blockstates: /^assets\/minecraft\/blockstates\//,
    lang: /^assets\/minecraft\/lang\//,
    sounds: /^assets\/minecraft\/sounds\//,
    recipes: /^data\/minecraft\/recipes\//,
    lootTables: /^data\/minecraft\/loot_tables\//,
    tags: /^data\/minecraft\/tags\//,
    advancements: /^data\/minecraft\/advancements\//,
    worldgen: /^data\/minecraft\/worldgen\//,
  }

  for (const entry of entries) {
    if (entry.isDirectory) continue

    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(entry.entryName)) {
        const relativePath = entry.entryName
        const outputPath = path.join(outputDir, version, relativePath)

        await fs.mkdir(path.dirname(outputPath), { recursive: true })
        await fs.writeFile(outputPath, entry.getData())

        break
      }
    }
  }

  console.log(`Extraction complete for version ${version}`)
}
```

---

## 4. データ変換処理

### 4.1 アイテムデータ生成

```typescript
// scripts/processors/items.ts
import * as fs from 'fs/promises'
import * as path from 'path'

interface RawItemModel {
  parent?: string
  textures?: Record<string, string>
  display?: Record<string, unknown>
}

interface ProcessedItem {
  id: string
  name: string
  stackSize: number
  durability?: number
  fireResistant: boolean
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC'
  food?: FoodData
  equipment?: EquipmentData
  tool?: ToolData
}

export async function processItems(
  version: string,
  extractedDir: string
): Promise<ProcessedItem[]> {
  const items: ProcessedItem[] = []

  // モデルファイルからアイテム一覧を取得
  const modelsDir = path.join(extractedDir, version, 'assets/minecraft/models/item')
  const modelFiles = await fs.readdir(modelsDir)

  for (const file of modelFiles) {
    if (!file.endsWith('.json')) continue

    const itemName = file.replace('.json', '')
    const modelPath = path.join(modelsDir, file)
    const modelData: RawItemModel = JSON.parse(await fs.readFile(modelPath, 'utf-8'))

    // 基本情報
    const item: ProcessedItem = {
      id: `minecraft:${itemName}`,
      name: itemName,
      stackSize: getStackSize(itemName),
      fireResistant: isFireResistant(itemName),
      rarity: getRarity(itemName),
    }

    // 耐久値
    const durability = getDurability(itemName)
    if (durability) {
      item.durability = durability
    }

    // 食料データ
    const foodData = getFoodData(itemName)
    if (foodData) {
      item.food = foodData
    }

    // 装備データ
    const equipmentData = getEquipmentData(itemName)
    if (equipmentData) {
      item.equipment = equipmentData
    }

    // ツールデータ
    const toolData = getToolData(itemName)
    if (toolData) {
      item.tool = toolData
    }

    items.push(item)
  }

  return items
}

// ハードコードされたデータ（JARから取得できない情報）
const STACK_SIZES: Record<string, number> = {
  // ツール・武器・防具
  diamond_sword: 1,
  diamond_pickaxe: 1,
  diamond_axe: 1,
  // ... 他のアイテム
}

const DURABILITIES: Record<string, number> = {
  diamond_sword: 1561,
  diamond_pickaxe: 1561,
  iron_sword: 250,
  // ...
}

const FOOD_DATA: Record<string, FoodData> = {
  apple: { nutrition: 4, saturation: 2.4, canAlwaysEat: false, effects: [] },
  golden_apple: {
    nutrition: 4,
    saturation: 9.6,
    canAlwaysEat: true,
    effects: [
      { effect: 'regeneration', duration: 100, amplifier: 1, probability: 1 },
      { effect: 'absorption', duration: 2400, amplifier: 0, probability: 1 },
    ],
  },
  // ...
}

function getStackSize(itemName: string): number {
  return STACK_SIZES[itemName] ?? 64
}

function getDurability(itemName: string): number | undefined {
  return DURABILITIES[itemName]
}

function getFoodData(itemName: string): FoodData | undefined {
  return FOOD_DATA[itemName]
}

// ... 他のヘルパー関数
```

### 4.2 ブロックデータ生成

```typescript
// scripts/processors/blocks.ts
interface ProcessedBlock {
  id: string
  name: string
  hardness: number
  blastResistance: number
  friction: number
  speedFactor: number
  jumpFactor: number
  luminance: number
  requiresCorrectTool: boolean
  hasGravity: boolean
  flammable: boolean
  replaceable: boolean
  states: BlockState[]
}

export async function processBlocks(
  version: string,
  extractedDir: string
): Promise<ProcessedBlock[]> {
  const blocks: ProcessedBlock[] = []

  // blockstatesからブロック一覧を取得
  const blockstatesDir = path.join(
    extractedDir,
    version,
    'assets/minecraft/blockstates'
  )
  const blockstateFiles = await fs.readdir(blockstatesDir)

  for (const file of blockstateFiles) {
    if (!file.endsWith('.json')) continue

    const blockName = file.replace('.json', '')
    const blockstatePath = path.join(blockstatesDir, file)
    const blockstateData = JSON.parse(await fs.readFile(blockstatePath, 'utf-8'))

    const block: ProcessedBlock = {
      id: `minecraft:${blockName}`,
      name: blockName,
      hardness: getHardness(blockName),
      blastResistance: getBlastResistance(blockName),
      friction: getFriction(blockName),
      speedFactor: getSpeedFactor(blockName),
      jumpFactor: getJumpFactor(blockName),
      luminance: getLuminance(blockName),
      requiresCorrectTool: requiresCorrectTool(blockName),
      hasGravity: hasGravity(blockName),
      flammable: isFlammable(blockName),
      replaceable: isReplaceable(blockName),
      states: parseBlockStates(blockstateData),
    }

    blocks.push(block)
  }

  return blocks
}

// ブロック状態のパース
function parseBlockStates(blockstateData: any): BlockState[] {
  const states: BlockState[] = []

  if (blockstateData.variants) {
    // Simple variants
    const variantKeys = Object.keys(blockstateData.variants)
    const stateProps = new Map<string, Set<string>>()

    for (const key of variantKeys) {
      if (key === '') continue

      const pairs = key.split(',')
      for (const pair of pairs) {
        const [name, value] = pair.split('=')
        if (!stateProps.has(name)) {
          stateProps.set(name, new Set())
        }
        stateProps.get(name)!.add(value)
      }
    }

    for (const [name, values] of stateProps) {
      states.push({
        name,
        type: inferBlockStateType(name, values),
        values: Array.from(values),
        defaultValue: Array.from(values)[0],
      })
    }
  }

  if (blockstateData.multipart) {
    // Multipart model - extract from conditions
    const conditions = blockstateData.multipart
      .filter((part: any) => part.when)
      .map((part: any) => part.when)

    // ... 条件からステート抽出
  }

  return states
}
```

### 4.3 レシピデータ生成

```typescript
// scripts/processors/recipes.ts
interface RawRecipe {
  type: string
  pattern?: string[]
  key?: Record<string, { item?: string; tag?: string }>
  ingredients?: Array<{ item?: string; tag?: string }>
  ingredient?: { item?: string; tag?: string }
  result: { item: string; count?: number } | string
  experience?: number
  cookingtime?: number
}

interface ProcessedRecipe {
  id: string
  type: string
  group?: string
  result: {
    item: string
    count: number
  }
  // タイプ別の追加フィールド
  pattern?: string[]
  key?: RecipeKey[]
  ingredients?: Ingredient[]
  ingredient?: Ingredient
  experience?: number
  cookingTime?: number
}

export async function processRecipes(
  version: string,
  extractedDir: string
): Promise<ProcessedRecipe[]> {
  const recipes: ProcessedRecipe[] = []

  const recipesDir = path.join(extractedDir, version, 'data/minecraft/recipes')
  const recipeFiles = await getFilesRecursive(recipesDir)

  for (const file of recipeFiles) {
    if (!file.endsWith('.json')) continue

    const recipePath = path.join(recipesDir, file)
    const rawRecipe: RawRecipe = JSON.parse(await fs.readFile(recipePath, 'utf-8'))

    const recipeName = file.replace('.json', '').replace(/\//g, '_')
    const processed = processRecipe(recipeName, rawRecipe)

    if (processed) {
      recipes.push(processed)
    }
  }

  return recipes
}

function processRecipe(name: string, raw: RawRecipe): ProcessedRecipe | null {
  const type = normalizeRecipeType(raw.type)

  const base: ProcessedRecipe = {
    id: `minecraft:${name}`,
    type,
    result: normalizeResult(raw.result),
  }

  switch (type) {
    case 'CRAFTING_SHAPED':
      return {
        ...base,
        pattern: raw.pattern,
        key: raw.key ? normalizeKey(raw.key) : [],
      }

    case 'CRAFTING_SHAPELESS':
      return {
        ...base,
        ingredients: raw.ingredients?.map(normalizeIngredient) ?? [],
      }

    case 'SMELTING':
    case 'BLASTING':
    case 'SMOKING':
    case 'CAMPFIRE_COOKING':
      return {
        ...base,
        ingredient: raw.ingredient ? normalizeIngredient(raw.ingredient) : undefined,
        experience: raw.experience ?? 0,
        cookingTime: raw.cookingtime ?? 200,
      }

    case 'STONECUTTING':
      return {
        ...base,
        ingredient: raw.ingredient ? normalizeIngredient(raw.ingredient) : undefined,
      }

    default:
      console.warn(`Unknown recipe type: ${raw.type}`)
      return null
  }
}

function normalizeRecipeType(type: string): string {
  const typeMap: Record<string, string> = {
    'minecraft:crafting_shaped': 'CRAFTING_SHAPED',
    'minecraft:crafting_shapeless': 'CRAFTING_SHAPELESS',
    'minecraft:smelting': 'SMELTING',
    'minecraft:blasting': 'BLASTING',
    'minecraft:smoking': 'SMOKING',
    'minecraft:campfire_cooking': 'CAMPFIRE_COOKING',
    'minecraft:stonecutting': 'STONECUTTING',
    'minecraft:smithing_transform': 'SMITHING',
    'minecraft:smithing_trim': 'SMITHING',
  }
  return typeMap[type] ?? type.toUpperCase()
}

function normalizeResult(result: RawRecipe['result']): { item: string; count: number } {
  if (typeof result === 'string') {
    return { item: result, count: 1 }
  }
  return {
    item: result.item,
    count: result.count ?? 1,
  }
}

function normalizeIngredient(
  ing: { item?: string; tag?: string }
): Ingredient {
  if (ing.tag) {
    return { type: 'tag', value: ing.tag }
  }
  return { type: 'item', value: ing.item! }
}
```

### 4.4 エンティティデータ生成

```typescript
// scripts/processors/entities.ts
import minecraftData from 'minecraft-data'

interface ProcessedEntity {
  id: string
  name: string
  category: string
  health: number
  width: number
  height: number
  fireImmune: boolean
  mob?: MobData
}

export async function processEntities(
  version: string,
  extractedDir: string
): Promise<ProcessedEntity[]> {
  // minecraft-dataから基本情報を取得
  const mcData = minecraftData(version)
  const entities: ProcessedEntity[] = []

  for (const entity of mcData.entitiesArray) {
    const processed: ProcessedEntity = {
      id: `minecraft:${entity.name}`,
      name: entity.name,
      category: categorizeEntity(entity),
      health: entity.health ?? 0,
      width: entity.width ?? 0,
      height: entity.height ?? 0,
      fireImmune: isFireImmune(entity.name),
    }

    // モブデータ
    if (isMob(entity)) {
      processed.mob = {
        attackDamage: getAttackDamage(entity.name),
        movementSpeed: getMovementSpeed(entity.name),
        followRange: getFollowRange(entity.name),
        spawnGroup: getSpawnGroup(entity.name),
      }
    }

    entities.push(processed)
  }

  return entities
}

function categorizeEntity(entity: any): string {
  // カテゴリ判定ロジック
  if (HOSTILE_MOBS.includes(entity.name)) return 'MONSTER'
  if (PASSIVE_MOBS.includes(entity.name)) return 'CREATURE'
  if (WATER_MOBS.includes(entity.name)) return 'WATER_CREATURE'
  if (AMBIENT_MOBS.includes(entity.name)) return 'AMBIENT'
  return 'MISC'
}
```

### 4.5 ルートテーブル処理

```typescript
// scripts/processors/loot-tables.ts
interface RawLootTable {
  type: string
  pools: LootPool[]
}

interface LootPool {
  rolls: number | { min: number; max: number }
  entries: LootEntry[]
  conditions?: LootCondition[]
}

interface LootEntry {
  type: string
  name?: string
  weight?: number
  quality?: number
  functions?: LootFunction[]
  conditions?: LootCondition[]
}

interface ProcessedLootDrop {
  item: string
  minCount: number
  maxCount: number
  chance: number
  conditions: string[]
  lootingBonus?: number
}

export async function processLootTables(
  version: string,
  extractedDir: string
): Promise<Map<string, ProcessedLootDrop[]>> {
  const lootTables = new Map<string, ProcessedLootDrop[]>()

  // ブロックのルートテーブル
  const blocksDir = path.join(
    extractedDir,
    version,
    'data/minecraft/loot_tables/blocks'
  )
  await processLootDir(blocksDir, 'block', lootTables)

  // エンティティのルートテーブル
  const entitiesDir = path.join(
    extractedDir,
    version,
    'data/minecraft/loot_tables/entities'
  )
  await processLootDir(entitiesDir, 'entity', lootTables)

  return lootTables
}

async function processLootDir(
  dir: string,
  prefix: string,
  result: Map<string, ProcessedLootDrop[]>
) {
  const files = await fs.readdir(dir)

  for (const file of files) {
    if (!file.endsWith('.json')) continue

    const tablePath = path.join(dir, file)
    const tableData: RawLootTable = JSON.parse(
      await fs.readFile(tablePath, 'utf-8')
    )

    const name = file.replace('.json', '')
    const key = `${prefix}:minecraft:${name}`
    const drops = processLootTable(tableData)

    result.set(key, drops)
  }
}

function processLootTable(table: RawLootTable): ProcessedLootDrop[] {
  const drops: ProcessedLootDrop[] = []

  for (const pool of table.pools) {
    const poolChance = calculatePoolChance(pool)

    for (const entry of pool.entries) {
      if (entry.type !== 'minecraft:item') continue

      const drop: ProcessedLootDrop = {
        item: entry.name!,
        minCount: 1,
        maxCount: 1,
        chance: poolChance * (entry.weight ?? 1),
        conditions: [],
      }

      // 関数からドロップ数を計算
      if (entry.functions) {
        for (const func of entry.functions) {
          if (func.function === 'minecraft:set_count') {
            const count = func.count as any
            if (typeof count === 'number') {
              drop.minCount = count
              drop.maxCount = count
            } else if (count.min !== undefined) {
              drop.minCount = count.min
              drop.maxCount = count.max
            }
          }

          if (func.function === 'minecraft:looting_enchant') {
            drop.lootingBonus = (func as any).count?.max ?? 1
          }
        }
      }

      // 条件を文字列化
      if (entry.conditions) {
        drop.conditions = entry.conditions.map(conditionToString)
      }

      drops.push(drop)
    }
  }

  return drops
}
```

---

## 5. データマージ・正規化

### 5.1 マージ処理

```typescript
// scripts/merge-data.ts
interface MergedData {
  items: ProcessedItem[]
  blocks: ProcessedBlock[]
  entities: ProcessedEntity[]
  recipes: ProcessedRecipe[]
  lootTables: Map<string, ProcessedLootDrop[]>
  tags: TagCollection
  lang: Record<string, Record<string, string>>
}

export async function mergeData(
  version: string,
  extractedDir: string
): Promise<MergedData> {
  // 各種データを処理
  const [items, blocks, entities, recipes, lootTables, tags, lang] =
    await Promise.all([
      processItems(version, extractedDir),
      processBlocks(version, extractedDir),
      processEntities(version, extractedDir),
      processRecipes(version, extractedDir),
      processLootTables(version, extractedDir),
      processTags(version, extractedDir),
      processLang(version, extractedDir),
    ])

  // アイテムにレシピ情報を紐付け
  const recipesByResult = groupBy(recipes, (r) => r.result.item)
  const recipesByIngredient = new Map<string, ProcessedRecipe[]>()

  for (const recipe of recipes) {
    const ingredients = extractIngredients(recipe)
    for (const ing of ingredients) {
      if (!recipesByIngredient.has(ing)) {
        recipesByIngredient.set(ing, [])
      }
      recipesByIngredient.get(ing)!.push(recipe)
    }
  }

  // ブロックにドロップ情報を紐付け
  for (const block of blocks) {
    const key = `block:${block.id}`
    block.drops = lootTables.get(key) ?? []
  }

  // エンティティにドロップ情報を紐付け
  for (const entity of entities) {
    const key = `entity:${entity.id}`
    entity.drops = lootTables.get(key) ?? []
  }

  return {
    items,
    blocks,
    entities,
    recipes,
    lootTables,
    tags,
    lang,
  }
}
```

### 5.2 データ検証

```typescript
// scripts/validate-data.ts
import { z } from 'zod'

const ItemSchema = z.object({
  id: z.string().regex(/^minecraft:[a-z_]+$/),
  name: z.string(),
  stackSize: z.number().int().min(1).max(64),
  durability: z.number().int().positive().optional(),
  fireResistant: z.boolean(),
  rarity: z.enum(['COMMON', 'UNCOMMON', 'RARE', 'EPIC']),
})

const BlockSchema = z.object({
  id: z.string().regex(/^minecraft:[a-z_]+$/),
  name: z.string(),
  hardness: z.number().min(-1), // -1 = unbreakable
  blastResistance: z.number().min(0),
  luminance: z.number().int().min(0).max(15),
})

export async function validateData(data: MergedData): Promise<ValidationResult> {
  const errors: ValidationError[] = []

  // アイテム検証
  for (const item of data.items) {
    const result = ItemSchema.safeParse(item)
    if (!result.success) {
      errors.push({
        type: 'item',
        id: item.id,
        errors: result.error.errors,
      })
    }
  }

  // ブロック検証
  for (const block of data.blocks) {
    const result = BlockSchema.safeParse(block)
    if (!result.success) {
      errors.push({
        type: 'block',
        id: block.id,
        errors: result.error.errors,
      })
    }
  }

  // 参照整合性チェック
  const itemIds = new Set(data.items.map((i) => i.id))

  for (const recipe of data.recipes) {
    // レシピの結果アイテムが存在するか
    if (!itemIds.has(recipe.result.item)) {
      errors.push({
        type: 'recipe',
        id: recipe.id,
        message: `Result item not found: ${recipe.result.item}`,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
```

---

## 6. アップロード処理

### 6.1 Cloudflare KVへのアップロード

```typescript
// scripts/upload-to-kv.ts
import { Miniflare } from 'miniflare'

interface UploadConfig {
  accountId: string
  namespaceId: string
  apiToken: string
}

export async function uploadToKV(
  data: MergedData,
  version: string,
  config: UploadConfig
) {
  const kvApi = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}`

  const uploads = [
    // アイテムデータ
    {
      key: `items:${version}`,
      value: JSON.stringify(data.items),
    },
    // ブロックデータ
    {
      key: `blocks:${version}`,
      value: JSON.stringify(data.blocks),
    },
    // エンティティデータ
    {
      key: `entities:${version}`,
      value: JSON.stringify(data.entities),
    },
    // レシピデータ
    {
      key: `recipes:${version}`,
      value: JSON.stringify(data.recipes),
    },
    // タグデータ
    {
      key: `tags:items:${version}`,
      value: JSON.stringify(data.tags.items),
    },
    {
      key: `tags:blocks:${version}`,
      value: JSON.stringify(data.tags.blocks),
    },
    // 言語データ
    ...Object.entries(data.lang).map(([lang, translations]) => ({
      key: `lang:${version}:${lang}`,
      value: JSON.stringify(translations),
    })),
  ]

  // バルクアップロード
  const batchSize = 100
  for (let i = 0; i < uploads.length; i += batchSize) {
    const batch = uploads.slice(i, i + batchSize)

    await fetch(`${kvApi}/bulk`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    })

    console.log(`Uploaded ${Math.min(i + batchSize, uploads.length)}/${uploads.length}`)
  }
}
```

### 6.2 Cloudflare R2へのアセットアップロード

```typescript
// scripts/upload-to-r2.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import * as fs from 'fs/promises'
import * as path from 'path'
import mime from 'mime-types'

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
}

export async function uploadToR2(
  extractedDir: string,
  version: string,
  config: R2Config
) {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  const assetsDir = path.join(extractedDir, version, 'assets/minecraft')

  // アップロード対象ディレクトリ
  const directories = ['textures', 'models', 'sounds']

  for (const dir of directories) {
    const fullDir = path.join(assetsDir, dir)
    const files = await getFilesRecursive(fullDir)

    for (const file of files) {
      const relativePath = path.relative(assetsDir, path.join(fullDir, file))
      const key = `${version}/${relativePath}`

      const content = await fs.readFile(path.join(fullDir, file))
      const contentType = mime.lookup(file) || 'application/octet-stream'

      await s3.send(new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: content,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }))

      console.log(`Uploaded: ${key}`)
    }
  }
}

async function getFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const subFiles = await getFilesRecursive(fullPath)
      files.push(...subFiles.map((f) => path.join(entry.name, f)))
    } else {
      files.push(entry.name)
    }
  }

  return files
}
```

---

## 7. 実行スクリプト

### 7.1 メインスクリプト

```typescript
// scripts/sync-version.ts
import { downloadJar } from './download-jar'
import { extractMinecraftData } from './extract-data'
import { mergeData } from './merge-data'
import { validateData } from './validate-data'
import { uploadToKV } from './upload-to-kv'
import { uploadToR2 } from './upload-to-r2'

interface SyncConfig {
  version: string
  kvConfig: KVConfig
  r2Config: R2Config
}

async function syncVersion(config: SyncConfig) {
  const { version } = config

  console.log(`\n========== Syncing version ${version} ==========\n`)

  // 1. JARダウンロード
  console.log('Step 1: Downloading JAR...')
  const jarPath = await downloadJar(version)

  // 2. データ抽出
  console.log('Step 2: Extracting data...')
  const extractedDir = './extracted'
  await extractMinecraftData({
    version,
    jarPath,
    outputDir: extractedDir,
  })

  // 3. データ変換・マージ
  console.log('Step 3: Processing data...')
  const data = await mergeData(version, extractedDir)

  // 4. 検証
  console.log('Step 4: Validating data...')
  const validation = await validateData(data)
  if (!validation.valid) {
    console.error('Validation errors:', validation.errors)
    throw new Error('Data validation failed')
  }

  // 5. KVアップロード
  console.log('Step 5: Uploading to KV...')
  await uploadToKV(data, version, config.kvConfig)

  // 6. R2アップロード
  console.log('Step 6: Uploading assets to R2...')
  await uploadToR2(extractedDir, version, config.r2Config)

  console.log(`\n========== Version ${version} synced successfully ==========\n`)
}

// CLI
const version = process.argv[2]
if (!version) {
  console.error('Usage: pnpm sync-version <version>')
  process.exit(1)
}

syncVersion({
  version,
  kvConfig: {
    accountId: process.env.CF_ACCOUNT_ID!,
    namespaceId: process.env.CF_KV_NAMESPACE_ID!,
    apiToken: process.env.CF_API_TOKEN!,
  },
  r2Config: {
    accountId: process.env.CF_ACCOUNT_ID!,
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!,
    bucketName: process.env.CF_R2_BUCKET_NAME!,
  },
})
```

### 7.2 package.json スクリプト

```json
{
  "scripts": {
    "sync-version": "tsx scripts/sync-version.ts",
    "sync-all": "tsx scripts/sync-all-versions.ts",
    "validate": "tsx scripts/validate-data.ts",
    "extract": "tsx scripts/extract-data.ts",
    "upload-kv": "tsx scripts/upload-to-kv.ts",
    "upload-r2": "tsx scripts/upload-to-r2.ts"
  }
}
```

---

## 8. GitHub Actions ワークフロー

```yaml
# .github/workflows/sync-data.yml
name: Sync Minecraft Data

on:
  schedule:
    # 毎日 UTC 0:00 に実行
    - cron: '0 0 * * *'
  workflow_dispatch:
    inputs:
      version:
        description: 'Minecraft version to sync (leave empty for latest)'
        required: false

jobs:
  check-version:
    runs-on: ubuntu-latest
    outputs:
      new_version: ${{ steps.check.outputs.new_version }}
    steps:
      - name: Check for new version
        id: check
        run: |
          LATEST=$(curl -s https://piston-meta.mojang.com/mc/game/version_manifest_v2.json | jq -r '.latest.release')
          CURRENT=$(curl -s https://api.example.com/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{ latestVersion { id } }"}' | jq -r '.data.latestVersion.id')

          if [ "$LATEST" != "$CURRENT" ] || [ -n "${{ github.event.inputs.version }}" ]; then
            echo "new_version=${{ github.event.inputs.version || env.LATEST }}" >> $GITHUB_OUTPUT
          fi

  sync:
    needs: check-version
    if: needs.check-version.outputs.new_version
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install

      - name: Sync version
        run: pnpm sync-version ${{ needs.check-version.outputs.new_version }}
        env:
          CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
          CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
          CF_KV_NAMESPACE_ID: ${{ secrets.CF_KV_NAMESPACE_ID }}
          CF_R2_ACCESS_KEY_ID: ${{ secrets.CF_R2_ACCESS_KEY_ID }}
          CF_R2_SECRET_ACCESS_KEY: ${{ secrets.CF_R2_SECRET_ACCESS_KEY }}
          CF_R2_BUCKET_NAME: ${{ secrets.CF_R2_BUCKET_NAME }}
```
