import { z } from "@hono/zod-openapi"
import {
  BedrockChangeSchema,
  BedrockMetaSchema,
  EditionSchema,
  LocalizedTextSchema,
  NamespacedIdSchema,
} from "./common.js"

/**
 * Entity category
 */
export const EntityCategorySchema = z
  .enum([
    "monster",
    "creature",
    "ambient",
    "water_creature",
    "water_ambient",
    "underground_water_creature",
    "misc",
  ])
  .openapi({
    description: "Entity spawn category",
    example: "monster",
  })

export type EntityCategory = z.infer<typeof EntityCategorySchema>

/**
 * Entity classification for behavior
 */
export const EntityClassificationSchema = z
  .enum(["hostile", "passive", "neutral", "boss"])
  .openapi({
    description: "Entity behavior classification",
    example: "hostile",
  })

export type EntityClassification = z.infer<typeof EntityClassificationSchema>

/**
 * Entity attribute (e.g., max health, speed)
 */
export const EntityAttributeSchema = z
  .object({
    id: NamespacedIdSchema.openapi({
      description: "Attribute ID",
      example: "minecraft:generic.max_health",
    }),
    baseValue: z.number().openapi({
      description: "Base attribute value",
      example: 20,
    }),
    minValue: z.number().optional().openapi({
      description: "Minimum possible value",
      example: 0,
    }),
    maxValue: z.number().optional().openapi({
      description: "Maximum possible value",
      example: 1024,
    }),
  })
  .openapi("EntityAttribute")

export type EntityAttribute = z.infer<typeof EntityAttributeSchema>

/**
 * Loot table entry
 */
