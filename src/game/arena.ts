// Battle Arena - Jujutsu Kaisen themed 2D battle

export const ARENA_W = 800;
export const ARENA_H = 600;
export const PLAYER_RADIUS = 16;
export const PLAYER_SPEED = 5;
export const PROJECTILE_SPEED = 8;
export const PROJECTILE_RADIUS = 5;
export const TICK_RATE = 50; // ms between updates (20 ticks/sec)

export interface Character {
  id: string;
  name: string;
  color: string;
  hp: number;
  abilityName: string;
  abilityCooldown: number; // seconds
  abilityDescription: string;
}

export const CHARACTERS: Character[] = [
  {
    id: "gojo",
    name: "Gojo",
    color: "#3b82f6",
    hp: 100,
    abilityName: "Infinity",
    abilityCooldown: 10,
    abilityDescription: "Shield that blocks all damage for 3s",
  },
  {
    id: "sukuna",
    name: "Sukuna",
    color: "#ef4444",
    hp: 100,
    abilityName: "Cleave",
    abilityCooldown: 6,
    abilityDescription: "Large area slash dealing 35 damage",
  },
  {
    id: "itadori",
    name: "Itadori",
    color: "#f97316",
    hp: 100,
    abilityName: "Black Flash",
    abilityCooldown: 5,
    abilityDescription: "Dash forward dealing 25 damage on hit",
  },
  {
    id: "naoya",
    name: "Naoya",
    color: "#06b6d4",
    hp: 90,
    abilityName: "Projection Sorcery",
    abilityCooldown: 8,
    abilityDescription: "2.3s invincible + insane speed with electric afterimages",
  },
];

export interface ArenaPlayer {
  id: string;
  nickname: string;
  characterId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  shielded: boolean;
  abilityTimer: number; // remaining cooldown in ms
  // Visual effects
  dashing?: boolean;
  slashing?: boolean;
  boosted?: boolean;
  projecting?: boolean; // Naoya projection sorcery active
  trail?: { x: number; y: number }[]; // Naoya afterimage positions
}

export interface Projectile {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
}

export interface ArenaState {
  players: ArenaPlayer[];
  projectiles: Projectile[];
  gameOver: boolean;
  winnerId: string | null;
  winnerNickname: string | null;
}

// Obstacles in the arena
export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const OBSTACLES: Obstacle[] = [
  { x: 200, y: 150, w: 60, h: 60 },
  { x: 540, y: 150, w: 60, h: 60 },
  { x: 200, y: 390, w: 60, h: 60 },
  { x: 540, y: 390, w: 60, h: 60 },
  { x: 370, y: 270, w: 60, h: 60 },
];

// Spawn positions for up to 8 players
export const SPAWN_POSITIONS = [
  { x: 80, y: 80 },
  { x: 720, y: 80 },
  { x: 80, y: 520 },
  { x: 720, y: 520 },
  { x: 400, y: 80 },
  { x: 400, y: 520 },
  { x: 80, y: 300 },
  { x: 720, y: 300 },
];
