/**
 * Bedrock Edition Data Extractor
 * Parses behavior_packs/vanilla and resource_packs/vanilla data
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getBedrockPaths } from "./downloader.js";

// ============================================================================
// Types
// ============================================================================

export interface BedrockBlockData {
  identifier: string;
  isExperimental?: boolean;
  properties?: BedrockBlockProperty[];
  components?: Record<string, unknown>;
}

export interface BedrockBlockProperty {
  name: string;
  values: (string | number | boolean)[];
}

export interface BedrockItemData {
  identifier: string;
  category?: string;
  isExperimental?: boolean;
  components?: Record<string, unknown>;
}

export interface BedrockEntityData {
  identifier: string;
  isSpawnable: boolean;
  isSummonable: boolean;
  isExperimental?: boolean;
  components?: Record<string, unknown>;
  componentGroups?: Record<string, unknown>;
  events?: Record<string, unknown>;
}

export interface BedrockRecipeData {
  identifier: string;
  type: BedrockRecipeType;
  tags?: string[];
  input?: unknown;
  output?: unknown;
  pattern?: string[];
  key?: Record<string, unknown>;
  ingredients?: unknown[];
  result?: unknown;
}

export type BedrockRecipeType =
  | "crafting_shaped"
  | "crafting_shapeless"
  | "furnace"
  | "blast_furnace"
  | "smoker"
  | "campfire"
  | "stonecutter"
  | "smithing_transform"
  | "smithing_trim"
  | "brewing_mix"
  | "brewing_container";

export interface BedrockLootTableData {
  pools: BedrockLootPool[];
}

export interface BedrockLootPool {
  rolls: number | { min: number; max: number };
  entries: BedrockLootEntry[];
  conditions?: unknown[];
}

export interface BedrockLootEntry {
  type: string;
  name?: string;
  weight?: number;
  functions?: unknown[];
  pools?: BedrockLootPool[];
}

export interface BedrockSpawnRule {
  identifier: string;
  population_control: string;
  conditions: unknown[];
}

export interface BedrockTradeTable {
  tiers: BedrockTradeTier[];
}

export interface BedrockTradeTier {
  groups: BedrockTradeGroup[];
}

export interface BedrockTradeGroup {
  num_to_select: number;
  trades: BedrockTrade[];
}

export interface BedrockTrade {
  wants: Array<{ item: string; quantity?: number; price_multiplier?: number }>;
  gives: Array<{ item: string; quantity?: number }>;
}

// ============================================================================
// Block Data
// ============================================================================

/**
 * Loads blocks.json from resource pack
 * @param extractDir - Extraction directory
 * @returns Map of block ID to block data
 */
