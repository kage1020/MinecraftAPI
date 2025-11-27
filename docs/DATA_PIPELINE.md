# データパイプライン設計書

## 1. 概要

Minecraft Web APIで提供するデータは、Minecraft公式クライアント/サーバーJARファイルから抽出し、API用のJSON形式に変換して使用する。

### 1.1 対象エディション

| エディション | 対象範囲 | データ管理方式 |
|-------------|---------|---------------|
| Java Edition (Release) | 全リリースバージョン (1.0〜最新) | バージョン別 |
| Java Edition (Snapshot) | 全スナップショット | バージョン別 |
| Bedrock Edition | 最新版のみ | 累積（バージョンメタデータ付き） |

### 1.2 データソース

#### Java Edition

| ソース | 内容 | 抽出方法 |
|--------|------|---------|
| Client JAR | アセット（テクスチャ、モデル、サウンド、言語） | ZIP解凍 |
| Client JAR | レシピ、ルートテーブル、タグ、進捗 | ZIP解凍 |
| Server JAR | レジストリダンプ（ブロック、アイテム、エンティティ等） | `--reports` オプション |
| Version Manifest | バージョン情報、ダウンロードURL | Mojang API |

#### Bedrock Edition

| ソース | 内容 | 抽出方法 |
|--------|------|---------|
| Android APK | アセット（テクスチャ、モデル、サウンド） | APK解凍 |
| Behavior Packs | レシピ、ルートテーブル、エンティティ定義 | JSON解析 |
| Resource Packs | テクスチャ、モデル定義、言語ファイル | JSON解析 |
| Minecraft Wiki | 数値データ（HP、攻撃力等） | 手動更新 + 検証 |

### 1.3 処理フロー概要

#### Java Edition

```
┌─────────────────┐
│ Version Manifest│
│ (Mojang API)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Download JARs (per version)            │
│  • Client JAR (アセット、データパック)              │
│  • Server JAR (レジストリダンプ生成用)              │
│  ※ 全リリース + 全スナップショットを処理            │
└────────┬────────────────────────────┬───────────────┘
         │                            │
         ▼                            ▼
┌─────────────────┐      ┌─────────────────────────────┐
│ Extract Client  │      │ Generate Server Reports     │
│ JAR Contents    │      │ java -jar server.jar        │
│ (ZIP解凍)       │      │   --reports                 │
└────────┬────────┘      └─────────────┬───────────────┘
         │                             │
         │    ┌────────────────────────┘
         │    │
         ▼    ▼
┌─────────────────────────────────────────────────────┐
│              Data Processing                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Items    │ │ Blocks   │ │ Entities │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Recipes  │ │ Loot     │ │ Tags     │            │
│  └──────────┘ └──────────┘ └──────────┘            │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Merge & Normalize                      │
│  • 関連データの紐付け                               │
│  • ID正規化                                         │
│  • 言語データ統合                                   │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Validation                             │
│  • スキーマ検証                                     │
│  • 参照整合性チェック                               │
└────────┬────────────────────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ KV     │ │ R2     │
│(データ)│ │(アセット)│
└────────┘ └────────┘
```

#### Bedrock Edition

```
┌─────────────────────────────────────────────────────┐
│                Bedrock APK / Packs                  │
│  • Android APK (Google Play / APKMirror)            │
│  • Behavior Packs (レシピ、エンティティ)            │
│  • Resource Packs (テクスチャ、モデル)              │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Extract APK Contents                   │
│  assets/                                            │
│  ├── behavior_packs/vanilla/                        │
│  ├── resource_packs/vanilla/                        │
│  └── definitions/                                   │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Data Processing                        │
│  ┌──────────────────────────────────────────────┐  │
│  │ Diff with Previous Version                    │  │
│  │ • 新規追加アイテム/ブロック検出               │  │
│  │ • 変更されたデータ検出                        │  │
│  │ • 削除されたデータ検出                        │  │
│  └──────────────────────────────────────────────┘  │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Merge with Cumulative Data             │
│  • 新規データに bedrockMeta.addedIn を設定         │
│  • 変更データの bedrockMeta.lastModifiedIn を更新  │
│  • 削除データに bedrockMeta.removedIn を設定       │
│  • changelog に変更履歴を追加                       │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Upload                                 │
│  • KV: items:bedrock, blocks:bedrock など           │
│  • R2: bedrock/ ディレクトリにアセット              │
└─────────────────────────────────────────────────────┘
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

## 3. JAR ダウンロード

### 3.1 ダウンロードスクリプト

```typescript
// scripts/download-jars.ts
import * as fs from 'fs/promises'
import * as path from 'path'
import { createHash } from 'crypto'

interface DownloadConfig {
  version: string
  outputDir: string
}

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

export async function downloadJars(config: DownloadConfig) {
  const { version, outputDir } = config

  // バージョン情報取得
  const manifest = await fetch(MANIFEST_URL).then(r => r.json())
  const versionEntry = manifest.versions.find((v: any) => v.id === version)

  if (!versionEntry) {
    throw new Error(`Version not found: ${version}`)
  }

  const versionDetail = await fetch(versionEntry.url).then(r => r.json())

  // ディレクトリ作成
  const versionDir = path.join(outputDir, version)
  await fs.mkdir(versionDir, { recursive: true })

  // Client JAR ダウンロード
  const clientPath = path.join(versionDir, 'client.jar')
  await downloadWithVerification(
    versionDetail.downloads.client.url,
    clientPath,
    versionDetail.downloads.client.sha1
  )
  console.log(`Downloaded client.jar for ${version}`)

  // Server JAR ダウンロード
  const serverPath = path.join(versionDir, 'server.jar')
  await downloadWithVerification(
    versionDetail.downloads.server.url,
    serverPath,
    versionDetail.downloads.server.sha1
  )
  console.log(`Downloaded server.jar for ${version}`)

  return {
    clientPath,
    serverPath,
    versionDetail,
  }
}

async function downloadWithVerification(
  url: string,
  outputPath: string,
  expectedSha1: string
) {
  const response = await fetch(url)
  const buffer = Buffer.from(await response.arrayBuffer())

  // SHA1検証
  const hash = createHash('sha1').update(buffer).digest('hex')
  if (hash !== expectedSha1) {
    throw new Error(`SHA1 mismatch: expected ${expectedSha1}, got ${hash}`)
  }

  await fs.writeFile(outputPath, buffer)
}
```

---

## 4. サーバーレポート生成

Minecraft 1.13以降では、サーバーJARに `--reports` オプションを付けて実行すると、詳細なレジストリダンプを生成できます。

### 4.1 レポート生成スクリプト

```typescript
// scripts/generate-reports.ts
import { execSync } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'

interface ReportConfig {
  version: string
  serverJarPath: string
  outputDir: string
}

export async function generateServerReports(config: ReportConfig) {
  const { version, serverJarPath, outputDir } = config

  const workDir = path.join(outputDir, version, 'reports')
  await fs.mkdir(workDir, { recursive: true })

  console.log(`Generating reports for ${version}...`)

  // サーバーJARを実行してレポート生成
  // EULAに同意していなくてもレポートは生成される
  try {
    execSync(`java -DbundlerMainClass=net.minecraft.data.Main -jar "${serverJarPath}" --reports --output "${workDir}"`, {
      cwd: workDir,
      stdio: 'pipe',
      timeout: 60000,
    })
  } catch (error) {
    // レポート生成後に終了コード0以外で終了することがあるが、
    // レポートファイルが生成されていれば問題なし
  }

  // 生成されたファイル確認
  const files = await fs.readdir(workDir, { recursive: true })
  console.log(`Generated ${files.length} report files`)

  return workDir
}
```

### 4.2 生成されるレポートファイル

```
reports/
├── blocks.json              # ブロック定義（状態含む）
├── registries.json          # 全レジストリ一覧
├── commands.json            # コマンド定義
└── registries/
    ├── block.json           # ブロックID一覧
    ├── item.json            # アイテムID一覧
    ├── entity_type.json     # エンティティID一覧
    ├── enchantment.json     # エンチャントID一覧
    ├── mob_effect.json      # ステータス効果ID一覧
    ├── potion.json          # ポーションID一覧
    ├── biome.json           # バイオームID一覧
    └── ...
