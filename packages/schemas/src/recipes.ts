import { z } from "@hono/zod-openapi"
import {
  BedrockChangeSchema,
  BedrockMetaSchema,
  EditionSchema,
  NamespacedIdSchema,
} from "./common.js"

/**
 * Recipe type discriminator
 */
export const RecipeTypeSchema = z
  .enum([
    "crafting_shaped",
    "crafting_shapeless",
    "smelting",
    "blasting",
    "smoking",
    "campfire_cooking",
    "stonecutting",
    "smithing_transform",
    "smithing_trim",
  ])
  .openapi({
    description: "Type of recipe",
    example: "crafting_shaped",
  })

export type RecipeType = z.infer<typeof RecipeTypeSchema>

/**
 * Recipe ingredient (item or tag reference)
 */
export const RecipeIngredientSchema = z
  .object({
    item: NamespacedIdSchema.optional().openapi({
      description: "Specific item ID",
      example: "minecraft:diamond",
    }),
    tag: NamespacedIdSchema.optional().openapi({
      description: "Item tag reference",
      example: "minecraft:planks",
    }),
    count: z.number().int().min(1).optional().openapi({
      description: "Required count (default: 1)",
      example: 1,
    }),
  })
  .refine((data) => data.item || data.tag, {
    message: "Either item or tag must be specified",
  })
  .openapi("RecipeIngredient")

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>

/**
 * Recipe result
 */
export const RecipeResultSchema = z
  .object({
    item: NamespacedIdSchema.openapi({
      description: "Result item ID",
      example: "minecraft:diamond_sword",
    }),
    count: z.number().int().min(1).optional().openapi({
      description: "Result count (default: 1)",
      example: 1,
    }),
  })
  .openapi("RecipeResult")

export type RecipeResult = z.infer<typeof RecipeResultSchema>

/**
 * Base recipe fields shared by all recipe types
 */
const BaseRecipeSchema = z.object({
  id: NamespacedIdSchema.openapi({
    description: "Recipe ID",
    example: "minecraft:diamond_sword",
  }),
  edition: EditionSchema,
  group: z.string().optional().openapi({
    description: "Recipe group for recipe book",
    example: "wooden_slab",
  }),
  category: z.string().optional().openapi({
    description: "Recipe category",
    example: "equipment",
  }),
  bedrockMeta: BedrockMetaSchema.optional(),
  bedrockChanges: z.array(BedrockChangeSchema).optional(),
})

/**
 * Shaped crafting recipe (crafting table with pattern)
 */
export const ShapedRecipeSchema = BaseRecipeSchema.extend({
  type: z.literal("crafting_shaped").openapi({
    example: "crafting_shaped",
  }),
  pattern: z
    .array(z.string())
    .min(1)
    .max(3)
    .openapi({
      description: "Crafting pattern (1-3 rows)",
      example: [" D ", " D ", " S "],
    }),
  key: z.record(z.string(), RecipeIngredientSchema).openapi({
    description: "Pattern key to ingredient mapping",
  }),
  result: RecipeResultSchema,
}).openapi("ShapedRecipe")

export type ShapedRecipe = z.infer<typeof ShapedRecipeSchema>

/**
 * Shapeless crafting recipe (order doesn't matter)
 */
export const ShapelessRecipeSchema = BaseRecipeSchema.extend({
  type: z.literal("crafting_shapeless").openapi({
    example: "crafting_shapeless",
  }),
  ingredients: z.array(RecipeIngredientSchema).min(1).max(9).openapi({
    description: "List of ingredients (order doesn't matter)",
  }),
  result: RecipeResultSchema,
}).openapi("ShapelessRecipe")

export type ShapelessRecipe = z.infer<typeof ShapelessRecipeSchema>

/**
 * Base cooking recipe fields
 */
const BaseCookingRecipeSchema = BaseRecipeSchema.extend({
  ingredient: RecipeIngredientSchema,
  result: RecipeResultSchema,
  experience: z.number().min(0).openapi({
    description: "Experience gained when collecting result",
    example: 0.7,
  }),
  cookingTime: z.number().int().min(0).openapi({
    description: "Cooking time in ticks",
    example: 200,
  }),
})

/**
 * Furnace smelting recipe
 */
export const SmeltingRecipeSchema = BaseCookingRecipeSchema.extend({
  type: z.literal("smelting").openapi({
    example: "smelting",
  }),
}).openapi("SmeltingRecipe")

export type SmeltingRecipe = z.infer<typeof SmeltingRecipeSchema>

/**
 * Blast furnace recipe
 */
export const BlastingRecipeSchema = BaseCookingRecipeSchema.extend({
  type: z.literal("blasting").openapi({
    example: "blasting",
  }),
}).openapi("BlastingRecipe")

