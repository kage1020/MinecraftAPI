/**
 * Data Normalizer
 * Converts Java/Bedrock data to common API format with schema validation
 */

import type { BlockReportData, RegistryData, RecipeData, LootTableData, TagData } from "./java/data.js";
import type { LocalizedText } from "./java/lang.js";
import type { BedrockBlockData, BedrockItemData, BedrockEntityData, BedrockRecipeData } from "./bedrock/data.js";
import type { BedrockMeta } from "./bedrock/cumulative.js";

// ============================================================================
// Common Types (API Schema)
// ============================================================================

export type Edition = "JAVA" | "BEDROCK";

export type ItemRarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC";

export interface NormalizedItem {
  id: string;
  name: LocalizedText;
  edition: Edition;
  stackSize: number;
  durability: number | null;
  fireResistant: boolean;
  rarity: ItemRarity;
  food: FoodProperties | null;
  equipment: EquipmentProperties | null;
  tool: ToolProperties | null;
  bedrockMeta?: BedrockMeta;
}

export interface FoodProperties {
  nutrition: number;
  saturation: number;
  canAlwaysEat: boolean;
  effects: FoodEffect[];
}

export interface FoodEffect {
  effect: string;
  duration: number;
  amplifier: number;
  probability: number;
}

export interface EquipmentProperties {
  slot: "HEAD" | "CHEST" | "LEGS" | "FEET" | "MAINHAND" | "OFFHAND";
  armor: number | null;
  armorToughness: number | null;
  knockbackResistance: number | null;
  attackDamage: number | null;
  attackSpeed: number | null;
}

export interface ToolProperties {
  type: "PICKAXE" | "AXE" | "SHOVEL" | "HOE" | "SWORD" | "SHEARS";
  tier: "WOOD" | "STONE" | "IRON" | "GOLD" | "DIAMOND" | "NETHERITE";
  speed: number;
  damage: number;
  enchantmentValue: number;
}

export interface NormalizedBlock {
  id: string;
  name: LocalizedText;
  edition: Edition;
  hardness: number;
  blastResistance: number;
  friction: number;
  speedFactor: number;
  jumpFactor: number;
  luminance: number;
  requiresCorrectTool: boolean;
  hasGravity: boolean;
  flammable: boolean;
  replaceable: boolean;
  states: BlockStateProperty[];
  bedrockMeta?: BedrockMeta;
}

export interface BlockStateProperty {
  name: string;
  type: "BOOLEAN" | "INTEGER" | "ENUM" | "DIRECTION";
  values: string[];
  defaultValue: string;
}

export interface NormalizedEntity {
  id: string;
  name: LocalizedText;
  edition: Edition;
  category: EntityCategory;
  health: number;
  width: number;
  height: number;
  fireImmune: boolean;
  mob: MobProperties | null;
  bedrockMeta?: BedrockMeta;
}

export type EntityCategory =
  | "MONSTER"
  | "CREATURE"
  | "AMBIENT"
  | "WATER_CREATURE"
  | "WATER_AMBIENT"
  | "UNDERGROUND_WATER_CREATURE"
  | "MISC";

export interface MobProperties {
  attackDamage: number;
  movementSpeed: number;
  followRange: number;
  spawnGroup: string;
}

export interface NormalizedRecipe {
  id: string;
  edition: Edition;
  type: RecipeType;
  group: string | null;
  result: RecipeResult;
  ingredients?: RecipeIngredient[];
  pattern?: string[];
  key?: RecipeKey[];
  experience?: number;
  cookingTime?: number;
  template?: RecipeIngredient;
  base?: RecipeIngredient;
  addition?: RecipeIngredient;
  bedrockMeta?: BedrockMeta;
}

export type RecipeType =
  | "CRAFTING_SHAPED"
  | "CRAFTING_SHAPELESS"
  | "SMELTING"
  | "BLASTING"
  | "SMOKING"
  | "CAMPFIRE_COOKING"
  | "STONECUTTING"
  | "SMITHING";

