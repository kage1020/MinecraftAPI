# Implementation Plan

## Overview

このドキュメントはMinecraft APIの実装計画を定義します。各ステップは1コミット単位で、関連するステップをPhaseとしてグループ化しています。

## Phase Summary

| Phase | 名称 | 概要 | 並列可否 |
|-------|------|------|----------|
| 1 | Project Setup | プロジェクト基盤構築 | - |
| 2 | Schema Definition | Zodスキーマ定義 | Phase 3と並列可 |
| 3 | Data Extraction Pipeline | JAR/APKからのデータ抽出 | Phase 2と並列可 |
| 4 | Storage Layer | KV/R2ストレージ実装 | - |
| 5 | API Core | Hono/Pylonによるエンドポイント実装 | - |
| 6 | Authentication & Security | 認証・レート制限 | - |
| 7 | Testing | テスト実装 | Phase 8と並列可 |
| 8 | Documentation & DevOps | ドキュメント・CI/CD | Phase 7と並列可 |

---

## Phase 1: Project Setup

プロジェクトの基盤を構築する。

### Step 1.1: Initialize monorepo structure
```
minecraft-api/
├── apps/
│   └── api/                 # Cloudflare Workers API
├── packages/
│   └── schemas/             # Shared Zod schemas
│   └── extraction/          # Data extraction scripts
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── .gitignore
```
- pnpm workspace設定
- Turborepo設定

### Step 1.2: Initialize Cloudflare Workers project
- `apps/api/`にWrangler設定
- `wrangler.toml`作成
- `nodejs_compat`フラグ設定

### Step 1.3: Configure environment variables
- `.dev.vars.example`作成
- 環境変数の型定義（`pnpm cf-typegen`）
- KV/R2バインディング定義

---

## Phase 2: Schema Definition

Zodスキーマを定義する。Phase 3と並列実装可能。

### Step 2.1: Create common schemas
```typescript
// packages/schemas/src/common.ts
- EditionSchema ('JAVA' | 'BEDROCK')
- BedrockMetaSchema
- BedrockChangeSchema
- LocalizedTextSchema
- PaginationSchema
- ErrorSchema
```

### Step 2.2: Create version schemas
```typescript
// packages/schemas/src/versions.ts
- JavaVersionSchema
- BedrockVersionSchema
- VersionSchema (discriminated union)
```

### Step 2.3: Create item schemas
```typescript
// packages/schemas/src/items.ts
- ItemRaritySchema
- FoodPropertiesSchema
- ItemSchema
- ItemQuerySchema
```

### Step 2.4: Create block schemas
```typescript
// packages/schemas/src/blocks.ts
- BlockStatePropertySchema
- BlockSchema
- BlockQuerySchema
```

### Step 2.5: Create recipe schemas
```typescript
// packages/schemas/src/recipes.ts
- RecipeIngredientSchema
- ShapedRecipeSchema
- ShapelessRecipeSchema
- SmeltingRecipeSchema
- SmithingRecipeSchema
- StonecuttingRecipeSchema
- RecipeSchema (discriminated union)
```

### Step 2.6: Create entity schemas
```typescript
// packages/schemas/src/entities.ts
- EntityCategorySchema
- EntityAttributeSchema
- LootEntrySchema
- SpawnConditionSchema
- EntitySchema
```

### Step 2.7: Create remaining schemas
```typescript
// packages/schemas/src/
- biomes.ts (BiomeSchema, BiomeEffectsSchema)
- enchantments.ts (EnchantmentSchema)
- effects.ts (EffectSchema, PotionSchema)
```

### Step 2.8: Create schema package exports
```typescript
// packages/schemas/src/index.ts
- 全スキーマのエクスポート
- package.json設定
- ビルド設定（tsup）
```

---

## Phase 3: Data Extraction Pipeline

MinecraftのJAR/APKからデータを抽出するスクリプトを実装する。Phase 2と並列実装可能。

### Step 3.1: Create version manifest fetcher
```typescript
// scripts/extraction/src/versions.ts
- Mojang version_manifest_v2.json取得
- Bedrockバージョン情報取得（Play Store API等）
- バージョンリスト管理
```

