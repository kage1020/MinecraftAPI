/**
 * Bedrock Edition Asset Extractor
 * Extracts textures, models, sounds from Bedrock APK/resource packs
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getBedrockPaths } from "./downloader.js";

// ============================================================================
// Types
// ============================================================================

export interface BedrockAssetInfo {
  path: string;
  type: BedrockAssetType;
  id: string;
}

export type BedrockAssetType =
  | "texture"
  | "model"
  | "sound"
  | "animation"
  | "particle"
  | "ui";

export interface BedrockTextureInfo {
  id: string;
  path: string;
  category: BedrockTextureCategory;
}

export type BedrockTextureCategory =
  | "blocks"
  | "items"
  | "entity"
  | "ui"
  | "gui"
  | "particle"
  | "environment"
  | "map"
  | "misc";

export interface BedrockModelInfo {
  id: string;
  path: string;
  format: "geometry" | "entity";
  identifier?: string;
}

export interface BedrockSoundInfo {
  id: string;
  path: string;
  category?: string;
}

export interface BedrockAnimationInfo {
  id: string;
  path: string;
  animations: string[];
}

export interface TerrainTextureData {
  resource_pack_name: string;
  texture_name: string;
  padding: number;
  num_mip_levels: number;
  texture_data: Record<string, {
    textures: string | string[] | { path: string; variations?: Array<{ path: string }> };
  }>;
}

export interface ItemTextureData {
  resource_pack_name: string;
  texture_name: string;
  texture_data: Record<string, {
    textures: string;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

const TEXTURE_CATEGORIES: Array<{
  prefix: string;
  category: BedrockTextureCategory;
}> = [
  { prefix: "blocks/", category: "blocks" },
  { prefix: "items/", category: "items" },
  { prefix: "entity/", category: "entity" },
  { prefix: "ui/", category: "ui" },
  { prefix: "gui/", category: "gui" },
  { prefix: "particle/", category: "particle" },
  { prefix: "environment/", category: "environment" },
  { prefix: "map/", category: "map" },
];

// ============================================================================
// Asset Listing
// ============================================================================

/**
 * Lists all textures in extracted Bedrock data
 * @param extractDir - Extraction directory
 * @returns Array of texture info
 */