export interface RecipeResult {
  item: string;
  count: number;
}

export interface RecipeIngredient {
  items: string[];
  tag: string | null;
}

export interface RecipeKey {
  key: string;
  ingredient: RecipeIngredient;
}

// ============================================================================
// Hardcoded Game Data
// ============================================================================

const ITEM_STACK_SIZES: Record<string, number> = {
  // Tools and weapons (stack size 1)
  diamond_sword: 1, netherite_sword: 1, iron_sword: 1, stone_sword: 1, wooden_sword: 1, golden_sword: 1,
  diamond_pickaxe: 1, netherite_pickaxe: 1, iron_pickaxe: 1, stone_pickaxe: 1, wooden_pickaxe: 1, golden_pickaxe: 1,
  diamond_axe: 1, netherite_axe: 1, iron_axe: 1, stone_axe: 1, wooden_axe: 1, golden_axe: 1,
  diamond_shovel: 1, netherite_shovel: 1, iron_shovel: 1, stone_shovel: 1, wooden_shovel: 1, golden_shovel: 1,
  diamond_hoe: 1, netherite_hoe: 1, iron_hoe: 1, stone_hoe: 1, wooden_hoe: 1, golden_hoe: 1,
  bow: 1, crossbow: 1, trident: 1, shield: 1, elytra: 1, fishing_rod: 1, flint_and_steel: 1, shears: 1,
  // Armor
  diamond_helmet: 1, diamond_chestplate: 1, diamond_leggings: 1, diamond_boots: 1,
  netherite_helmet: 1, netherite_chestplate: 1, netherite_leggings: 1, netherite_boots: 1,
  iron_helmet: 1, iron_chestplate: 1, iron_leggings: 1, iron_boots: 1,
  golden_helmet: 1, golden_chestplate: 1, golden_leggings: 1, golden_boots: 1,
  leather_helmet: 1, leather_chestplate: 1, leather_leggings: 1, leather_boots: 1,
  chainmail_helmet: 1, chainmail_chestplate: 1, chainmail_leggings: 1, chainmail_boots: 1,
  turtle_helmet: 1,
  // Stack size 16
  egg: 16, snowball: 16, ender_pearl: 16, bucket: 16, sign: 16, banner: 16, honey_bottle: 16,
  // Stack size 1 misc
  water_bucket: 1, lava_bucket: 1, milk_bucket: 1, powder_snow_bucket: 1,
  minecart: 1, saddle: 1, music_disc_13: 1, music_disc_cat: 1, music_disc_blocks: 1,
};

const ITEM_DURABILITIES: Record<string, number> = {
  // Swords
  diamond_sword: 1561, netherite_sword: 2031, iron_sword: 250, stone_sword: 131, wooden_sword: 59, golden_sword: 32,
  // Pickaxes
  diamond_pickaxe: 1561, netherite_pickaxe: 2031, iron_pickaxe: 250, stone_pickaxe: 131, wooden_pickaxe: 59, golden_pickaxe: 32,
  // Axes
  diamond_axe: 1561, netherite_axe: 2031, iron_axe: 250, stone_axe: 131, wooden_axe: 59, golden_axe: 32,
  // Shovels
  diamond_shovel: 1561, netherite_shovel: 2031, iron_shovel: 250, stone_shovel: 131, wooden_shovel: 59, golden_shovel: 32,
  // Hoes
  diamond_hoe: 1561, netherite_hoe: 2031, iron_hoe: 250, stone_hoe: 131, wooden_hoe: 59, golden_hoe: 32,
  // Other
  bow: 384, crossbow: 465, trident: 250, shield: 336, elytra: 432, fishing_rod: 64, flint_and_steel: 64, shears: 238, carrot_on_a_stick: 25, warped_fungus_on_a_stick: 100,
  // Armor
  diamond_helmet: 363, diamond_chestplate: 528, diamond_leggings: 495, diamond_boots: 429,
  netherite_helmet: 407, netherite_chestplate: 592, netherite_leggings: 555, netherite_boots: 481,
  iron_helmet: 165, iron_chestplate: 240, iron_leggings: 225, iron_boots: 195,
  golden_helmet: 77, golden_chestplate: 112, golden_leggings: 105, golden_boots: 91,
  leather_helmet: 55, leather_chestplate: 80, leather_leggings: 75, leather_boots: 65,
  chainmail_helmet: 165, chainmail_chestplate: 240, chainmail_leggings: 225, chainmail_boots: 195,
  turtle_helmet: 275,
};

