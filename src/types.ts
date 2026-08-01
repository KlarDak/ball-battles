export interface Vector2 {
  x: number;
  y: number;
}

export type BallId =
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "purple"
  | "orange";

export type GameMode =
  | "classic"
  | "teams"
  | "melee"
  | "chaos"
  | "regen"
  | "shrinking"
  | "boss";

export type TeamId = "red" | "blue";

export type WeaponType =
  | "assaultRifle"
  | "uzi"
  | "shotgun"
  | "pistol"
  | "knife"
  | "shield";

export type WeaponPhase = "aiming" | "firing" | "held";

export interface RangedWeaponConfig {
  kind: "ranged";
  aimDelay: number;
  burstCount: number;
  burstInterval: number;
  projectileSpeed: number;
  projectileRadius: number;
  projectileDamage: number;
  pelletAngles: readonly number[];
}

export interface KnifeWeaponConfig {
  kind: "knife";
  contactDamage: number;
  hitRadius: number;
}

export interface ShieldWeaponConfig {
  kind: "shield";
  contactDamage: number;
  contactCooldown: number;
  hitRadius: number;
  durability: number;
}

export type WeaponConfig =
  | RangedWeaponConfig
  | KnifeWeaponConfig
  | ShieldWeaponConfig;

export interface EquippedWeapon {
  type: WeaponType;
  angle: number;
  targetId: BallId | null;
  phase: WeaponPhase;
  timer: number;
  shotsRemaining: number;
  contactCooldown: number;
  durability: number | null;
}

export interface Ball {
  id: BallId;
  name: string;
  team: TeamId | null;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  color: string;
  lives: number;
  maxLives: number;
  hurtTimer: number;
  regenTimer: number;
  weapon: EquippedWeapon | null;
}

export interface Projectile {
  id: number;
  ownerId: BallId;
  position: Vector2;
  previousPosition: Vector2;
  velocity: Vector2;
  radius: number;
  damage: number;
}

export type ProjectileHit =
  | { kind: "ball"; time: number; target: Ball }
  | { kind: "shield"; time: number; target: Ball }
  | { kind: "arena"; time: number };

export interface WeaponPickup {
  id: number;
  type: WeaponType;
  position: Vector2;
  radius: number;
  angle: number;
}

export interface HeartPickup {
  id: number;
  position: Vector2;
  radius: number;
  pulse: number;
}

export interface Arena {
  center: Vector2;
  radius: number;
}