```

### 4.3 blocks.json の構造

```json
{
  "minecraft:stone": {
    "properties": {},
    "states": [
      {
        "id": 1,
        "default": true
      }
    ]
  },
  "minecraft:oak_log": {
    "properties": {
      "axis": ["x", "y", "z"]
    },
    "states": [
      { "id": 100, "properties": { "axis": "x" } },
      { "id": 101, "properties": { "axis": "y" }, "default": true },
      { "id": 102, "properties": { "axis": "z" } }
    ]
  }
}
```

---

## 5. Client JAR 抽出

### 5.1 抽出スクリプト

```typescript
// scripts/extract-client.ts
import * as fs from 'fs/promises'
import * as path from 'path'
import AdmZip from 'adm-zip'

interface ExtractionConfig {
  version: string
  clientJarPath: string
  outputDir: string
}

export async function extractClientJar(config: ExtractionConfig) {
  const { version, clientJarPath, outputDir } = config

  console.log(`Extracting client.jar for ${version}...`)

  const zip = new AdmZip(clientJarPath)
  const entries = zip.getEntries()

  const extractDir = path.join(outputDir, version, 'extracted')

  // 抽出対象パターン
  const patterns = {
    // アセット
    textures: /^assets\/minecraft\/textures\//,
    models: /^assets\/minecraft\/models\//,
    blockstates: /^assets\/minecraft\/blockstates\//,
    sounds: /^assets\/minecraft\/sounds\//,
    lang: /^assets\/minecraft\/lang\//,

    // データパック
    recipes: /^data\/minecraft\/recipe\//,            // 1.21+
    recipesLegacy: /^data\/minecraft\/recipes\//,     // 1.20以前
    lootTables: /^data\/minecraft\/loot_table\//,     // 1.21+
    lootTablesLegacy: /^data\/minecraft\/loot_tables\//, // 1.20以前
    tags: /^data\/minecraft\/tags\//,
    advancements: /^data\/minecraft\/advancement\//,  // 1.21+
    advancementsLegacy: /^data\/minecraft\/advancements\//, // 1.20以前
    worldgen: /^data\/minecraft\/worldgen\//,
  }

  let extractedCount = 0

  for (const entry of entries) {
    if (entry.isDirectory) continue

    let matched = false
    for (const pattern of Object.values(patterns)) {
      if (pattern.test(entry.entryName)) {
        matched = true
        break
      }
    }

    if (matched) {
      const outputPath = path.join(extractDir, entry.entryName)
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(outputPath, entry.getData())
      extractedCount++
    }
  }

  console.log(`Extracted ${extractedCount} files`)
  return extractDir
}
```

### 5.2 Client JAR の構造

```
client.jar
├── assets/
│   └── minecraft/
│       ├── textures/
│       │   ├── block/          # ブロックテクスチャ
│       │   ├── item/           # アイテムテクスチャ
│       │   ├── entity/         # エンティティテクスチャ
│       │   ├── gui/            # GUIテクスチャ
│       │   └── particle/       # パーティクル
│       ├── models/
│       │   ├── block/          # ブロックモデル
│       │   └── item/           # アイテムモデル
│       ├── blockstates/        # ブロック状態定義
│       ├── sounds/             # サウンドファイル
│       └── lang/               # 言語ファイル
│           ├── en_us.json
│           └── ja_jp.json
│
├── data/
│   └── minecraft/
│       ├── recipe/             # レシピ (1.21+)
│       ├── loot_table/         # ルートテーブル (1.21+)
│       │   ├── blocks/
│       │   ├── entities/
│       │   └── chests/
│       ├── tags/               # タグ
│       │   ├── block/
│       │   ├── item/
│       │   └── entity_type/
│       ├── advancement/        # 進捗 (1.21+)
│       └── worldgen/
│           └── biome/          # バイオーム定義
│
└── META-INF/
```

---

## 6. データ処理

### 6.1 アイテムデータ生成

```typescript
// scripts/processors/items.ts
import * as fs from 'fs/promises'
import * as path from 'path'

interface ProcessedItem {
  id: string
  name: string
  stackSize: number
  durability: number | null
  fireResistant: boolean
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC'
  food: FoodData | null
  equipment: EquipmentData | null
  tool: ToolData | null
}

export async function processItems(
  version: string,
  extractedDir: string,
  reportsDir: string
): Promise<ProcessedItem[]> {
  const items: ProcessedItem[] = []

  // レジストリからアイテムID一覧取得
  const registryPath = path.join(reportsDir, 'registries', 'item.json')
  const registry = JSON.parse(await fs.readFile(registryPath, 'utf-8'))
  const itemIds: string[] = Object.keys(registry.entries || registry)

  // モデルディレクトリ
  const modelsDir = path.join(extractedDir, 'assets/minecraft/models/item')

  for (const itemId of itemIds) {
    const name = itemId.replace('minecraft:', '')

    // 基本情報
    const item: ProcessedItem = {
      id: itemId,
      name,
      stackSize: getStackSize(name),
      durability: getDurability(name),
      fireResistant: isFireResistant(name),
      rarity: getRarity(name),
      food: getFoodData(name),
      equipment: getEquipmentData(name),
      tool: getToolData(name),
    }

    items.push(item)
  }

  return items
}

// ========== ハードコードされたゲームデータ ==========
// これらのデータはJARからは直接取得できないため、
// Minecraft Wikiなどを参考にハードコードします

const STACK_SIZES: Record<string, number> = {
  // デフォルトは64
  // 以下はスタック不可または16個まで
  'diamond_sword': 1,
  'diamond_pickaxe': 1,
  'diamond_axe': 1,
  'diamond_shovel': 1,
  'diamond_hoe': 1,
  'iron_sword': 1,
  'iron_pickaxe': 1,
  'bow': 1,
  'trident': 1,
  'elytra': 1,
  'shield': 1,
  'fishing_rod': 1,
  'egg': 16,
  'snowball': 16,
  'ender_pearl': 16,
  'sign': 16,
  'bucket': 16,
  'water_bucket': 1,
  'lava_bucket': 1,
  // ... 続く
}

const DURABILITIES: Record<string, number> = {
  'diamond_sword': 1561,
  'diamond_pickaxe': 1561,
  'diamond_axe': 1561,
  'diamond_shovel': 1561,
  'diamond_hoe': 1561,
  'netherite_sword': 2031,
  'netherite_pickaxe': 2031,
  'iron_sword': 250,
  'iron_pickaxe': 250,
  'stone_sword': 131,
  'stone_pickaxe': 131,
  'wooden_sword': 59,
  'wooden_pickaxe': 59,
  'golden_sword': 32,
  'golden_pickaxe': 32,
  'bow': 384,
  'trident': 250,
  'elytra': 432,
  'shield': 336,
  'fishing_rod': 64,
  'shears': 238,
  'flint_and_steel': 64,
  // 防具
  'diamond_helmet': 363,
  'diamond_chestplate': 528,
  'diamond_leggings': 495,
  'diamond_boots': 429,
  'netherite_helmet': 407,
  'netherite_chestplate': 592,
  'netherite_leggings': 555,
  'netherite_boots': 481,
  // ... 続く
}