const FIRE_RESISTANT_ITEMS = new Set([
  "netherite_sword", "netherite_pickaxe", "netherite_axe", "netherite_shovel", "netherite_hoe",
  "netherite_helmet", "netherite_chestplate", "netherite_leggings", "netherite_boots",
  "netherite_ingot", "netherite_scrap", "ancient_debris", "netherite_block",
]);

const RARE_ITEMS = new Set([
  "enchanted_golden_apple", "nether_star", "elytra", "dragon_egg", "beacon", "conduit", "heart_of_the_sea", "totem_of_undying",
]);

const UNCOMMON_ITEMS = new Set([
  "golden_apple", "music_disc_13", "music_disc_cat", "music_disc_blocks", "music_disc_chirp",
  "music_disc_far", "music_disc_mall", "music_disc_mellohi", "music_disc_stal", "music_disc_strad",
  "music_disc_ward", "music_disc_11", "music_disc_wait", "music_disc_pigstep", "music_disc_otherside",
  "music_disc_5", "music_disc_relic",
]);

const BLOCK_HARDNESS: Record<string, number> = {
  stone: 1.5, granite: 1.5, diorite: 1.5, andesite: 1.5,
  dirt: 0.5, grass_block: 0.6, cobblestone: 2.0,
  oak_planks: 2.0, spruce_planks: 2.0, birch_planks: 2.0,
  oak_log: 2.0, spruce_log: 2.0, birch_log: 2.0,
  obsidian: 50.0, crying_obsidian: 50.0,
  bedrock: -1, // Indestructible
  diamond_block: 5.0, netherite_block: 50.0, iron_block: 5.0, gold_block: 3.0,
  sand: 0.5, gravel: 0.6, glass: 0.3,
};

const BLOCK_BLAST_RESISTANCE: Record<string, number> = {
  stone: 6.0, obsidian: 1200.0, crying_obsidian: 1200.0, bedrock: 3600000.0,
  netherite_block: 1200.0, ancient_debris: 1200.0, end_portal_frame: 3600000.0,
  reinforced_deepslate: 1200.0,
};

const LUMINANCE: Record<string, number> = {
  torch: 14, wall_torch: 14, glowstone: 15, sea_lantern: 15, lantern: 15, soul_lantern: 10,
  jack_o_lantern: 15, lava: 15, fire: 15, redstone_lamp: 15, shroomlight: 15, beacon: 15,
  end_rod: 14, magma_block: 3, brewing_stand: 1, brown_mushroom: 1, crying_obsidian: 10,
  soul_fire: 10, soul_torch: 10, soul_wall_torch: 10, respawn_anchor: 15, ochre_froglight: 15,
  verdant_froglight: 15, pearlescent_froglight: 15,
};

const GRAVITY_BLOCKS = new Set([
  "sand", "red_sand", "gravel", "anvil", "chipped_anvil", "damaged_anvil", "dragon_egg",
  "white_concrete_powder", "orange_concrete_powder", "magenta_concrete_powder", "light_blue_concrete_powder",
  "yellow_concrete_powder", "lime_concrete_powder", "pink_concrete_powder", "gray_concrete_powder",
  "light_gray_concrete_powder", "cyan_concrete_powder", "purple_concrete_powder", "blue_concrete_powder",
  "brown_concrete_powder", "green_concrete_powder", "red_concrete_powder", "black_concrete_powder",
]);

