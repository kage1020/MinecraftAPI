export interface Achievement {
  parent?: string;
  criteria: {
    [key: string]: {
      trigger: string;
      conditions?: Record<string, any>;
    };
  };
  requirements: string[][];
  display: {
    description: {
      translate: string;
    };
    title: {
      translate: string;
    };
  };
}

export interface ArmorMaterial {
  id: number;
  name: string;
  maxDamageFactor: number;
  damageReductionAmount: number[];
  enchantability: number;
}

export interface Biome {
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

export interface Block {
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

export interface Color {
  id: number;
  name: string;
  hex: string;
}

export interface DataVersion {
  client: string;
  protocol: number;
  data: number | null;
}

export interface Death {
  id: number;
  name: string;
  description: string;
}

export interface Item {
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

export interface Potion {
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

export interface ToolMaterial {
  id: number;
  name: string;
  harvestLevel: number;
  maxUses: number;
  efficiency: number;
  damage: number;
  enchantability: number;
}

export interface Version {
  id: string;
  minimumLauncherVersion: number;
  releaseTime: string;
  type: string;
}
