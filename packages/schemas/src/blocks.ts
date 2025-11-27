import { z } from "@hono/zod-openapi"
import {
  BedrockChangeSchema,
  BedrockMetaSchema,
  EditionSchema,
  LocalizedTextSchema,
  NamespacedIdSchema,
} from "./common.js"

/**
 * Block state property type
 */
export const BlockStatePropertyTypeSchema = z
  .enum(["bool", "int", "enum"])
  .openapi({
    description: "Type of block state property",
    example: "enum",
  })

export type BlockStatePropertyType = z.infer<
  typeof BlockStatePropertyTypeSchema
>

/**
 * Block state property definition
 */
export const BlockStatePropertySchema = z
  .object({
    name: z.string().openapi({
      description: "Property name",
      example: "facing",
    }),
    type: BlockStatePropertyTypeSchema,
    values: z.array(z.union([z.string(), z.number(), z.boolean()])).openapi({
      description: "Possible values for this property",
      example: ["north", "south", "east", "west"],
    }),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).openapi({
      description: "Default value when not specified",
      example: "north",
    }),
  })
  .openapi("BlockStateProperty")

export type BlockStateProperty = z.infer<typeof BlockStatePropertySchema>

/**
 * Block material type
 */
export const BlockMaterialSchema = z
  .enum([
    "air",
    "stone",
    "wood",
    "plant",
    "water",
    "lava",
    "sand",
    "cloth",
    "fire",
    "glass",
    "ice",
    "metal",
    "snow",
    "clay",
    "dirt",
    "grass",
    "sponge",
    "wool",
    "gourd",
    "coral",
    "leaves",
    "moss",
    "sculk",
    "nether_wood",
    "amethyst",
    "powder_snow",
  ])
  .openapi({
    description: "Block material type",
    example: "stone",
  })

export type BlockMaterial = z.infer<typeof BlockMaterialSchema>

/**
 * Block sound type
 */
export const BlockSoundTypeSchema = z
  .object({
    breakSound: NamespacedIdSchema.optional().openapi({
      description: "Sound when block is broken",
      example: "minecraft:block.stone.break",
    }),
    stepSound: NamespacedIdSchema.optional().openapi({
      description: "Sound when walking on block",
      example: "minecraft:block.stone.step",
    }),
    placeSound: NamespacedIdSchema.optional().openapi({
      description: "Sound when block is placed",
      example: "minecraft:block.stone.place",
    }),
    hitSound: NamespacedIdSchema.optional().openapi({
      description: "Sound when block is hit",
      example: "minecraft:block.stone.hit",
    }),
    fallSound: NamespacedIdSchema.optional().openapi({
      description: "Sound when landing on block",
      example: "minecraft:block.stone.fall",
    }),
  })
  .openapi("BlockSoundType")

export type BlockSoundType = z.infer<typeof BlockSoundTypeSchema>

/**
 * Block drop information
 */
export const BlockDropSchema = z
  .object({
    item: NamespacedIdSchema.openapi({
      description: "Item dropped",
      example: "minecraft:diamond",
    }),
    minCount: z.number().int().min(0).openapi({
      description: "Minimum drop count",
      example: 1,
    }),
    maxCount: z.number().int().min(0).openapi({
      description: "Maximum drop count",
      example: 1,
    }),
    probability: z.number().min(0).max(1).optional().openapi({
      description: "Probability of dropping (0-1)",
      example: 1.0,
    }),
    requiresSilkTouch: z.boolean().optional().openapi({
      description: "Whether silk touch is required",
      example: false,
    }),
    fortuneMultiplier: z.boolean().optional().openapi({
      description: "Whether fortune affects drop count",
      example: true,
    }),
  })
  .openapi("BlockDrop")

export type BlockDrop = z.infer<typeof BlockDropSchema>

/**
 * Tool required to harvest the block
 */
export const HarvestToolSchema = z
  .object({
    type: z
      .enum(["pickaxe", "axe", "shovel", "hoe", "shears", "sword", "any"])
      .openapi({
        description: "Tool type required",
        example: "pickaxe",
      }),
    minTier: z
      .enum(["wood", "stone", "iron", "gold", "diamond", "netherite"])
      .optional()
      .openapi({
        description: "Minimum tool tier required",
        example: "iron",
      }),
  })
  .openapi("HarvestTool")

export type HarvestTool = z.infer<typeof HarvestToolSchema>

/**
 * Block bounding box
 */
