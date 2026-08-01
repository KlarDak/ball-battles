import type {
  BallId,
  WeaponConfig,
  WeaponType,
} from "./types";

export const WORLD_WIDTH = 1080;
export const WORLD_HEIGHT = 1920;
export const BASE_ARENA_RADIUS = 500;
export const MIN_ARENA_RADIUS = 285;
export const MAX_LIVES = 10;
export const EQUIPPED_WEAPON_SIZE = 92;
export const EQUIPPED_WEAPON_OFFSET = 24;
export const SHIELD_DURABILITY = 3;
export const WEAPON_RADIUS = 46;
export const MAX_WEAPON_PICKUPS = 6;
export const MIN_SPAWN_DELAY = 1;
export const MAX_SPAWN_DELAY = 2.5;

export const WEAPON_CONFIGS = {
  assaultRifle: {
    kind: "ranged",
    aimDelay: 0.65,
    burstCount: 6,
    burstInterval: 0.14,
    projectileSpeed: 1000,
    projectileRadius: 8,
    projectileDamage: 1,
    pelletAngles: [0],
  },
  uzi: {
    kind: "ranged",
    aimDelay: 0.55,
    burstCount: 6,
    burstInterval: 0.07,
    projectileSpeed: 1100,
    projectileRadius: 7,
    projectileDamage: 1,
    pelletAngles: [0],
  },
  shotgun: {
    kind: "ranged",
    aimDelay: 0.75,
    burstCount: 1,
    burstInterval: 0,
    projectileSpeed: 850,
    projectileRadius: 12,
    projectileDamage: 2,
    pelletAngles: [-Math.PI / 8, Math.PI / 8],
  },
  pistol: {
    kind: "ranged",
    aimDelay: 0.6,
    burstCount: 1,
    burstInterval: 0,
    projectileSpeed: 950,
    projectileRadius: 9,
    projectileDamage: 1,
    pelletAngles: [0],
  },
  knife: {
    kind: "knife",
    contactDamage: 1,
    hitRadius: 12,
  },
  shield: {
    kind: "shield",
    contactDamage: 1,
    contactCooldown: 0.85,
    hitRadius: 42,
    durability: SHIELD_DURABILITY,
  },
} satisfies Record<WeaponType, WeaponConfig>;

export const BALL_PRESETS: ReadonlyArray<{
  id: BallId;
  name: string;
  color: string;
}> = [
  { id: "red", name: "RED", color: "#e72c58" },
  { id: "blue", name: "BLUE", color: "#6495ed" },
  { id: "green", name: "GREEN", color: "#4fcf8b" },
  { id: "yellow", name: "YELLOW", color: "#f2c94c" },
  { id: "purple", name: "PURPLE", color: "#a879ff" },
  { id: "orange", name: "ORANGE", color: "#ff8a4c" },
];

export const WEAPON_TYPES: readonly WeaponType[] = [
  "assaultRifle",
  "uzi",
  "shotgun",
  "pistol",
  "knife",
  "shield",
];