const FIRE_RESISTANT_ITEMS = new Set([
  'netherite_sword',
  'netherite_pickaxe',
  'netherite_axe',
  'netherite_shovel',
  'netherite_hoe',
  'netherite_helmet',
  'netherite_chestplate',
  'netherite_leggings',
  'netherite_boots',
  'netherite_ingot',
  'netherite_scrap',
  'ancient_debris',
])

const RARE_ITEMS = new Set([
  'enchanted_golden_apple',
  'nether_star',
  'elytra',
  'dragon_egg',
  'beacon',
  'conduit',
  'heart_of_the_sea',
  'totem_of_undying',
])

const UNCOMMON_ITEMS = new Set([
  'golden_apple',
  'music_disc_13',
  'music_disc_cat',
  // ... 他のレコード
])

const FOOD_DATA: Record<string, FoodData> = {
  'apple': { nutrition: 4, saturation: 2.4, canAlwaysEat: false, effects: [] },
  'baked_potato': { nutrition: 5, saturation: 6.0, canAlwaysEat: false, effects: [] },
  'beef': { nutrition: 3, saturation: 1.8, canAlwaysEat: false, effects: [] },
  'cooked_beef': { nutrition: 8, saturation: 12.8, canAlwaysEat: false, effects: [] },
  'bread': { nutrition: 5, saturation: 6.0, canAlwaysEat: false, effects: [] },
  'golden_apple': {
    nutrition: 4,
    saturation: 9.6,
    canAlwaysEat: true,
    effects: [
      { effect: 'regeneration', duration: 100, amplifier: 1, probability: 1 },
      { effect: 'absorption', duration: 2400, amplifier: 0, probability: 1 },
    ],
  },
  'enchanted_golden_apple': {
    nutrition: 4,
    saturation: 9.6,
    canAlwaysEat: true,
    effects: [
      { effect: 'regeneration', duration: 400, amplifier: 1, probability: 1 },
      { effect: 'absorption', duration: 2400, amplifier: 3, probability: 1 },
      { effect: 'resistance', duration: 6000, amplifier: 0, probability: 1 },
      { effect: 'fire_resistance', duration: 6000, amplifier: 0, probability: 1 },
    ],
  },
  'rotten_flesh': {
    nutrition: 4,
    saturation: 0.8,
    canAlwaysEat: false,
    effects: [
      { effect: 'hunger', duration: 600, amplifier: 0, probability: 0.8 },
    ],
  },
  // ... 続く
}

const EQUIPMENT_DATA: Record<string, EquipmentData> = {
  // 剣
  'diamond_sword': { slot: 'MAINHAND', attackDamage: 7, attackSpeed: 1.6, armor: null, armorToughness: null, knockbackResistance: null },
  'netherite_sword': { slot: 'MAINHAND', attackDamage: 8, attackSpeed: 1.6, armor: null, armorToughness: null, knockbackResistance: null },
  'iron_sword': { slot: 'MAINHAND', attackDamage: 6, attackSpeed: 1.6, armor: null, armorToughness: null, knockbackResistance: null },
  'stone_sword': { slot: 'MAINHAND', attackDamage: 5, attackSpeed: 1.6, armor: null, armorToughness: null, knockbackResistance: null },
  'wooden_sword': { slot: 'MAINHAND', attackDamage: 4, attackSpeed: 1.6, armor: null, armorToughness: null, knockbackResistance: null },
  'golden_sword': { slot: 'MAINHAND', attackDamage: 4, attackSpeed: 1.6, armor: null, armorToughness: null, knockbackResistance: null },

  // 防具
  'diamond_helmet': { slot: 'HEAD', armor: 3, armorToughness: 2, knockbackResistance: null, attackDamage: null, attackSpeed: null },
  'diamond_chestplate': { slot: 'CHEST', armor: 8, armorToughness: 2, knockbackResistance: null, attackDamage: null, attackSpeed: null },
  'diamond_leggings': { slot: 'LEGS', armor: 6, armorToughness: 2, knockbackResistance: null, attackDamage: null, attackSpeed: null },
  'diamond_boots': { slot: 'FEET', armor: 3, armorToughness: 2, knockbackResistance: null, attackDamage: null, attackSpeed: null },
  'netherite_helmet': { slot: 'HEAD', armor: 3, armorToughness: 3, knockbackResistance: 0.1, attackDamage: null, attackSpeed: null },
  'netherite_chestplate': { slot: 'CHEST', armor: 8, armorToughness: 3, knockbackResistance: 0.1, attackDamage: null, attackSpeed: null },
  'netherite_leggings': { slot: 'LEGS', armor: 6, armorToughness: 3, knockbackResistance: 0.1, attackDamage: null, attackSpeed: null },
  'netherite_boots': { slot: 'FEET', armor: 3, armorToughness: 3, knockbackResistance: 0.1, attackDamage: null, attackSpeed: null },
  // ... 続く
}

const TOOL_DATA: Record<string, ToolData> = {
  'diamond_pickaxe': { type: 'PICKAXE', tier: 'DIAMOND', speed: 8.0, damage: 5, enchantmentValue: 10 },
  'diamond_axe': { type: 'AXE', tier: 'DIAMOND', speed: 8.0, damage: 9, enchantmentValue: 10 },
  'diamond_shovel': { type: 'SHOVEL', tier: 'DIAMOND', speed: 8.0, damage: 5.5, enchantmentValue: 10 },
  'diamond_hoe': { type: 'HOE', tier: 'DIAMOND', speed: 8.0, damage: 1, enchantmentValue: 10 },
  'netherite_pickaxe': { type: 'PICKAXE', tier: 'NETHERITE', speed: 9.0, damage: 6, enchantmentValue: 15 },
  'iron_pickaxe': { type: 'PICKAXE', tier: 'IRON', speed: 6.0, damage: 4, enchantmentValue: 14 },
  'stone_pickaxe': { type: 'PICKAXE', tier: 'STONE', speed: 4.0, damage: 3, enchantmentValue: 5 },
  'wooden_pickaxe': { type: 'PICKAXE', tier: 'WOOD', speed: 2.0, damage: 2, enchantmentValue: 15 },
  'golden_pickaxe': { type: 'PICKAXE', tier: 'GOLD', speed: 12.0, damage: 2, enchantmentValue: 22 },
  // ... 続く
}

function getStackSize(name: string): number {
  return STACK_SIZES[name] ?? 64
}

function getDurability(name: string): number | null {
  return DURABILITIES[name] ?? null
}

function isFireResistant(name: string): boolean {
  return FIRE_RESISTANT_ITEMS.has(name)
}

function getRarity(name: string): 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' {
  if (name === 'enchanted_golden_apple') return 'EPIC'
  if (RARE_ITEMS.has(name)) return 'RARE'
  if (UNCOMMON_ITEMS.has(name)) return 'UNCOMMON'
  return 'COMMON'
}

function getFoodData(name: string): FoodData | null {
  return FOOD_DATA[name] ?? null
}

function getEquipmentData(name: string): EquipmentData | null {
  return EQUIPMENT_DATA[name] ?? null
}

