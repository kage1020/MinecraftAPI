/**
 * Java Edition Data Extractor
 * Generates and parses server reports, extracts data from client JAR
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import AdmZip from "adm-zip";
import { supportsDataReports, usesNewDataPackStructure } from "../versions.js";

// ============================================================================
// Types
// ============================================================================

export interface DataExtractionConfig {
  /** Version ID */
  version: string;
  /** Path to server.jar */
  serverJarPath: string;
  /** Path to client.jar */
  clientJarPath: string;
  /** Output directory */
  outputDir: string;
  /** Java executable path */
  javaPath?: string;
  /** Timeout for report generation in ms */
  timeout?: number;
}

export interface DataExtractionResult {
  version: string;
  reportsDir: string;
  dataDir: string;
  registries: RegistryData;
  blocks: BlockReportData;
  hasRecipes: boolean;
  hasLootTables: boolean;
  hasTags: boolean;
}

export interface RegistryData {
  [registryName: string]: {
    default?: string;
    entries: Record<string, { protocol_id: number }>;
  };
}

export interface BlockReportEntry {
  properties?: Record<string, string[]>;
  states: Array<{
    id: number;
    default?: boolean;
    properties?: Record<string, string>;
  }>;
}

export interface BlockReportData {
  [blockId: string]: BlockReportEntry;
}

export interface RecipeData {
  type: string;
  group?: string;
  pattern?: string[];
  key?: Record<string, { item?: string; tag?: string } | Array<{ item?: string; tag?: string }>>;
  ingredients?: Array<{ item?: string; tag?: string } | Array<{ item?: string; tag?: string }>>;
  ingredient?: { item?: string; tag?: string } | Array<{ item?: string; tag?: string }>;
  result: { id?: string; item?: string; count?: number } | string;
  experience?: number;
  cookingtime?: number;
  template?: { item?: string; tag?: string };
  base?: { item?: string; tag?: string };
  addition?: { item?: string; tag?: string };
}

export interface LootTableData {
  type?: string;
  pools?: Array<{
    rolls: number | { min: number; max: number };
    entries: Array<{
      type: string;
      name?: string;
      functions?: unknown[];
      conditions?: unknown[];
    }>;
    conditions?: unknown[];
  }>;
}

