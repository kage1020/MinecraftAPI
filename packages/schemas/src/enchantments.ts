import { z } from "@hono/zod-openapi"
import {
  BedrockChangeSchema,
  BedrockMetaSchema,
  EditionSchema,
  LocalizedTextSchema,
  NamespacedIdSchema,
} from "./common.js"
import { ItemRaritySchema } from "./items.js"

/**
 * Enchantment target (what can be enchanted)
 */
export const EnchantmentTargetSchema = z
  .enum([
    "armor",
    "armor_feet",
    "armor_legs",
    "armor_chest",
    "armor_head",
    "weapon",
    "digger",
    "fishing_rod",
    "trident",
    "breakable",
    "bow",
    "wearable",
    "crossbow",
    "vanishable",
  ])
  .openapi({
    description: "Target item type for enchantment",
    example: "weapon",
  })

export type EnchantmentTarget = z.infer<typeof EnchantmentTargetSchema>

/**
 * Enchantment category for UI grouping
 */
export const EnchantmentCategorySchema = z
  .enum([
    "armor",
    "weapon",
    "tool",
    "bow",
    "fishing",
    "trident",
    "crossbow",
    "universal",
  ])
  .openapi({
    description: "Enchantment category",
    example: "weapon",
  })

export type EnchantmentCategory = z.infer<typeof EnchantmentCategorySchema>

/**
 * Enchantment level cost function
 */
export const EnchantmentCostSchema = z
  .object({
    base: z.number().int().openapi({
      description: "Base cost",
      example: 1,
    }),
    perLevelAboveFirst: z.number().int().openapi({
      description: "Additional cost per level",
      example: 11,
    }),
  })
  .openapi("EnchantmentCost")

export type EnchantmentCost = z.infer<typeof EnchantmentCostSchema>

/**
 * Enchantment effect modifier
 */
export const EnchantmentEffectSchema = z
  .object({
    type: z.string().openapi({
      description: "Effect type",
      example: "damage",
    }),
    perLevel: z.number().openapi({
      description: "Effect value per level",
      example: 2.5,
    }),
    affectsType: z.string().optional().openapi({
      description: "Target entity type (for damage enchantments)",
      example: "undead",
    }),
  })
  .openapi("EnchantmentEffect")

export type EnchantmentEffect = z.infer<typeof EnchantmentEffectSchema>

/**
 * Enchantment schema
 */
export const EnchantmentSchema = z
  .object({
    id: NamespacedIdSchema.openapi({
      description: "Namespaced enchantment ID",
      example: "minecraft:sharpness",
    }),
    edition: EditionSchema,
    name: LocalizedTextSchema,
    description: LocalizedTextSchema.optional().openapi({
      description: "Enchantment description",
    }),
    maxLevel: z.number().int().min(1).openapi({
      description: "Maximum enchantment level",
      example: 5,
    }),
    minLevel: z.number().int().min(1).optional().openapi({
      description: "Minimum enchantment level (usually 1)",
      example: 1,
    }),
    rarity: ItemRaritySchema.optional().openapi({
      description: "Enchantment rarity affecting availability",
    }),
    category: EnchantmentCategorySchema.optional(),
    targets: z.array(EnchantmentTargetSchema).optional().openapi({
      description: "Valid item types",
    }),
    applicableItems: z.array(NamespacedIdSchema).optional().openapi({
      description: "Specific items that can have this enchantment",
    }),
    primaryItems: z.array(NamespacedIdSchema).optional().openapi({
      description: "Items that can get this from enchanting table",
    }),
    incompatibleWith: z
      .array(NamespacedIdSchema)
      .optional()
      .openapi({
        description: "Mutually exclusive enchantments",
        example: ["minecraft:smite", "minecraft:bane_of_arthropods"],
      }),
    isTreasure: z.boolean().optional().openapi({
      description: "Only found in loot/trading, not enchanting table",
      example: false,
    }),
    isCurse: z.boolean().optional().openapi({
      description: "Whether this is a curse enchantment",
      example: false,
    }),
    isTradeable: z.boolean().optional().openapi({
      description: "Can be obtained from villager trading",
      example: true,
    }),
    isDiscoverable: z.boolean().optional().openapi({
      description: "Can be found in loot",
      example: true,
    }),
    weight: z.number().int().min(1).optional().openapi({
      description: "Weight for random selection (higher = more common)",
      example: 10,
    }),
    minCost: EnchantmentCostSchema.optional().openapi({
      description: "Minimum enchanting cost",
    }),
    maxCost: EnchantmentCostSchema.optional().openapi({
      description: "Maximum enchanting cost",
    }),
    anvilCost: z.number().int().optional().openapi({
      description: "Experience cost multiplier for anvil",
      example: 1,
    }),
    effects: z.array(EnchantmentEffectSchema).optional().openapi({
      description: "Enchantment effects",
    }),
    tags: z.array(NamespacedIdSchema).optional().openapi({
      description: "Enchantment tags",
    }),
    bedrockMeta: BedrockMetaSchema.optional(),
    bedrockChanges: z.array(BedrockChangeSchema).optional(),
  })
  .openapi("Enchantment")

export type Enchantment = z.infer<typeof EnchantmentSchema>

/**
 * Enchantment query parameters
 */
export const EnchantmentQuerySchema = z.object({
  edition: EditionSchema.optional(),
  version: z.string().optional().openapi({
    description: "Minecraft version",
    example: "1.20.4",
  }),
  category: EnchantmentCategorySchema.optional(),
  target: EnchantmentTargetSchema.optional(),
  tag: z.string().optional().openapi({
    description: "Filter by enchantment tag",
    example: "minecraft:weapon_enchantable",
  }),
  q: z.string().optional().openapi({
    description: "Search query for enchantment name/ID",
    example: "sharpness",
  }),
  locale: z.string().optional().openapi({
    description: "Locale for name search",
    example: "en_us",
  }),
  isTreasure: z.string().optional().openapi({
    description: "Filter treasure enchantments",
    example: "true",
  }),
  isCurse: z.string().optional().openapi({
    description: "Filter curse enchantments",
    example: "false",
  }),
  applicableTo: z.string().optional().openapi({
    description: "Filter enchantments applicable to item",
    example: "minecraft:diamond_sword",
  }),
})

export type EnchantmentQuery = z.infer<typeof EnchantmentQuerySchema>

/**
 * Enchantment path parameters
 */
export const EnchantmentPathParamsSchema = z.object({
  id: z.string().openapi({
    description: "Enchantment ID (with or without namespace)",
    example: "sharpness",
  }),
})

export type EnchantmentPathParams = z.infer<typeof EnchantmentPathParamsSchema>

/**
 * Enchantment list response
 */
export const EnchantmentListResponseSchema = z
  .object({
    enchantments: z.array(EnchantmentSchema),
    pagination: z
      .object({
        total: z.number().int(),
        limit: z.number().int(),
        offset: z.number().int(),
        hasMore: z.boolean(),
      })
      .optional(),
  })
  .openapi("EnchantmentListResponse")

export type EnchantmentListResponse = z.infer<
  typeof EnchantmentListResponseSchema
>
