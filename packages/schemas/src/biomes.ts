import { z } from "@hono/zod-openapi"
import {
  BedrockChangeSchema,
  BedrockMetaSchema,
  EditionSchema,
  LocalizedTextSchema,
  NamespacedIdSchema,
} from "./common.js"

/**
 * Biome category
 */
export const BiomeCategorySchema = z
  .enum([
    "none",
    "taiga",
    "extreme_hills",
    "jungle",
    "mesa",
    "plains",
    "savanna",
    "icy",
    "the_end",
    "beach",
    "forest",
    "ocean",
    "desert",
    "river",
    "swamp",
    "mushroom",
    "nether",
    "underground",
    "mountain",
  ])
  .openapi({
    description: "Biome category",
    example: "forest",
  })

export type BiomeCategory = z.infer<typeof BiomeCategorySchema>

/**
 * Precipitation type
 */
export const PrecipitationTypeSchema = z
  .enum(["none", "rain", "snow"])
  .openapi({
    description: "Type of precipitation in the biome",
    example: "rain",
  })

export type PrecipitationType = z.infer<typeof PrecipitationTypeSchema>

/**
 * Biome effects (visual/audio)
 */
export const BiomeEffectsSchema = z
  .object({
    fogColor: z.number().int().openapi({
      description: "Fog color as integer",
      example: 12638463,
    }),
    waterColor: z.number().int().openapi({
      description: "Water color as integer",
      example: 4159204,
    }),
    waterFogColor: z.number().int().openapi({
      description: "Underwater fog color as integer",
      example: 329011,
    }),
    skyColor: z.number().int().openapi({
      description: "Sky color as integer",
      example: 7907327,
    }),
    foliageColor: z.number().int().optional().openapi({
      description: "Foliage color override",
      example: 10387789,
    }),
    grassColor: z.number().int().optional().openapi({
      description: "Grass color override",
      example: 9470285,
    }),
    grassColorModifier: z
      .enum(["none", "dark_forest", "swamp"])
      .optional()
      .openapi({
        description: "Grass color modifier",
        example: "none",
      }),
    ambientSound: NamespacedIdSchema.optional().openapi({
      description: "Ambient sound ID",
      example: "minecraft:ambient.basalt_deltas.loop",
    }),
    moodSound: z
      .object({
        sound: NamespacedIdSchema.openapi({
          description: "Mood sound ID",
          example: "minecraft:ambient.cave",
        }),
        tickDelay: z.number().int().openapi({
          description: "Delay between sound plays in ticks",
          example: 6000,
        }),
        blockSearchExtent: z.number().int().openapi({
          description: "Search extent for darkness check",
          example: 8,
        }),
        offset: z.number().openapi({
          description: "Sound position offset",
          example: 2.0,
        }),
      })
      .optional()
      .openapi({
        description: "Mood sound settings",
      }),
    additionsSound: z
      .object({
        sound: NamespacedIdSchema,
        tickChance: z.number().min(0).max(1),
      })
      .optional()
      .openapi({
        description: "Random additions sound settings",
      }),
    music: z
      .object({
        sound: NamespacedIdSchema,
        minDelay: z.number().int(),
        maxDelay: z.number().int(),
        replaceCurrentMusic: z.boolean(),
      })
      .optional()
      .openapi({
        description: "Biome-specific music settings",
      }),
    particleSettings: z
      .object({
        type: NamespacedIdSchema.openapi({
          description: "Particle type",
          example: "minecraft:crimson_spore",
        }),
        probability: z.number().min(0).max(1).openapi({
          description: "Spawn probability per tick",
          example: 0.025,
        }),
      })
      .optional()
      .openapi({
        description: "Ambient particle settings",
      }),
  })
  .openapi("BiomeEffects")

export type BiomeEffects = z.infer<typeof BiomeEffectsSchema>

/**
 * Spawn settings for a mob in this biome
 */
export const BiomeSpawnEntrySchema = z
  .object({
    entity: NamespacedIdSchema.openapi({
      description: "Entity ID",
      example: "minecraft:pig",
    }),
    weight: z.number().int().min(0).openapi({
      description: "Spawn weight",
      example: 10,
    }),
    minCount: z.number().int().min(1).openapi({
      description: "Minimum spawn count",
      example: 1,
    }),
    maxCount: z.number().int().min(1).openapi({
      description: "Maximum spawn count",
      example: 4,
    }),
  })
  .openapi("BiomeSpawnEntry")

export type BiomeSpawnEntry = z.infer<typeof BiomeSpawnEntrySchema>

/**
 * Biome spawn settings
 */
export const BiomeSpawnSettingsSchema = z
  .object({
    probability: z.number().min(0).max(1).optional().openapi({
      description: "Spawn probability modifier",
      example: 0.1,
    }),
    creatures: z.array(BiomeSpawnEntrySchema).optional(),
    monsters: z.array(BiomeSpawnEntrySchema).optional(),
    ambient: z.array(BiomeSpawnEntrySchema).optional(),
    waterCreatures: z.array(BiomeSpawnEntrySchema).optional(),
    waterAmbient: z.array(BiomeSpawnEntrySchema).optional(),
    undergroundWaterCreatures: z.array(BiomeSpawnEntrySchema).optional(),
    misc: z.array(BiomeSpawnEntrySchema).optional(),
  })
  .openapi("BiomeSpawnSettings")