export async function loadBedrockBlocks(
  extractDir: string
): Promise<Map<string, BedrockBlockData>> {
  const { vanillaResource, vanillaBehavior } = getBedrockPaths(extractDir);
  const blocks = new Map<string, BedrockBlockData>();

  // Load from resource pack blocks.json
  const blocksJsonPath = path.join(vanillaResource, "blocks.json");
  try {
    const content = await fs.readFile(blocksJsonPath, "utf-8");
    const data = JSON.parse(content);

    for (const [id, blockData] of Object.entries(data)) {
      if (id === "format_version") continue;

      blocks.set(id, {
        identifier: id,
        components: blockData as Record<string, unknown>,
      });
    }
  } catch {
    // blocks.json might not exist
  }

  // Load from behavior pack block definitions
  const blocksDir = path.join(vanillaBehavior, "blocks");
  try {
    const files = await getFilesRecursive(blocksDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(blocksDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      const blockDef = data["minecraft:block"];
      if (blockDef?.description?.identifier) {
        const id = blockDef.description.identifier;
        const existing = blocks.get(id) || { identifier: id };

        blocks.set(id, {
          ...existing,
          properties: parseBlockProperties(blockDef.description.properties),
          components: blockDef.components,
          isExperimental: blockDef.description.is_experimental,
        });
      }
    }
  } catch {
    // Blocks directory might not exist
  }

  return blocks;
}

function parseBlockProperties(
  props?: Record<string, unknown>
): BedrockBlockProperty[] | undefined {
  if (!props) return undefined;

  return Object.entries(props).map(([name, values]) => ({
    name,
    values: Array.isArray(values) ? values : [values],
  }));
}

// ============================================================================
// Item Data
// ============================================================================

/**
 * Loads items from behavior pack
 * @param extractDir - Extraction directory
 * @returns Map of item ID to item data
 */
export async function loadBedrockItems(
  extractDir: string
): Promise<Map<string, BedrockItemData>> {
  const { vanillaBehavior } = getBedrockPaths(extractDir);
  const items = new Map<string, BedrockItemData>();

  const itemsDir = path.join(vanillaBehavior, "items");
  try {
    const files = await getFilesRecursive(itemsDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(itemsDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      const itemDef = data["minecraft:item"];
      if (itemDef?.description?.identifier) {
        const id = itemDef.description.identifier;

        items.set(id, {
          identifier: id,
          category: itemDef.description.category,
          isExperimental: itemDef.description.is_experimental,
          components: itemDef.components,
        });
      }
    }
  } catch {
    // Items directory might not exist
  }

  return items;
}

// ============================================================================
// Entity Data
// ============================================================================

/**
 * Loads entities from behavior pack
 * @param extractDir - Extraction directory
 * @returns Map of entity ID to entity data
 */
export async function loadBedrockEntities(
  extractDir: string
): Promise<Map<string, BedrockEntityData>> {
  const { vanillaBehavior } = getBedrockPaths(extractDir);
  const entities = new Map<string, BedrockEntityData>();

  const entitiesDir = path.join(vanillaBehavior, "entities");
  try {
    const files = await getFilesRecursive(entitiesDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(entitiesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      const entityDef = data["minecraft:entity"];
      if (entityDef?.description?.identifier) {
        const id = entityDef.description.identifier;

        entities.set(id, {
          identifier: id,
          isSpawnable: entityDef.description.is_spawnable ?? false,
          isSummonable: entityDef.description.is_summonable ?? false,
          isExperimental: entityDef.description.is_experimental,
          components: entityDef.components,
          componentGroups: entityDef.component_groups,
          events: entityDef.events,
        });
      }
    }
  } catch {
    // Entities directory might not exist
  }

  return entities;
}

/**
 * Extracts entity component data
 * @param entity - Entity data
 * @param componentName - Component name (e.g., "minecraft:health")
 * @returns Component data or undefined
 */
export function getEntityComponent<T>(
  entity: BedrockEntityData,
  componentName: string
): T | undefined {
  return entity.components?.[componentName] as T | undefined;
}

/**
 * Extracts health from entity
 * @param entity - Entity data
 * @returns Health value or undefined
 */
export function getEntityHealth(
  entity: BedrockEntityData
): number | { value: number; max: number } | undefined {
  const health = getEntityComponent<{
    value?: number;
    max?: number;
  }>(entity, "minecraft:health");

  if (!health) return undefined;

  if (health.max !== undefined) {
    return { value: health.value ?? health.max, max: health.max };
  }

  return health.value;
}

/**
 * Extracts attack damage from entity
 * @param entity - Entity data
 * @returns Attack damage or undefined
 */
export function getEntityAttackDamage(
  entity: BedrockEntityData
): number | { min: number; max: number } | undefined {
  const attack = getEntityComponent<{
    damage?: number | [number, number];
  }>(entity, "minecraft:attack");

  if (!attack?.damage) return undefined;

  if (Array.isArray(attack.damage)) {
    return { min: attack.damage[0], max: attack.damage[1] };
  }

  return attack.damage;
}

// ============================================================================
// Recipe Data
// ============================================================================

/**
 * Loads recipes from behavior pack
 * @param extractDir - Extraction directory
 * @returns Map of recipe ID to recipe data
 */
export async function loadBedrockRecipes(
  extractDir: string
): Promise<Map<string, BedrockRecipeData>> {
  const { vanillaBehavior } = getBedrockPaths(extractDir);
  const recipes = new Map<string, BedrockRecipeData>();

  const recipesDir = path.join(vanillaBehavior, "recipes");
  try {
    const files = await getFilesRecursive(recipesDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(recipesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      // Find the recipe definition key
      const recipeKey = Object.keys(data).find((k) =>
        k.startsWith("minecraft:recipe_")
      );

      if (recipeKey) {
        const recipeDef = data[recipeKey];
        const type = recipeKey.replace("minecraft:recipe_", "") as BedrockRecipeType;

        // Generate identifier from filename if not present
        const identifier =
          recipeDef.description?.identifier ||
          `minecraft:${file.replace(/\.json$/, "").replace(/\//g, "_")}`;

        recipes.set(identifier, {
          identifier,
          type,
          tags: recipeDef.tags,
          pattern: recipeDef.pattern,
          key: recipeDef.key,
          ingredients: recipeDef.ingredients,
          input: recipeDef.input,
          output: recipeDef.output,
          result: recipeDef.result,
        });
      }
    }
  } catch {
    // Recipes directory might not exist
  }

  return recipes;
}

// ============================================================================
// Loot Table Data
// ============================================================================

/**
 * Loads loot tables from behavior pack
 * @param extractDir - Extraction directory
 * @returns Map of loot table ID to loot table data
 */
export async function loadBedrockLootTables(
  extractDir: string
): Promise<Map<string, BedrockLootTableData>> {
  const { vanillaBehavior } = getBedrockPaths(extractDir);
  const lootTables = new Map<string, BedrockLootTableData>();

  const lootDir = path.join(vanillaBehavior, "loot_tables");
  try {
    const files = await getFilesRecursive(lootDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(lootDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      const id = `loot_tables/${file.replace(/\.json$/, "")}`;

      lootTables.set(id, {
        pools: data.pools || [],
      });
    }
  } catch {
    // Loot tables directory might not exist
  }

  return lootTables;
}

// ============================================================================
// Spawn Rules
// ============================================================================

/**
 * Loads spawn rules from behavior pack
 * @param extractDir - Extraction directory
 * @returns Map of entity ID to spawn rules
 */
export async function loadBedrockSpawnRules(
  extractDir: string
): Promise<Map<string, BedrockSpawnRule>> {
  const { vanillaBehavior } = getBedrockPaths(extractDir);
  const spawnRules = new Map<string, BedrockSpawnRule>();

  const spawnDir = path.join(vanillaBehavior, "spawn_rules");
  try {
    const files = await getFilesRecursive(spawnDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(spawnDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      const spawnDef = data["minecraft:spawn_rules"];
      if (spawnDef?.description?.identifier) {
        const id = spawnDef.description.identifier;

        spawnRules.set(id, {
          identifier: id,
          population_control: spawnDef.description.population_control,
          conditions: spawnDef.conditions || [],
        });
      }
    }
  } catch {
    // Spawn rules directory might not exist
  }

  return spawnRules;
}

// ============================================================================
// Trading Tables
// ============================================================================

/**
 * Loads trading tables from behavior pack
 * @param extractDir - Extraction directory
 * @returns Map of trade table ID to trade data
 */
export async function loadBedrockTradeTables(
  extractDir: string
): Promise<Map<string, BedrockTradeTable>> {
  const { vanillaBehavior } = getBedrockPaths(extractDir);
  const tradeTables = new Map<string, BedrockTradeTable>();

  const tradingDir = path.join(vanillaBehavior, "trading");
  try {
    const files = await getFilesRecursive(tradingDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(tradingDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      const id = `trading/${file.replace(/\.json$/, "")}`;

      tradeTables.set(id, {
        tiers: data.tiers || [],
      });
    }
  } catch {
    // Trading directory might not exist
  }

  return tradeTables;
}

// ============================================================================
// Biome Data
// ============================================================================

export interface BedrockBiomeData {
  identifier: string;
  components?: Record<string, unknown>;
}

/**
 * Loads biome definitions from behavior pack
 * @param extractDir - Extraction directory
 * @returns Map of biome ID to biome data
 */
export async function loadBedrockBiomes(
  extractDir: string
): Promise<Map<string, BedrockBiomeData>> {
  const { vanillaBehavior } = getBedrockPaths(extractDir);
  const biomes = new Map<string, BedrockBiomeData>();

  const biomesDir = path.join(vanillaBehavior, "biomes");
  try {
    const files = await getFilesRecursive(biomesDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(biomesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      const biomeDef = data["minecraft:biome"];
      if (biomeDef?.description?.identifier) {
        const id = biomeDef.description.identifier;

        biomes.set(id, {
          identifier: id,
          components: biomeDef.components,
        });
      }
    }
  } catch {
    // Biomes directory might not exist
  }

  return biomes;
}

// ============================================================================
// Feature Rules (World Generation)
// ============================================================================

export interface BedrockFeatureRule {
  identifier: string;
  places_feature: string;
  conditions?: unknown;
}

/**
 * Loads feature rules from behavior pack
 * @param extractDir - Extraction directory
 * @returns Map of feature rule ID to rule data
 */
export async function loadBedrockFeatureRules(
  extractDir: string
): Promise<Map<string, BedrockFeatureRule>> {
  const { vanillaBehavior } = getBedrockPaths(extractDir);
  const featureRules = new Map<string, BedrockFeatureRule>();

  const rulesDir = path.join(vanillaBehavior, "feature_rules");
  try {
    const files = await getFilesRecursive(rulesDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(rulesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      const ruleDef = data["minecraft:feature_rules"];
      if (ruleDef?.description?.identifier) {
        const id = ruleDef.description.identifier;

        featureRules.set(id, {
          identifier: id,
          places_feature: ruleDef.description.places_feature,
          conditions: ruleDef.conditions,
        });
      }
    }
  } catch {
    // Feature rules directory might not exist
  }

  return featureRules;
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
 * Gets data statistics for extracted Bedrock data
 * @param extractDir - Extraction directory
 * @returns Statistics for each data type
 */
export async function getDataStats(
  extractDir: string
): Promise<Record<string, number>> {
  const [blocks, items, entities, recipes, lootTables, spawnRules, biomes] =
    await Promise.all([
      loadBedrockBlocks(extractDir),
      loadBedrockItems(extractDir),
      loadBedrockEntities(extractDir),
      loadBedrockRecipes(extractDir),
      loadBedrockLootTables(extractDir),
      loadBedrockSpawnRules(extractDir),
      loadBedrockBiomes(extractDir),
    ]);

  return {
    blocks: blocks.size,
    items: items.size,
    entities: entities.size,
    recipes: recipes.size,
    lootTables: lootTables.size,
    spawnRules: spawnRules.size,
    biomes: biomes.size,
  };
}
