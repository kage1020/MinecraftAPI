/**
 * Java Edition Asset Extractor
 * Extracts assets (textures, models, sounds, blockstates) from client JAR
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import AdmZip from "adm-zip";

// ============================================================================
// Types
// ============================================================================

export interface AssetExtractionConfig {
  /** Version ID */
  version: string;
  /** Path to client.jar */
  clientJarPath: string;
  /** Output directory for extracted assets */
  outputDir: string;
  /** Asset types to extract */
  assetTypes?: AssetType[];
}

export type AssetType =
  | "textures"
  | "models"
  | "blockstates"
  | "sounds"
  | "particles"
  | "shaders";

export interface AssetExtractionResult {
  version: string;
  extractDir: string;
  extractedCounts: Record<AssetType, number>;
  totalFiles: number;
}

export interface TextureInfo {
  id: string;
  path: string;
  category: TextureCategory;
}

export type TextureCategory =
  | "block"
  | "item"
  | "entity"
  | "gui"
  | "particle"
  | "painting"
  | "effect"
  | "map"
  | "misc"
  | "environment"
  | "colormap"
  | "font";

export interface ModelInfo {
  id: string;
  path: string;
  type: "block" | "item";
  parent?: string;
  textures?: Record<string, string>;
}

export interface BlockStateInfo {
  id: string;
  path: string;
  variants?: Record<string, unknown>;
  multipart?: unknown[];
}

// ============================================================================
// Constants
// ============================================================================

const ASSET_PATTERNS: Record<AssetType, RegExp> = {
  textures: /^assets\/minecraft\/textures\//,
  models: /^assets\/minecraft\/models\//,
  blockstates: /^assets\/minecraft\/blockstates\//,
  sounds: /^assets\/minecraft\/sounds\//,
  particles: /^assets\/minecraft\/particles\//,
  shaders: /^assets\/minecraft\/shaders\//,
};

const TEXTURE_CATEGORIES: Array<{ prefix: string; category: TextureCategory }> =
  [
    { prefix: "block/", category: "block" },
    { prefix: "item/", category: "item" },
    { prefix: "entity/", category: "entity" },
    { prefix: "gui/", category: "gui" },
    { prefix: "particle/", category: "particle" },
    { prefix: "painting/", category: "painting" },
    { prefix: "mob_effect/", category: "effect" },
    { prefix: "map/", category: "map" },
    { prefix: "misc/", category: "misc" },
    { prefix: "environment/", category: "environment" },
    { prefix: "colormap/", category: "colormap" },
    { prefix: "font/", category: "font" },
  ];

const ALL_ASSET_TYPES: AssetType[] = [
  "textures",
  "models",
  "blockstates",
  "sounds",
  "particles",
  "shaders",
];

// ============================================================================
// Asset Extractor
// ============================================================================

/**
 * Extracts assets from client JAR
 * @param config - Extraction configuration
 * @returns Extraction result
 */
export async function extractAssets(
  config: AssetExtractionConfig
): Promise<AssetExtractionResult> {
  const {
    version,
    clientJarPath,
    outputDir,
    assetTypes = ALL_ASSET_TYPES,
  } = config;

  console.log(`Extracting assets for ${version}...`);

  // Create extraction directory
  const extractDir = path.join(outputDir, version, "extracted");
  await fs.mkdir(extractDir, { recursive: true });

  // Open JAR file
  const zip = new AdmZip(clientJarPath);
  const entries = zip.getEntries();

  const extractedCounts: Record<AssetType, number> = {
    textures: 0,
    models: 0,
    blockstates: 0,
    sounds: 0,
    particles: 0,
    shaders: 0,
  };

  let totalFiles = 0;

  // Build pattern list based on requested asset types
  const patterns = assetTypes.map((type) => ({
    type,
    pattern: ASSET_PATTERNS[type],
  }));

  // Extract matching entries
  for (const entry of entries) {
    if (entry.isDirectory) continue;

    // Check if entry matches any pattern
    for (const { type, pattern } of patterns) {
      if (pattern.test(entry.entryName)) {
        const outputPath = path.join(extractDir, entry.entryName);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, entry.getData());
        extractedCounts[type]++;
        totalFiles++;
        break;
      }
    }
  }

  console.log(`Extracted ${totalFiles} asset files`);
  for (const [type, count] of Object.entries(extractedCounts)) {
    if (count > 0) {
      console.log(`  ${type}: ${count}`);
    }
  }

  return {
    version,
    extractDir,
    extractedCounts,
    totalFiles,
  };
}

