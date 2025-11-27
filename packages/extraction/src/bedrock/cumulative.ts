/**
 * Bedrock Cumulative Data Processor
 * Handles version diff detection, BedrockMeta generation, and changelog tracking
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  loadBedrockBlocks,
  loadBedrockItems,
  loadBedrockEntities,
  loadBedrockRecipes,
  type BedrockBlockData,
  type BedrockItemData,
  type BedrockEntityData,
  type BedrockRecipeData,
} from "./data.js";

// ============================================================================
// Types
// ============================================================================

/** Metadata tracking Bedrock version history */
export interface BedrockMeta {
  /** Version when this data was added */
  addedIn: string;
  /** Version when this data was last modified */
  lastModifiedIn: string;
  /** Version when this data was removed (null if still present) */
  removedIn: string | null;
  /** Changelog entries */
  changelog: BedrockChange[];
  /** Equivalent Java Edition ID (if applicable) */
  javaEquivalent: string | null;
}

/** A single changelog entry */
export interface BedrockChange {
  /** Version where change occurred */
  version: string;
  /** Description of the change */
  change: string;
  /** Timestamp of when this was processed */
  timestamp: string;
}

/** Block data with Bedrock metadata */
export interface CumulativeBlock extends BedrockBlockData {
  bedrockMeta: BedrockMeta;
}

/** Item data with Bedrock metadata */
export interface CumulativeItem extends BedrockItemData {
  bedrockMeta: BedrockMeta;
}

/** Entity data with Bedrock metadata */
export interface CumulativeEntity extends BedrockEntityData {
  bedrockMeta: BedrockMeta;
}

/** Recipe data with Bedrock metadata */
export interface CumulativeRecipe extends BedrockRecipeData {
  bedrockMeta: BedrockMeta;
}

/** Cumulative data store */
export interface CumulativeData {
  version: string;
  lastUpdated: string;
  blocks: Map<string, CumulativeBlock>;
  items: Map<string, CumulativeItem>;
  entities: Map<string, CumulativeEntity>;
  recipes: Map<string, CumulativeRecipe>;
}

/** Diff result between two versions */
export interface VersionDiff {
  added: string[];
  modified: string[];
  removed: string[];
}

/** Combined diff results */
export interface CumulativeDiff {
  version: string;
  blocks: VersionDiff;
  items: VersionDiff;
  entities: VersionDiff;
  recipes: VersionDiff;
}

// ============================================================================
// Constants
// ============================================================================

const CUMULATIVE_DIR = "cumulative";
const CUMULATIVE_FILE = "cumulative_data.json";

// ============================================================================
// Cumulative Data Management
// ============================================================================

/**
 * Loads cumulative data from storage
 * @param outputDir - Output directory
 * @returns Cumulative data or null if not exists
 */
export async function loadCumulativeData(
  outputDir: string
): Promise<CumulativeData | null> {
  const filePath = path.join(outputDir, "bedrock", CUMULATIVE_DIR, CUMULATIVE_FILE);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);

    return {
      version: data.version,
      lastUpdated: data.lastUpdated,
      blocks: new Map(Object.entries(data.blocks || {})),
      items: new Map(Object.entries(data.items || {})),
      entities: new Map(Object.entries(data.entities || {})),
      recipes: new Map(Object.entries(data.recipes || {})),
    };
  } catch {
    return null;
  }
}

/**
 * Saves cumulative data to storage
 * @param outputDir - Output directory
 * @param data - Cumulative data to save
 */
export async function saveCumulativeData(
  outputDir: string,
  data: CumulativeData
): Promise<void> {
  const dirPath = path.join(outputDir, "bedrock", CUMULATIVE_DIR);
  await fs.mkdir(dirPath, { recursive: true });

  const filePath = path.join(dirPath, CUMULATIVE_FILE);

  const serializable = {
    version: data.version,
    lastUpdated: data.lastUpdated,
    blocks: Object.fromEntries(data.blocks),
    items: Object.fromEntries(data.items),
    entities: Object.fromEntries(data.entities),
    recipes: Object.fromEntries(data.recipes),
  };

  await fs.writeFile(filePath, JSON.stringify(serializable, null, 2));
}