export type BlastingRecipe = z.infer<typeof BlastingRecipeSchema>

/**
 * Smoker recipe
 */
export const SmokingRecipeSchema = BaseCookingRecipeSchema.extend({
  type: z.literal("smoking").openapi({
    example: "smoking",
  }),
}).openapi("SmokingRecipe")

export type SmokingRecipe = z.infer<typeof SmokingRecipeSchema>

/**
 * Campfire cooking recipe
 */
export const CampfireCookingRecipeSchema = BaseCookingRecipeSchema.extend({
  type: z.literal("campfire_cooking").openapi({
    example: "campfire_cooking",
  }),
}).openapi("CampfireCookingRecipe")

export type CampfireCookingRecipe = z.infer<typeof CampfireCookingRecipeSchema>

/**
 * Stonecutter recipe
 */
export const StonecuttingRecipeSchema = BaseRecipeSchema.extend({
  type: z.literal("stonecutting").openapi({
    example: "stonecutting",
  }),
  ingredient: RecipeIngredientSchema,
  result: RecipeResultSchema,
}).openapi("StonecuttingRecipe")

export type StonecuttingRecipe = z.infer<typeof StonecuttingRecipeSchema>

/**
 * Smithing transform recipe (netherite upgrades)
 */
export const SmithingTransformRecipeSchema = BaseRecipeSchema.extend({
  type: z.literal("smithing_transform").openapi({
    example: "smithing_transform",
  }),
  template: RecipeIngredientSchema.openapi({
    description: "Smithing template item",
  }),
  base: RecipeIngredientSchema.openapi({
    description: "Base item to upgrade",
  }),
  addition: RecipeIngredientSchema.openapi({
    description: "Material to add (e.g., netherite ingot)",
  }),
  result: RecipeResultSchema,
}).openapi("SmithingTransformRecipe")

export type SmithingTransformRecipe = z.infer<
  typeof SmithingTransformRecipeSchema
>

/**
 * Smithing trim recipe (armor trims)
 */
export const SmithingTrimRecipeSchema = BaseRecipeSchema.extend({
  type: z.literal("smithing_trim").openapi({
    example: "smithing_trim",
  }),
  template: RecipeIngredientSchema.openapi({
    description: "Trim pattern template",
  }),
  base: RecipeIngredientSchema.openapi({
    description: "Armor piece to trim",
  }),
  addition: RecipeIngredientSchema.openapi({
    description: "Trim material (e.g., amethyst shard)",
  }),
}).openapi("SmithingTrimRecipe")

export type SmithingTrimRecipe = z.infer<typeof SmithingTrimRecipeSchema>

/**
 * Unified recipe schema (discriminated union)
 */
export const RecipeSchema = z
  .discriminatedUnion("type", [
    ShapedRecipeSchema,
    ShapelessRecipeSchema,
    SmeltingRecipeSchema,
    BlastingRecipeSchema,
    SmokingRecipeSchema,
    CampfireCookingRecipeSchema,
    StonecuttingRecipeSchema,
    SmithingTransformRecipeSchema,
    SmithingTrimRecipeSchema,
  ])
  .openapi("Recipe")

export type Recipe = z.infer<typeof RecipeSchema>

/**
 * Recipe query parameters
 */
export const RecipeQuerySchema = z.object({
  edition: EditionSchema.optional(),
  version: z.string().optional().openapi({
    description: "Minecraft version",
    example: "1.20.4",
  }),
  type: RecipeTypeSchema.optional(),
  result: z.string().optional().openapi({
    description: "Filter by result item ID",
    example: "minecraft:diamond_sword",
  }),
  ingredient: z.string().optional().openapi({
    description: "Filter by ingredient item ID or tag",
    example: "minecraft:diamond",
  }),
  group: z.string().optional().openapi({
    description: "Filter by recipe group",
    example: "wooden_slab",
  }),
})

export type RecipeQuery = z.infer<typeof RecipeQuerySchema>

/**
 * Recipe path parameters
 */
export const RecipePathParamsSchema = z.object({
  id: z.string().openapi({
    description: "Recipe ID (with or without namespace)",
    example: "diamond_sword",
  }),
})

export type RecipePathParams = z.infer<typeof RecipePathParamsSchema>

/**
 * Recipe list response
 */
export const RecipeListResponseSchema = z
  .object({
    recipes: z.array(RecipeSchema),
    pagination: z
      .object({
        total: z.number().int(),
        limit: z.number().int(),
        offset: z.number().int(),
        hasMore: z.boolean(),
      })
      .optional(),
  })
  .openapi("RecipeListResponse")

export type RecipeListResponse = z.infer<typeof RecipeListResponseSchema>