export const BoundingBoxSchema = z
  .object({
    minX: z.number().openapi({ example: 0 }),
    minY: z.number().openapi({ example: 0 }),
    minZ: z.number().openapi({ example: 0 }),
    maxX: z.number().openapi({ example: 1 }),
    maxY: z.number().openapi({ example: 1 }),
    maxZ: z.number().openapi({ example: 1 }),
  })
  .openapi("BoundingBox")

export type BoundingBox = z.infer<typeof BoundingBoxSchema>

/**
 * Block schema
 */
export const BlockSchema = z
  .object({
    id: NamespacedIdSchema.openapi({
      description: "Namespaced block ID",
      example: "minecraft:diamond_ore",
    }),
    edition: EditionSchema,
    name: LocalizedTextSchema,
    numericId: z.number().int().optional().openapi({
      description: "Legacy numeric ID (Bedrock)",
      example: 56,
    }),
    stateProperties: z.array(BlockStatePropertySchema).optional().openapi({
      description: "Block state properties",
    }),
    defaultState: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional()
      .openapi({
        description: "Default block state values",
      }),
    material: BlockMaterialSchema.optional(),
    hardness: z.number().min(-1).openapi({
      description: "Block hardness (-1 = unbreakable)",
      example: 3,
    }),
    blastResistance: z.number().min(0).openapi({
      description: "Explosion resistance",
      example: 3,
    }),
    luminance: z.number().int().min(0).max(15).openapi({
      description: "Light level emitted (0-15)",
      example: 0,
    }),
    opacity: z.number().int().min(0).max(15).optional().openapi({
      description: "Light blocking (0-15)",
      example: 15,
    }),
    flammable: z.boolean().optional().openapi({
      description: "Whether the block can catch fire",
      example: false,
    }),
    isFullCube: z.boolean().optional().openapi({
      description: "Whether the block occupies a full cube",
      example: true,
    }),
    isSolid: z.boolean().optional().openapi({
      description: "Whether the block has collision",
      example: true,
    }),
    isTransparent: z.boolean().optional().openapi({
      description: "Whether the block is transparent",
      example: false,
    }),
    requiresToolForDrops: z.boolean().optional().openapi({
      description: "Whether proper tool is needed for drops",
      example: true,
    }),
    harvestTool: HarvestToolSchema.optional(),
    drops: z.array(BlockDropSchema).optional(),
    sounds: BlockSoundTypeSchema.optional(),
    boundingBox: BoundingBoxSchema.optional(),
    mapColor: z.string().optional().openapi({
      description: "Color shown on maps (hex)",
      example: "#61D1E1",
    }),
    itemId: NamespacedIdSchema.optional().openapi({
      description: "Associated item ID when picked up",
      example: "minecraft:diamond_ore",
    }),
    tags: z.array(NamespacedIdSchema).optional().openapi({
      description: "Block tags for grouping",
    }),
    bedrockMeta: BedrockMetaSchema.optional(),
    bedrockChanges: z.array(BedrockChangeSchema).optional(),
  })
  .openapi("Block")

export type Block = z.infer<typeof BlockSchema>

/**
 * Block query parameters
 */
export const BlockQuerySchema = z.object({
  edition: EditionSchema.optional(),
  version: z.string().optional().openapi({
    description: "Minecraft version",
    example: "1.20.4",
  }),
  material: BlockMaterialSchema.optional(),
  tag: z.string().optional().openapi({
    description: "Filter by block tag",
    example: "minecraft:mineable/pickaxe",
  }),
  q: z.string().optional().openapi({
    description: "Search query for block name/ID",
    example: "ore",
  }),
  locale: z.string().optional().openapi({
    description: "Locale for name search",
    example: "en_us",
  }),
  minHardness: z.string().optional().openapi({
    description: "Minimum hardness filter",
    example: "0",
  }),
  maxHardness: z.string().optional().openapi({
    description: "Maximum hardness filter",
    example: "50",
  }),
  hasLuminance: z.string().optional().openapi({
    description: "Filter blocks that emit light",
    example: "true",
  }),
})

export type BlockQuery = z.infer<typeof BlockQuerySchema>

/**
 * Block path parameters
 */
export const BlockPathParamsSchema = z.object({
  id: z.string().openapi({
    description: "Block ID (with or without namespace)",
    example: "diamond_ore",
  }),
})

export type BlockPathParams = z.infer<typeof BlockPathParamsSchema>

/**
 * Block list response
 */
export const BlockListResponseSchema = z
  .object({
    blocks: z.array(BlockSchema),
    pagination: z
      .object({
        total: z.number().int(),
        limit: z.number().int(),
        offset: z.number().int(),
        hasMore: z.boolean(),
      })
      .optional(),
  })
  .openapi("BlockListResponse")

export type BlockListResponse = z.infer<typeof BlockListResponseSchema>