export const LootEntrySchema = z
  .object({
    item: NamespacedIdSchema.openapi({
      description: "Item dropped",
      example: "minecraft:rotten_flesh",
    }),
    minCount: z.number().int().min(0).openapi({
      description: "Minimum drop count",
      example: 0,
    }),
    maxCount: z.number().int().min(0).openapi({
      description: "Maximum drop count",
      example: 2,
    }),
    weight: z.number().int().min(1).optional().openapi({
      description: "Relative drop weight",
      example: 1,
    }),
    probability: z.number().min(0).max(1).optional().openapi({
      description: "Base drop probability",
      example: 1.0,
    }),
    lootingMultiplier: z.number().optional().openapi({
      description: "Additional drops per looting level",
      example: 1,
    }),
    conditions: z
      .array(
        z.object({
          type: z.string().openapi({
            description: "Condition type",
            example: "killed_by_player",
          }),
          params: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .optional()
      .openapi({
        description: "Conditions required for this drop",
      }),
  })
  .openapi("LootEntry")

export type LootEntry = z.infer<typeof LootEntrySchema>

/**
 * Spawn condition for entity
 */
export const SpawnConditionSchema = z
  .object({
    type: z
      .enum([
        "natural",
        "spawner",
        "spawn_egg",
        "jockey",
        "patrol",
        "structure",
      ])
      .openapi({
        description: "Spawn type",
        example: "natural",
      }),
    biomes: z.array(NamespacedIdSchema).optional().openapi({
      description: "Biomes where entity can spawn",
    }),
    minLightLevel: z.number().int().min(0).max(15).optional().openapi({
      description: "Minimum light level for spawning",
      example: 0,
    }),
    maxLightLevel: z.number().int().min(0).max(15).optional().openapi({
      description: "Maximum light level for spawning",
      example: 7,
    }),
    minY: z.number().int().optional().openapi({
      description: "Minimum Y coordinate",
      example: -64,
    }),
    maxY: z.number().int().optional().openapi({
      description: "Maximum Y coordinate",
      example: 320,
    }),
    spawnWeight: z.number().int().min(0).optional().openapi({
      description: "Spawn weight relative to other entities",
      example: 100,
    }),
    minGroupSize: z.number().int().min(1).optional().openapi({
      description: "Minimum group spawn size",
      example: 1,
    }),
    maxGroupSize: z.number().int().min(1).optional().openapi({
      description: "Maximum group spawn size",
      example: 4,
    }),
    requiresBlock: NamespacedIdSchema.optional().openapi({
      description: "Block required for spawning",
      example: "minecraft:grass_block",
    }),
    requiresStructure: NamespacedIdSchema.optional().openapi({
      description: "Structure required for spawning",
      example: "minecraft:nether_fortress",
    }),
  })
  .openapi("SpawnCondition")

export type SpawnCondition = z.infer<typeof SpawnConditionSchema>

/**
 * Entity dimensions
 */
export const EntityDimensionsSchema = z
  .object({
    width: z.number().min(0).openapi({
      description: "Entity width in blocks",
      example: 0.6,
    }),
    height: z.number().min(0).openapi({
      description: "Entity height in blocks",
      example: 1.8,
    }),
    eyeHeight: z.number().min(0).optional().openapi({
      description: "Eye height from base",
      example: 1.62,
    }),
  })
  .openapi("EntityDimensions")

export type EntityDimensions = z.infer<typeof EntityDimensionsSchema>

/**
 * Entity experience drop
 */
export const EntityExperienceSchema = z
  .object({
    base: z.number().int().min(0).openapi({
      description: "Base experience dropped",
      example: 5,
    }),
    perBaby: z.number().int().min(0).optional().openapi({
      description: "Experience if baby variant",
      example: 0,
    }),
    perKilledByPlayer: z.boolean().optional().openapi({
      description: "Whether experience requires player kill",
      example: true,
    }),
  })
  .openapi("EntityExperience")

export type EntityExperience = z.infer<typeof EntityExperienceSchema>

/**
 * Entity schema
 */
export const EntitySchema = z
  .object({
    id: NamespacedIdSchema.openapi({
      description: "Namespaced entity ID",
      example: "minecraft:zombie",
    }),
    edition: EditionSchema,
    name: LocalizedTextSchema,
    category: EntityCategorySchema,
    classification: EntityClassificationSchema.optional(),
    attributes: z.array(EntityAttributeSchema).optional().openapi({
      description: "Entity attributes",
    }),
    dimensions: EntityDimensionsSchema.optional(),
    experience: EntityExperienceSchema.optional(),
    loot: z.array(LootEntrySchema).optional().openapi({
      description: "Items dropped on death",
    }),
    spawnConditions: z.array(SpawnConditionSchema).optional().openapi({
      description: "Spawn conditions",
    }),
    isBoss: z.boolean().optional().openapi({
      description: "Whether this is a boss mob",
      example: false,
    }),
    isTameable: z.boolean().optional().openapi({
      description: "Whether this entity can be tamed",
      example: false,
    }),
    isBreedable: z.boolean().optional().openapi({
      description: "Whether this entity can be bred",
      example: false,
    }),
    breedingItems: z.array(NamespacedIdSchema).optional().openapi({
      description: "Items used for breeding",
    }),
    fireImmune: z.boolean().optional().openapi({
      description: "Whether immune to fire damage",
      example: false,
    }),
    canSwim: z.boolean().optional().openapi({
      description: "Whether entity can swim",
      example: true,
    }),
    tags: z.array(NamespacedIdSchema).optional().openapi({
      description: "Entity tags",
    }),
    bedrockMeta: BedrockMetaSchema.optional(),
    bedrockChanges: z.array(BedrockChangeSchema).optional(),
  })
  .openapi("Entity")

export type Entity = z.infer<typeof EntitySchema>

/**
 * Entity query parameters
 */
export const EntityQuerySchema = z.object({
  edition: EditionSchema.optional(),
  version: z.string().optional().openapi({
    description: "Minecraft version",
    example: "1.20.4",
  }),
  category: EntityCategorySchema.optional(),
  classification: EntityClassificationSchema.optional(),
  tag: z.string().optional().openapi({
    description: "Filter by entity tag",
    example: "minecraft:raiders",
  }),
  q: z.string().optional().openapi({
    description: "Search query for entity name/ID",
    example: "zombie",
  }),
  locale: z.string().optional().openapi({
    description: "Locale for name search",
    example: "en_us",
  }),
  spawnsIn: z.string().optional().openapi({
    description: "Filter by biome where entity spawns",
    example: "minecraft:plains",
  }),
  isBoss: z.string().optional().openapi({
    description: "Filter boss mobs",
    example: "true",
  }),
})

export type EntityQuery = z.infer<typeof EntityQuerySchema>

/**
 * Entity path parameters
 */
export const EntityPathParamsSchema = z.object({
  id: z.string().openapi({
    description: "Entity ID (with or without namespace)",
    example: "zombie",
  }),
})

export type EntityPathParams = z.infer<typeof EntityPathParamsSchema>

/**
 * Entity list response
 */
export const EntityListResponseSchema = z
  .object({
    entities: z.array(EntitySchema),
    pagination: z
      .object({
        total: z.number().int(),
        limit: z.number().int(),
        offset: z.number().int(),
        hasMore: z.boolean(),
      })
      .optional(),
  })
  .openapi("EntityListResponse")

export type EntityListResponse = z.infer<typeof EntityListResponseSchema>
