import { z } from "@hono/zod-openapi"
import {
  BedrockChangeSchema,
  BedrockMetaSchema,
  EditionSchema,
  LocalizedTextSchema,
  NamespacedIdSchema,
} from "./common.js"

/**
 * Effect category
 */
export const EffectCategorySchema = z
  .enum(["beneficial", "harmful", "neutral"])
  .openapi({
    description: "Effect category",
    example: "beneficial",
  })

export type EffectCategory = z.infer<typeof EffectCategorySchema>

/**
 * Attribute modifier operation
 */
export const AttributeModifierOperationSchema = z
  .enum(["add_value", "add_multiplied_base", "add_multiplied_total"])
  .openapi({
    description: "How the modifier is applied",
    example: "add_value",
  })

export type AttributeModifierOperation = z.infer<
  typeof AttributeModifierOperationSchema
>

/**
 * Attribute modifier from an effect
 */
export const EffectAttributeModifierSchema = z
  .object({
    attribute: NamespacedIdSchema.openapi({
      description: "Attribute being modified",
      example: "minecraft:generic.movement_speed",
    }),
    operation: AttributeModifierOperationSchema,
    amountPerLevel: z.number().openapi({
      description: "Modifier amount per effect level",
      example: 0.2,
    }),
  })
  .openapi("EffectAttributeModifier")

export type EffectAttributeModifier = z.infer<
  typeof EffectAttributeModifierSchema
>

/**
 * Status effect schema
 */
export const EffectSchema = z
  .object({
    id: NamespacedIdSchema.openapi({
      description: "Namespaced effect ID",
      example: "minecraft:speed",
    }),
    edition: EditionSchema,
    name: LocalizedTextSchema,
    description: LocalizedTextSchema.optional(),
    category: EffectCategorySchema,
    color: z.number().int().openapi({
      description: "Particle color as integer",
      example: 8171462,
    }),
    colorHex: z.string().optional().openapi({
      description: "Particle color as hex string",
      example: "#7CAFC6",
    }),
    isInstant: z.boolean().optional().openapi({
      description: "Whether effect is applied instantly (no duration)",
      example: false,
    }),
    attributeModifiers: z
      .array(EffectAttributeModifierSchema)
      .optional()
      .openapi({
        description: "Attribute modifiers applied by this effect",
      }),
    iconIndex: z.number().int().optional().openapi({
      description: "Index in the effects sprite sheet",
      example: 0,
    }),
    tags: z.array(NamespacedIdSchema).optional().openapi({
      description: "Effect tags",
    }),
    bedrockMeta: BedrockMetaSchema.optional(),
    bedrockChanges: z.array(BedrockChangeSchema).optional(),
  })
  .openapi("Effect")

export type Effect = z.infer<typeof EffectSchema>

/**
 * Potion effect instance (effect + duration + amplifier)
 */
export const PotionEffectInstanceSchema = z
  .object({
    effect: NamespacedIdSchema.openapi({
      description: "Effect ID",
      example: "minecraft:speed",
    }),
    duration: z.number().int().openapi({
      description: "Duration in ticks (20 = 1 second)",
      example: 3600,
    }),
    amplifier: z.number().int().min(0).openapi({
      description: "Effect amplifier (0 = level 1)",
      example: 0,
    }),
    ambient: z.boolean().optional().openapi({
      description: "Whether particles are less visible (beacon effect)",
      example: false,
    }),
    showParticles: z.boolean().optional().openapi({
      description: "Whether to show particles",
      example: true,
    }),
    showIcon: z.boolean().optional().openapi({
      description: "Whether to show icon in HUD",
      example: true,
    }),
  })
  .openapi("PotionEffectInstance")

export type PotionEffectInstance = z.infer<typeof PotionEffectInstanceSchema>

/**
 * Potion type
 */
export const PotionTypeSchema = z
  .enum(["normal", "splash", "lingering"])
  .openapi({
    description: "Potion item type",
    example: "normal",
  })

export type PotionType = z.infer<typeof PotionTypeSchema>

/**
 * Potion schema
 */
