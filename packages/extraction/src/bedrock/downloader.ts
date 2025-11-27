/**
 * Bedrock Edition Extractor Base
 * APK download/extraction and version detection
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import AdmZip from "adm-zip";

// ============================================================================
// Types
// ============================================================================

export interface BedrockExtractionConfig {
  /** Path to APK file (manually downloaded) */
  apkPath: string;
  /** Version string (if known) */
  version?: string;
  /** Output directory */
  outputDir: string;
}

export interface BedrockExtractionResult {
  version: string;
  extractDir: string;
  hasBehaviorPacks: boolean;
  hasResourcePacks: boolean;
  hasDefinitions: boolean;
}

export interface BedrockVersionMeta {
  /** Version string (e.g., "1.21.0") */
  version: string;
  /** Build number if available */
  buildNumber?: number;
  /** Package name */
  packageName: string;
  /** Min SDK version */
  minSdkVersion?: number;
  /** Target SDK version */
  targetSdkVersion?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Paths within Bedrock APK */
const BEDROCK_PATHS = {
  behaviorPacks: "assets/behavior_packs",
  resourcePacks: "assets/resource_packs",
  definitions: "assets/definitions",
  vanillaBehavior: "assets/behavior_packs/vanilla",
  vanillaResource: "assets/resource_packs/vanilla",
  skin_packs: "assets/skin_packs",
};

/** Patterns for extracting relevant files */
const EXTRACT_PATTERNS = [
  /^assets\/behavior_packs\/vanilla\//,
  /^assets\/resource_packs\/vanilla\//,
  /^assets\/definitions\//,
];

// ============================================================================
// APK Extractor
// ============================================================================

/**
 * Extracts Bedrock APK contents
 * @param config - Extraction configuration
 * @returns Extraction result
 */
export async function extractBedrockAPK(
  config: BedrockExtractionConfig
): Promise<BedrockExtractionResult> {
  const { apkPath, outputDir } = config;

  console.log(`Extracting Bedrock APK: ${apkPath}`);

  // Detect version from APK
  const versionMeta = await detectVersion(apkPath);
  const version = config.version || versionMeta.version;

  console.log(`Detected version: ${version}`);

  // Create extraction directory
  const extractDir = path.join(outputDir, "bedrock", version);
  await fs.mkdir(extractDir, { recursive: true });

  // Open APK (it's just a ZIP file)
  const zip = new AdmZip(apkPath);
  const entries = zip.getEntries();

  let extractedCount = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    // Check if entry matches any extraction pattern
    const matched = EXTRACT_PATTERNS.some((pattern) =>
      pattern.test(entry.entryName)
    );

    if (matched) {
      const outputPath = path.join(extractDir, entry.entryName);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, entry.getData());
      extractedCount++;
    }
  }

  console.log(`Extracted ${extractedCount} files`);

  // Check what was extracted
  const hasBehaviorPacks = await pathExists(
    path.join(extractDir, BEDROCK_PATHS.vanillaBehavior)
  );
  const hasResourcePacks = await pathExists(
    path.join(extractDir, BEDROCK_PATHS.vanillaResource)
  );
  const hasDefinitions = await pathExists(
    path.join(extractDir, BEDROCK_PATHS.definitions)
  );

  // Save version metadata
  const metaPath = path.join(extractDir, "version.json");
  await fs.writeFile(metaPath, JSON.stringify(versionMeta, null, 2));

  return {
    version,
    extractDir,
    hasBehaviorPacks,
    hasResourcePacks,
    hasDefinitions,
  };
}

/**
 * Detects version from APK
 * @param apkPath - Path to APK file
 * @returns Version metadata
 */
export async function detectVersion(apkPath: string): Promise<BedrockVersionMeta> {
  const zip = new AdmZip(apkPath);

  // Try to read AndroidManifest.xml (binary format, need to parse)
  // For simplicity, we'll try to extract version from other sources

  // Try manifest.json in behavior pack
  const manifestEntry = zip.getEntry(
    "assets/behavior_packs/vanilla/manifest.json"
  );
  if (manifestEntry) {
    try {
      const content = manifestEntry.getData().toString("utf-8");
      const manifest = JSON.parse(content);

      if (manifest.header?.version) {
        const version = Array.isArray(manifest.header.version)
          ? manifest.header.version.join(".")
          : manifest.header.version;

        return {
          version,
          packageName: "com.mojang.minecraftpe",
        };
      }
    } catch {
      // Failed to parse manifest
    }
  }

  // Try resource pack manifest
  const resourceManifestEntry = zip.getEntry(
    "assets/resource_packs/vanilla/manifest.json"
  );
  if (resourceManifestEntry) {
    try {
      const content = resourceManifestEntry.getData().toString("utf-8");
      const manifest = JSON.parse(content);

      if (manifest.header?.version) {
        const version = Array.isArray(manifest.header.version)
          ? manifest.header.version.join(".")
          : manifest.header.version;

        return {
          version,
          packageName: "com.mojang.minecraftpe",
        };
      }
    } catch {
      // Failed to parse manifest
    }
  }

  // Fallback: try to extract from APK filename
  const filename = path.basename(apkPath);
  const versionMatch = filename.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
  if (versionMatch) {
    return {
      version: versionMatch[1],
      packageName: "com.mojang.minecraftpe",
    };
  }

  // Default fallback
  return {
    version: "unknown",
    packageName: "com.mojang.minecraftpe",
  };
}

/**
 * Gets paths to extracted Bedrock data
 * @param extractDir - Extraction directory
 * @returns Object with paths to various data directories
 */
