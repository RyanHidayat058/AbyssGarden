export interface SuitColorConfig {
  id: string;
  name: string;
  description: string;
  price: number;
  bodyColor: string;
  trimColor: string;
  visorColor: string;
  glowColor: string;
  badge: string;
}

export const SUITS_CATALOG: Record<string, SuitColorConfig> = {
  cyan: {
    id: 'cyan',
    name: 'Abyssal Cyan',
    description: 'Standard issue high-durability neoprene diving suit.',
    price: 0,
    bodyColor: '#0f172a',
    trimColor: '#0284c7',
    visorColor: '#4cf3d8',
    glowColor: '#4cf3d8',
    badge: '🤿'
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson Ruby',
    description: 'Thermal-lined diving weave resistant to abyssal thermal vents.',
    price: 250,
    bodyColor: '#2b0b11',
    trimColor: '#ef4444',
    visorColor: '#fca5a5',
    glowColor: '#ef4444',
    badge: '🔴'
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Trench',
    description: 'Bio-luminescent algae-treated suit favored by deep trench botanists.',
    price: 250,
    bodyColor: '#062c1e',
    trimColor: '#10b981',
    visorColor: '#6ee7b7',
    glowColor: '#10b981',
    badge: '🟢'
  },
  amethyst: {
    id: 'amethyst',
    name: 'Amethyst Void',
    description: 'Infused with catalytic grotto amethyst crystals for deep stealth.',
    price: 380,
    bodyColor: '#25103d',
    trimColor: '#a855f7',
    visorColor: '#e9d5ff',
    glowColor: '#c084fc',
    badge: '🟣'
  },
  gold: {
    id: 'gold',
    name: 'Bioluminescent Gold',
    description: 'High-visibility golden trim favored by master undersea explorers.',
    price: 500,
    bodyColor: '#2d2208',
    trimColor: '#eab308',
    visorColor: '#fef08a',
    glowColor: '#facc15',
    badge: '🟡'
  },
  obsidian: {
    id: 'obsidian',
    name: 'Shadow Obsidian',
    description: 'Reinforced volcanic obsidian composite suit absorbing all light.',
    price: 650,
    bodyColor: '#030712',
    trimColor: '#64748b',
    visorColor: '#38bdf8',
    glowColor: '#38bdf8',
    badge: '⚫'
  },
  bloodmoon: {
    id: 'bloodmoon',
    name: 'Bloodmoon Reaper',
    description: 'Forged during the sinister eclipse of the abyssal bloodmoon.',
    price: 850,
    bodyColor: '#3b0707',
    trimColor: '#f43f5e',
    visorColor: '#ff0055',
    glowColor: '#ff0055',
    badge: '🩸'
  }
};
