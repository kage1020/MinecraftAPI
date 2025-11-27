/**
 * Java Edition Language Extractor
 * Extracts and processes language files from client JAR
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import AdmZip from "adm-zip";

// ============================================================================
// Types
// ============================================================================

export interface LanguageExtractionConfig {
  /** Version ID */
  version: string;
  /** Path to client.jar */
  clientJarPath: string;
  /** Output directory */
  outputDir: string;
  /** Specific languages to extract (empty = all) */
  languages?: string[];
}

export interface LanguageExtractionResult {
  version: string;
  langDir: string;
  languages: LanguageInfo[];
  totalTranslations: number;
}

export interface LanguageInfo {
  code: string;
  name: string;
  region: string;
  bidirectional: boolean;
  translationCount: number;
}

export interface LocalizedText {
  /** English (en_us) text */
  en: string;
  /** All translations */
  translations: Record<string, string>;
}

export interface TranslationMap {
  [key: string]: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Common language codes and their metadata */
const LANGUAGE_META: Record<string, { name: string; region: string; bidirectional: boolean }> = {
  en_us: { name: "English", region: "US", bidirectional: false },
  en_gb: { name: "English", region: "UK", bidirectional: false },
  ja_jp: { name: "Japanese", region: "Japan", bidirectional: false },
  ko_kr: { name: "Korean", region: "Korea", bidirectional: false },
  zh_cn: { name: "Chinese", region: "China (Simplified)", bidirectional: false },
  zh_tw: { name: "Chinese", region: "Taiwan (Traditional)", bidirectional: false },
  de_de: { name: "German", region: "Germany", bidirectional: false },
  fr_fr: { name: "French", region: "France", bidirectional: false },
  es_es: { name: "Spanish", region: "Spain", bidirectional: false },
  es_mx: { name: "Spanish", region: "Mexico", bidirectional: false },
  it_it: { name: "Italian", region: "Italy", bidirectional: false },
  pt_br: { name: "Portuguese", region: "Brazil", bidirectional: false },
  pt_pt: { name: "Portuguese", region: "Portugal", bidirectional: false },
  ru_ru: { name: "Russian", region: "Russia", bidirectional: false },
  pl_pl: { name: "Polish", region: "Poland", bidirectional: false },
  nl_nl: { name: "Dutch", region: "Netherlands", bidirectional: false },
  ar_sa: { name: "Arabic", region: "Saudi Arabia", bidirectional: true },
  he_il: { name: "Hebrew", region: "Israel", bidirectional: true },
  th_th: { name: "Thai", region: "Thailand", bidirectional: false },
  vi_vn: { name: "Vietnamese", region: "Vietnam", bidirectional: false },
  tr_tr: { name: "Turkish", region: "Turkey", bidirectional: false },
  uk_ua: { name: "Ukrainian", region: "Ukraine", bidirectional: false },
  cs_cz: { name: "Czech", region: "Czech Republic", bidirectional: false },
  da_dk: { name: "Danish", region: "Denmark", bidirectional: false },
  fi_fi: { name: "Finnish", region: "Finland", bidirectional: false },
  el_gr: { name: "Greek", region: "Greece", bidirectional: false },
  hu_hu: { name: "Hungarian", region: "Hungary", bidirectional: false },
  id_id: { name: "Indonesian", region: "Indonesia", bidirectional: false },
  nb_no: { name: "Norwegian Bokmål", region: "Norway", bidirectional: false },
  ro_ro: { name: "Romanian", region: "Romania", bidirectional: false },
  sv_se: { name: "Swedish", region: "Sweden", bidirectional: false },
  bg_bg: { name: "Bulgarian", region: "Bulgaria", bidirectional: false },
  ca_es: { name: "Catalan", region: "Spain", bidirectional: false },
  hr_hr: { name: "Croatian", region: "Croatia", bidirectional: false },
  lt_lt: { name: "Lithuanian", region: "Lithuania", bidirectional: false },
  lv_lv: { name: "Latvian", region: "Latvia", bidirectional: false },
  sk_sk: { name: "Slovak", region: "Slovakia", bidirectional: false },
  sl_si: { name: "Slovenian", region: "Slovenia", bidirectional: false },
  sr_sp: { name: "Serbian", region: "Serbia", bidirectional: false },
  et_ee: { name: "Estonian", region: "Estonia", bidirectional: false },
};

/** Translation key prefixes for different data types */
const TRANSLATION_PREFIXES = {
  block: "block.minecraft.",
  item: "item.minecraft.",
  entity: "entity.minecraft.",
  biome: "biome.minecraft.",
  enchantment: "enchantment.minecraft.",
  effect: "effect.minecraft.",
  potion: "item.minecraft.potion.effect.",
  advancement: "advancements.",
  stat: "stat.minecraft.",
  container: "container.",
  death: "death.",
  subtitles: "subtitles.",
};

// ============================================================================
// Language Extractor
// ============================================================================

/**
 * Extracts language files from client JAR
 * @param config - Extraction configuration
 * @returns Extraction result
 */
export async function extractLanguages(
  config: LanguageExtractionConfig
): Promise<LanguageExtractionResult> {
  const { version, clientJarPath, outputDir, languages = [] } = config;

  console.log(`Extracting languages for ${version}...`);

  const langDir = path.join(outputDir, version, "lang");
  await fs.mkdir(langDir, { recursive: true });

  const zip = new AdmZip(clientJarPath);
  const entries = zip.getEntries();

  const langPattern = /^assets\/minecraft\/lang\/([a-z]{2}_[a-z]{2})\.json$/;
  const extractedLanguages: LanguageInfo[] = [];
  let totalTranslations = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const match = entry.entryName.match(langPattern);
    if (!match) continue;

    const langCode = match[1];

    // Skip if specific languages requested and this isn't one of them
    if (languages.length > 0 && !languages.includes(langCode)) {
      continue;
    }

    const content = entry.getData().toString("utf-8");
    const translations: TranslationMap = JSON.parse(content);
    const translationCount = Object.keys(translations).length;

    // Write language file
    const outputPath = path.join(langDir, `${langCode}.json`);
    await fs.writeFile(outputPath, JSON.stringify(translations, null, 2));

    // Get language metadata
    const meta = LANGUAGE_META[langCode] || {
      name: langCode,
      region: "Unknown",
      bidirectional: false,
    };

    extractedLanguages.push({
      code: langCode,
      name: meta.name,
      region: meta.region,
      bidirectional: meta.bidirectional,
      translationCount,
    });

    totalTranslations += translationCount;
  }

