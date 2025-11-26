# MinecraftAPI

Minecraftの静的アセットおよびゲームデータを提供するGraphQL API

## 概要

MinecraftAPIは、Minecraft Java Editionのアイテム、ブロック、レシピ、エンティティなどのゲームデータと、テクスチャ、モデル、サウンドなどの静的アセットを提供するWeb APIです。

### 特徴

- **GraphQL API** - 必要なデータのみを柔軟に取得
- **マルチバージョン対応** - 複数のMinecraftバージョンをサポート
- **多言語対応** - 日本語を含む各言語の翻訳データを提供
- **高速配信** - Cloudflare Edgeによる低レイテンシ

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| ランタイム | Node.js 20 |
| 言語 | TypeScript |
| フレームワーク | Hono |
| GraphQL | graphql-yoga + Pothos |
| インフラ | Cloudflare Workers / R2 / KV |

## ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [仕様書](./docs/SPECIFICATION.md) | API仕様、GraphQLスキーマ、エンドポイント定義 |
| [アーキテクチャ](./docs/ARCHITECTURE.md) | システム構成、ディレクトリ構造、コンポーネント設計 |
| [データパイプライン](./docs/DATA_PIPELINE.md) | データ抽出・変換・アップロード処理 |

## クエリ例

```graphql
# アイテムの詳細とレシピを取得
query {
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
            }
          }
        }
      }
    }
  }
}
```

## 開発

```bash
# 依存関係のインストール
pnpm install

# 開発サーバー起動
pnpm dev

# テスト実行
pnpm test

# ビルド
pnpm build

# デプロイ
pnpm wrangler deploy
```

## ライセンス

MIT

## 免責事項

このプロジェクトはMojang ABおよびMicrosoft Corporationとは無関係の非公式プロジェクトです。Minecraftは Mojang AB の商標です。