/**
 * Creates initial BedrockMeta for new data
 * @param version - Version where data was added
 * @param javaEquivalent - Optional Java Edition equivalent ID
 * @returns BedrockMeta object
 */
function createBedrockMeta(
  version: string,
  javaEquivalent: string | null = null
): BedrockMeta {
  const timestamp = new Date().toISOString();
  return {
    addedIn: version,
    lastModifiedIn: version,
    removedIn: null,
    changelog: [
      {
        version,
        change: "added",
        timestamp,
      },
    ],
    javaEquivalent,
  };
}

/**
 * Updates BedrockMeta for modified data
 * @param meta - Existing metadata
 * @param version - Version where modification occurred
 * @param changeDescription - Description of changes
 * @returns Updated BedrockMeta
 */
function updateBedrockMeta(
  meta: BedrockMeta,
  version: string,
  changeDescription: string
): BedrockMeta {
  const timestamp = new Date().toISOString();
  return {
    ...meta,
    lastModifiedIn: version,
    changelog: [
      ...meta.changelog,
      {
        version,
        change: changeDescription,
        timestamp,
      },
    ],
  };
}

/**
 * Marks BedrockMeta as removed
 * @param meta - Existing metadata
 * @param version - Version where removal occurred
 * @returns Updated BedrockMeta
 */
function markAsRemoved(meta: BedrockMeta, version: string): BedrockMeta {
  const timestamp = new Date().toISOString();
  return {
    ...meta,
    removedIn: version,
    changelog: [
      ...meta.changelog,
      {
        version,
        change: "removed",
        timestamp,
      },
    ],
  };
}

// ============================================================================
// Diff Detection
// ============================================================================

/**
 * Detects differences between two data maps
 * @param previous - Previous version data
 * @param current - Current version data
 * @param compareFunc - Function to compare two items
 * @returns Diff result
 */
function detectDiff<T>(
  previous: Map<string, T>,
  current: Map<string, T>,
  compareFunc: (a: T, b: T) => boolean
): VersionDiff {
  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];

  // Find added and modified
  for (const [id, currentData] of current) {
    const previousData = previous.get(id);

    if (!previousData) {
      added.push(id);
    } else if (!compareFunc(previousData, currentData)) {
      modified.push(id);
    }
  }

  // Find removed
  for (const id of previous.keys()) {
    if (!current.has(id)) {
      removed.push(id);
    }
  }

  return { added, modified, removed };
}

/**
 * Compares two blocks for equality
 */
function compareBlocks(a: BedrockBlockData, b: BedrockBlockData): boolean {
  return JSON.stringify(a.components) === JSON.stringify(b.components) &&
    JSON.stringify(a.properties) === JSON.stringify(b.properties);
}

/**
 * Compares two items for equality
 */
function compareItems(a: BedrockItemData, b: BedrockItemData): boolean {
  return JSON.stringify(a.components) === JSON.stringify(b.components);
}

/**
 * Compares two entities for equality
 */
function compareEntities(a: BedrockEntityData, b: BedrockEntityData): boolean {
  return JSON.stringify(a.components) === JSON.stringify(b.components) &&
    JSON.stringify(a.componentGroups) === JSON.stringify(b.componentGroups);
}

/**
 * Compares two recipes for equality
 */