  console.log(
    `Extracted ${extractedLanguages.length} languages (${totalTranslations} total translations)`
  );

  return {
    version,
    langDir,
    languages: extractedLanguages,
    totalTranslations,
  };
}

/**
 * Loads a language file
 * @param langDir - Language directory
 * @param langCode - Language code (e.g., "en_us")
 * @returns Translation map or null
 */
export async function loadLanguage(
  langDir: string,
  langCode: string
): Promise<TranslationMap | null> {
  const filePath = path.join(langDir, `${langCode}.json`);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Gets all available language codes
 * @param langDir - Language directory
 * @returns Array of language codes
 */
export async function getAvailableLanguages(langDir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(langDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch {
    return [];
  }
}

/**
 * Gets a translation for a key
 * @param langDir - Language directory
 * @param key - Translation key
 * @param langCode - Language code (default: en_us)
 * @returns Translation or null
 */
export async function getTranslation(
  langDir: string,
  key: string,
  langCode: string = "en_us"
): Promise<string | null> {
  const translations = await loadLanguage(langDir, langCode);
  return translations?.[key] ?? null;
}

/**
 * Gets translations for a key in multiple languages
 * @param langDir - Language directory
 * @param key - Translation key
 * @param langCodes - Language codes to include (empty = all)
 * @returns Map of language code to translation
 */
export async function getTranslations(
  langDir: string,
  key: string,
  langCodes?: string[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const codes = langCodes || (await getAvailableLanguages(langDir));

  for (const code of codes) {
    const translation = await getTranslation(langDir, key, code);
    if (translation) {
      result[code] = translation;
    }
  }

  return result;
}

/**
 * Creates a LocalizedText object for a translation key
 * @param langDir - Language directory
 * @param key - Translation key
 * @param langCodes - Language codes to include
 * @returns LocalizedText object
 */
export async function createLocalizedText(
  langDir: string,
  key: string,
  langCodes?: string[]
): Promise<LocalizedText | null> {
  const en = await getTranslation(langDir, key, "en_us");
  if (!en) return null;

  const translations = await getTranslations(langDir, key, langCodes);

  return {
    en,
    translations,
  };
}

// ============================================================================
// Translation Key Helpers
// ============================================================================

/**
 * Gets the translation key for a block
 * @param blockId - Block ID (e.g., "minecraft:stone")
 * @returns Translation key
 */
export function getBlockTranslationKey(blockId: string): string {
  const name = blockId.replace("minecraft:", "");
  return `${TRANSLATION_PREFIXES.block}${name}`;
}

/**
 * Gets the translation key for an item
 * @param itemId - Item ID (e.g., "minecraft:diamond_sword")
 * @returns Translation key
 */
export function getItemTranslationKey(itemId: string): string {
  const name = itemId.replace("minecraft:", "");
  return `${TRANSLATION_PREFIXES.item}${name}`;
}

/**
 * Gets the translation key for an entity
 * @param entityId - Entity ID (e.g., "minecraft:zombie")
 * @returns Translation key
 */
export function getEntityTranslationKey(entityId: string): string {
  const name = entityId.replace("minecraft:", "");
  return `${TRANSLATION_PREFIXES.entity}${name}`;
}

/**
 * Gets the translation key for an enchantment
 * @param enchantmentId - Enchantment ID (e.g., "minecraft:sharpness")
 * @returns Translation key
 */
export function getEnchantmentTranslationKey(enchantmentId: string): string {
  const name = enchantmentId.replace("minecraft:", "");
  return `${TRANSLATION_PREFIXES.enchantment}${name}`;
}

/**
 * Gets the translation key for a status effect
 * @param effectId - Effect ID (e.g., "minecraft:speed")
 * @returns Translation key
 */
export function getEffectTranslationKey(effectId: string): string {
  const name = effectId.replace("minecraft:", "");
  return `${TRANSLATION_PREFIXES.effect}${name}`;
}

/**
 * Gets the translation key for a biome
 * @param biomeId - Biome ID (e.g., "minecraft:plains")
 * @returns Translation key
 */
export function getBiomeTranslationKey(biomeId: string): string {
  const name = biomeId.replace("minecraft:", "");
  return `${TRANSLATION_PREFIXES.biome}${name}`;
}

// ============================================================================
// Batch Translation Helpers
// ============================================================================

/**
 * Gets translations for multiple blocks
 * @param langDir - Language directory
 * @param blockIds - Block IDs
 * @param langCode - Language code
 * @returns Map of block ID to translation
 */
export async function getBlockTranslations(
  langDir: string,
  blockIds: string[],
  langCode: string = "en_us"
): Promise<Map<string, string>> {
  const translations = await loadLanguage(langDir, langCode);
  if (!translations) return new Map();

  const result = new Map<string, string>();

  for (const blockId of blockIds) {
    const key = getBlockTranslationKey(blockId);
    const translation = translations[key];
    if (translation) {
      result.set(blockId, translation);
    }
  }

  return result;
}

/**
 * Gets translations for multiple items
 * @param langDir - Language directory
 * @param itemIds - Item IDs
 * @param langCode - Language code
 * @returns Map of item ID to translation
 */
export async function getItemTranslations(
  langDir: string,
  itemIds: string[],
  langCode: string = "en_us"
): Promise<Map<string, string>> {
  const translations = await loadLanguage(langDir, langCode);
  if (!translations) return new Map();

  const result = new Map<string, string>();

  for (const itemId of itemIds) {
    const key = getItemTranslationKey(itemId);
    const translation = translations[key];
    if (translation) {
      result.set(itemId, translation);
    }
  }

  return result;
}

/**
 * Gets translations for multiple entities
 * @param langDir - Language directory
 * @param entityIds - Entity IDs
 * @param langCode - Language code
 * @returns Map of entity ID to translation
 */
export async function getEntityTranslations(
  langDir: string,
  entityIds: string[],
  langCode: string = "en_us"
): Promise<Map<string, string>> {
  const translations = await loadLanguage(langDir, langCode);
  if (!translations) return new Map();

  const result = new Map<string, string>();

  for (const entityId of entityIds) {
    const key = getEntityTranslationKey(entityId);
    const translation = translations[key];
    if (translation) {
      result.set(entityId, translation);
    }
  }

  return result;
}

/**
 * Creates LocalizedText objects for multiple IDs
 * @param langDir - Language directory
 * @param ids - IDs to translate
 * @param getKeyFn - Function to get translation key from ID
 * @param langCodes - Language codes to include
 * @returns Map of ID to LocalizedText
 */
export async function createLocalizedTexts(
  langDir: string,
  ids: string[],
  getKeyFn: (id: string) => string,
  langCodes?: string[]
): Promise<Map<string, LocalizedText>> {
  const result = new Map<string, LocalizedText>();
  const codes = langCodes || (await getAvailableLanguages(langDir));

  // Load all languages at once for efficiency
  const languageData = new Map<string, TranslationMap>();
  for (const code of codes) {
    const translations = await loadLanguage(langDir, code);
    if (translations) {
      languageData.set(code, translations);
    }
  }

  // Get English translations (required)
  const enTranslations = languageData.get("en_us");
  if (!enTranslations) return result;

  // Create LocalizedText for each ID
  for (const id of ids) {
    const key = getKeyFn(id);
    const en = enTranslations[key];

    if (!en) continue;

    const translations: Record<string, string> = {};
    for (const [code, langTranslations] of languageData) {
      const translation = langTranslations[key];
      if (translation) {
        translations[code] = translation;
      }
    }

    result.set(id, { en, translations });
  }

  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if languages have been extracted for a version
 * @param outputDir - Output directory
 * @param version - Version ID
 * @returns true if languages exist
 */
export async function languagesExist(
  outputDir: string,
  version: string
): Promise<boolean> {
  const langDir = path.join(outputDir, version, "lang");
  const enUsPath = path.join(langDir, "en_us.json");

  try {
    await fs.access(enUsPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets translation statistics
 * @param langDir - Language directory
 * @returns Statistics for each language
 */
export async function getLanguageStats(
  langDir: string
): Promise<Map<string, { count: number; coverage: number }>> {
  const stats = new Map<string, { count: number; coverage: number }>();
  const languages = await getAvailableLanguages(langDir);

  // Get English count as baseline
  const enTranslations = await loadLanguage(langDir, "en_us");
  const enCount = enTranslations ? Object.keys(enTranslations).length : 0;

  for (const code of languages) {
    const translations = await loadLanguage(langDir, code);
    if (translations) {
      const count = Object.keys(translations).length;
      stats.set(code, {
        count,
        coverage: enCount > 0 ? (count / enCount) * 100 : 0,
      });
    }
  }

  return stats;
}