function getToolData(name: string): ToolData | null {
  return TOOL_DATA[name] ?? null
}
```

### 6.2 ブロックデータ生成

```typescript
// scripts/processors/blocks.ts
import * as fs from 'fs/promises'
import * as path from 'path'

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
  extractedDir: string,
  reportsDir: string
): Promise<ProcessedBlock[]> {
  const blocks: ProcessedBlock[] = []

  // サーバーレポートからブロック情報取得
  const blocksReportPath = path.join(reportsDir, 'blocks.json')
  const blocksReport = JSON.parse(await fs.readFile(blocksReportPath, 'utf-8'))

  // blockstatesディレクトリ
  const blockstatesDir = path.join(extractedDir, 'assets/minecraft/blockstates')

  for (const [blockId, blockData] of Object.entries(blocksReport) as any) {
    const name = blockId.replace('minecraft:', '')

    // ブロック状態をパース
    const states = parseBlockStates(blockData.properties || {})

    const block: ProcessedBlock = {
      id: blockId,
      name,
      hardness: getHardness(name),
      blastResistance: getBlastResistance(name),
      friction: getFriction(name),
      speedFactor: getSpeedFactor(name),
      jumpFactor: getJumpFactor(name),
      luminance: getLuminance(name),
      requiresCorrectTool: requiresCorrectTool(name),
      hasGravity: hasGravity(name),
      flammable: isFlammable(name),
      replaceable: isReplaceable(name),
      states,
    }

    blocks.push(block)
  }

  return blocks
}

function parseBlockStates(properties: Record<string, string[]>): BlockState[] {
  const states: BlockState[] = []

  for (const [name, values] of Object.entries(properties)) {
    states.push({
      name,
      type: inferBlockStateType(name, values),
      values,
      defaultValue: values[0],
    })
  }

  return states
}

function inferBlockStateType(name: string, values: string[]): string {
  if (values.every(v => v === 'true' || v === 'false')) {
    return 'BOOLEAN'
  }
  if (values.every(v => !isNaN(Number(v)))) {
    return 'INTEGER'
  }
  if (['north', 'south', 'east', 'west', 'up', 'down'].some(d => values.includes(d))) {
    return 'DIRECTION'
  }
  return 'ENUM'
}

// ========== ハードコードされたブロックデータ ==========

const BLOCK_HARDNESS: Record<string, number> = {
  'stone': 1.5,
  'granite': 1.5,
  'diorite': 1.5,
  'andesite': 1.5,
  'dirt': 0.5,
  'grass_block': 0.6,
  'cobblestone': 2.0,
  'oak_planks': 2.0,
  'oak_log': 2.0,
  'obsidian': 50.0,
  'crying_obsidian': 50.0,
  'bedrock': -1, // 破壊不可
  'diamond_block': 5.0,
  'netherite_block': 50.0,
  'iron_block': 5.0,
  'gold_block': 3.0,
  // ... 続く
}

const BLOCK_BLAST_RESISTANCE: Record<string, number> = {
  'stone': 6.0,
  'obsidian': 1200.0,
  'crying_obsidian': 1200.0,
  'bedrock': 3600000.0,
  'netherite_block': 1200.0,
  'ancient_debris': 1200.0,
  'end_portal_frame': 3600000.0,
  // ... 続く
}

const LUMINANCE: Record<string, number> = {
  'torch': 14,
  'wall_torch': 14,
  'glowstone': 15,
  'sea_lantern': 15,
  'lantern': 15,
  'soul_lantern': 10,
  'jack_o_lantern': 15,
  'lava': 15,
  'fire': 15,
  'redstone_lamp': 15, // オン時のみ
  'shroomlight': 15,
  'beacon': 15,
  'end_rod': 14,
  'magma_block': 3,
  'brewing_stand': 1,
  'brown_mushroom': 1,
  // ... 続く
}

const GRAVITY_BLOCKS = new Set([
  'sand',
  'red_sand',
  'gravel',
  'anvil',
  'chipped_anvil',
  'damaged_anvil',
  'dragon_egg',
  'white_concrete_powder',
  'orange_concrete_powder',
  // ... 他のコンクリートパウダー
])

const FLAMMABLE_BLOCKS = new Set([
  'oak_planks', 'spruce_planks', 'birch_planks',
  'oak_log', 'spruce_log', 'birch_log',
  'oak_leaves', 'spruce_leaves', 'birch_leaves',
  'bookshelf',
  'tnt',
  'wool', // 全色
  'carpet', // 全色
  // ... 続く
])

function getHardness(name: string): number {
  return BLOCK_HARDNESS[name] ?? 1.0
}

function getBlastResistance(name: string): number {
  return BLOCK_BLAST_RESISTANCE[name] ?? 6.0
}

function getFriction(name: string): number {
  if (name === 'ice' || name === 'packed_ice' || name === 'blue_ice') {
    return name === 'blue_ice' ? 0.989 : 0.98
  }
  if (name === 'slime_block') return 0.8
  return 0.6 // デフォルト
}

function getSpeedFactor(name: string): number {
  if (name === 'soul_sand' || name === 'honey_block') return 0.4
  return 1.0
}

function getJumpFactor(name: string): number {
  if (name === 'honey_block') return 0.5
  return 1.0
}

function getLuminance(name: string): number {
  return LUMINANCE[name] ?? 0
}

function requiresCorrectTool(name: string): boolean {
  // 鉄以上のツールが必要なブロック
  const requiresTool = [
    'obsidian', 'crying_obsidian', 'diamond_ore', 'deepslate_diamond_ore',
    'emerald_ore', 'deepslate_emerald_ore', 'gold_ore', 'deepslate_gold_ore',
    'nether_gold_ore', 'redstone_ore', 'deepslate_redstone_ore',
    'ancient_debris', 'netherite_block',
  ]
  return requiresTool.includes(name)
}

function hasGravity(name: string): boolean {
  return GRAVITY_BLOCKS.has(name)
}

function isFlammable(name: string): boolean {
  return FLAMMABLE_BLOCKS.has(name) ||
    name.includes('planks') ||
    name.includes('log') ||
    name.includes('wood') ||
    name.includes('leaves') ||
    name.includes('wool') ||
    name.includes('carpet')
}

function isReplaceable(name: string): boolean {
  return ['air', 'cave_air', 'void_air', 'water', 'lava', 'grass', 'tall_grass', 'fern', 'large_fern'].includes(name)
}
```

### 6.3 エンティティデータ生成

```typescript
// scripts/processors/entities.ts
import * as fs from 'fs/promises'
import * as path from 'path'

interface ProcessedEntity {
  id: string
  name: string
  category: EntityCategory
  health: number
  width: number
  height: number
  fireImmune: boolean
  mob: MobData | null
}

export async function processEntities(
  version: string,
  extractedDir: string,
  reportsDir: string
): Promise<ProcessedEntity[]> {
  const entities: ProcessedEntity[] = []

  // レジストリからエンティティID一覧取得
  const registryPath = path.join(reportsDir, 'registries', 'entity_type.json')
  const registry = JSON.parse(await fs.readFile(registryPath, 'utf-8'))
  const entityIds: string[] = Object.keys(registry.entries || registry)

  for (const entityId of entityIds) {
    const name = entityId.replace('minecraft:', '')

    const entity: ProcessedEntity = {
      id: entityId,
      name,
      category: getEntityCategory(name),
      health: getEntityHealth(name),
      width: getEntityWidth(name),
      height: getEntityHeight(name),
      fireImmune: isEntityFireImmune(name),
      mob: getMobData(name),
    }

    entities.push(entity)
  }

  return entities
}

// ========== エンティティデータ ==========
// JARからは取得できないため、Minecraft Wikiを参考にハードコード