/**
 * Lists all textures in extracted assets
 * @param extractDir - Extraction directory
 * @returns Array of texture info
 */
export async function listTextures(extractDir: string): Promise<TextureInfo[]> {
  const texturesDir = path.join(extractDir, "assets/minecraft/textures");
  const textures: TextureInfo[] = [];

  try {
    const files = await getFilesRecursive(texturesDir);

    for (const file of files) {
      if (!file.endsWith(".png")) continue;

      const relativePath = file;
      const id = `minecraft:${relativePath.replace(/\.png$/, "")}`;

      // Determine category
      let category: TextureCategory = "misc";
      for (const { prefix, category: cat } of TEXTURE_CATEGORIES) {
        if (relativePath.startsWith(prefix)) {
          category = cat;
          break;
        }
      }

      textures.push({
        id,
        path: path.join(texturesDir, file),
        category,
      });
    }
  } catch {
    // Textures directory might not exist
  }

  return textures;
}

/**
 * Lists all models in extracted assets
 * @param extractDir - Extraction directory
 * @returns Array of model info
 */
export async function listModels(extractDir: string): Promise<ModelInfo[]> {
  const modelsDir = path.join(extractDir, "assets/minecraft/models");
  const models: ModelInfo[] = [];

  try {
    const files = await getFilesRecursive(modelsDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(modelsDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const modelData = JSON.parse(content);

      const relativePath = file.replace(/\.json$/, "");
      const id = `minecraft:${relativePath}`;
      const type = file.startsWith("block/") ? "block" : "item";

      models.push({
        id,
        path: filePath,
        type,
        parent: modelData.parent,
        textures: modelData.textures,
      });
    }
  } catch {
    // Models directory might not exist
  }

  return models;
}

/**
 * Lists all blockstates in extracted assets
 * @param extractDir - Extraction directory
 * @returns Array of blockstate info
 */
export async function listBlockStates(
  extractDir: string
): Promise<BlockStateInfo[]> {
  const blockstatesDir = path.join(
    extractDir,
    "assets/minecraft/blockstates"
  );
  const blockstates: BlockStateInfo[] = [];

  try {
    const files = await getFilesRecursive(blockstatesDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(blockstatesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const stateData = JSON.parse(content);

      const id = `minecraft:${file.replace(/\.json$/, "")}`;

      blockstates.push({
        id,
        path: filePath,
        variants: stateData.variants,
        multipart: stateData.multipart,
      });
    }
  } catch {
    // Blockstates directory might not exist
  }

  return blockstates;
}

/**
 * Gets a specific texture by ID
 * @param extractDir - Extraction directory
 * @param textureId - Texture ID (e.g., "minecraft:block/stone")
 * @returns Texture file path or null
 */
export async function getTexture(
  extractDir: string,
  textureId: string
): Promise<string | null> {
  const id = textureId.replace("minecraft:", "");
  const texturePath = path.join(
    extractDir,
    "assets/minecraft/textures",
    `${id}.png`
  );

  try {
    await fs.access(texturePath);
    return texturePath;
  } catch {
    return null;
  }
}

/**
 * Gets a specific model by ID
 * @param extractDir - Extraction directory
 * @param modelId - Model ID (e.g., "minecraft:block/stone")
 * @returns Model data or null
 */
export async function getModel(
  extractDir: string,
  modelId: string
): Promise<ModelInfo | null> {
  const id = modelId.replace("minecraft:", "");
  const modelPath = path.join(
    extractDir,
    "assets/minecraft/models",
    `${id}.json`
  );

  try {
    const content = await fs.readFile(modelPath, "utf-8");
    const modelData = JSON.parse(content);

    return {
      id: modelId,
      path: modelPath,
      type: id.startsWith("block/") ? "block" : "item",
      parent: modelData.parent,
      textures: modelData.textures,
    };
  } catch {
    return null;
  }
}

/**
 * Gets a specific blockstate by ID
 * @param extractDir - Extraction directory
 * @param blockId - Block ID (e.g., "minecraft:stone")
 * @returns Blockstate data or null
 */
export async function getBlockState(
  extractDir: string,
  blockId: string
): Promise<BlockStateInfo | null> {
  const id = blockId.replace("minecraft:", "");
  const statePath = path.join(
    extractDir,
    "assets/minecraft/blockstates",
    `${id}.json`
  );

  try {
    const content = await fs.readFile(statePath, "utf-8");
    const stateData = JSON.parse(content);

    return {
      id: blockId,
      path: statePath,
      variants: stateData.variants,
      multipart: stateData.multipart,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves a model with all its parents
 * @param extractDir - Extraction directory
 * @param modelId - Model ID
 * @returns Resolved model with merged properties
 */
export async function resolveModel(
  extractDir: string,
  modelId: string
): Promise<{
  id: string;
  textures: Record<string, string>;
  elements?: unknown[];
} | null> {
  const model = await getModel(extractDir, modelId);
  if (!model) return null;

  const result: {
    id: string;
    textures: Record<string, string>;
    elements?: unknown[];
  } = {
    id: modelId,
    textures: { ...model.textures },
  };

  // Resolve parent chain
  if (model.parent) {
    const parent = await resolveModel(extractDir, model.parent);
    if (parent) {
      // Merge textures (child overrides parent)
      result.textures = { ...parent.textures, ...result.textures };
      // Use parent's elements if not defined
      if (parent.elements && !result.elements) {
        result.elements = parent.elements;
      }
    }
  }

  return result;
}

/**
 * Gets texture paths for all blocks
 * @param extractDir - Extraction directory
 * @returns Map of block ID to texture paths
 */
export async function getBlockTextures(
  extractDir: string
): Promise<Map<string, string[]>> {
  const blockstates = await listBlockStates(extractDir);
  const blockTextures = new Map<string, string[]>();

  for (const blockstate of blockstates) {
    const textures = new Set<string>();

    // Extract model references from variants
    if (blockstate.variants) {
      for (const variant of Object.values(blockstate.variants)) {
        const modelRef = Array.isArray(variant)
          ? (variant[0] as { model?: string })?.model
          : (variant as { model?: string })?.model;

        if (modelRef) {
          const resolved = await resolveModel(extractDir, modelRef);
          if (resolved?.textures) {
            for (const texture of Object.values(resolved.textures)) {
              if (!texture.startsWith("#")) {
                textures.add(texture);
              }
            }
          }
        }
      }
    }

    // Extract model references from multipart
    if (blockstate.multipart) {
      for (const part of blockstate.multipart) {
        const apply = (part as { apply?: unknown }).apply;
        const modelRef = Array.isArray(apply)
          ? (apply[0] as { model?: string })?.model
          : (apply as { model?: string } | undefined)?.model;

        if (modelRef) {
          const resolved = await resolveModel(extractDir, modelRef);
          if (resolved?.textures) {
            for (const texture of Object.values(resolved.textures)) {
              if (!texture.startsWith("#")) {
                textures.add(texture);
              }
            }
          }
        }
      }
    }

    if (textures.size > 0) {
      blockTextures.set(blockstate.id, Array.from(textures));
    }
  }

  return blockTextures;
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
 * Checks if assets have been extracted for a version
 * @param outputDir - Output directory
 * @param version - Version ID
 * @returns true if assets exist
 */
export async function assetsExist(
  outputDir: string,
  version: string
): Promise<boolean> {
  const extractDir = path.join(outputDir, version, "extracted");
  const assetsDir = path.join(extractDir, "assets/minecraft");

  try {
    await fs.access(assetsDir);
    return true;
  } catch {
    return false;
  }
}