const ENTITY_DATA: Record<string, { category: EntityCategory; health: number; width: number; height: number; fireImmune: boolean; mob?: MobProperties }> = {
  zombie: { category: "MONSTER", health: 20, width: 0.6, height: 1.95, fireImmune: false, mob: { attackDamage: 3, movementSpeed: 0.23, followRange: 35, spawnGroup: "MONSTER" } },
  skeleton: { category: "MONSTER", health: 20, width: 0.6, height: 1.99, fireImmune: false, mob: { attackDamage: 2, movementSpeed: 0.25, followRange: 16, spawnGroup: "MONSTER" } },
  creeper: { category: "MONSTER", health: 20, width: 0.6, height: 1.7, fireImmune: false, mob: { attackDamage: 0, movementSpeed: 0.25, followRange: 16, spawnGroup: "MONSTER" } },
  spider: { category: "MONSTER", health: 16, width: 1.4, height: 0.9, fireImmune: false, mob: { attackDamage: 2, movementSpeed: 0.3, followRange: 16, spawnGroup: "MONSTER" } },
  enderman: { category: "MONSTER", health: 40, width: 0.6, height: 2.9, fireImmune: false, mob: { attackDamage: 7, movementSpeed: 0.3, followRange: 64, spawnGroup: "MONSTER" } },
  warden: { category: "MONSTER", health: 500, width: 0.9, height: 2.9, fireImmune: false, mob: { attackDamage: 30, movementSpeed: 0.3, followRange: 16, spawnGroup: "MONSTER" } },
  blaze: { category: "MONSTER", health: 20, width: 0.6, height: 1.8, fireImmune: true },
  ghast: { category: "MONSTER", health: 10, width: 4.0, height: 4.0, fireImmune: true },
  wither_skeleton: { category: "MONSTER", health: 20, width: 0.7, height: 2.4, fireImmune: true },
  pig: { category: "CREATURE", health: 10, width: 0.9, height: 0.9, fireImmune: false },
  cow: { category: "CREATURE", health: 10, width: 0.9, height: 1.4, fireImmune: false },
  sheep: { category: "CREATURE", health: 8, width: 0.9, height: 1.3, fireImmune: false },
  chicken: { category: "CREATURE", health: 4, width: 0.4, height: 0.7, fireImmune: false },
  wolf: { category: "CREATURE", health: 8, width: 0.6, height: 0.85, fireImmune: false, mob: { attackDamage: 4, movementSpeed: 0.3, followRange: 16, spawnGroup: "CREATURE" } },
  villager: { category: "MISC", health: 20, width: 0.6, height: 1.95, fireImmune: false },
  iron_golem: { category: "MISC", health: 100, width: 1.4, height: 2.7, fireImmune: false, mob: { attackDamage: 21, movementSpeed: 0.25, followRange: 16, spawnGroup: "MISC" } },
  bat: { category: "AMBIENT", health: 6, width: 0.5, height: 0.9, fireImmune: false },
  squid: { category: "WATER_CREATURE", health: 10, width: 0.8, height: 0.8, fireImmune: false },
  dolphin: { category: "WATER_CREATURE", health: 10, width: 0.9, height: 0.6, fireImmune: false },
  cod: { category: "WATER_AMBIENT", health: 3, width: 0.5, height: 0.3, fireImmune: false },
  salmon: { category: "WATER_AMBIENT", health: 3, width: 0.7, height: 0.4, fireImmune: false },
  axolotl: { category: "UNDERGROUND_WATER_CREATURE", health: 14, width: 0.75, height: 0.42, fireImmune: false },
};

// ============================================================================
// Normalizers
// ============================================================================

/**
 * Normalizes item data to common format
 */
export function normalizeItem(
  id: string,
  edition: Edition,
  nameTranslations: LocalizedText,
  bedrockMeta?: BedrockMeta
): NormalizedItem {
  const name = id.replace("minecraft:", "");

  return {
    id,
    name: nameTranslations,
    edition,
    stackSize: ITEM_STACK_SIZES[name] ?? 64,
    durability: ITEM_DURABILITIES[name] ?? null,
    fireResistant: FIRE_RESISTANT_ITEMS.has(name),
    rarity: getItemRarity(name),
    food: getFoodProperties(name),
    equipment: getEquipmentProperties(name),
    tool: getToolProperties(name),
    bedrockMeta,
  };
}