const ENTITY_CATEGORIES: Record<string, EntityCategory> = {
  // モンスター
  'zombie': 'MONSTER',
  'skeleton': 'MONSTER',
  'creeper': 'MONSTER',
  'spider': 'MONSTER',
  'enderman': 'MONSTER',
  'witch': 'MONSTER',
  'slime': 'MONSTER',
  'phantom': 'MONSTER',
  'drowned': 'MONSTER',
  'husk': 'MONSTER',
  'stray': 'MONSTER',
  'blaze': 'MONSTER',
  'ghast': 'MONSTER',
  'wither_skeleton': 'MONSTER',
  'piglin': 'MONSTER',
  'piglin_brute': 'MONSTER',
  'hoglin': 'MONSTER',
  'zoglin': 'MONSTER',
  'warden': 'MONSTER',

  // クリーチャー
  'pig': 'CREATURE',
  'cow': 'CREATURE',
  'sheep': 'CREATURE',
  'chicken': 'CREATURE',
  'horse': 'CREATURE',
  'donkey': 'CREATURE',
  'mule': 'CREATURE',
  'wolf': 'CREATURE',
  'cat': 'CREATURE',
  'ocelot': 'CREATURE',
  'rabbit': 'CREATURE',
  'fox': 'CREATURE',
  'bee': 'CREATURE',
  'goat': 'CREATURE',
  'frog': 'CREATURE',
  'camel': 'CREATURE',
  'sniffer': 'CREATURE',
  'armadillo': 'CREATURE',

  // 水生
  'squid': 'WATER_CREATURE',
  'glow_squid': 'WATER_CREATURE',
  'dolphin': 'WATER_CREATURE',
  'cod': 'WATER_AMBIENT',
  'salmon': 'WATER_AMBIENT',
  'tropical_fish': 'WATER_AMBIENT',
  'pufferfish': 'WATER_AMBIENT',
  'axolotl': 'UNDERGROUND_WATER_CREATURE',

  // アンビエント
  'bat': 'AMBIENT',

  // その他
  'villager': 'MISC',
  'iron_golem': 'MISC',
  'snow_golem': 'MISC',
  'armor_stand': 'MISC',
}

const ENTITY_HEALTH: Record<string, number> = {
  'zombie': 20,
  'skeleton': 20,
  'creeper': 20,
  'spider': 16,
  'enderman': 40,
  'witch': 26,
  'slime': 16, // 大サイズ
  'phantom': 20,
  'blaze': 20,
  'ghast': 10,
  'wither_skeleton': 20,
  'warden': 500,
  'ender_dragon': 200,
  'wither': 300,

  'pig': 10,
  'cow': 10,
  'sheep': 8,
  'chicken': 4,
  'horse': 30, // 15-30の範囲
  'wolf': 8,
  'cat': 10,
  'rabbit': 3,
  'bee': 10,

  'villager': 20,
  'iron_golem': 100,
  'snow_golem': 4,
}

const ENTITY_DIMENSIONS: Record<string, { width: number; height: number }> = {
  'zombie': { width: 0.6, height: 1.95 },
  'skeleton': { width: 0.6, height: 1.99 },
  'creeper': { width: 0.6, height: 1.7 },
  'spider': { width: 1.4, height: 0.9 },
  'enderman': { width: 0.6, height: 2.9 },
  'slime': { width: 2.04, height: 2.04 }, // 大サイズ
  'pig': { width: 0.9, height: 0.9 },
  'cow': { width: 0.9, height: 1.4 },
  'sheep': { width: 0.9, height: 1.3 },
  'chicken': { width: 0.4, height: 0.7 },
  'horse': { width: 1.3965, height: 1.6 },
  'wolf': { width: 0.6, height: 0.85 },
  'villager': { width: 0.6, height: 1.95 },
  'iron_golem': { width: 1.4, height: 2.7 },
  'warden': { width: 0.9, height: 2.9 },
  'ender_dragon': { width: 16.0, height: 8.0 },
}

const FIRE_IMMUNE_ENTITIES = new Set([
  'blaze',
  'ghast',
  'magma_cube',
  'strider',
  'wither',
  'wither_skeleton',
  'zoglin',
  'zombified_piglin',
  'ender_dragon',
])

const MOB_DATA: Record<string, MobData> = {
  'zombie': { attackDamage: 3, movementSpeed: 0.23, followRange: 35, spawnGroup: 'MONSTER' },
  'skeleton': { attackDamage: 2, movementSpeed: 0.25, followRange: 16, spawnGroup: 'MONSTER' },
  'creeper': { attackDamage: 0, movementSpeed: 0.25, followRange: 16, spawnGroup: 'MONSTER' },
  'spider': { attackDamage: 2, movementSpeed: 0.3, followRange: 16, spawnGroup: 'MONSTER' },
  'enderman': { attackDamage: 7, movementSpeed: 0.3, followRange: 64, spawnGroup: 'MONSTER' },
  'warden': { attackDamage: 30, movementSpeed: 0.3, followRange: 16, spawnGroup: 'MONSTER' },
  'wolf': { attackDamage: 4, movementSpeed: 0.3, followRange: 16, spawnGroup: 'CREATURE' },
  'iron_golem': { attackDamage: 21, movementSpeed: 0.25, followRange: 16, spawnGroup: 'MISC' },
}

function getEntityCategory(name: string): EntityCategory {
  return ENTITY_CATEGORIES[name] ?? 'MISC'
}

function getEntityHealth(name: string): number {
  return ENTITY_HEALTH[name] ?? 20
}

function getEntityWidth(name: string): number {
  return ENTITY_DIMENSIONS[name]?.width ?? 0.6
}

function getEntityHeight(name: string): number {
  return ENTITY_DIMENSIONS[name]?.height ?? 1.8
}

function isEntityFireImmune(name: string): boolean {
  return FIRE_IMMUNE_ENTITIES.has(name)
}

function getMobData(name: string): MobData | null {
  return MOB_DATA[name] ?? null
}
```

### 6.4 レシピデータ生成

```typescript
// scripts/processors/recipes.ts
import * as fs from 'fs/promises'
import * as path from 'path'

