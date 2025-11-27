# Schema Package Design

## Overview

`@minecraft-api/schemas` is a unified schema package that provides:

1. **Zod Schemas** - Runtime validation and TypeScript type inference
2. **OpenAPI Specification** - Auto-generated via `@hono/zod-openapi`
3. **TypeScript Types** - Inferred from Zod schemas

This approach follows the **Single Source of Truth** principle where Zod schemas are the canonical definition, and all other formats are derived from them.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         API Server                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐                                        │
│  │   Zod Schemas   │  ← Single Source of Truth              │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ├──────────────────┬──────────────────┐           │
│           ▼                  ▼                  ▼           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │ TypeScript Types│ │ OpenAPI Spec    │ │ Runtime         ││
│  │ (auto-inferred) │ │(@hono/zod-openapi)│ │ Validation    ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    @hono/zod-openapi                    ││
│  │  - Route definition with Zod schemas                    ││
│  │  - Auto OpenAPI doc generation (/doc endpoint)          ││
│  │  - Request/Response validation                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Technology Choice

### @hono/zod-openapi

Hono provides `@hono/zod-openapi` middleware that integrates Zod schemas directly into route definitions:

- **Type-safe routes**: Request params, query, body, and response are all typed via Zod
- **Auto OpenAPI generation**: OpenAPI 3.0 spec is automatically generated from routes
- **Runtime validation**: Incoming requests are validated against schemas
- **Swagger UI integration**: Built-in support for serving API documentation

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

const app = new OpenAPIHono()

// Define route with Zod schemas
const route = createRoute({
  method: 'get',
  path: '/api/v1/items/{id}',
  request: {
    params: z.object({
      id: z.string().openapi({ example: 'minecraft:diamond_sword' }),
    }),
    query: z.object({
      version: z.string().openapi({ example: '1.20.4' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ItemSchema,
        },
      },
      description: 'Item details',
    },
  },
})

app.openapi(route, async (c) => {
  const { id } = c.req.valid('param')
  const { version } = c.req.valid('query')
  // Handler implementation
})

// Auto-generated OpenAPI doc
app.doc('/doc', {
  openapi: '3.0.0',
  info: { title: 'Minecraft API', version: '1.0.0' },
})
```

## Schema Design Principles

### 1. Zod as Single Source of Truth

All type definitions originate from Zod schemas:

```typescript
// Schema definition
const ItemSchema = z.object({
  id: z.string(),
  name: z.record(z.string(), z.string()),
  stackSize: z.number().int().min(1).max(64),
  // ...
})

// TypeScript type is automatically inferred
type Item = z.infer<typeof ItemSchema>
```

### 2. OpenAPI Metadata

Schemas include OpenAPI metadata for documentation:

```typescript
const ItemSchema = z.object({
  id: z.string().openapi({
    description: 'Namespaced item ID',
    example: 'minecraft:diamond_sword',
  }),
  stackSize: z.number().int().min(1).max(64).openapi({
    description: 'Maximum stack size',
    example: 64,
  }),
}).openapi('Item')
```

### 3. Shared Schema Categories

| Category | Description |
|----------|-------------|
| Common | Edition, BedrockMeta, LocalizedText, Pagination |
| Items | Item definitions and queries |
| Blocks | Block definitions with states |
| Recipes | Crafting, smelting, smithing recipes |
| Entities | Mobs, attributes, loot tables |
| Biomes | Biome properties and spawns |
| Enchantments | Enchantment properties |
| Effects | Status effects |
| Versions | Java/Bedrock version info |

## OpenAPI Output

The API automatically exposes:

- `GET /doc` - OpenAPI 3.0 JSON specification
- `GET /swagger` - Swagger UI for interactive documentation (optional)

### SDK Generation

Users can generate clients from the OpenAPI spec:

```bash
# Fetch OpenAPI spec from running API
curl https://api.minecraft-api.example.com/doc > openapi.json

# Generate TypeScript client
npx openapi-typescript-codegen \
  --input openapi.json \
  --output ./src/generated \
  --client fetch

# Generate other language clients
npx @openapitools/openapi-generator-cli generate \
  -i openapi.json \
  -g python \
  -o ./python-client
```

## npm Package Distribution

The schema package can be published for direct TypeScript usage:

```typescript
import { ItemSchema, type Item } from '@minecraft-api/schemas'

// Validate data
const result = ItemSchema.safeParse(data)

// Use types
function processItem(item: Item) {
  // ...
}
```

## Benefits

1. **Single Source of Truth**: Zod schemas define types once, everything else is derived
2. **Hono Integration**: `@hono/zod-openapi` provides seamless OpenAPI generation
3. **Runtime Validation**: Automatic request validation in route handlers
4. **TypeScript Integration**: Full type inference from schemas
5. **Self-Documenting API**: OpenAPI spec always matches implementation
6. **Flexible Consumption**: Users can use OpenAPI spec or TypeScript types directly