/**
 * Normalizes block data to common format
 */
export function normalizeBlock(
  id: string,
  edition: Edition,
  nameTranslations: LocalizedText,
  blockReport?: BlockReportData,
  bedrockData?: BedrockBlockData,
  bedrockMeta?: BedrockMeta
): NormalizedBlock {
  const name = id.replace("minecraft:", "");

  // Get states from block report (Java) or Bedrock data
  const states: BlockStateProperty[] = [];

  if (blockReport?.[id]?.properties) {
    for (const [propName, values] of Object.entries(blockReport[id].properties)) {
      states.push({
        name: propName,
        type: inferStateType(propName, values),
        values,
        defaultValue: values[0],
      });
    }
  } else if (bedrockData?.properties) {
    for (const prop of bedrockData.properties) {
      states.push({
        name: prop.name,
        type: inferStateType(prop.name, prop.values.map(String)),
        values: prop.values.map(String),
        defaultValue: String(prop.values[0]),
      });
    }
  }

  return {
    id,
    name: nameTranslations,
    edition,
    hardness: BLOCK_HARDNESS[name] ?? 1.0,
    blastResistance: BLOCK_BLAST_RESISTANCE[name] ?? 6.0,
    friction: getBlockFriction(name),
    speedFactor: getBlockSpeedFactor(name),
    jumpFactor: getBlockJumpFactor(name),
    luminance: LUMINANCE[name] ?? 0,
    requiresCorrectTool: requiresCorrectTool(name),
    hasGravity: GRAVITY_BLOCKS.has(name),
    flammable: isFlammable(name),
    replaceable: isReplaceable(name),
    states,
    bedrockMeta,
  };
}

/**
 * Normalizes entity data to common format
 */
export function normalizeEntity(
  id: string,
  edition: Edition,
  nameTranslations: LocalizedText,
  bedrockData?: BedrockEntityData,
  bedrockMeta?: BedrockMeta
): NormalizedEntity {
  const name = id.replace("minecraft:", "");
  const data = ENTITY_DATA[name] ?? {
    category: "MISC" as EntityCategory,
    health: 20,
    width: 0.6,
    height: 1.8,
    fireImmune: false,
  };

  return {
    id,
    name: nameTranslations,
    edition,
    category: data.category,
    health: data.health,
    width: data.width,
    height: data.height,
    fireImmune: data.fireImmune,
    mob: data.mob ?? null,
    bedrockMeta,
  };
}

/**
 * Normalizes recipe data to common format
 */
export function normalizeRecipe(
  id: string,
  edition: Edition,
  rawRecipe: RecipeData | BedrockRecipeData,
  bedrockMeta?: BedrockMeta
): NormalizedRecipe | null {
  if ("type" in rawRecipe && typeof rawRecipe.type === "string" && rawRecipe.type.startsWith("minecraft:")) {
    // Java recipe
    return normalizeJavaRecipe(id, rawRecipe as RecipeData);
  } else if ("type" in rawRecipe) {
    // Bedrock recipe
    return normalizeBedrockRecipe(id, rawRecipe as BedrockRecipeData, bedrockMeta);
  }

  return null;
}