export async function processRecipes(
  version: string,
  extractedDir: string
): Promise<ProcessedRecipe[]> {
  const recipes: ProcessedRecipe[] = []

  // レシピディレクトリ（バージョンによってパスが異なる）
  let recipesDir = path.join(extractedDir, 'data/minecraft/recipe')
  if (!await pathExists(recipesDir)) {
    recipesDir = path.join(extractedDir, 'data/minecraft/recipes')
  }

  const recipeFiles = await getFilesRecursive(recipesDir)

  for (const file of recipeFiles) {
    if (!file.endsWith('.json')) continue

    const recipePath = path.join(recipesDir, file)
    const rawRecipe = JSON.parse(await fs.readFile(recipePath, 'utf-8'))

    const recipeName = file.replace('.json', '').replace(/\//g, '_')
    const processed = processRecipe(recipeName, rawRecipe)

    if (processed) {
      recipes.push(processed)
    }
  }

  return recipes
}

function processRecipe(name: string, raw: any): ProcessedRecipe | null {
  const type = normalizeRecipeType(raw.type)

  const base = {
    id: `minecraft:${name}`,
    type,
    group: raw.group || null,
  }

  switch (type) {
    case 'CRAFTING_SHAPED':
      return {
        ...base,
        pattern: raw.pattern,
        key: normalizeKey(raw.key),
        width: raw.pattern[0].length,
        height: raw.pattern.length,
        result: normalizeResult(raw.result),
      }

    case 'CRAFTING_SHAPELESS':
      return {
        ...base,
        ingredients: raw.ingredients.map(normalizeIngredient),
        result: normalizeResult(raw.result),
      }

    case 'SMELTING':
    case 'BLASTING':
    case 'SMOKING':
    case 'CAMPFIRE_COOKING':
      return {
        ...base,
        ingredient: normalizeIngredient(raw.ingredient),
        result: normalizeResult(raw.result),
        experience: raw.experience ?? 0,
        cookingTime: raw.cookingtime ?? 200,
      }

    case 'STONECUTTING':
      return {
        ...base,
        ingredient: normalizeIngredient(raw.ingredient),
        result: normalizeResult(raw.result),
      }

    case 'SMITHING_TRANSFORM':
    case 'SMITHING_TRIM':
      return {
        ...base,
        type: 'SMITHING',
        template: normalizeIngredient(raw.template),
        base: normalizeIngredient(raw.base),
        addition: normalizeIngredient(raw.addition),
        result: normalizeResult(raw.result),
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
    'minecraft:smithing_transform': 'SMITHING_TRANSFORM',
    'minecraft:smithing_trim': 'SMITHING_TRIM',
  }
  return typeMap[type] ?? type.replace('minecraft:', '').toUpperCase()
}

function normalizeResult(result: any): { item: string; count: number } {
  // 1.20.5以降の形式
  if (result.id) {
    return { item: result.id, count: result.count ?? 1 }
  }
  // 1.20.4以前の形式
  if (typeof result === 'string') {
    return { item: result, count: 1 }
  }
  return { item: result.item, count: result.count ?? 1 }
}

function normalizeIngredient(ing: any): Ingredient {
  if (Array.isArray(ing)) {
    return { items: ing.map(i => i.item || i.id || i), tag: null }
  }
  if (ing.tag) {
    return { items: [], tag: ing.tag }
  }
  return { items: [ing.item || ing.id || ing], tag: null }
}

function normalizeKey(key: Record<string, any>): RecipeKey[] {
  return Object.entries(key).map(([k, v]) => ({
    key: k,
    ingredient: normalizeIngredient(v),
  }))
}
```

---

## 7. データアップロード

### 7.1 KV アップロード

```typescript
// scripts/upload-kv.ts
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
    { key: `items:${version}`, value: JSON.stringify(data.items) },
    { key: `blocks:${version}`, value: JSON.stringify(data.blocks) },
    { key: `entities:${version}`, value: JSON.stringify(data.entities) },
    { key: `recipes:${version}`, value: JSON.stringify(data.recipes) },
    { key: `tags:items:${version}`, value: JSON.stringify(data.tags.items) },
    { key: `tags:blocks:${version}`, value: JSON.stringify(data.tags.blocks) },
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

  // バージョンリスト更新
  const existingVersions = await fetch(`${kvApi}/values/versions:list`, {
    headers: { 'Authorization': `Bearer ${config.apiToken}` },
  }).then(r => r.json()).catch(() => [])

  if (!existingVersions.includes(version)) {
    existingVersions.push(version)
    existingVersions.sort((a: string, b: string) => b.localeCompare(a))

    await fetch(`${kvApi}/values/versions:list`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(existingVersions),
    })
  }
}
```

### 7.2 R2 アップロード

```typescript
// scripts/upload-r2.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import * as fs from 'fs/promises'
import * as path from 'path'

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

  const assetsDir = path.join(extractedDir, 'assets/minecraft')
  const directories = ['textures', 'models', 'sounds', 'lang']

  for (const dir of directories) {
    const fullDir = path.join(assetsDir, dir)

    if (!await pathExists(fullDir)) continue

    const files = await getFilesRecursive(fullDir)

    for (const file of files) {
      const content = await fs.readFile(path.join(fullDir, file))
      const key = `${version}/${dir}/${file}`

      await s3.send(new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: content,
        ContentType: getContentType(file),
        CacheControl: dir === 'lang'
          ? 'public, max-age=86400, stale-while-revalidate=3600'
          : 'public, max-age=31536000, immutable',
      }))
    }

    console.log(`Uploaded ${dir}/ for ${version}`)
  }
}

function getContentType(file: string): string {
  if (file.endsWith('.png')) return 'image/png'
  if (file.endsWith('.json')) return 'application/json'
  if (file.endsWith('.ogg')) return 'audio/ogg'
  return 'application/octet-stream'
}
```

---

## 8. 実行スクリプト

### 8.1 メインスクリプト

```typescript
// scripts/sync-version.ts
import { downloadJars } from './download-jars'
import { generateServerReports } from './generate-reports'
import { extractClientJar } from './extract-client'
import { processItems } from './processors/items'
import { processBlocks } from './processors/blocks'
import { processEntities } from './processors/entities'
import { processRecipes } from './processors/recipes'
import { processLootTables } from './processors/loot-tables'
import { processTags } from './processors/tags'
import { processLang } from './processors/lang'
import { uploadToKV } from './upload-kv'
import { uploadToR2 } from './upload-r2'

async function syncVersion(version: string) {
  const outputDir = './data'

  console.log(`\n========== Syncing version ${version} ==========\n`)

  // 1. JAR ダウンロード
  console.log('Step 1: Downloading JARs...')
  const { clientPath, serverPath } = await downloadJars({ version, outputDir })

  // 2. サーバーレポート生成
  console.log('Step 2: Generating server reports...')
  const reportsDir = await generateServerReports({
    version,
    serverJarPath: serverPath,
    outputDir,
  })

  // 3. Client JAR 抽出
  console.log('Step 3: Extracting client JAR...')
  const extractedDir = await extractClientJar({
    version,
    clientJarPath: clientPath,
    outputDir,
  })

  // 4. データ処理
  console.log('Step 4: Processing data...')
  const [items, blocks, entities, recipes, lootTables, tags, lang] =
    await Promise.all([
      processItems(version, extractedDir, reportsDir),
      processBlocks(version, extractedDir, reportsDir),
      processEntities(version, extractedDir, reportsDir),
      processRecipes(version, extractedDir),
      processLootTables(version, extractedDir),
      processTags(version, extractedDir),
      processLang(version, extractedDir),
    ])

  const mergedData = { items, blocks, entities, recipes, lootTables, tags, lang }

  // 5. KV アップロード
  console.log('Step 5: Uploading to KV...')
  await uploadToKV(mergedData, version, {
    accountId: process.env.CF_ACCOUNT_ID!,
    namespaceId: process.env.CF_KV_NAMESPACE_ID!,
    apiToken: process.env.CF_API_TOKEN!,
  })

  // 6. R2 アップロード
  console.log('Step 6: Uploading assets to R2...')
  await uploadToR2(extractedDir, version, {
    accountId: process.env.CF_ACCOUNT_ID!,
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!,
    bucketName: process.env.CF_R2_BUCKET_NAME!,
  })

  console.log(`\n========== Version ${version} synced successfully ==========\n`)
}

// CLI
const version = process.argv[2]
if (!version) {
  console.error('Usage: pnpm sync-version <version>')
  process.exit(1)
}

syncVersion(version)
```

### 8.2 package.json

```json
{
  "scripts": {
    "sync-version": "tsx scripts/sync-version.ts",
    "download": "tsx scripts/download-jars.ts",
    "extract": "tsx scripts/extract-client.ts",
    "reports": "tsx scripts/generate-reports.ts",
    "upload-kv": "tsx scripts/upload-kv.ts",
    "upload-r2": "tsx scripts/upload-r2.ts"
  }
}
```

---

## 9. ハードコードデータの管理

### 9.1 データファイル構成

JARから取得できないデータ（HP、攻撃力、スタック数など）は、JSONファイルとして管理します。

```
scripts/
└── data/
    ├── items/
    │   ├── stack-sizes.json
    │   ├── durabilities.json
    │   ├── rarities.json
    │   ├── food.json
    │   ├── equipment.json
    │   └── tools.json
    ├── blocks/
    │   ├── hardness.json
    │   ├── blast-resistance.json
    │   ├── luminance.json
    │   └── properties.json
    └── entities/
        ├── health.json
        ├── dimensions.json
        └── mob-data.json
