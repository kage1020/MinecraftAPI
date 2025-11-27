import { z } from "@hono/zod-openapi"

/**
 * Minecraft edition discriminator
 */
export const EditionSchema = z
  .enum(["JAVA", "BEDROCK"])
  .openapi({ description: "Minecraft edition", example: "JAVA" })

export type Edition = z.infer<typeof EditionSchema>

/**
 * Localized text map (language code -> text)
 */
export const LocalizedTextSchema = z.record(z.string(), z.string()).openapi({
  description: "Localized text keyed by language code (e.g., 'en_us', 'ja_jp')",
  example: { en_us: "Diamond Sword", ja_jp: "ダイヤモンドの剣" },
})

export type LocalizedText = z.infer<typeof LocalizedTextSchema>

/**
 * Bedrock edition metadata for cumulative tracking
 */
export const BedrockMetaSchema = z
  .object({
    addedIn: z.string().openapi({
      description: "Version when this element was added",
      example: "1.16.0",
    }),
    removedIn: z.string().optional().openapi({
      description: "Version when this element was removed (if applicable)",
      example: "1.19.0",
    }),
    lastModifiedIn: z.string().openapi({
      description: "Version when this element was last modified",
      example: "1.20.0",
    }),
  })
  .openapi("BedrockMeta")

export type BedrockMeta = z.infer<typeof BedrockMetaSchema>

/**
 * Bedrock changelog entry
 */
export const BedrockChangeSchema = z
  .object({
    version: z.string().openapi({
      description: "Version of the change",
      example: "1.20.0",
    }),
    type: z.enum(["added", "modified", "removed"]).openapi({
      description: "Type of change",
      example: "modified",
    }),
    field: z.string().optional().openapi({
      description: "Specific field that was changed",
      example: "stackSize",
    }),
    oldValue: z.unknown().optional().openapi({
      description: "Previous value before the change",
    }),
    newValue: z.unknown().optional().openapi({
      description: "New value after the change",
    }),
  })
  .openapi("BedrockChange")

export type BedrockChange = z.infer<typeof BedrockChangeSchema>

/**
 * Pagination parameters for list queries
 */
export const PaginationQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val, 10) : 100))
    .pipe(z.number().int().min(1).max(1000))
    .openapi({
      description: "Maximum number of items to return",
      example: "100",
    }),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val, 10) : 0))
    .pipe(z.number().int().min(0))
    .openapi({
      description: "Number of items to skip",
      example: "0",
    }),
})

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>

/**
 * Pagination metadata in responses
 */
export const PaginationMetaSchema = z
  .object({
    total: z.number().int().min(0).openapi({
      description: "Total number of items available",
      example: 1500,
    }),
    limit: z.number().int().min(1).max(1000).openapi({
      description: "Number of items per page",
      example: 100,
    }),
    offset: z.number().int().min(0).openapi({
      description: "Number of items skipped",
      example: 0,
    }),
    hasMore: z.boolean().openapi({
      description: "Whether there are more items available",
      example: true,
    }),
  })
  .openapi("PaginationMeta")

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>

/**
 * Standard error response
 */
export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({
        description: "Error code identifier",
        example: "NOT_FOUND",
      }),
      message: z.string().openapi({
        description: "Human-readable error message",
        example: "Item not found",
      }),
      details: z.unknown().optional().openapi({
        description: "Additional error details",
      }),
    }),
  })
  .openapi("Error")

export type ErrorResponse = z.infer<typeof ErrorSchema>

/**
 * Common query parameters for filtering by edition and version
 */
export const EditionVersionQuerySchema = z.object({
  edition: EditionSchema.optional().openapi({
    description: "Filter by Minecraft edition",
    example: "JAVA",
  }),
  version: z.string().optional().openapi({
    description: "Filter by Minecraft version",
    example: "1.20.4",
  }),
})

export type EditionVersionQuery = z.infer<typeof EditionVersionQuerySchema>

/**
 * Namespaced ID format (e.g., minecraft:diamond_sword)
 */
export const NamespacedIdSchema = z
  .string()
  .regex(/^[a-z_][a-z0-9_]*:[a-z_][a-z0-9_/]*$/)
  .openapi({
    description: "Namespaced ID in format 'namespace:path'",
    example: "minecraft:diamond_sword",
  })

export type NamespacedId = z.infer<typeof NamespacedIdSchema>

/**
 * Search query parameter
 */
export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(100).optional().openapi({
    description: "Search query string",
    example: "diamond",
  }),
})

export type SearchQuery = z.infer<typeof SearchQuerySchema>

/**
 * Locale query parameter
 */
export const LocaleQuerySchema = z.object({
  locale: z.string().optional().default("en_us").openapi({
    description: "Locale code for localized text",
    example: "en_us",
  }),
})

export type LocaleQuery = z.infer<typeof LocaleQuerySchema>