export const PotionSchema = z
  .object({
    id: NamespacedIdSchema.openapi({
      description: "Namespaced potion ID",
      example: "minecraft:swiftness",
    }),
    edition: EditionSchema,
    name: LocalizedTextSchema,
    effects: z.array(PotionEffectInstanceSchema).openapi({
      description: "Effects applied by this potion",
    }),
    baseColor: z.number().int().optional().openapi({
      description: "Base potion color as integer",
      example: 2293580,
    }),
    baseColorHex: z.string().optional().openapi({
      description: "Base potion color as hex string",
      example: "#22FC5C",
    }),
    isExtended: z.boolean().optional().openapi({
      description: "Whether this is the extended duration variant",
      example: false,
    }),
    isStrong: z.boolean().optional().openapi({
      description: "Whether this is the strong (level II) variant",
      example: false,
    }),
    basePotion: NamespacedIdSchema.optional().openapi({
      description: "Base potion for variants",
      example: "minecraft:swiftness",
    }),
    brewingIngredient: NamespacedIdSchema.optional().openapi({
      description: "Ingredient to brew this potion",
      example: "minecraft:sugar",
    }),
    brewingBase: NamespacedIdSchema.optional().openapi({
      description: "Base potion for brewing",
      example: "minecraft:awkward",
    }),
    tags: z.array(NamespacedIdSchema).optional().openapi({
      description: "Potion tags",
    }),
    bedrockMeta: BedrockMetaSchema.optional(),
    bedrockChanges: z.array(BedrockChangeSchema).optional(),
  })
  .openapi("Potion")

export type Potion = z.infer<typeof PotionSchema>

/**
 * Effect query parameters
 */
export const EffectQuerySchema = z.object({
  edition: EditionSchema.optional(),
  version: z.string().optional().openapi({
    description: "Minecraft version",
    example: "1.20.4",
  }),
  category: EffectCategorySchema.optional(),
  tag: z.string().optional().openapi({
    description: "Filter by effect tag",
    example: "minecraft:positive_effects",
  }),
  q: z.string().optional().openapi({
    description: "Search query for effect name/ID",
    example: "speed",
  }),
  locale: z.string().optional().openapi({
    description: "Locale for name search",
    example: "en_us",
  }),
  isInstant: z.string().optional().openapi({
    description: "Filter instant effects",
    example: "false",
  }),
})

export type EffectQuery = z.infer<typeof EffectQuerySchema>

/**
 * Effect path parameters
 */
export const EffectPathParamsSchema = z.object({
  id: z.string().openapi({
    description: "Effect ID (with or without namespace)",
    example: "speed",
  }),
})

export type EffectPathParams = z.infer<typeof EffectPathParamsSchema>

/**
 * Effect list response
 */
export const EffectListResponseSchema = z
  .object({
    effects: z.array(EffectSchema),
    pagination: z
      .object({
        total: z.number().int(),
        limit: z.number().int(),
        offset: z.number().int(),
        hasMore: z.boolean(),
      })
      .optional(),
  })
  .openapi("EffectListResponse")

export type EffectListResponse = z.infer<typeof EffectListResponseSchema>

/**
 * Potion query parameters
 */
export const PotionQuerySchema = z.object({
  edition: EditionSchema.optional(),
  version: z.string().optional().openapi({
    description: "Minecraft version",
    example: "1.20.4",
  }),
  tag: z.string().optional().openapi({
    description: "Filter by potion tag",
    example: "minecraft:positive_effects",
  }),
  q: z.string().optional().openapi({
    description: "Search query for potion name/ID",
    example: "swiftness",
  }),
  locale: z.string().optional().openapi({
    description: "Locale for name search",
    example: "en_us",
  }),
  hasEffect: z.string().optional().openapi({
    description: "Filter potions with specific effect",
    example: "minecraft:speed",
  }),
  isExtended: z.string().optional().openapi({
    description: "Filter extended duration potions",
    example: "true",
  }),
  isStrong: z.string().optional().openapi({
    description: "Filter strong (level II) potions",
    example: "false",
  }),
})

export type PotionQuery = z.infer<typeof PotionQuerySchema>

/**
 * Potion path parameters
 */
export const PotionPathParamsSchema = z.object({
  id: z.string().openapi({
    description: "Potion ID (with or without namespace)",
    example: "swiftness",
  }),
})

export type PotionPathParams = z.infer<typeof PotionPathParamsSchema>

/**
 * Potion list response
 */
export const PotionListResponseSchema = z
  .object({
    potions: z.array(PotionSchema),
    pagination: z
      .object({
        total: z.number().int(),
        limit: z.number().int(),
        offset: z.number().int(),
        hasMore: z.boolean(),
      })
      .optional(),
  })
  .openapi("PotionListResponse")

export type PotionListResponse = z.infer<typeof PotionListResponseSchema>