### Step 3.2: Create Java Edition JAR downloader
```typescript
// scripts/extraction/src/java/downloader.ts
- Client JAR ダウンロード
- Server JAR ダウンロード
- キャッシュ管理
```

### Step 3.3: Create Java Edition asset extractor
```typescript
// scripts/extraction/src/java/assets.ts
- JAR展開（unzipper）
- assets/minecraft/textures/ 抽出
- assets/minecraft/sounds/ 抽出
- assets/minecraft/models/ 抽出
- assets/minecraft/blockstates/ 抽出
```

### Step 3.4: Create Java Edition data extractor
```typescript
// scripts/extraction/src/java/data.ts
- Server JAR --reports 実行
- registries.json パース
- blocks.json パース
- items.json パース
- recipes/ ディレクトリパース
```

### Step 3.5: Create Java Edition language extractor
```typescript
// scripts/extraction/src/java/lang.ts
- assets/minecraft/lang/*.json 抽出
- 言語コードマッピング
- LocalizedText形式への変換
```

### Step 3.6: Create Bedrock Edition extractor base
```typescript
// scripts/extraction/src/bedrock/downloader.ts
- APKダウンロード機構
- APK展開
- バージョン検出
```

### Step 3.7: Create Bedrock Edition asset extractor
```typescript
// scripts/extraction/src/bedrock/assets.ts
- textures/ 抽出
- sounds/ 抽出
- models/ 抽出（Bedrock形式）
```

### Step 3.8: Create Bedrock Edition data extractor
```typescript
// scripts/extraction/src/bedrock/data.ts
- behavior_packs/vanilla/ パース
- resource_packs/vanilla/ パース
- blocks.json, items.json パース
```

### Step 3.9: Create Bedrock cumulative data processor
```typescript
// scripts/extraction/src/bedrock/cumulative.ts
- バージョン間diff検出
- BedrockMeta生成
- changelog追跡
- 累積データマージ
```

### Step 3.10: Create data normalizer
```typescript
// scripts/extraction/src/normalizer.ts
- Java/Bedrock共通フォーマットへ変換
- ID正規化（namespace付与）
- スキーマバリデーション
```

### Step 3.11: Create extraction CLI
```typescript
// scripts/extraction/src/cli.ts
- コマンドライン引数パース
- バージョン指定抽出
- 全バージョン抽出
- 差分抽出モード
```

---

## Phase 4: Storage Layer

Cloudflare KV/R2へのデータ保存層を実装する。

### Step 4.1: Create KV client wrapper
```typescript
// apps/api/src/storage/kv.ts
- KV操作抽象化
- JSON自動パース
- キープレフィックス管理
- バージョン別キー生成
```

### Step 4.2: Create R2 client wrapper
```typescript
// apps/api/src/storage/r2.ts
- R2操作抽象化
- Content-Type自動設定
- パス正規化
```

### Step 4.3: Create data repository layer
```typescript
// apps/api/src/repositories/
- ItemRepository
- BlockRepository
- RecipeRepository
- EntityRepository
- VersionRepository
```

### Step 4.4: Create asset repository layer
```typescript
// apps/api/src/repositories/assets.ts
- TextureRepository
- SoundRepository
- ModelRepository
- Bedrock版アセット対応
```

### Step 4.5: Create data upload scripts
```typescript
// scripts/upload/
- KVへのデータアップロード
- R2へのアセットアップロード
- バッチアップロード
- 差分アップロード
```

---

## Phase 5: API Core

Hono + Pylonによるエンドポイント実装。

### Step 5.1: Initialize Hono application
```typescript
// apps/api/src/index.ts
- Honoアプリケーション初期化
- OpenAPIHono設定
- グローバルミドルウェア
```

### Step 5.2: Create REST routes for versions
```typescript
// apps/api/src/routes/versions.ts
- GET /api/v1/versions
- GET /api/v1/versions/latest
- GET /api/v1/versions/:edition/:version
```

