import { z } from "@hono/zod-openapi"
import {
  BedrockChangeSchema,
  BedrockMetaSchema,
  EditionSchema,
  LocalizedTextSchema,
  NamespacedIdSchema,
} from "./common.js"

/**
 * Item rarity tiers
 */
export const ItemRaritySchema = z
  .enum(["common", "uncommon", "rare", "epic"])
  .openapi({
    description: "Item rarity tier affecting name color",
    example: "common",
  })

export type ItemRarity = z.infer<typeof ItemRaritySchema>

/**
 * Equipment slot types
 */
export const EquipmentSlotSchema = z
  .enum(["mainhand", "offhand", "head", "chest", "legs", "feet"])
  .openapi({
    description: "Equipment slot for wearable/holdable items",
    example: "mainhand",
  })

export type EquipmentSlot = z.infer<typeof EquipmentSlotSchema>

/**
 * Item creative mode tab/category
 */
export const ItemCategorySchema = z
  .enum([
    "building_blocks",
    "colored_blocks",
    "natural_blocks",
    "functional_blocks",
    "redstone_blocks",
    "tools_and_utilities",
    "combat",
    "food_and_drinks",
    "ingredients",
    "spawn_eggs",
    "operator_utilities",
  ])
  .openapi({
    description: "Creative mode inventory category",
    example: "combat",
  })

export type ItemCategory = z.infer<typeof ItemCategorySchema>

/**
 * Food properties for consumable items
 */
export const FoodPropertiesSchema = z
  .object({
    nutrition: z.number().int().min(0).openapi({
      description: "Hunger points restored",
      example: 8,
    }),
    saturation: z.number().openapi({
      description: "Saturation modifier",
      example: 12.8,
    }),
    canAlwaysEat: z.boolean().optional().openapi({
      description: "Whether the item can be eaten when not hungry",
      example: false,
    }),
    eatDurationTicks: z.number().int().optional().openapi({
      description: "Time to consume in ticks (20 ticks = 1 second)",
      example: 32,
    }),
    effects: z
      .array(
        z.object({
          effect: NamespacedIdSchema.openapi({
            description: "Effect ID",
            example: "minecraft:poison",
          }),
          duration: z.number().int().openapi({
            description: "Effect duration in ticks",
            example: 100,
          }),
          amplifier: z.number().int().openapi({
            description: "Effect amplifier level (0 = level 1)",
            example: 0,
          }),
          probability: z.number().min(0).max(1).openapi({
            description: "Chance of applying the effect",
            example: 1.0,
          }),
        }),
      )
      .optional()
      .openapi({
        description: "Status effects applied when consumed",
      }),
  })
  .openapi("FoodProperties")

export type FoodProperties = z.infer<typeof FoodPropertiesSchema>

/**
 * Tool properties for tools/weapons
 */
export const ToolPropertiesSchema = z
  .object({
    tier: z
      .enum(["wood", "stone", "iron", "gold", "diamond", "netherite"])
      .optional()
      .openapi({
        description: "Tool material tier",
        example: "diamond",
      }),
    durability: z.number().int().min(0).openapi({
      description: "Maximum durability",
      example: 1561,
    }),
    attackDamage: z.number().optional().openapi({
      description: "Base attack damage",
      example: 7,
    }),
    attackSpeed: z.number().optional().openapi({
      description: "Attack speed modifier",
      example: 1.6,
    }),
    miningSpeed: z.number().optional().openapi({
      description: "Mining speed multiplier",
      example: 8,
    }),
    enchantability: z.number().int().optional().openapi({
      description: "Enchantability value",
      example: 10,
    }),
  })
  .openapi("ToolProperties")

export type ToolProperties = z.infer<typeof ToolPropertiesSchema>

/**
 * Armor properties for protective items
 */
export const ArmorPropertiesSchema = z
  .object({
    slot: EquipmentSlotSchema,
    defense: z.number().int().min(0).openapi({
      description: "Defense points provided",
      example: 3,
    }),
    toughness: z.number().min(0).optional().openapi({
      description: "Armor toughness value",
      example: 2,
    }),
    knockbackResistance: z.number().min(0).max(1).optional().openapi({
      description: "Knockback resistance (0-1)",
      example: 0.1,
    }),
    durability: z.number().int().min(0).openapi({
      description: "Maximum durability",
      example: 407,
    }),
    enchantability: z.number().int().optional().openapi({
      description: "Enchantability value",
      example: 10,
    }),
  })
  .openapi("ArmorProperties")

export type ArmorProperties = z.infer<typeof ArmorPropertiesSchema>

/**
 * Fuel properties for furnace fuel items
 */
export const FuelPropertiesSchema = z
  .object({
    burnTime: z.number().int().min(0).openapi({
      description: "Burn time in ticks (200 = smelt 1 item)",
      example: 1600,
    }),
  })
  .openapi("FuelProperties")

export type FuelProperties = z.infer<typeof FuelPropertiesSchema>

/**
 * Item schema
 */
export const ItemSchema = z
  .object({
    id: NamespacedIdSchema.openapi({
      description: "Namespaced item ID",
      example: "minecraft:diamond_sword",
    }),
    edition: EditionSchema,
    name: LocalizedTextSchema.openapi({
      description: "Localized display names",
    }),
    description: LocalizedTextSchema.optional().openapi({
      description: "Localized item description/lore",
    }),
    stackSize: z.number().int().min(1).max(64).openapi({
      description: "Maximum stack size",
      example: 1,
    }),
    rarity: ItemRaritySchema.optional(),
    category: ItemCategorySchema.optional(),
    isFireResistant: z.boolean().optional().openapi({
      description: "Whether the item survives in fire/lava",
      example: true,
    }),
    food: FoodPropertiesSchema.optional(),
    tool: ToolPropertiesSchema.optional(),
    armor: ArmorPropertiesSchema.optional(),
    fuel: FuelPropertiesSchema.optional(),
    tags: z.array(NamespacedIdSchema).optional().openapi({
      description: "Item tags for grouping (e.g., minecraft:swords)",
    }),
    bedrockMeta: BedrockMetaSchema.optional(),
    bedrockChanges: z.array(BedrockChangeSchema).optional(),
  })
  .openapi("Item")

export type Item = z.infer<typeof ItemSchema>

/**
 * Item query parameters
 */
export const ItemQuerySchema = z.object({
  edition: EditionSchema.optional(),
  version: z.string().optional().openapi({
    description: "Minecraft version",
    example: "1.20.4",
  }),
  category: ItemCategorySchema.optional(),
  tag: z.string().optional().openapi({
    description: "Filter by item tag",
    example: "minecraft:swords",
  }),
  q: z.string().optional().openapi({
    description: "Search query for item name/ID",
    example: "diamond",
  }),
  locale: z.string().optional().openapi({
    description: "Locale for name search",
    example: "en_us",
  }),
})

export type ItemQuery = z.infer<typeof ItemQuerySchema>

/**
 * Item path parameters
 */
export const ItemPathParamsSchema = z.object({
  id: z.string().openapi({
    description: "Item ID (with or without namespace)",
    example: "diamond_sword",
  }),
})

export type ItemPathParams = z.infer<typeof ItemPathParamsSchema>

/**
 * Item list response
 */
export const ItemListResponseSchema = z
  .object({
    items: z.array(ItemSchema),
    pagination: z
      .object({
        total: z.number().int(),
        limit: z.number().int(),
        offset: z.number().int(),
        hasMore: z.boolean(),
      })
      .optional(),
  })
  .openapi("ItemListResponse")

export type ItemListResponse = z.infer<typeof ItemListResponseSchema>