function compareRecipes(a: BedrockRecipeData, b: BedrockRecipeData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Describes changes between two data objects
 * @param previous - Previous version
 * @param current - Current version
 * @returns Description of changes
 */
function describeChanges(
  previous: object,
  current: object
): string {
  const changes: string[] = [];

  const prevRecord = previous as Record<string, unknown>;
  const currRecord = current as Record<string, unknown>;

  // Check for changed properties
  const allKeys = new Set([...Object.keys(prevRecord), ...Object.keys(currRecord)]);

  for (const key of allKeys) {
    if (key === "bedrockMeta") continue;

    const prevValue = JSON.stringify(prevRecord[key]);
    const currValue = JSON.stringify(currRecord[key]);

    if (prevValue !== currValue) {
      if (prevValue === undefined) {
        changes.push(`${key} added`);
      } else if (currValue === undefined) {
        changes.push(`${key} removed`);
      } else {
        changes.push(`${key} changed`);
      }
    }
  }

  return changes.length > 0 ? changes.join(", ") : "modified";
}

// ============================================================================
// Cumulative Processing
// ============================================================================

/**
 * Processes a new Bedrock version and updates cumulative data
 * @param extractDir - Directory with extracted version data
 * @param version - Version being processed
 * @param outputDir - Output directory
 * @returns Diff results and updated cumulative data
 */
export async function processCumulativeUpdate(
  extractDir: string,
  version: string,
  outputDir: string
): Promise<{ diff: CumulativeDiff; data: CumulativeData }> {
  console.log(`Processing cumulative update for Bedrock ${version}...`);

  // Load current version data
  const [currentBlocks, currentItems, currentEntities, currentRecipes] =
    await Promise.all([
      loadBedrockBlocks(extractDir),
      loadBedrockItems(extractDir),
      loadBedrockEntities(extractDir),
      loadBedrockRecipes(extractDir),
    ]);

  // Load previous cumulative data
  const previousData = await loadCumulativeData(outputDir);

  // Initialize cumulative data if first run
  if (!previousData) {
    console.log("No previous cumulative data found, creating initial dataset");

    const newData: CumulativeData = {
      version,
      lastUpdated: new Date().toISOString(),
      blocks: new Map(),
      items: new Map(),
      entities: new Map(),
      recipes: new Map(),
    };

    // Add all current data as new
    for (const [id, block] of currentBlocks) {
      newData.blocks.set(id, {
        ...block,
        bedrockMeta: createBedrockMeta(version, findJavaEquivalent("block", id)),
      });
    }

    for (const [id, item] of currentItems) {
      newData.items.set(id, {
        ...item,
        bedrockMeta: createBedrockMeta(version, findJavaEquivalent("item", id)),
      });
    }

    for (const [id, entity] of currentEntities) {
      newData.entities.set(id, {
        ...entity,
        bedrockMeta: createBedrockMeta(version, findJavaEquivalent("entity", id)),
      });
    }

    for (const [id, recipe] of currentRecipes) {
      newData.recipes.set(id, {
        ...recipe,
        bedrockMeta: createBedrockMeta(version),
      });
    }

    await saveCumulativeData(outputDir, newData);

    const diff: CumulativeDiff = {
      version,
      blocks: {
        added: Array.from(currentBlocks.keys()),
        modified: [],
        removed: [],
      },
      items: {
        added: Array.from(currentItems.keys()),
        modified: [],
        removed: [],
      },
      entities: {
        added: Array.from(currentEntities.keys()),
        modified: [],
        removed: [],
      },
      recipes: {
        added: Array.from(currentRecipes.keys()),
        modified: [],
        removed: [],
      },
    };

    return { diff, data: newData };
  }

  // Detect diffs
  const blockDiff = detectDiff(
    new Map(
      Array.from(previousData.blocks).map(([id, b]) => [id, b as BedrockBlockData])
    ),
    currentBlocks,
    compareBlocks
  );
  const itemDiff = detectDiff(
    new Map(
      Array.from(previousData.items).map(([id, i]) => [id, i as BedrockItemData])
    ),
    currentItems,
    compareItems
  );
  const entityDiff = detectDiff(
    new Map(
      Array.from(previousData.entities).map(([id, e]) => [id, e as BedrockEntityData])
    ),
    currentEntities,
    compareEntities
  );
  const recipeDiff = detectDiff(
    new Map(
      Array.from(previousData.recipes).map(([id, r]) => [id, r as BedrockRecipeData])
    ),
    currentRecipes,
    compareRecipes
  );

  // Update cumulative data
  const updatedData: CumulativeData = {
    version,
    lastUpdated: new Date().toISOString(),
    blocks: new Map(previousData.blocks),
    items: new Map(previousData.items),
    entities: new Map(previousData.entities),
    recipes: new Map(previousData.recipes),
  };

  // Process block changes
  for (const id of blockDiff.added) {
    const block = currentBlocks.get(id)!;
    updatedData.blocks.set(id, {
      ...block,
      bedrockMeta: createBedrockMeta(version, findJavaEquivalent("block", id)),
    });
  }

  for (const id of blockDiff.modified) {
    const block = currentBlocks.get(id)!;
    const existing = previousData.blocks.get(id)!;
    const changeDesc = describeChanges(existing, block);
    updatedData.blocks.set(id, {
      ...block,
      bedrockMeta: updateBedrockMeta(existing.bedrockMeta, version, changeDesc),
    });
  }

  for (const id of blockDiff.removed) {
    const existing = previousData.blocks.get(id)!;
    if (!existing.bedrockMeta.removedIn) {
      updatedData.blocks.set(id, {
        ...existing,
        bedrockMeta: markAsRemoved(existing.bedrockMeta, version),
      });
    }
  }

  // Process item changes
  for (const id of itemDiff.added) {
    const item = currentItems.get(id)!;
    updatedData.items.set(id, {
      ...item,
      bedrockMeta: createBedrockMeta(version, findJavaEquivalent("item", id)),
    });
  }

  for (const id of itemDiff.modified) {
    const item = currentItems.get(id)!;
    const existing = previousData.items.get(id)!;
    const changeDesc = describeChanges(existing, item);
    updatedData.items.set(id, {
      ...item,
      bedrockMeta: updateBedrockMeta(existing.bedrockMeta, version, changeDesc),
    });
  }

  for (const id of itemDiff.removed) {
    const existing = previousData.items.get(id)!;
    if (!existing.bedrockMeta.removedIn) {
      updatedData.items.set(id, {
        ...existing,
        bedrockMeta: markAsRemoved(existing.bedrockMeta, version),
      });
    }
  }

  // Process entity changes
  for (const id of entityDiff.added) {
    const entity = currentEntities.get(id)!;
    updatedData.entities.set(id, {
      ...entity,
      bedrockMeta: createBedrockMeta(version, findJavaEquivalent("entity", id)),
    });
  }

  for (const id of entityDiff.modified) {
    const entity = currentEntities.get(id)!;
    const existing = previousData.entities.get(id)!;
    const changeDesc = describeChanges(existing, entity);
    updatedData.entities.set(id, {
      ...entity,
      bedrockMeta: updateBedrockMeta(existing.bedrockMeta, version, changeDesc),
    });
  }

  for (const id of entityDiff.removed) {
    const existing = previousData.entities.get(id)!;
    if (!existing.bedrockMeta.removedIn) {
      updatedData.entities.set(id, {
        ...existing,
        bedrockMeta: markAsRemoved(existing.bedrockMeta, version),
      });
    }
  }

  // Process recipe changes
  for (const id of recipeDiff.added) {
    const recipe = currentRecipes.get(id)!;
    updatedData.recipes.set(id, {
      ...recipe,
      bedrockMeta: createBedrockMeta(version),
    });
  }

  for (const id of recipeDiff.modified) {
    const recipe = currentRecipes.get(id)!;
    const existing = previousData.recipes.get(id)!;
    updatedData.recipes.set(id, {
      ...recipe,
      bedrockMeta: updateBedrockMeta(existing.bedrockMeta, version, "modified"),
    });
  }

  for (const id of recipeDiff.removed) {
    const existing = previousData.recipes.get(id)!;
    if (!existing.bedrockMeta.removedIn) {
      updatedData.recipes.set(id, {
        ...existing,
        bedrockMeta: markAsRemoved(existing.bedrockMeta, version),
      });
    }
  }

  // Save updated data
  await saveCumulativeData(outputDir, updatedData);

  // Log summary
  console.log("Cumulative update complete:");
  console.log(`  Blocks: +${blockDiff.added.length} ~${blockDiff.modified.length} -${blockDiff.removed.length}`);
  console.log(`  Items: +${itemDiff.added.length} ~${itemDiff.modified.length} -${itemDiff.removed.length}`);
  console.log(`  Entities: +${entityDiff.added.length} ~${entityDiff.modified.length} -${entityDiff.removed.length}`);
  console.log(`  Recipes: +${recipeDiff.added.length} ~${recipeDiff.modified.length} -${recipeDiff.removed.length}`);

  const diff: CumulativeDiff = {
    version,
    blocks: blockDiff,
    items: itemDiff,
    entities: entityDiff,
    recipes: recipeDiff,
  };

  return { diff, data: updatedData };
}

// ============================================================================
// Java Equivalent Mapping
// ============================================================================

/**
 * ID mapping from Bedrock to Java
 * Bedrock uses different IDs for some items/blocks
 */
const BEDROCK_TO_JAVA_MAPPING: Record<string, Record<string, string>> = {
  block: {
    // Bedrock uses data values for wood variants
    "minecraft:planks": "minecraft:oak_planks", // Default mapping
    "minecraft:stone": "minecraft:stone",
    "minecraft:grass": "minecraft:short_grass",
    // Add more mappings as needed
  },
  item: {
    "minecraft:dye": "minecraft:ink_sac", // Default mapping
    // Add more mappings
  },
  entity: {
    "minecraft:zombie": "minecraft:zombie",
    "minecraft:skeleton": "minecraft:skeleton",
    // Most entities have same IDs
  },
};

/**
 * Finds the Java Edition equivalent for a Bedrock ID
 * @param type - Data type (block, item, entity)
 * @param bedrockId - Bedrock ID
 * @returns Java ID or the same ID if no mapping exists
 */
function findJavaEquivalent(
  type: "block" | "item" | "entity",
  bedrockId: string
): string | null {
  const mapping = BEDROCK_TO_JAVA_MAPPING[type];
  if (!mapping) return bedrockId;

  return mapping[bedrockId] ?? bedrockId;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Gets data that existed at a specific version (asOf query)
 * @param data - Cumulative data
 * @param asOfVersion - Version to query
 * @returns Filtered data that existed at that version
 */
export function getDataAsOfVersion<T extends { bedrockMeta: BedrockMeta }>(
  data: Map<string, T>,
  asOfVersion: string
): Map<string, T> {
  const result = new Map<string, T>();

  for (const [id, item] of data) {
    const { addedIn, removedIn } = item.bedrockMeta;

    // Check if item existed at this version
    if (compareVersions(addedIn, asOfVersion) <= 0) {
      // Item was added before or at this version
      if (!removedIn || compareVersions(removedIn, asOfVersion) > 0) {
        // Item wasn't removed yet (or was removed after this version)
        result.set(id, item);
      }
    }
  }

  return result;
}

/**
 * Gets changelog for a specific item
 * @param data - Cumulative data map
 * @param id - Item ID
 * @returns Changelog or null
 */
export function getChangelog<T extends { bedrockMeta: BedrockMeta }>(
  data: Map<string, T>,
  id: string
): BedrockChange[] | null {
  const item = data.get(id);
  return item?.bedrockMeta.changelog ?? null;
}

/**
 * Gets all items added in a specific version
 * @param data - Cumulative data map
 * @param version - Version to check
 * @returns Array of IDs added in that version
 */
export function getAddedInVersion<T extends { bedrockMeta: BedrockMeta }>(
  data: Map<string, T>,
  version: string
): string[] {
  const result: string[] = [];

  for (const [id, item] of data) {
    if (item.bedrockMeta.addedIn === version) {
      result.push(id);
    }
  }

  return result;
}

/**
 * Gets all items modified in a specific version
 * @param data - Cumulative data map
 * @param version - Version to check
 * @returns Array of IDs modified in that version
 */
export function getModifiedInVersion<T extends { bedrockMeta: BedrockMeta }>(
  data: Map<string, T>,
  version: string
): string[] {
  const result: string[] = [];

  for (const [id, item] of data) {
    const hasChange = item.bedrockMeta.changelog.some(
      (c) => c.version === version && c.change !== "added" && c.change !== "removed"
    );
    if (hasChange) {
      result.push(id);
    }
  }

  return result;
}

/**
 * Gets all items removed in a specific version
 * @param data - Cumulative data map
 * @param version - Version to check
 * @returns Array of IDs removed in that version
 */
export function getRemovedInVersion<T extends { bedrockMeta: BedrockMeta }>(
  data: Map<string, T>,
  version: string
): string[] {
  const result: string[] = [];

  for (const [id, item] of data) {
    if (item.bedrockMeta.removedIn === version) {
      result.push(id);
    }
  }

  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Simple version comparison for Bedrock versions
 * @param a - First version
 * @param b - Second version
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;

    if (partA !== partB) {
      return partA - partB;
    }
  }

  return 0;
}