export type BiomeSpawnSettings = z.infer<typeof BiomeSpawnSettingsSchema>

/**
 * Carver configuration
 */
export const CarverSchema = z
  .object({
    id: NamespacedIdSchema.openapi({
      description: "Carver ID",
      example: "minecraft:cave",
    }),
    probability: z.number().min(0).max(1).optional().openapi({
      description: "Generation probability",
      example: 0.15,
    }),
  })
  .openapi("Carver")

export type Carver = z.infer<typeof CarverSchema>

/**
 * Feature placement
 */
export const FeaturePlacementSchema = z
  .object({
    feature: NamespacedIdSchema.openapi({
      description: "Feature ID",
      example: "minecraft:oak",
    }),
    step: z
      .enum([
        "raw_generation",
        "lakes",
        "local_modifications",
        "underground_structures",
        "surface_structures",
        "strongholds",
        "underground_ores",
        "underground_decoration",
        "fluid_springs",
        "vegetal_decoration",
        "top_layer_modification",
      ])
      .openapi({
        description: "Generation step",
        example: "vegetal_decoration",
      }),
  })
  .openapi("FeaturePlacement")

export type FeaturePlacement = z.infer<typeof FeaturePlacementSchema>

/**
 * Biome schema
 */
export const BiomeSchema = z
  .object({
    id: NamespacedIdSchema.openapi({
      description: "Namespaced biome ID",
      example: "minecraft:forest",
    }),
    edition: EditionSchema,
    name: LocalizedTextSchema,
    category: BiomeCategorySchema.optional(),
    temperature: z.number().openapi({
      description: "Temperature value (affects snow/rain)",
      example: 0.7,
    }),
    downfall: z.number().min(0).max(1).openapi({
      description: "Rainfall/snowfall amount (0-1)",
      example: 0.8,
    }),
    precipitation: PrecipitationTypeSchema.optional(),
    effects: BiomeEffectsSchema.optional(),
    spawns: BiomeSpawnSettingsSchema.optional(),
    carvers: z.array(CarverSchema).optional().openapi({
      description: "Cave/canyon carvers",
    }),
    features: z.array(FeaturePlacementSchema).optional().openapi({
      description: "Generated features (trees, ores, etc.)",
    }),
    hasPrecipitation: z.boolean().optional().openapi({
      description: "Whether precipitation occurs",
      example: true,
    }),
    creatureSpawnProbability: z.number().min(0).max(1).optional().openapi({
      description: "Creature spawn probability",
      example: 0.1,
    }),
    tags: z.array(NamespacedIdSchema).optional().openapi({
      description: "Biome tags",
    }),
    bedrockMeta: BedrockMetaSchema.optional(),
    bedrockChanges: z.array(BedrockChangeSchema).optional(),
  })
  .openapi("Biome")

export type Biome = z.infer<typeof BiomeSchema>

/**
 * Biome query parameters
 */
export const BiomeQuerySchema = z.object({
  edition: EditionSchema.optional(),
  version: z.string().optional().openapi({
    description: "Minecraft version",
    example: "1.20.4",
  }),
  category: BiomeCategorySchema.optional(),
  tag: z.string().optional().openapi({
    description: "Filter by biome tag",
    example: "minecraft:is_forest",
  }),
  q: z.string().optional().openapi({
    description: "Search query for biome name/ID",
    example: "forest",
  }),
  locale: z.string().optional().openapi({
    description: "Locale for name search",
    example: "en_us",
  }),
  minTemperature: z.string().optional().openapi({
    description: "Minimum temperature filter",
    example: "0.5",
  }),
  maxTemperature: z.string().optional().openapi({
    description: "Maximum temperature filter",
    example: "1.0",
  }),
  hasEntity: z.string().optional().openapi({
    description: "Filter biomes where entity spawns",
    example: "minecraft:wolf",
  }),
})

export type BiomeQuery = z.infer<typeof BiomeQuerySchema>

/**
 * Biome path parameters
 */
export const BiomePathParamsSchema = z.object({
  id: z.string().openapi({
    description: "Biome ID (with or without namespace)",
    example: "forest",
  }),
})

export type BiomePathParams = z.infer<typeof BiomePathParamsSchema>

/**
 * Biome list response
 */
export const BiomeListResponseSchema = z
  .object({
    biomes: z.array(BiomeSchema),
    pagination: z
      .object({
        total: z.number().int(),
        limit: z.number().int(),
        offset: z.number().int(),
        hasMore: z.boolean(),
      })
      .optional(),
  })
  .openapi("BiomeListResponse")

export type BiomeListResponse = z.infer<typeof BiomeListResponseSchema>