export async function listBedrockTextures(
  extractDir: string
): Promise<BedrockTextureInfo[]> {
  const { vanillaResource } = getBedrockPaths(extractDir);
  const texturesDir = path.join(vanillaResource, "textures");
  const textures: BedrockTextureInfo[] = [];

  try {
    const files = await getFilesRecursive(texturesDir);

    for (const file of files) {
      if (!file.endsWith(".png") && !file.endsWith(".tga")) continue;

      const id = file.replace(/\.(png|tga)$/, "");

      // Determine category
      let category: BedrockTextureCategory = "misc";
      for (const { prefix, category: cat } of TEXTURE_CATEGORIES) {
        if (file.startsWith(prefix)) {
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
 * Lists all models in extracted Bedrock data
 * @param extractDir - Extraction directory
 * @returns Array of model info
 */
export async function listBedrockModels(
  extractDir: string
): Promise<BedrockModelInfo[]> {
  const { vanillaResource } = getBedrockPaths(extractDir);
  const modelsDir = path.join(vanillaResource, "models");
  const models: BedrockModelInfo[] = [];

  try {
    const files = await getFilesRecursive(modelsDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(modelsDir, file);
      const content = await fs.readFile(filePath, "utf-8");

      try {
        const modelData = JSON.parse(content);
        const id = file.replace(/\.json$/, "");

        // Determine format
        const isGeometry =
          modelData.format_version?.startsWith("1.") ||
          modelData["minecraft:geometry"];

        // Extract identifier if available
        let identifier: string | undefined;
        if (modelData["minecraft:geometry"]) {
          const geo = modelData["minecraft:geometry"];
          if (Array.isArray(geo) && geo[0]?.description?.identifier) {
            identifier = geo[0].description.identifier;
          }
        } else if (modelData.geometry) {
          const geoKeys = Object.keys(modelData.geometry);
          if (geoKeys.length > 0) {
            identifier = geoKeys[0];
          }
        }

        models.push({
          id,
          path: filePath,
          format: isGeometry ? "geometry" : "entity",
          identifier,
        });
      } catch {
        // Invalid JSON, skip
      }
    }
  } catch {
    // Models directory might not exist
  }

  return models;
}

/**
 * Lists all sounds in extracted Bedrock data
 * @param extractDir - Extraction directory
 * @returns Array of sound info
 */
export async function listBedrockSounds(
  extractDir: string
): Promise<BedrockSoundInfo[]> {
  const { vanillaResource } = getBedrockPaths(extractDir);
  const soundsDir = path.join(vanillaResource, "sounds");
  const sounds: BedrockSoundInfo[] = [];

  try {
    const files = await getFilesRecursive(soundsDir);

    for (const file of files) {
      if (!file.endsWith(".ogg") && !file.endsWith(".fsb")) continue;

      const id = file.replace(/\.(ogg|fsb)$/, "");

      // Extract category from path
      const parts = file.split("/");
      const category = parts.length > 1 ? parts[0] : undefined;

      sounds.push({
        id,
        path: path.join(soundsDir, file),
        category,
      });
    }
  } catch {
    // Sounds directory might not exist
  }

  return sounds;
}

/**
 * Lists all animations in extracted Bedrock data
 * @param extractDir - Extraction directory
 * @returns Array of animation info
 */
export async function listBedrockAnimations(
  extractDir: string
): Promise<BedrockAnimationInfo[]> {
  const { vanillaResource } = getBedrockPaths(extractDir);
  const animationsDir = path.join(vanillaResource, "animations");
  const animations: BedrockAnimationInfo[] = [];

  try {
    const files = await getFilesRecursive(animationsDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(animationsDir, file);
      const content = await fs.readFile(filePath, "utf-8");

      try {
        const animData = JSON.parse(content);
        const id = file.replace(/\.json$/, "");

        // Extract animation names
        const animationNames: string[] = [];
        if (animData.animations) {
          animationNames.push(...Object.keys(animData.animations));
        }

        animations.push({
          id,
          path: filePath,
          animations: animationNames,
        });
      } catch {
        // Invalid JSON, skip
      }
    }
  } catch {
    // Animations directory might not exist
  }

  return animations;
}

// ============================================================================
// Texture Atlases
// ============================================================================

/**
 * Loads terrain texture atlas data
 * @param extractDir - Extraction directory
 * @returns Terrain texture data or null
 */
export async function loadTerrainTextures(
  extractDir: string
): Promise<TerrainTextureData | null> {
  const { vanillaResource } = getBedrockPaths(extractDir);
  const atlasPath = path.join(vanillaResource, "textures", "terrain_texture.json");

  try {
    const content = await fs.readFile(atlasPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Loads item texture atlas data
 * @param extractDir - Extraction directory
 * @returns Item texture data or null
 */
export async function loadItemTextures(
  extractDir: string
): Promise<ItemTextureData | null> {
  const { vanillaResource } = getBedrockPaths(extractDir);
  const atlasPath = path.join(vanillaResource, "textures", "item_texture.json");

  try {
    const content = await fs.readFile(atlasPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Gets texture path for a block from terrain atlas
 * @param terrainTextures - Terrain texture data
 * @param blockId - Block ID
 * @returns Texture path(s) or null
 */
export function getBlockTexturePath(
  terrainTextures: TerrainTextureData,
  blockId: string
): string[] | null {
  const texData = terrainTextures.texture_data[blockId];
  if (!texData) return null;

  const textures = texData.textures;

  if (typeof textures === "string") {
    return [textures];
  }

  if (Array.isArray(textures)) {
    return textures;
  }

  if (typeof textures === "object" && textures.path) {
    const paths = [textures.path];
    if (textures.variations) {
      paths.push(...textures.variations.map((v) => v.path));
    }
    return paths;
  }

  return null;
}

/**
 * Gets texture path for an item from item atlas
 * @param itemTextures - Item texture data
 * @param itemId - Item ID
 * @returns Texture path or null
 */
export function getItemTexturePath(
  itemTextures: ItemTextureData,
  itemId: string
): string | null {
  const texData = itemTextures.texture_data[itemId];
  return texData?.textures ?? null;
}

// ============================================================================
// Language Files (Bedrock uses .lang format)
// ============================================================================

export interface BedrockTranslations {
  [key: string]: string;
}

/**
 * Loads a Bedrock language file (.lang format)
 * @param extractDir - Extraction directory
 * @param langCode - Language code (e.g., "en_US")
 * @returns Translations map or null
 */
export async function loadBedrockLanguage(
  extractDir: string,
  langCode: string
): Promise<BedrockTranslations | null> {
  const { vanillaResource } = getBedrockPaths(extractDir);
  const langPath = path.join(vanillaResource, "texts", `${langCode}.lang`);

  try {
    const content = await fs.readFile(langPath, "utf-8");
    return parseBedrockLang(content);
  } catch {
    return null;
  }
}

/**
 * Parses Bedrock .lang file format
 * @param content - File content
 * @returns Translations map
 */
function parseBedrockLang(content: string): BedrockTranslations {
  const translations: BedrockTranslations = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
      continue;
    }

    // Parse key=value format
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);

    // Handle tab-separated comments
    const tabIndex = value.indexOf("\t");
    const cleanValue = tabIndex !== -1 ? value.slice(0, tabIndex) : value;

    translations[key] = cleanValue;
  }

  return translations;
}

/**
 * Lists available Bedrock languages
 * @param extractDir - Extraction directory
 * @returns Array of language codes
 */
export async function listBedrockLanguages(
  extractDir: string
): Promise<string[]> {
  const { vanillaResource } = getBedrockPaths(extractDir);
  const textsDir = path.join(vanillaResource, "texts");

  try {
    const files = await fs.readdir(textsDir);
    return files
      .filter((f) => f.endsWith(".lang"))
      .map((f) => f.replace(".lang", ""));
  } catch {
    return [];
  }
}

// ============================================================================
// Sound Definitions
// ============================================================================

export interface SoundDefinition {
  category?: string;
  sounds: Array<string | {
    name: string;
    volume?: number;
    pitch?: number;
    load_on_low_memory?: boolean;
  }>;
}

export interface SoundDefinitions {
  [soundId: string]: SoundDefinition;
}

/**
 * Loads sound definitions
 * @param extractDir - Extraction directory
 * @returns Sound definitions or null
 */
export async function loadSoundDefinitions(
  extractDir: string
): Promise<SoundDefinitions | null> {
  const { vanillaResource } = getBedrockPaths(extractDir);
  const defsPath = path.join(vanillaResource, "sounds", "sound_definitions.json");

  try {
    const content = await fs.readFile(defsPath, "utf-8");
    const data = JSON.parse(content);
    return data.sound_definitions || data;
  } catch {
    return null;
  }
}

// ============================================================================
// Flipbook Textures (Animated)
// ============================================================================

export interface FlipbookTexture {
  flipbook_texture: string;
  atlas_tile: string;
  ticks_per_frame: number;
  frames?: number[];
  replicate?: number;
  blend_frames?: boolean;
}

/**
 * Loads flipbook texture data (animated textures)
 * @param extractDir - Extraction directory
 * @returns Array of flipbook textures
 */
export async function loadFlipbookTextures(
  extractDir: string
): Promise<FlipbookTexture[]> {
  const { vanillaResource } = getBedrockPaths(extractDir);
  const flipbookPath = path.join(
    vanillaResource,
    "textures",
    "flipbook_textures.json"
  );

  try {
    const content = await fs.readFile(flipbookPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
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
 * Gets a specific texture file
 * @param extractDir - Extraction directory
 * @param texturePath - Texture path relative to textures/
 * @returns Full path to texture file or null
 */
export async function getBedrockTexture(
  extractDir: string,
  texturePath: string
): Promise<string | null> {
  const { vanillaResource } = getBedrockPaths(extractDir);

  // Try with .png extension
  let fullPath = path.join(vanillaResource, "textures", `${texturePath}.png`);
  try {
    await fs.access(fullPath);
    return fullPath;
  } catch {
    // Try with .tga extension
  }

  fullPath = path.join(vanillaResource, "textures", `${texturePath}.tga`);
  try {
    await fs.access(fullPath);
    return fullPath;
  } catch {
    // Try without extension
  }

  fullPath = path.join(vanillaResource, "textures", texturePath);
  try {
    await fs.access(fullPath);
    return fullPath;
  } catch {
    return null;
  }
}

/**
 * Gets asset counts for extracted Bedrock data
 * @param extractDir - Extraction directory
 * @returns Counts for each asset type
 */
export async function getAssetCounts(
  extractDir: string
): Promise<Record<BedrockAssetType, number>> {
  const [textures, models, sounds, animations] = await Promise.all([
    listBedrockTextures(extractDir),
    listBedrockModels(extractDir),
    listBedrockSounds(extractDir),
    listBedrockAnimations(extractDir),
  ]);

  return {
    texture: textures.length,
    model: models.length,
    sound: sounds.length,
    animation: animations.length,
    particle: 0, // TODO: Implement particle listing
    ui: 0, // TODO: Implement UI listing
  };
}