### Step 5.3: Create REST routes for assets
```typescript
// apps/api/src/routes/assets.ts
- GET /api/v1/assets/:edition/:version/textures/*
- GET /api/v1/assets/:edition/:version/sounds/*
- GET /api/v1/assets/:edition/:version/models/*
- GET /api/v1/assets/:edition/:version/blockstates/*
- Cache-Control設定
- ETag対応
```

### Step 5.4: Initialize Pylon GraphQL service
```typescript
// apps/api/src/graphql/index.ts
- Pylonサービス初期化
- スキーマ定義
- /graphqlエンドポイント
```

### Step 5.5: Create GraphQL item resolvers
```typescript
// apps/api/src/graphql/resolvers/items.ts
- Query.items (list with filters)
- Query.item (by ID)
- Field resolvers
```

### Step 5.6: Create GraphQL block resolvers
```typescript
// apps/api/src/graphql/resolvers/blocks.ts
- Query.blocks
- Query.block
- Block.drops resolver
```

### Step 5.7: Create GraphQL recipe resolvers
```typescript
// apps/api/src/graphql/resolvers/recipes.ts
- Query.recipes
- Query.recipe
- Query.recipesByResult
- Query.recipesByIngredient
```

### Step 5.8: Create GraphQL entity resolvers
```typescript
// apps/api/src/graphql/resolvers/entities.ts
- Query.entities
- Query.entity
- Entity.loot resolver
- Entity.spawnBiomes resolver
```

### Step 5.9: Create remaining GraphQL resolvers
```typescript
// apps/api/src/graphql/resolvers/
- biomes.ts
- enchantments.ts
- effects.ts
```

### Step 5.10: Create GraphQL version resolvers
```typescript
// apps/api/src/graphql/resolvers/versions.ts
- Query.versions
- Query.version
- Bedrock版フィルタリング（asOf）
```

### Step 5.11: Create OpenAPI documentation endpoint
```typescript
// apps/api/src/routes/docs.ts
- GET /doc (OpenAPI JSON)
- GET /swagger (Swagger UI - optional)
```

---

## Phase 6: Authentication & Security

認証とレート制限を実装する。

### Step 6.1: Create API token validation middleware
```typescript
// apps/api/src/middleware/auth.ts
- Bearer tokenパース
- mcapi_xxx形式バリデーション
- KVからトークン検証
- 無効トークン拒否
```

### Step 6.2: Create rate limiting middleware
```typescript
// apps/api/src/middleware/rateLimit.ts
- トークン別レート制限
- 分単位/日単位カウンター
- KVでのカウント保存
- 429レスポンス
- X-RateLimit-* ヘッダー
```

### Step 6.3: Create token management utilities
```typescript
// apps/api/src/services/tokens.ts
- トークン生成
- トークン無効化
- 使用量追跡
- クォータ管理
```

### Step 6.4: Create security headers middleware
```typescript
// apps/api/src/middleware/security.ts
- CORS設定
- Content-Security-Policy
- X-Content-Type-Options
```

### Step 6.5: Create error handling middleware
```typescript
// apps/api/src/middleware/errors.ts
- グローバルエラーハンドラー
- Zodバリデーションエラー変換
- GraphQLエラーフォーマット
- エラーログ
```

---

## Phase 7: Testing

テスト実装。Phase 8と並列実装可能。

### Step 7.1: Configure test environment
- Vitest設定
- テストユーティリティ
- モック設定

### Step 7.2: Create schema unit tests
```typescript
// packages/schemas/__tests__/
- 各スキーマのバリデーションテスト
- エッジケーステスト
- 型推論テスト
```

### Step 7.3: Create extraction unit tests
```typescript
// scripts/extraction/__tests__/
- パーサーテスト
- 正規化テスト
- diff検出テスト
```

### Step 7.4: Create repository unit tests
```typescript
// apps/api/__tests__/repositories/
- KVモックテスト
- R2モックテスト
- データ取得テスト
```

