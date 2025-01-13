interface Block {
  id: number;
  name: string;
  displays?: {
    en: string;
  };
  hardness: number;
  resistance: number;
  stepSound: string;
  drops: {
    id: number;
    type: 'block' | 'item';
    count: number;
    probability?: number;
    condition?: 'fully_grown';
  }[];
}

interface Item {
  id: number;
  name: string;
  displays?: {
    en: string;
  };
  maxStackSize: number;
  tool?: {
    usage: number;
    material?: string;
    damage?: number;
    effectiveBlocks: number[];
  };
  armor?: {
    usage: number;
    material: string;
    durability: number;
  };
  food?: {
    amount: number;
    saturation: number;
  };
}

interface Biome {
  id: number;
  name: string;
  displays: {
    en: string;
  };
  colors: {
    map: string;
    grass: string;
  };
  temperature: number;
  downfall: number;
}

interface ToolMaterial {
  id: number;
  name: string;
  harvestLevel: number;
  maxUses: number;
  efficiency: number;
  damage: number;
  enchantability: number;
}

interface Potion {
  id: number;
  name: string;
  displays: {
    en: {
      name: string;
      effect: string;
    };
  };
  ingredients: {
    id: number;
    amount: number;
  }[][];
  extendable: boolean;
  upgradeable: boolean;
}

interface Color {
  id: number;
  name: string;
  hex: string;
}

interface ArmorMaterial {
  id: number;
  name: string;
  maxDamageFactor: number;
  damageReductionAmount: number[];
  enchantability: number;
}