function normalizeJavaRecipe(id: string, recipe: RecipeData): NormalizedRecipe {
  const type = normalizeRecipeType(recipe.type);
  const result = normalizeRecipeResult(recipe.result);

  const normalized: NormalizedRecipe = {
    id,
    edition: "JAVA",
    type,
    group: recipe.group ?? null,
    result,
  };

  if (recipe.pattern) {
    normalized.pattern = recipe.pattern;
  }

  if (recipe.key) {
    normalized.key = Object.entries(recipe.key).map(([k, v]) => ({
      key: k,
      ingredient: normalizeIngredient(v),
    }));
  }

  if (recipe.ingredients) {
    normalized.ingredients = recipe.ingredients.map(normalizeIngredient);
  }

  if (recipe.ingredient) {
    normalized.ingredients = [normalizeIngredient(recipe.ingredient)];
  }

  if (recipe.experience !== undefined) {
    normalized.experience = recipe.experience;
  }

  if (recipe.cookingtime !== undefined) {
    normalized.cookingTime = recipe.cookingtime;
  }

  if (recipe.template) {
    normalized.template = normalizeIngredient(recipe.template);
  }

  if (recipe.base) {
    normalized.base = normalizeIngredient(recipe.base);
  }

  if (recipe.addition) {
    normalized.addition = normalizeIngredient(recipe.addition);
  }

  return normalized;
}

