import { z } from "@hono/zod-openapi"
import { BedrockMetaSchema } from "./common.js"

/**
 * Version type for Java Edition
 */
export const JavaVersionTypeSchema = z
  .enum(["release", "snapshot", "old_beta", "old_alpha"])
  .openapi({
    description: "Type of Java Edition version",
    example: "release",
  })

export type JavaVersionType = z.infer<typeof JavaVersionTypeSchema>

/**
 * Java Edition version schema
 */
export const JavaVersionSchema = z
  .object({
    edition: z.literal("JAVA").openapi({
      description: "Minecraft edition",
      example: "JAVA",
    }),
    id: z.string().openapi({
      description: "Version identifier",
      example: "1.20.4",
    }),
    type: JavaVersionTypeSchema,
    releaseTime: z.string().datetime().openapi({
      description: "ISO 8601 release timestamp",
      example: "2023-12-07T12:56:20+00:00",
    }),
    sha1: z.string().optional().openapi({
      description: "SHA1 hash of the client JAR",
      example: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
    }),
    complianceLevel: z.number().int().optional().openapi({
      description: "Compliance level for account restrictions",
      example: 1,
    }),
    dataVersion: z.number().int().optional().openapi({
      description: "Internal data version number for world upgrades",
      example: 3700,
    }),
    protocolVersion: z.number().int().optional().openapi({
      description: "Protocol version for multiplayer",
      example: 765,
    }),
  })
  .openapi("JavaVersion")

export type JavaVersion = z.infer<typeof JavaVersionSchema>

/**
 * Platform for Bedrock Edition
 */
export const BedrockPlatformSchema = z
  .enum(["android", "ios", "windows", "xbox", "playstation", "switch"])
  .openapi({
    description: "Bedrock Edition platform",
    example: "android",
  })

export type BedrockPlatform = z.infer<typeof BedrockPlatformSchema>

/**
 * Bedrock Edition version schema
 */
export const BedrockVersionSchema = z
  .object({
    edition: z.literal("BEDROCK").openapi({
      description: "Minecraft edition",
      example: "BEDROCK",
    }),
    id: z.string().openapi({
      description: "Version identifier",
      example: "1.20.50",
    }),
    releaseTime: z.string().datetime().openapi({
      description: "ISO 8601 release timestamp",
      example: "2023-12-05T00:00:00+00:00",
    }),
    platforms: z.array(BedrockPlatformSchema).optional().openapi({
      description: "Platforms this version is available on",
    }),
    protocolVersion: z.number().int().optional().openapi({
      description: "Protocol version for multiplayer",
      example: 630,
    }),
    bedrockMeta: BedrockMetaSchema.optional().openapi({
      description: "Bedrock cumulative tracking metadata",
    }),
  })
  .openapi("BedrockVersion")

export type BedrockVersion = z.infer<typeof BedrockVersionSchema>

/**
 * Unified version schema (discriminated union)
 */
export const VersionSchema = z
  .discriminatedUnion("edition", [JavaVersionSchema, BedrockVersionSchema])
  .openapi("Version")

export type Version = z.infer<typeof VersionSchema>

/**
 * Version list response
 */
export const VersionListResponseSchema = z
  .object({
    versions: z.array(VersionSchema),
    latest: z
      .object({
        java: z
          .object({
            release: z.string().openapi({
              description: "Latest Java release version",
              example: "1.20.4",
            }),
            snapshot: z.string().optional().openapi({
              description: "Latest Java snapshot version",
              example: "24w04a",
            }),
          })
          .optional(),
        bedrock: z.string().optional().openapi({
          description: "Latest Bedrock version",
          example: "1.20.50",
        }),
      })
      .optional(),
  })
  .openapi("VersionListResponse")

export type VersionListResponse = z.infer<typeof VersionListResponseSchema>

/**
 * Version query parameters
 */
export const VersionQuerySchema = z.object({
  edition: z.enum(["JAVA", "BEDROCK"]).optional().openapi({
    description: "Filter by edition",
    example: "JAVA",
  }),
  type: JavaVersionTypeSchema.optional().openapi({
    description: "Filter by version type (Java only)",
    example: "release",
  }),
  after: z.string().optional().openapi({
    description: "Filter versions released after this date (ISO 8601)",
    example: "2023-01-01",
  }),
  before: z.string().optional().openapi({
    description: "Filter versions released before this date (ISO 8601)",
    example: "2024-01-01",
  }),
})

export type VersionQuery = z.infer<typeof VersionQuerySchema>

/**
 * Version path parameters
 */
export const VersionPathParamsSchema = z.object({
  edition: z.enum(["java", "bedrock"]).openapi({
    description: "Minecraft edition (lowercase)",
    example: "java",
  }),
  version: z.string().openapi({
    description: "Version identifier",
    example: "1.20.4",
  }),
})

export type VersionPathParams = z.infer<typeof VersionPathParamsSchema>
