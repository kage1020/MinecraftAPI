/**
 * @minecraft-api/extraction
 * Data extraction pipeline for Minecraft Java and Bedrock editions
 */

// ============================================================================
// Version Management
// ============================================================================

export {
  // Types
  type JavaVersionType,
  type VersionEntry,
  type VersionManifest,
  type DownloadInfo,
  type AssetIndex,
  type VersionDetail,
  type BedrockVersionInfo,
  type VersionList,
  // Functions
  fetchVersionManifest,
  fetchVersionDetail,
  findVersion,
  getReleaseVersions,
  getSnapshotVersions,
  getLatestRelease,
  getLatestSnapshot,
  filterVersionsByType,
  filterVersionsByDate,
  getBedrockVersionInfo,
  setBedrockVersionInfo,
  getVersionList,
  checkForNewVersion,
  clearCache,
  supportsDataReports,
  usesNewDataPackStructure,
  parseVersion,
  compareVersions,
} from "./versions.js";

// ============================================================================
// Java Edition - Downloader
// ============================================================================

export {
  // Types
  type DownloadConfig,
  type DownloadResult,
  type DownloadProgress,
  type ProgressCallback,
  // Functions
  downloadJars,
  verifyJar,
  getJarPaths,
  cleanupVersion,
  getDownloadSize,
  downloadMultipleVersions,
} from "./java/downloader.js";

// ============================================================================
// Java Edition - Assets
// ============================================================================

export {
  // Types
  type AssetExtractionConfig,
  type AssetType,
  type AssetExtractionResult,
  type TextureInfo,
  type TextureCategory,
  type ModelInfo,
  type BlockStateInfo,
  // Functions
  extractAssets,
  listTextures,
  listModels,
  listBlockStates,
  getTexture,
  getModel,
  getBlockState,
  resolveModel,
  getBlockTextures,
  assetsExist,
} from "./java/assets.js";

// ============================================================================
// Java Edition - Data
// ============================================================================

export {
  // Types
  type DataExtractionConfig,
  type DataExtractionResult,
  type RegistryData,
  type BlockReportEntry,
  type BlockReportData,
  type RecipeData,
  type LootTableData,
  type TagData,
  // Functions
  extractData,
  getItemIds,
  getBlockIds,
  getEntityTypeIds,
  getEnchantmentIds,
  getPotionIds,
  getMobEffectIds,
  getBiomeIds,
  loadRecipes,
  loadLootTables,
  loadTags,
  getBlockStates,
  dataExists,
} from "./java/data.js";

// ============================================================================
// Java Edition - Languages
// ============================================================================

export {
  // Types
  type LanguageExtractionConfig,
  type LanguageExtractionResult,
  type LanguageInfo,
  type LocalizedText,
  type TranslationMap,
  // Functions
  extractLanguages,
  loadLanguage,
  getAvailableLanguages,
  getTranslation,
  getTranslations,
  createLocalizedText,
  getBlockTranslationKey,
  getItemTranslationKey,
  getEntityTranslationKey,
  getEnchantmentTranslationKey,
  getEffectTranslationKey,
  getBiomeTranslationKey,
  getBlockTranslations,
  getItemTranslations,
  getEntityTranslations,
  createLocalizedTexts,
  languagesExist,
  getLanguageStats,
} from "./java/lang.js";

// ============================================================================
// Bedrock Edition - Downloader
// ============================================================================

export {
  // Types
  type BedrockExtractionConfig,
  type BedrockExtractionResult,
  type BedrockVersionMeta,
  type PackManifest,
  // Functions
  extractBedrockAPK,
  detectVersion,
  getBedrockPaths,
  listBehaviorPacks,
  listResourcePacks,
  readPackManifest,
  parseBedrockVersion,
  compareBedrockVersions,
  isNewerVersion,
  validateBedrockAPK,
  getAPKSize,
  bedrockDataExists,
  listExtractedVersions,
  cleanupBedrockVersion,
} from "./bedrock/downloader.js";

// ============================================================================
// Bedrock Edition - Assets
// ============================================================================

export {
  // Types
  type BedrockAssetInfo,
  type BedrockAssetType,
  type BedrockTextureInfo,
  type BedrockTextureCategory,
  type BedrockModelInfo,
  type BedrockSoundInfo,
  type BedrockAnimationInfo,
  type TerrainTextureData,
  type ItemTextureData,
  type BedrockTranslations,
  type SoundDefinition,
  type SoundDefinitions,
  type FlipbookTexture,
  // Functions
  listBedrockTextures,
  listBedrockModels,
  listBedrockSounds,
  listBedrockAnimations,
  loadTerrainTextures,
  loadItemTextures,
  getBlockTexturePath,
  getItemTexturePath,
  loadBedrockLanguage,
  listBedrockLanguages,
  loadSoundDefinitions,
  loadFlipbookTextures,
  getBedrockTexture,
  getAssetCounts,
} from "./bedrock/assets.js";

// ============================================================================
// Bedrock Edition - Data
// ============================================================================

export {
  // Types
  type BedrockBlockData,
  type BedrockBlockProperty,
  type BedrockItemData,
  type BedrockEntityData,
  type BedrockRecipeData,
  type BedrockRecipeType,
  type BedrockLootTableData,
  type BedrockLootPool,
  type BedrockLootEntry,
  type BedrockSpawnRule,
  type BedrockTradeTable,
  type BedrockTradeTier,
  type BedrockTradeGroup,
  type BedrockTrade,
  type BedrockBiomeData,
  type BedrockFeatureRule,
  // Functions
  loadBedrockBlocks,
  loadBedrockItems,
  loadBedrockEntities,
  getEntityComponent,
  getEntityHealth,
  getEntityAttackDamage,
  loadBedrockRecipes,
  loadBedrockLootTables,
  loadBedrockSpawnRules,
  loadBedrockTradeTables,
  loadBedrockBiomes,
  loadBedrockFeatureRules,
  getDataStats,
} from "./bedrock/data.js";

// ============================================================================
// Bedrock Edition - Cumulative Data
// ============================================================================

export {
  // Types
  type BedrockMeta,
  type BedrockChange,
  type CumulativeBlock,
  type CumulativeItem,
  type CumulativeEntity,
  type CumulativeRecipe,
  type CumulativeData,
  type VersionDiff,
  type CumulativeDiff,
  // Functions
  loadCumulativeData,
  saveCumulativeData,
  processCumulativeUpdate,
  getDataAsOfVersion,
  getChangelog,
  getAddedInVersion,
  getModifiedInVersion,
  getRemovedInVersion,
} from "./bedrock/cumulative.js";

// ============================================================================
// Data Normalizer
// ============================================================================

export {
  // Types
  type Edition,
  type ItemRarity,
  type NormalizedItem,
  type FoodProperties,
  type FoodEffect,
  type EquipmentProperties,
  type ToolProperties,
  type NormalizedBlock,
  type BlockStateProperty,
  type NormalizedEntity,
  type EntityCategory,
  type MobProperties,
  type NormalizedRecipe,
  type RecipeType,
  type RecipeResult,
  type RecipeIngredient,
  type RecipeKey,
  // Functions
  normalizeItem,
  normalizeBlock,
  normalizeEntity,
  normalizeRecipe,
} from "./normalizer.js";