export interface TagData {
  replace?: boolean;
  values: Array<string | { id: string; required?: boolean }>;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT = 120000; // 2 minutes
const DEFAULT_JAVA_PATH = "java";

// Data pack paths differ by version
const DATA_PATHS = {
  modern: {
    recipes: "data/minecraft/recipe",
    lootTables: "data/minecraft/loot_table",
    tags: "data/minecraft/tags",
    advancements: "data/minecraft/advancement",
    worldgen: "data/minecraft/worldgen",
  },
  legacy: {
    recipes: "data/minecraft/recipes",
    lootTables: "data/minecraft/loot_tables",
    tags: "data/minecraft/tags",
    advancements: "data/minecraft/advancements",
    worldgen: "data/minecraft/worldgen",
  },
};

// ============================================================================
// Data Extractor
// ============================================================================

/**
 * Extracts game data for a Minecraft version
 * @param config - Extraction configuration
 * @returns Extraction result
 */
export async function extractData(
  config: DataExtractionConfig
): Promise<DataExtractionResult> {
  const {
    version,
    serverJarPath,
    clientJarPath,
    outputDir,
    javaPath = DEFAULT_JAVA_PATH,
    timeout = DEFAULT_TIMEOUT,
  } = config;

  console.log(`Extracting data for ${version}...`);

  const versionDir = path.join(outputDir, version);
  const reportsDir = path.join(versionDir, "reports");
  const dataDir = path.join(versionDir, "data");

  // Generate server reports (1.13+)
  if (supportsDataReports(version)) {
    await generateServerReports(serverJarPath, reportsDir, javaPath, timeout);
  }

  // Extract data from client JAR
  await extractClientData(clientJarPath, dataDir, version);

  // Parse registries
  const registries = await parseRegistries(reportsDir);

  // Parse blocks report
  const blocks = await parseBlocksReport(reportsDir);

  // Check what data is available
  const hasRecipes = await pathExists(path.join(dataDir, "recipes")) ||
    await pathExists(path.join(dataDir, "recipe"));
  const hasLootTables = await pathExists(path.join(dataDir, "loot_tables")) ||
    await pathExists(path.join(dataDir, "loot_table"));
  const hasTags = await pathExists(path.join(dataDir, "tags"));

  return {
    version,
    reportsDir,
    dataDir,
    registries,
    blocks,
    hasRecipes,
    hasLootTables,
    hasTags,
  };
}

/**
 * Generates server reports using --reports flag
 * @param serverJarPath - Path to server.jar
 * @param outputDir - Output directory for reports
 * @param javaPath - Java executable path
 * @param timeout - Timeout in milliseconds
 */
async function generateServerReports(
  serverJarPath: string,
  outputDir: string,
  javaPath: string,
  timeout: number
): Promise<void> {
  console.log("Generating server reports...");

  await fs.mkdir(outputDir, { recursive: true });

  try {
    // The bundlerMainClass system property is needed for newer versions
    const command = `"${javaPath}" -DbundlerMainClass=net.minecraft.data.Main -jar "${serverJarPath}" --reports --output "${outputDir}"`;

    execSync(command, {
      cwd: outputDir,
      stdio: "pipe",
      timeout,
    });
  } catch (error) {
    // The server may exit with non-zero code after generating reports
    // Check if reports were actually generated
    const blocksExists = await pathExists(path.join(outputDir, "blocks.json"));
    const registriesExists =
      await pathExists(path.join(outputDir, "registries.json")) ||
      await pathExists(path.join(outputDir, "registries"));

    if (!blocksExists && !registriesExists) {
      throw new Error(`Failed to generate server reports: ${error}`);
    }
  }

  // List generated files
  const files = await fs.readdir(outputDir, { recursive: true });
  console.log(`Generated ${files.length} report files`);
}

/**
 * Extracts data from client JAR
 * @param clientJarPath - Path to client.jar
 * @param outputDir - Output directory
 * @param version - Version ID
 */
async function extractClientData(
  clientJarPath: string,
  outputDir: string,
  version: string
): Promise<void> {
  console.log("Extracting client data...");

  await fs.mkdir(outputDir, { recursive: true });

  const zip = new AdmZip(clientJarPath);
  const entries = zip.getEntries();

  // Determine which paths to use based on version
  const paths = usesNewDataPackStructure(version)
    ? DATA_PATHS.modern
    : DATA_PATHS.legacy;

  // Patterns for data extraction
  const dataPatterns = [
    new RegExp(`^${paths.recipes.replace(/\//g, "\\/")}\\/`),
    new RegExp(`^${paths.lootTables.replace(/\//g, "\\/")}\\/`),
    new RegExp(`^${paths.tags.replace(/\//g, "\\/")}\\/`),
    new RegExp(`^${paths.advancements.replace(/\//g, "\\/")}\\/`),
    new RegExp(`^${paths.worldgen.replace(/\//g, "\\/")}\\/`),
  ];

  let extractedCount = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    // Check if entry matches any data pattern
    const matched = dataPatterns.some((pattern) =>
      pattern.test(entry.entryName)
    );

    if (matched) {
      // Normalize path to consistent structure
      let relativePath = entry.entryName.replace(/^data\/minecraft\//, "");

      // Normalize legacy paths to modern structure
      if (!usesNewDataPackStructure(version)) {
        relativePath = relativePath
          .replace(/^recipes\//, "recipe/")
          .replace(/^loot_tables\//, "loot_table/")
          .replace(/^advancements\//, "advancement/");
      }

      const outputPath = path.join(outputDir, relativePath);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, entry.getData());
      extractedCount++;
    }
  }

  console.log(`Extracted ${extractedCount} data files`);
}

/**
 * Parses registries from server reports
 * @param reportsDir - Reports directory
 * @returns Registry data
 */
async function parseRegistries(reportsDir: string): Promise<RegistryData> {
  // Try single registries.json file first
  const singleFilePath = path.join(reportsDir, "registries.json");

  try {
    const content = await fs.readFile(singleFilePath, "utf-8");
    return JSON.parse(content);
  } catch {
    // Fall back to individual registry files
  }

  // Try registries directory
  const registriesDir = path.join(reportsDir, "registries");
  const registries: RegistryData = {};

  try {
    const files = await fs.readdir(registriesDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const registryName = `minecraft:${file.replace(".json", "")}`;
      const filePath = path.join(registriesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      registries[registryName] = JSON.parse(content);
    }
  } catch {
    // Registries directory doesn't exist
  }

  return registries;
}

/**
 * Parses blocks report
 * @param reportsDir - Reports directory
 * @returns Block report data
 */
async function parseBlocksReport(reportsDir: string): Promise<BlockReportData> {
  const blocksPath = path.join(reportsDir, "blocks.json");

  try {
    const content = await fs.readFile(blocksPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// ============================================================================
// Data Accessors
// ============================================================================

/**
 * Gets all item IDs from registries
 * @param registries - Registry data
 * @returns Array of item IDs
 */
export function getItemIds(registries: RegistryData): string[] {
  const itemRegistry =
    registries["minecraft:item"] || registries["item"] || {};
  return Object.keys(itemRegistry.entries || itemRegistry);
}

/**
 * Gets all block IDs from registries
 * @param registries - Registry data
 * @returns Array of block IDs
 */
export function getBlockIds(registries: RegistryData): string[] {
  const blockRegistry =
    registries["minecraft:block"] || registries["block"] || {};
  return Object.keys(blockRegistry.entries || blockRegistry);
}

/**
 * Gets all entity type IDs from registries
 * @param registries - Registry data
 * @returns Array of entity type IDs
 */
export function getEntityTypeIds(registries: RegistryData): string[] {
  const entityRegistry =
    registries["minecraft:entity_type"] || registries["entity_type"] || {};
  return Object.keys(entityRegistry.entries || entityRegistry);
}

/**
 * Gets all enchantment IDs from registries
 * @param registries - Registry data
 * @returns Array of enchantment IDs
 */
export function getEnchantmentIds(registries: RegistryData): string[] {
  const enchantmentRegistry =
    registries["minecraft:enchantment"] || registries["enchantment"] || {};
  return Object.keys(enchantmentRegistry.entries || enchantmentRegistry);
}

/**
 * Gets all potion IDs from registries
 * @param registries - Registry data
 * @returns Array of potion IDs
 */
export function getPotionIds(registries: RegistryData): string[] {
  const potionRegistry =
    registries["minecraft:potion"] || registries["potion"] || {};
  return Object.keys(potionRegistry.entries || potionRegistry);
}

/**
 * Gets all mob effect IDs from registries
 * @param registries - Registry data
 * @returns Array of mob effect IDs
 */
export function getMobEffectIds(registries: RegistryData): string[] {
  const effectRegistry =
    registries["minecraft:mob_effect"] || registries["mob_effect"] || {};
  return Object.keys(effectRegistry.entries || effectRegistry);
}

/**
 * Gets all biome IDs from registries
 * @param registries - Registry data
 * @returns Array of biome IDs
 */
export function getBiomeIds(registries: RegistryData): string[] {
  const biomeRegistry =
    registries["minecraft:worldgen/biome"] ||
    registries["minecraft:biome"] ||
    registries["biome"] ||
    {};
  return Object.keys(biomeRegistry.entries || biomeRegistry);
}

/**
 * Loads all recipes from data directory
 * @param dataDir - Data directory
 * @returns Map of recipe ID to recipe data
 */
export async function loadRecipes(
  dataDir: string
): Promise<Map<string, RecipeData>> {
  const recipes = new Map<string, RecipeData>();

  // Try both modern and legacy paths
  const recipeDirs = [
    path.join(dataDir, "recipe"),
    path.join(dataDir, "recipes"),
  ];

  for (const recipeDir of recipeDirs) {
    try {
      const files = await getFilesRecursive(recipeDir);

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        const filePath = path.join(recipeDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        const recipeData: RecipeData = JSON.parse(content);

        const recipeId = `minecraft:${file.replace(/\.json$/, "").replace(/\\/g, "/")}`;
        recipes.set(recipeId, recipeData);
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return recipes;
}

/**
 * Loads all loot tables from data directory
 * @param dataDir - Data directory
 * @returns Map of loot table ID to loot table data
 */
export async function loadLootTables(
  dataDir: string
): Promise<Map<string, LootTableData>> {
  const lootTables = new Map<string, LootTableData>();

  // Try both modern and legacy paths
  const lootDirs = [
    path.join(dataDir, "loot_table"),
    path.join(dataDir, "loot_tables"),
  ];

  for (const lootDir of lootDirs) {
    try {
      const files = await getFilesRecursive(lootDir);

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        const filePath = path.join(lootDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        const lootData: LootTableData = JSON.parse(content);

        const lootId = `minecraft:${file.replace(/\.json$/, "").replace(/\\/g, "/")}`;
        lootTables.set(lootId, lootData);
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return lootTables;
}

/**
 * Loads all tags from data directory
 * @param dataDir - Data directory
 * @param tagType - Tag type (blocks, items, entity_types, etc.)
 * @returns Map of tag ID to tag data
 */
export async function loadTags(
  dataDir: string,
  tagType: string
): Promise<Map<string, TagData>> {
  const tags = new Map<string, TagData>();

  // Handle both old format (tags/blocks) and new format (tags/block)
  const tagDirs = [
    path.join(dataDir, "tags", tagType),
    path.join(dataDir, "tags", tagType.replace(/s$/, "")), // blocks -> block
  ];

  for (const tagDir of tagDirs) {
    try {
      const files = await getFilesRecursive(tagDir);

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        const filePath = path.join(tagDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        const tagData: TagData = JSON.parse(content);

        const tagId = `minecraft:${file.replace(/\.json$/, "").replace(/\\/g, "/")}`;
        tags.set(tagId, tagData);
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return tags;
}

/**
 * Gets block states from report data
 * @param blocks - Block report data
 * @param blockId - Block ID
 * @returns Block state properties or null
 */
export function getBlockStates(
  blocks: BlockReportData,
  blockId: string
): BlockReportEntry | null {
  return blocks[blockId] || null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Recursively gets all files in a directory
 * @param dir - Directory path
 * @param basePath - Base path for relative paths
 * @returns Array of relative file paths
 */
async function getFilesRecursive(
  dir: string,
  basePath: string = ""
): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const subFiles = await getFilesRecursive(
          path.join(dir, entry.name),
          relativePath
        );
        files.push(...subFiles);
      } else {
        files.push(relativePath);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return files;
}

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
 * Checks if data has been extracted for a version
 * @param outputDir - Output directory
 * @param version - Version ID
 * @returns true if data exists
 */
export async function dataExists(
  outputDir: string,
  version: string
): Promise<boolean> {
  const versionDir = path.join(outputDir, version);
  const reportsDir = path.join(versionDir, "reports");
  const dataDir = path.join(versionDir, "data");

  const hasReports = await pathExists(path.join(reportsDir, "blocks.json"));
  const hasData = await pathExists(dataDir);

  return hasReports || hasData;
}