export function getBedrockPaths(extractDir: string): {
  behaviorPacks: string;
  resourcePacks: string;
  definitions: string;
  vanillaBehavior: string;
  vanillaResource: string;
} {
  return {
    behaviorPacks: path.join(extractDir, BEDROCK_PATHS.behaviorPacks),
    resourcePacks: path.join(extractDir, BEDROCK_PATHS.resourcePacks),
    definitions: path.join(extractDir, BEDROCK_PATHS.definitions),
    vanillaBehavior: path.join(extractDir, BEDROCK_PATHS.vanillaBehavior),
    vanillaResource: path.join(extractDir, BEDROCK_PATHS.vanillaResource),
  };
}

/**
 * Lists all behavior packs in APK
 * @param extractDir - Extraction directory
 * @returns Array of behavior pack names
 */
export async function listBehaviorPacks(extractDir: string): Promise<string[]> {
  const behaviorDir = path.join(extractDir, BEDROCK_PATHS.behaviorPacks);

  try {
    const entries = await fs.readdir(behaviorDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Lists all resource packs in APK
 * @param extractDir - Extraction directory
 * @returns Array of resource pack names
 */
export async function listResourcePacks(extractDir: string): Promise<string[]> {
  const resourceDir = path.join(extractDir, BEDROCK_PATHS.resourcePacks);

  try {
    const entries = await fs.readdir(resourceDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Reads a manifest.json from a pack
 * @param packDir - Pack directory
 * @returns Manifest data or null
 */
export async function readPackManifest(
  packDir: string
): Promise<PackManifest | null> {
  const manifestPath = path.join(packDir, "manifest.json");

  try {
    const content = await fs.readFile(manifestPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export interface PackManifest {
  format_version: number;
  header: {
    name: string;
    description: string;
    uuid: string;
    version: number[] | string;
    min_engine_version?: number[];
  };
  modules: Array<{
    type: string;
    uuid: string;
    version: number[] | string;
  }>;
  dependencies?: Array<{
    uuid: string;
    version: number[] | string;
  }>;
}

// ============================================================================
// Version Comparison
// ============================================================================

/**
 * Parses a Bedrock version string
 * @param version - Version string (e.g., "1.21.0.3")
 * @returns Parsed version parts
 */
export function parseBedrockVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  build?: number;
} {
  const parts = version.split(".").map(Number);

  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    build: parts[3],
  };
}

/**
 * Compares two Bedrock versions
 * @param a - First version
 * @param b - Second version
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export function compareBedrockVersions(a: string, b: string): number {
  const parsedA = parseBedrockVersion(a);
  const parsedB = parseBedrockVersion(b);

  if (parsedA.major !== parsedB.major) {
    return parsedA.major - parsedB.major;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor - parsedB.minor;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch - parsedB.patch;
  }

  const buildA = parsedA.build ?? 0;
  const buildB = parsedB.build ?? 0;

  return buildA - buildB;
}

/**
 * Checks if a Bedrock version is newer than another
 * @param version - Version to check
 * @param than - Version to compare against
 * @returns true if version is newer
 */
export function isNewerVersion(version: string, than: string): boolean {
  return compareBedrockVersions(version, than) > 0;
}

// ============================================================================
// APK Validation
// ============================================================================

/**
 * Validates that an APK is a Minecraft Bedrock APK
 * @param apkPath - Path to APK file
 * @returns Validation result
 */
export async function validateBedrockAPK(apkPath: string): Promise<{
  valid: boolean;
  reason?: string;
}> {
  try {
    const zip = new AdmZip(apkPath);

    // Check for Minecraft-specific files
    const hasVanillaBehavior = zip.getEntry(
      "assets/behavior_packs/vanilla/manifest.json"
    );
    const hasVanillaResource = zip.getEntry(
      "assets/resource_packs/vanilla/manifest.json"
    );

    if (!hasVanillaBehavior && !hasVanillaResource) {
      return {
        valid: false,
        reason: "APK does not contain Minecraft vanilla packs",
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      reason: `Failed to read APK: ${error}`,
    };
  }
}

/**
 * Gets APK file size
 * @param apkPath - Path to APK file
 * @returns File size in bytes
 */
export async function getAPKSize(apkPath: string): Promise<number> {
  const stats = await fs.stat(apkPath);
  return stats.size;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if a path exists
 * @param p - Path to check
 * @returns true if path exists
 */
async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if Bedrock data has been extracted
 * @param outputDir - Output directory
 * @param version - Version string
 * @returns true if data exists
 */
export async function bedrockDataExists(
  outputDir: string,
  version: string
): Promise<boolean> {
  const extractDir = path.join(outputDir, "bedrock", version);
  return pathExists(extractDir);
}

/**
 * Lists all extracted Bedrock versions
 * @param outputDir - Output directory
 * @returns Array of version strings
 */
export async function listExtractedVersions(
  outputDir: string
): Promise<string[]> {
  const bedrockDir = path.join(outputDir, "bedrock");

  try {
    const entries = await fs.readdir(bedrockDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && e.name !== "cumulative")
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Cleans up extracted Bedrock data
 * @param outputDir - Output directory
 * @param version - Version to clean up
 */
export async function cleanupBedrockVersion(
  outputDir: string,
  version: string
): Promise<void> {
  const extractDir = path.join(outputDir, "bedrock", version);

  try {
    await fs.rm(extractDir, { recursive: true });
    console.log(`Cleaned up Bedrock ${version}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