function normalizeBedrockRecipe(
  id: string,
  recipe: BedrockRecipeData,
  bedrockMeta?: BedrockMeta
): NormalizedRecipe {
  const type = normalizeBedrockRecipeType(recipe.type);

  // Handle different result formats
  let result: RecipeResult;
  if (recipe.result) {
    if (typeof recipe.result === "string") {
      result = { item: recipe.result, count: 1 };
    } else if (Array.isArray(recipe.result)) {
      const first = recipe.result[0] as { item?: string; count?: number };
      result = { item: first?.item ?? "", count: first?.count ?? 1 };
    } else {
      const r = recipe.result as { item?: string; count?: number };
      result = { item: r.item ?? "", count: r.count ?? 1 };
    }
  } else if (recipe.output) {
    if (typeof recipe.output === "string") {
      result = { item: recipe.output, count: 1 };
    } else {
      const o = recipe.output as { item?: string; count?: number };
      result = { item: o.item ?? "", count: o.count ?? 1 };
    }
  } else {
    result = { item: "unknown", count: 1 };
  }

  const normalized: NormalizedRecipe = {
    id,
    edition: "BEDROCK",
    type,
    group: null,
    result,
    bedrockMeta,
  };

  if (recipe.pattern) {
    normalized.pattern = recipe.pattern;
  }

  if (recipe.key) {
    normalized.key = Object.entries(recipe.key).map(([k, v]) => ({
      key: k,
      ingredient: normalizeBedrockIngredient(v),
    }));
  }

  if (recipe.ingredients) {
    normalized.ingredients = recipe.ingredients.map(normalizeBedrockIngredient);
  }

  return normalized;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getItemRarity(name: string): ItemRarity {
  if (name === "enchanted_golden_apple") return "EPIC";
  if (RARE_ITEMS.has(name)) return "RARE";
  if (UNCOMMON_ITEMS.has(name)) return "UNCOMMON";
  return "COMMON";
}

function getFoodProperties(name: string): FoodProperties | null {
  const FOOD_DATA: Record<string, FoodProperties> = {
    apple: { nutrition: 4, saturation: 2.4, canAlwaysEat: false, effects: [] },
    baked_potato: { nutrition: 5, saturation: 6.0, canAlwaysEat: false, effects: [] },
    beef: { nutrition: 3, saturation: 1.8, canAlwaysEat: false, effects: [] },
    cooked_beef: { nutrition: 8, saturation: 12.8, canAlwaysEat: false, effects: [] },
    bread: { nutrition: 5, saturation: 6.0, canAlwaysEat: false, effects: [] },
    golden_apple: {
      nutrition: 4, saturation: 9.6, canAlwaysEat: true,
      effects: [
        { effect: "regeneration", duration: 100, amplifier: 1, probability: 1 },
        { effect: "absorption", duration: 2400, amplifier: 0, probability: 1 },
      ],
    },
    enchanted_golden_apple: {
      nutrition: 4, saturation: 9.6, canAlwaysEat: true,
      effects: [
        { effect: "regeneration", duration: 400, amplifier: 1, probability: 1 },
        { effect: "absorption", duration: 2400, amplifier: 3, probability: 1 },
        { effect: "resistance", duration: 6000, amplifier: 0, probability: 1 },
        { effect: "fire_resistance", duration: 6000, amplifier: 0, probability: 1 },
      ],
    },
    rotten_flesh: {
      nutrition: 4, saturation: 0.8, canAlwaysEat: false,
      effects: [{ effect: "hunger", duration: 600, amplifier: 0, probability: 0.8 }],
    },
  };

  return FOOD_DATA[name] ?? null;
}

function getEquipmentProperties(name: string): EquipmentProperties | null {
  const EQUIPMENT_DATA: Record<string, EquipmentProperties> = {
    diamond_sword: { slot: "MAINHAND", attackDamage: 7, attackSpeed: 1.6, armor: null, armorToughness: null, knockbackResistance: null },
    netherite_sword: { slot: "MAINHAND", attackDamage: 8, attackSpeed: 1.6, armor: null, armorToughness: null, knockbackResistance: null },
    iron_sword: { slot: "MAINHAND", attackDamage: 6, attackSpeed: 1.6, armor: null, armorToughness: null, knockbackResistance: null },
    diamond_helmet: { slot: "HEAD", armor: 3, armorToughness: 2, knockbackResistance: null, attackDamage: null, attackSpeed: null },
    diamond_chestplate: { slot: "CHEST", armor: 8, armorToughness: 2, knockbackResistance: null, attackDamage: null, attackSpeed: null },
    diamond_leggings: { slot: "LEGS", armor: 6, armorToughness: 2, knockbackResistance: null, attackDamage: null, attackSpeed: null },
    diamond_boots: { slot: "FEET", armor: 3, armorToughness: 2, knockbackResistance: null, attackDamage: null, attackSpeed: null },
    netherite_helmet: { slot: "HEAD", armor: 3, armorToughness: 3, knockbackResistance: 0.1, attackDamage: null, attackSpeed: null },
    netherite_chestplate: { slot: "CHEST", armor: 8, armorToughness: 3, knockbackResistance: 0.1, attackDamage: null, attackSpeed: null },
    netherite_leggings: { slot: "LEGS", armor: 6, armorToughness: 3, knockbackResistance: 0.1, attackDamage: null, attackSpeed: null },
    netherite_boots: { slot: "FEET", armor: 3, armorToughness: 3, knockbackResistance: 0.1, attackDamage: null, attackSpeed: null },
  };

  return EQUIPMENT_DATA[name] ?? null;
}

function getToolProperties(name: string): ToolProperties | null {
  const TOOL_DATA: Record<string, ToolProperties> = {
    diamond_pickaxe: { type: "PICKAXE", tier: "DIAMOND", speed: 8.0, damage: 5, enchantmentValue: 10 },
    netherite_pickaxe: { type: "PICKAXE", tier: "NETHERITE", speed: 9.0, damage: 6, enchantmentValue: 15 },
    iron_pickaxe: { type: "PICKAXE", tier: "IRON", speed: 6.0, damage: 4, enchantmentValue: 14 },
    diamond_axe: { type: "AXE", tier: "DIAMOND", speed: 8.0, damage: 9, enchantmentValue: 10 },
    diamond_shovel: { type: "SHOVEL", tier: "DIAMOND", speed: 8.0, damage: 5.5, enchantmentValue: 10 },
  };

  return TOOL_DATA[name] ?? null;
}

function getBlockFriction(name: string): number {
  if (name === "ice" || name === "packed_ice") return 0.98;
  if (name === "blue_ice") return 0.989;
  if (name === "slime_block") return 0.8;
  return 0.6;
}

function getBlockSpeedFactor(name: string): number {
  if (name === "soul_sand" || name === "honey_block") return 0.4;
  return 1.0;
}

function getBlockJumpFactor(name: string): number {
  if (name === "honey_block") return 0.5;
  return 1.0;
}

function requiresCorrectTool(name: string): boolean {
  const REQUIRES_TOOL = [
    "obsidian", "crying_obsidian", "diamond_ore", "deepslate_diamond_ore",
    "emerald_ore", "deepslate_emerald_ore", "gold_ore", "deepslate_gold_ore",
    "nether_gold_ore", "redstone_ore", "deepslate_redstone_ore",
    "ancient_debris", "netherite_block",
  ];
  return REQUIRES_TOOL.includes(name);
}

function isFlammable(name: string): boolean {
  return name.includes("planks") || name.includes("log") || name.includes("wood") ||
    name.includes("leaves") || name.includes("wool") || name.includes("carpet") ||
    name === "bookshelf" || name === "tnt";
}

function isReplaceable(name: string): boolean {
  return ["air", "cave_air", "void_air", "water", "lava", "grass", "tall_grass", "fern", "large_fern"].includes(name);
}

function inferStateType(name: string, values: string[]): BlockStateProperty["type"] {
  if (values.every((v) => v === "true" || v === "false")) return "BOOLEAN";
  if (values.every((v) => !isNaN(Number(v)))) return "INTEGER";
  if (["north", "south", "east", "west", "up", "down"].some((d) => values.includes(d))) return "DIRECTION";
  return "ENUM";
}

function normalizeRecipeType(type: string): RecipeType {
  const TYPE_MAP: Record<string, RecipeType> = {
    "minecraft:crafting_shaped": "CRAFTING_SHAPED",
    "minecraft:crafting_shapeless": "CRAFTING_SHAPELESS",
    "minecraft:smelting": "SMELTING",
    "minecraft:blasting": "BLASTING",
    "minecraft:smoking": "SMOKING",
    "minecraft:campfire_cooking": "CAMPFIRE_COOKING",
    "minecraft:stonecutting": "STONECUTTING",
    "minecraft:smithing_transform": "SMITHING",
    "minecraft:smithing_trim": "SMITHING",
  };
  return TYPE_MAP[type] ?? "CRAFTING_SHAPED";
}

function normalizeBedrockRecipeType(type: string): RecipeType {
  const TYPE_MAP: Record<string, RecipeType> = {
    crafting_shaped: "CRAFTING_SHAPED",
    crafting_shapeless: "CRAFTING_SHAPELESS",
    furnace: "SMELTING",
    blast_furnace: "BLASTING",
    smoker: "SMOKING",
    campfire: "CAMPFIRE_COOKING",
    stonecutter: "STONECUTTING",
    smithing_transform: "SMITHING",
    smithing_trim: "SMITHING",
  };
  return TYPE_MAP[type] ?? "CRAFTING_SHAPED";
}

function normalizeRecipeResult(result: RecipeData["result"]): RecipeResult {
  if (typeof result === "string") {
    return { item: result, count: 1 };
  }
  if ("id" in result) {
    return { item: result.id as string, count: (result as { count?: number }).count ?? 1 };
  }
  return { item: (result as { item: string }).item, count: (result as { count?: number }).count ?? 1 };
}

function normalizeIngredient(
  ing: { item?: string; tag?: string } | Array<{ item?: string; tag?: string }>
): RecipeIngredient {
  if (Array.isArray(ing)) {
    return { items: ing.map((i) => i.item || "").filter(Boolean), tag: null };
  }
  if (ing.tag) {
    return { items: [], tag: ing.tag };
  }
  return { items: ing.item ? [ing.item] : [], tag: null };
}

function normalizeBedrockIngredient(ing: unknown): RecipeIngredient {
  if (typeof ing === "string") {
    return { items: [ing], tag: null };
  }
  if (Array.isArray(ing)) {
    return {
      items: ing.map((i) => (typeof i === "string" ? i : (i as { item?: string }).item || "")).filter(Boolean),
      tag: null,
    };
  }
  if (typeof ing === "object" && ing !== null) {
    const obj = ing as { item?: string; tag?: string };
    if (obj.tag) {
      return { items: [], tag: obj.tag };
    }
    return { items: obj.item ? [obj.item] : [], tag: null };
  }
  return { items: [], tag: null };
}