```

### 9.2 データ更新手順

1. 新バージョンリリース時にMinecraft Wikiを参照
2. 変更されたアイテム/ブロック/エンティティのデータを更新
3. プルリクエストで変更をレビュー
4. マージ後、`sync-version`を実行

---

## 10. GitHub Actions

```yaml
# .github/workflows/sync-data.yml
name: Sync Minecraft Data

on:
  schedule:
    - cron: '0 0 * * *'  # 毎日 UTC 0:00
  workflow_dispatch:
    inputs:
      version:
        description: 'Minecraft version to sync'
        required: false

jobs:
  check-new-version:
    runs-on: ubuntu-latest
    outputs:
      new_version: ${{ steps.check.outputs.new_version }}
    steps:
      - name: Check for new version
        id: check
        run: |
          LATEST=$(curl -s https://piston-meta.mojang.com/mc/game/version_manifest_v2.json | jq -r '.latest.release')
          # 現在同期済みのバージョンと比較
          # ...

  sync:
    needs: check-new-version
    if: needs.check-new-version.outputs.new_version || github.event.inputs.version
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'

      - run: pnpm install
      - run: pnpm sync-version ${{ github.event.inputs.version || needs.check-new-version.outputs.new_version }}
        env:
          CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
          CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
          CF_KV_NAMESPACE_ID: ${{ secrets.CF_KV_NAMESPACE_ID }}
          CF_R2_ACCESS_KEY_ID: ${{ secrets.CF_R2_ACCESS_KEY_ID }}
          CF_R2_SECRET_ACCESS_KEY: ${{ secrets.CF_R2_SECRET_ACCESS_KEY }}
          CF_R2_BUCKET_NAME: ${{ secrets.CF_R2_BUCKET_NAME }}
```

---

## 11. Bedrock Edition データ抽出

### 11.1 APK の取得

Bedrock Edition のデータは Android APK から抽出します。

```typescript
// scripts/bedrock/download-apk.ts
import * as fs from 'fs/promises'
import * as path from 'path'

interface BedrockConfig {
  version: string
  apkPath: string  // 手動でダウンロードしたAPKのパス
  outputDir: string
}

export async function extractBedrockAPK(config: BedrockConfig) {
  const { version, apkPath, outputDir } = config

  console.log(`Extracting Bedrock APK for version ${version}...`)

  // APK は ZIP 形式なので解凍
  const zip = new AdmZip(apkPath)
  const extractDir = path.join(outputDir, 'bedrock', version)

  await fs.mkdir(extractDir, { recursive: true })

  // 必要なディレクトリのみ抽出
  const targetPaths = [
    'assets/behavior_packs/vanilla/',
    'assets/resource_packs/vanilla/',
    'assets/definitions/',
  ]

  const entries = zip.getEntries()
  for (const entry of entries) {
    if (targetPaths.some(p => entry.entryName.startsWith(p))) {
      const outputPath = path.join(extractDir, entry.entryName)
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(outputPath, entry.getData())
    }
  }

  console.log(`Extracted to ${extractDir}`)
  return extractDir
}
```

### 11.2 APK の構造

```
assets/
├── behavior_packs/
│   └── vanilla/
│       ├── recipes/                 # レシピ定義
│       │   ├── furnace_*.json
│       │   ├── crafting_table_*.json
│       │   └── ...
│       ├── loot_tables/             # ルートテーブル
│       │   ├── chests/
│       │   ├── entities/
│       │   └── blocks/
│       ├── entities/                # エンティティ定義
│       │   ├── zombie.json
│       │   ├── creeper.json
│       │   └── ...
│       ├── spawn_rules/             # スポーンルール
│       └── trading/                 # 村人取引
│
├── resource_packs/
│   └── vanilla/
│       ├── textures/                # テクスチャ
│       │   ├── blocks/
│       │   ├── items/
│       │   └── entity/
│       ├── models/                  # モデル（Bedrockはgeometry形式）
│       │   └── entity/
│       ├── texts/                   # 言語ファイル
│       │   ├── ja_JP.lang
│       │   └── en_US.lang
│       └── blocks.json              # ブロック定義
│
└── definitions/
    └── item/                        # アイテム定義
        └── item_texture.json
```

### 11.3 Bedrock Edition データ処理

```typescript
// scripts/bedrock/process-items.ts
import * as fs from 'fs/promises'
import * as path from 'path'

interface BedrockItem {
  id: string
  name: string
  // ... Java版と同様のプロパティ
  bedrockMeta: BedrockMeta
}

interface BedrockMeta {
  addedIn: string
  lastModifiedIn: string
  removedIn: string | null
  changelog: BedrockChange[]
  javaEquivalent: string | null
}

interface BedrockChange {
  version: string
  change: string
}

export async function processBedrockItems(
  version: string,
  extractedDir: string,
  previousData: BedrockItem[]
): Promise<BedrockItem[]> {
  // 現在のAPKからアイテムを抽出
  const currentItems = await extractItemsFromAPK(extractedDir)

  // 既存データとマージ
  const mergedItems = mergeBedrockData(previousData, currentItems, version)

  return mergedItems
}

function mergeBedrockData(
  previous: BedrockItem[],
  current: ExtractedItem[],
  version: string
): BedrockItem[] {
  const result: BedrockItem[] = []
  const currentIds = new Set(current.map(i => i.id))
  const previousIds = new Set(previous.map(i => i.id))

  // 既存アイテムの処理
  for (const prevItem of previous) {
    if (currentIds.has(prevItem.id)) {
      // まだ存在する
      const currItem = current.find(i => i.id === prevItem.id)!

      // 変更があるかチェック
      if (hasChanges(prevItem, currItem)) {
        result.push({
          ...prevItem,
          ...currItem,
          bedrockMeta: {
            ...prevItem.bedrockMeta,
            lastModifiedIn: version,
            changelog: [
              ...prevItem.bedrockMeta.changelog,
              { version, change: describeChanges(prevItem, currItem) },
            ],
          },
        })
      } else {
        result.push(prevItem)
      }
    } else {
      // 削除された
      if (!prevItem.bedrockMeta.removedIn) {
        result.push({
          ...prevItem,
          bedrockMeta: {
            ...prevItem.bedrockMeta,
            removedIn: version,
            changelog: [
              ...prevItem.bedrockMeta.changelog,
              { version, change: 'removed' },
            ],
          },
        })
      } else {
        result.push(prevItem)
      }
    }
  }

  // 新規アイテムの追加
  for (const currItem of current) {
    if (!previousIds.has(currItem.id)) {
      result.push({
        ...currItem,
        bedrockMeta: {
          addedIn: version,
          lastModifiedIn: version,
          removedIn: null,
          changelog: [{ version, change: 'added' }],
          javaEquivalent: findJavaEquivalent(currItem.id),
        },
      })
    }
  }

  return result
}

function hasChanges(prev: BedrockItem, curr: ExtractedItem): boolean {
  // スタックサイズ、耐久値などの主要プロパティを比較
  return (
    prev.stackSize !== curr.stackSize ||
    prev.durability !== curr.durability ||
    JSON.stringify(prev.food) !== JSON.stringify(curr.food)
  )
}

function describeChanges(prev: BedrockItem, curr: ExtractedItem): string {
  const changes: string[] = []
  if (prev.stackSize !== curr.stackSize) {
    changes.push(`stackSize: ${prev.stackSize} → ${curr.stackSize}`)
  }
  if (prev.durability !== curr.durability) {
    changes.push(`durability: ${prev.durability} → ${curr.durability}`)
  }
  return changes.join(', ')
}

function findJavaEquivalent(bedrockId: string): string | null {
  // Bedrock と Java で ID が異なる場合のマッピング
  const idMapping: Record<string, string> = {
    'minecraft:planks': null,  // Bedrock は単一ID、Java は木材別
    // ... その他のマッピング
  }
  return idMapping[bedrockId] ?? bedrockId
}
```

### 11.4 Bedrock Edition 同期スクリプト

```typescript
// scripts/sync-bedrock.ts
import { extractBedrockAPK } from './bedrock/download-apk'
import { processBedrockItems } from './bedrock/process-items'
import { processBedrockBlocks } from './bedrock/process-blocks'
import { processBedrockEntities } from './bedrock/process-entities'
import { processBedrockRecipes } from './bedrock/process-recipes'
import { uploadToKV } from './upload-kv'
import { uploadToR2 } from './upload-r2'

async function syncBedrock(version: string, apkPath: string) {
  const outputDir = './data'

  console.log(`\n========== Syncing Bedrock Edition ${version} ==========\n`)

  // 1. APK 抽出
  console.log('Step 1: Extracting APK...')
  const extractedDir = await extractBedrockAPK({
    version,
    apkPath,
    outputDir,
  })

  // 2. 既存データ取得
  console.log('Step 2: Fetching previous data...')
  const previousData = await fetchPreviousBedrockData()

  // 3. データ処理（差分検出 + マージ）
  console.log('Step 3: Processing data with diff detection...')
  const [items, blocks, entities, recipes] = await Promise.all([
    processBedrockItems(version, extractedDir, previousData.items),
    processBedrockBlocks(version, extractedDir, previousData.blocks),
    processBedrockEntities(version, extractedDir, previousData.entities),
    processBedrockRecipes(version, extractedDir),
  ])

  // 4. KV アップロード
  console.log('Step 4: Uploading to KV...')
  await uploadBedrockToKV({ items, blocks, entities, recipes })

  // 5. R2 アップロード
  console.log('Step 5: Uploading assets to R2...')
  await uploadBedrockToR2(extractedDir)

  // 6. メタデータ更新
  console.log('Step 6: Updating metadata...')
  await updateBedrockMetadata(version)

  console.log(`\n========== Bedrock Edition ${version} synced successfully ==========\n`)
}

async function fetchPreviousBedrockData() {
  // KV から既存の累積データを取得
  const kvApi = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/storage/kv/namespaces/${process.env.CF_KV_NAMESPACE_ID}`

  const [items, blocks, entities] = await Promise.all([
    fetch(`${kvApi}/values/items:bedrock`, {
      headers: { 'Authorization': `Bearer ${process.env.CF_API_TOKEN}` },
    }).then(r => r.json()).catch(() => []),
    fetch(`${kvApi}/values/blocks:bedrock`, {
      headers: { 'Authorization': `Bearer ${process.env.CF_API_TOKEN}` },
    }).then(r => r.json()).catch(() => []),
    fetch(`${kvApi}/values/entities:bedrock`, {
      headers: { 'Authorization': `Bearer ${process.env.CF_API_TOKEN}` },
    }).then(r => r.json()).catch(() => []),
  ])

  return { items, blocks, entities }
}

async function updateBedrockMetadata(version: string) {
  // bedrock:meta キーにバージョン情報を更新
  const metadata = {
    currentVersion: version,
    lastUpdated: new Date().toISOString(),
    edition: 'BEDROCK',
  }

  // KV に保存
  // ...
}

// CLI
const version = process.argv[2]
const apkPath = process.argv[3]

if (!version || !apkPath) {
  console.error('Usage: pnpm sync-bedrock <version> <apk-path>')
  console.error('Example: pnpm sync-bedrock 1.21.0 ./minecraft-1.21.0.apk')
  process.exit(1)
}

syncBedrock(version, apkPath)
```

### 11.5 Java版とBedrock版の差異

| 項目 | Java Edition | Bedrock Edition |
|------|-------------|-----------------|
| テクスチャパス | `textures/block/` | `textures/blocks/` |
| アイテムテクスチャ | `textures/item/` | `textures/items/` |
| モデル形式 | JSON (block/item states) | JSON (geometry) |
| 言語ファイル | `.json` 形式 | `.lang` 形式 |
| レシピ定義 | データパック形式 | Behavior Pack形式 |
| ブロックID | `minecraft:oak_planks` | `minecraft:planks` (data value) |

### 11.6 ID マッピング

Java版とBedrock版でIDが異なるケースのマッピングを管理します。

```typescript
// scripts/bedrock/id-mapping.ts

// Bedrock ID → Java ID
export const BEDROCK_TO_JAVA: Record<string, string | null> = {
  // 木材（Bedrockは単一ID + data value）
  'minecraft:planks:0': 'minecraft:oak_planks',
  'minecraft:planks:1': 'minecraft:spruce_planks',
  'minecraft:planks:2': 'minecraft:birch_planks',
  'minecraft:planks:3': 'minecraft:jungle_planks',
  'minecraft:planks:4': 'minecraft:acacia_planks',
  'minecraft:planks:5': 'minecraft:dark_oak_planks',

  // 染料（Bedrockは単一ID）
  'minecraft:dye:0': 'minecraft:ink_sac',
  'minecraft:dye:1': 'minecraft:red_dye',
  'minecraft:dye:2': 'minecraft:green_dye',
  'minecraft:dye:3': 'minecraft:cocoa_beans',
  'minecraft:dye:4': 'minecraft:lapis_lazuli',
  // ...

  // Bedrock専用アイテム
  'minecraft:lodestone_compass': null,  // Java版は別の仕組み
}

// Java ID → Bedrock ID
export const JAVA_TO_BEDROCK: Record<string, string> = {
  'minecraft:oak_planks': 'minecraft:planks:0',
  'minecraft:spruce_planks': 'minecraft:planks:1',
  // ...
}
```

---

## 12. 全バージョン同期

### 12.1 初期同期（全バージョン）

```typescript
// scripts/sync-all-versions.ts
import { downloadJars } from './download-jars'
import { syncVersion } from './sync-version'

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

async function syncAllVersions() {
  const manifest = await fetch(MANIFEST_URL).then(r => r.json())

  // 全バージョン（リリース + スナップショット）
  const allVersions = manifest.versions

  console.log(`Found ${allVersions.length} versions to sync`)

  for (const version of allVersions) {
    try {
      console.log(`\nSyncing ${version.id} (${version.type})...`)
      await syncVersion(version.id)
    } catch (error) {
      console.error(`Failed to sync ${version.id}:`, error)
      // エラーログを記録して続行
    }
  }
}

syncAllVersions()
```

### 12.2 増分同期

```yaml
# .github/workflows/sync-all.yml
name: Sync All Versions

on:
  schedule:
    - cron: '0 0 * * *'  # 毎日チェック
  workflow_dispatch:

jobs:
  sync-java:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'

      - run: pnpm install

      # 新しいバージョンのみ同期
      - name: Sync new Java versions
        run: |
          NEW_VERSIONS=$(pnpm check-new-versions)
          for VERSION in $NEW_VERSIONS; do
            pnpm sync-version $VERSION
          done
        env:
          CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
          CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
          CF_KV_NAMESPACE_ID: ${{ secrets.CF_KV_NAMESPACE_ID }}
          CF_R2_ACCESS_KEY_ID: ${{ secrets.CF_R2_ACCESS_KEY_ID }}
          CF_R2_SECRET_ACCESS_KEY: ${{ secrets.CF_R2_SECRET_ACCESS_KEY }}
          CF_R2_BUCKET_NAME: ${{ secrets.CF_R2_BUCKET_NAME }}

  sync-bedrock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: pnpm install

      # Bedrock版の新バージョンチェック（手動トリガーが多い）
      - name: Check Bedrock update
        id: check-bedrock
        run: |
          # APKMirrorなどから最新バージョンを確認
          echo "Check for new Bedrock version..."
        env:
          CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
```