### Step 7.5: Create API integration tests
```typescript
// apps/api/__tests__/integration/
- RESTエンドポイントテスト
- GraphQLクエリテスト
- 認証テスト
- レート制限テスト
```

### Step 7.6: Create E2E tests
```typescript
// apps/api/__tests__/e2e/
- 実際のWorkers環境テスト
- Miniflareによるローカルテスト
```

---

## Phase 8: Documentation & DevOps

ドキュメントとCI/CD。Phase 7と並列実装可能。

### Step 8.1: Create API usage documentation
```markdown
// docs/API_USAGE.md
- 認証方法
- エンドポイント一覧
- クエリ例
- レスポンス形式
```

### Step 8.2: Create contribution guide
```markdown
// CONTRIBUTING.md
- 開発環境セットアップ
- コーディング規約
- PR手順
```

### Step 8.3: Configure GitHub Actions for CI
```yaml
// .github/workflows/ci.yml
- lint
- typecheck
- test
- build
```

### Step 8.4: Configure GitHub Actions for CD
```yaml
// .github/workflows/deploy.yml
- Cloudflare Workersデプロイ
- 環境別デプロイ（staging/production）
```

### Step 8.5: Configure data extraction automation
```yaml
// .github/workflows/extraction.yml
- 定期的なバージョンチェック
- 新バージョン検出時の自動抽出
- KV/R2への自動アップロード
```

### Step 8.6: Create monitoring and alerting
- エラーログ設定
- パフォーマンスモニタリング
- アラート設定

---

## Implementation Order

### Parallel Execution Plan

```
Week 1-2:
├── Phase 1: Project Setup (Sequential)
│   └── Steps 1.1 → 1.2

Week 3-4:
├── Phase 2: Schema Definition ─────────┐
│   └── Steps 2.1 → 2.2 → ... → 2.8     │ Parallel
├── Phase 3: Data Extraction ───────────┘
│   └── Steps 3.1 → 3.2 → ... → 3.11

Week 5:
├── Phase 4: Storage Layer (Sequential)
│   └── Steps 4.1 → 4.2 → 4.3 → 4.4 → 4.5

Week 6-7:
├── Phase 5: API Core (Sequential)
│   └── Steps 5.1 → 5.2 → ... → 5.11

Week 8:
├── Phase 6: Authentication & Security (Sequential)
│   └── Steps 6.1 → 6.2 → 6.3 → 6.4 → 6.5

Week 9-10:
├── Phase 7: Testing ───────────────────┐
│   └── Steps 7.1 → 7.2 → ... → 7.6     │ Parallel
├── Phase 8: Documentation & DevOps ────┘
│   └── Steps 8.1 → 8.2 → ... → 8.6
```

### Critical Path

```
Phase 1 → Phase 4 → Phase 5 → Phase 6
              ↑
        Phase 2 + Phase 3 (parallel, must complete before Phase 4)
```

---

## Commit Message Convention

各コミットは以下の形式に従う：

```
<type>(<scope>): <description>

Types:
- feat: 新機能
- fix: バグ修正
- docs: ドキュメント
- refactor: リファクタリング
- test: テスト追加
- chore: ビルド・設定変更

Examples:
- feat(schemas): add ItemSchema with Zod validation
- feat(extraction): implement Java JAR asset extractor
- feat(api): add GraphQL item resolvers
- test(api): add integration tests for REST endpoints
```

---

## Risk Mitigation

### 技術的リスク

| リスク | 対策 |
|--------|------|
| Bedrock APK取得の法的リスク | 公式ドキュメントを参照し、正規手段のみ使用 |
| 大量バージョンのストレージコスト | 差分ストレージ、古いスナップショットの圧縮 |
| Cloudflare Workers制限 | CPU時間・メモリ制限を考慮した設計 |
| Pylonの成熟度 | フォールバックとしてgraphql-yoga+Pothos検討 |

### 依存関係リスク

| 依存 | 対策 |
|------|------|
| Mojang API変更 | バージョンマニフェストのキャッシュ |
| Minecraft JAR構造変更 | 抽出ロジックのバージョン別分岐 |
