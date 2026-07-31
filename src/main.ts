interface Vector2 {
  x: number;
  y: number;
}

type BallId = "red" | "blue" | "green" | "yellow" | "purple" | "orange";

type WeaponType =
  | "assaultRifle"
  | "uzi"
  | "shotgun"
  | "pistol"
  | "knife"
  | "shield";

type WeaponPhase = "aiming" | "firing" | "held";

interface RangedWeaponConfig {
  kind: "ranged";
  aimDelay: number;
  burstCount: number;
  burstInterval: number;
  projectileSpeed: number;
  projectileRadius: number;
  projectileDamage: number;
  pelletAngles: readonly number[];
}

interface KnifeWeaponConfig {
  kind: "knife";
  contactDamage: number;
  hitRadius: number;
}

interface ShieldWeaponConfig {
  kind: "shield";
  contactDamage: number;
  contactCooldown: number;
  hitRadius: number;
  durability: number;
}

type WeaponConfig =
  | RangedWeaponConfig
  | KnifeWeaponConfig
  | ShieldWeaponConfig;

interface EquippedWeapon {
  type: WeaponType;
  angle: number;
  targetId: BallId | null;
  phase: WeaponPhase;
  timer: number;
  shotsRemaining: number;
  contactCooldown: number;
  durability: number | null;
}

interface Ball {
  id: BallId;
  name: string;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  color: string;
  lives: number;
  hurtTimer: number;
  weapon: EquippedWeapon | null;
}

interface Projectile {
  id: number;
  ownerId: BallId;
  position: Vector2;
  previousPosition: Vector2;
  velocity: Vector2;
  radius: number;
  damage: number;
}

type ProjectileHit =
  | {
      kind: "ball";
      time: number;
      target: Ball;
    }
  | {
      kind: "shield";
      time: number;
      target: Ball;
    }
  | {
      kind: "arena";
      time: number;
    };

const arena = {
  center: {
    x: 540,
    y: 1050,
  },
  radius: 500,
};

const MAX_LIVES = 10;
const EQUIPPED_WEAPON_SIZE = 92;
const EQUIPPED_WEAPON_OFFSET = 24;
const SHIELD_DURABILITY = 3;

const WEAPON_CONFIGS = {
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

let audioContext: AudioContext | null = null;

function enableAudio(): void {
  audioContext ??= new AudioContext();

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }
}

function playShotSound(type: WeaponType): void {
  const audio = audioContext;

  if (!audio || audio.state !== "running") {
    return;
  }

  const now = audio.currentTime;
  const settings = {
    assaultRifle: { frequency: 135, duration: .065, volume: .09 },
    uzi: { frequency: 190, duration: .04, volume: .065 },
    pistol: { frequency: 115, duration: .11, volume: .13 },
    shotgun: { frequency: 75, duration: .18, volume: .18 },
  } as const;

  if (type === "knife" || type === "shield") {
    return;
  }

  const setting = settings[type];
  const oscillator = audio.createOscillator();
  const oscillatorGain = audio.createGain();
  oscillator.type = type === "uzi" ? "square" : "sawtooth";
  oscillator.frequency.setValueAtTime(setting.frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(45, now + setting.duration);
  oscillatorGain.gain.setValueAtTime(setting.volume, now);
  oscillatorGain.gain.exponentialRampToValueAtTime(.001, now + setting.duration);
  oscillator.connect(oscillatorGain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + setting.duration);

  const sampleCount = Math.max(1, Math.floor(audio.sampleRate * setting.duration));
  const noiseBuffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);

  for (let index = 0; index < sampleCount; index++) {
    noiseData[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
  }

  const noise = audio.createBufferSource();
  const noiseGain = audio.createGain();
  noise.buffer = noiseBuffer;
  noiseGain.gain.setValueAtTime(setting.volume * (type === "shotgun" ? 1.5 : .65), now);
  noiseGain.gain.exponentialRampToValueAtTime(.001, now + setting.duration);
  noise.connect(noiseGain).connect(audio.destination);
  noise.start(now);
}

function playPickupReminderSound(): void {
  const audio = audioContext;

  if (!audio || audio.state !== "running") {
    return;
  }

  const now = audio.currentTime;

  for (const [index, frequency] of [660, 880].entries()) {
    const start = now + index * .09;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.055, start);
    gain.gain.exponentialRampToValueAtTime(.001, start + .16);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + .16);
  }
}

function playHealSound(): void {
  const audio = audioContext;

  if (!audio || audio.state !== "running") {
    return;
  }

  const now = audio.currentTime;

  for (const [index, frequency] of [523, 659, 784].entries()) {
    const start = now + index * .075;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.07, start);
    gain.gain.exponentialRampToValueAtTime(.001, start + .22);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + .22);
  }
}

function playDamageSound(): void {
  const audio = audioContext;

  if (!audio || audio.state !== "running") {
    return;
  }

  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(105, now);
  oscillator.frequency.exponentialRampToValueAtTime(52, now + .12);
  gain.gain.setValueAtTime(.12, now);
  gain.gain.exponentialRampToValueAtTime(.001, now + .13);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + .13);

  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * .07), audio.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < data.length; index++) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
  }

  const noise = audio.createBufferSource();
  const noiseGain = audio.createGain();
  noise.buffer = buffer;
  noiseGain.gain.setValueAtTime(.075, now);
  noiseGain.gain.exponentialRampToValueAtTime(.001, now + .07);
  noise.connect(noiseGain).connect(audio.destination);
  noise.start(now);
}

const BALL_PRESETS: ReadonlyArray<{ id: BallId; name: string; color: string }> = [
  { id: "red", name: "RED", color: "#e72c58" },
  { id: "blue", name: "BLUE", color: "#6495ed" },
  { id: "green", name: "GREEN", color: "#4fcf8b" },
  { id: "yellow", name: "YELLOW", color: "#f2c94c" },
  { id: "purple", name: "PURPLE", color: "#a879ff" },
  { id: "orange", name: "ORANGE", color: "#ff8a4c" },
];

function createBalls(count: number): Ball[] {
  const createdBalls: Ball[] = [];

  for (const preset of BALL_PRESETS.slice(0, count)) {
    const radius = 52;
    let position = randomPointInsideArena(radius + 45);
    let attempts = 0;

    while (
      createdBalls.some((ball) =>
        circlesOverlap(position, radius + 55, ball.position, ball.radius),
      ) &&
      attempts < 100
    ) {
      position = randomPointInsideArena(radius + 45);
      attempts += 1;
    }

    const movementAngle = Math.random() * Math.PI * 2;
    const speed = randomBetween(330, 450);

    createdBalls.push({
      ...preset,
      position,
      velocity: {
        x: Math.cos(movementAngle) * speed,
        y: Math.sin(movementAngle) * speed,
      },
      radius,
      lives: MAX_LIVES,
      hurtTimer: 0,
      weapon: null,
    });
  }

  return createdBalls;
}

const balls: Ball[] = createBalls(2);

interface WeaponPickup {
  id: number;
  type: WeaponType;
  position: Vector2;
  radius: number;
  angle: number;
}

interface HeartPickup {
  id: number;
  position: Vector2;
  radius: number;
  pulse: number;
}

const WEAPON_TYPES: readonly WeaponType[] = [
  "assaultRifle",
  "uzi",
  "shotgun",
  "pistol",
  "knife",
  "shield",
];

let enabledWeaponTypes: WeaponType[] = [...WEAPON_TYPES];
let healingEnabled = true;

const weaponPickups: WeaponPickup[] = [];
const heartPickups: HeartPickup[] = [];
const projectiles: Projectile[] = [];

const WEAPON_RADIUS = 46;
const MAX_WEAPON_PICKUPS = 6;
const MIN_SPAWN_DELAY = 1;
const MAX_SPAWN_DELAY = 2.5;

let nextWeaponId = 1;
let nextHeartId = 1;
let nextProjectileId = 1;
let weaponSpawnTimer = randomBetween(MIN_SPAWN_DELAY, MAX_SPAWN_DELAY);
let pickupReminderTimer = 0;
let heartSpawnTimer = randomBetween(4, 7);

function randomBetween(minimum: number, maximum: number): number {
  return minimum + Math.random() * (maximum - minimum);
}

function randomPointInsideArena(margin: number): Vector2 {
  const angle = Math.random() * Math.PI * 2;

  const distance = Math.sqrt(Math.random()) * (arena.radius - margin);

  return {
    x: arena.center.x + Math.cos(angle) * distance,
    y: arena.center.y + Math.sin(angle) * distance,
  };
}

function spawnWeapon(): void {
  if (enabledWeaponTypes.length === 0) {
    return;
  }

  const type = enabledWeaponTypes[
    Math.floor(Math.random() * enabledWeaponTypes.length)
  ];

  weaponPickups.push({
    id: nextWeaponId++,
    type,
    position: randomPointInsideArena(WEAPON_RADIUS),
    radius: WEAPON_RADIUS,
    angle: Math.random() * Math.PI * 2,
  });
}

function fillPolygon(points: readonly Vector2[]): void {
  const firstPoint = points[0];

  if (!firstPoint) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(firstPoint.x, firstPoint.y);

  for (let index = 1; index < points.length; index++) {
    const point = points[index];

    if (point) {
      ctx.lineTo(point.x, point.y);
    }
  }

  ctx.closePath();
  ctx.fill();
}

function drawAssaultRifleIcon(): void {
  ctx.fillRect(-26, -11, 55, 19);
  ctx.fillRect(28, -5, 20, 6);
  ctx.fillRect(46, -8, 6, 12);
  ctx.fillRect(-5, -17, 18, 6);

  fillPolygon([
    { x: -25, y: -8 },
    { x: -43, y: -19 },
    { x: -52, y: -15 },
    { x: -44, y: 8 },
    { x: -25, y: 5 },
  ]);

  fillPolygon([
    { x: -14, y: 7 },
    { x: -1, y: 7 },
    { x: -6, y: 29 },
    { x: -19, y: 27 },
  ]);

  fillPolygon([
    { x: 5, y: 7 },
    { x: 19, y: 7 },
    { x: 15, y: 30 },
    { x: 2, y: 26 },
  ]);
}

function drawUziIcon(): void {
  ctx.fillRect(-25, -17, 52, 25);
  ctx.fillRect(27, -8, 18, 6);
  ctx.fillRect(-7, 8, 18, 32);
  ctx.fillRect(-33, -12, 9, 6);
  ctx.fillRect(-9, -23, 19, 6);
}

function drawShotgunIcon(): void {
  ctx.fillRect(-22, -8, 43, 16);
  ctx.fillRect(18, -10, 33, 7);
  ctx.fillRect(16, 2, 27, 12);
  ctx.fillRect(49, -12, 5, 12);

  fillPolygon([
    { x: -20, y: -6 },
    { x: -44, y: -20 },
    { x: -53, y: -16 },
    { x: -46, y: 9 },
    { x: -20, y: 6 },
  ]);
}

function drawPistolIcon(): void {
  ctx.fillRect(-27, -17, 64, 17);
  ctx.fillRect(35, -13, 8, 9);

  fillPolygon([
    { x: -12, y: -1 },
    { x: 12, y: -1 },
    { x: 6, y: 32 },
    { x: -18, y: 32 },
  ]);
}

function drawKnifeIcon(): void {
  fillPolygon([
    { x: -6, y: -13 },
    { x: 46, y: 0 },
    { x: -6, y: 13 },
  ]);

  ctx.fillRect(-13, -18, 7, 36);
  ctx.fillRect(-44, -9, 31, 18);
}

function drawShieldIcon(accentColor: string): void {
  ctx.beginPath();
  ctx.moveTo(0, -43);
  ctx.lineTo(34, -29);
  ctx.lineTo(29, 8);
  ctx.quadraticCurveTo(23, 32, 0, 45);
  ctx.quadraticCurveTo(-23, 32, -29, 8);
  ctx.lineTo(-34, -29);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(0, 27);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 5;
  ctx.stroke();
}

function drawWeaponIcon(
  type: WeaponType,
  x: number,
  y: number,
  size: number,
  angle: number,
  fillColor = "#111322",
  accentColor = "#f2c94c",
): void {
  ctx.save();

  ctx.translate(x, y);
  ctx.rotate(angle);

  const scale = size / 100;
  ctx.scale(scale, scale);

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = fillColor;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (type) {
    case "assaultRifle":
      drawAssaultRifleIcon();
      break;

    case "uzi":
      drawUziIcon();
      break;

    case "shotgun":
      drawShotgunIcon();
      break;

    case "pistol":
      drawPistolIcon();
      break;

    case "knife":
      drawKnifeIcon();
      break;

    case "shield":
      drawShieldIcon(accentColor);
      break;
  }

  ctx.restore();
}

function updateWeaponSpawner(deltaTime: number): void {
  weaponSpawnTimer -= deltaTime;

  if (weaponSpawnTimer > 0) {
    return;
  }

  if (weaponPickups.length < MAX_WEAPON_PICKUPS) {
    spawnWeapon();
  }

  weaponSpawnTimer = randomBetween(MIN_SPAWN_DELAY, MAX_SPAWN_DELAY);
}

function updatePickupReminder(deltaTime: number): void {
  if (weaponPickups.length === 0) {
    pickupReminderTimer = 0;
    return;
  }

  pickupReminderTimer -= deltaTime;

  if (pickupReminderTimer <= 0) {
    playPickupReminderSound();
    pickupReminderTimer = 1.1;
  }
}

function updateHeartPickups(deltaTime: number): void {
  if (!healingEnabled) {
    heartPickups.length = 0;
    return;
  }

  for (const heart of heartPickups) {
    heart.pulse += deltaTime * 5;
  }

  if (!balls.some((ball) => ball.lives > 0 && ball.lives < MAX_LIVES)) {
    heartSpawnTimer = Math.max(heartSpawnTimer, 2);
    return;
  }

  heartSpawnTimer -= deltaTime;

  if (heartSpawnTimer <= 0 && heartPickups.length < 2) {
    heartPickups.push({
      id: nextHeartId++,
      position: randomPointInsideArena(42),
      radius: 34,
      pulse: Math.random() * Math.PI * 2,
    });
    heartSpawnTimer = randomBetween(5, 9);
  }

  for (let index = heartPickups.length - 1; index >= 0; index--) {
    const heart = heartPickups[index];
    const collector = balls.find(
      (ball) =>
        ball.lives > 0 &&
        ball.lives < MAX_LIVES &&
        circlesOverlap(ball.position, ball.radius, heart.position, heart.radius),
    );

    if (collector) {
      collector.lives = Math.min(MAX_LIVES, collector.lives + 2);
      heartPickups.splice(index, 1);
      playHealSound();
    }
  }
}

function circlesOverlap(
  firstPosition: Vector2,
  firstRadius: number,
  secondPosition: Vector2,
  secondRadius: number,
): boolean {
  const dx = secondPosition.x - firstPosition.x;
  const dy = secondPosition.y - firstPosition.y;
  const combinedRadius = firstRadius + secondRadius;

  return dx * dx + dy * dy <= combinedRadius * combinedRadius;
}

function chooseRandomTarget(owner: Ball): Ball | null {
  const candidates = balls.filter(
    (ball) => ball.id !== owner.id && ball.lives > 0,
  );

  if (candidates.length === 0) {
    return null;
  }

  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

function angleBetween(from: Vector2, to: Vector2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function createEquippedWeapon(
  owner: Ball,
  type: WeaponType,
  fallbackAngle: number,
): EquippedWeapon {
  const target = chooseRandomTarget(owner);
  const config = WEAPON_CONFIGS[type];

  return {
    type,
    angle: target
      ? angleBetween(owner.position, target.position)
      : fallbackAngle,
    targetId: target?.id ?? null,
    phase: config.kind === "ranged" ? "aiming" : "held",
    timer: config.kind === "ranged" ? config.aimDelay : 0,
    shotsRemaining: config.kind === "ranged" ? config.burstCount : 0,
    contactCooldown: 0,
    durability: config.kind === "shield" ? config.durability : null,
  };
}

function collectWeaponPickups(): void {
  for (let index = weaponPickups.length - 1; index >= 0; index--) {
    const pickup = weaponPickups[index];

    if (!pickup) {
      continue;
    }

    const collector = balls.find(
      (ball) =>
        ball.lives > 0 &&
        circlesOverlap(
          ball.position,
          ball.radius,
          pickup.position,
          pickup.radius,
        ),
    );

    if (!collector) {
      continue;
    }

    const previousWeapon = collector.weapon?.type;
    collector.weapon = createEquippedWeapon(
      collector,
      pickup.type,
      pickup.angle,
    );

    weaponPickups.splice(index, 1);

    if (previousWeapon) {
      console.info(
        `${collector.id} replaced ${previousWeapon} with ${pickup.type}`,
      );
    } else {
      console.info(`${collector.id} picked up ${pickup.type}`);
    }
  }
}

function updateWeaponAiming(): void {
  for (const owner of balls) {
    const weapon = owner.weapon;

    if (!weapon || owner.lives <= 0) {
      continue;
    }

    let target =
      weapon.targetId === null
        ? null
        : balls.find((ball) => ball.id === weapon.targetId) ?? null;

    if (!target || target.lives <= 0 || target.id === owner.id) {
      target = chooseRandomTarget(owner);
      weapon.targetId = target?.id ?? null;
    }

    if (target) {
      weapon.angle = angleBetween(owner.position, target.position);
    }
  }
}

function getEquippedWeaponCenter(ball: Ball, angle: number): Vector2 {
  const distanceFromCenter = ball.radius + EQUIPPED_WEAPON_OFFSET;

  return {
    x: ball.position.x + Math.cos(angle) * distanceFromCenter,
    y: ball.position.y + Math.sin(angle) * distanceFromCenter,
  };
}

function spawnProjectile(
  owner: Ball,
  angle: number,
  config: RangedWeaponConfig,
): void {
  const weaponAngle = owner.weapon?.angle ?? angle;
  const spawnDistance = owner.radius + config.projectileRadius + 2;
  const origin = {
    x: owner.position.x + Math.cos(weaponAngle) * spawnDistance,
    y: owner.position.y + Math.sin(weaponAngle) * spawnDistance,
  };

  projectiles.push({
    id: nextProjectileId++,
    ownerId: owner.id,
    position: { ...origin },
    previousPosition: { ...origin },
    velocity: {
      x: Math.cos(angle) * config.projectileSpeed,
      y: Math.sin(angle) * config.projectileSpeed,
    },
    radius: config.projectileRadius,
    damage: config.projectileDamage,
  });
}

function fireWeapon(
  owner: Ball,
  weapon: EquippedWeapon,
  config: RangedWeaponConfig,
): void {
  playShotSound(weapon.type);

  for (const pelletAngle of config.pelletAngles) {
    spawnProjectile(owner, weapon.angle + pelletAngle, config);
  }

  console.info(
    `${owner.id} fired ${weapon.type}: ${config.pelletAngles.length} projectile(s)`,
  );
}

function updateRangedWeapons(deltaTime: number): void {
  for (const owner of balls) {
    const weapon = owner.weapon;

    if (!weapon || owner.lives <= 0) {
      continue;
    }

    const config = WEAPON_CONFIGS[weapon.type];

    if (config.kind !== "ranged") {
      continue;
    }

    weapon.timer -= deltaTime;

    if (weapon.phase === "aiming") {
      if (weapon.timer > 0) {
        continue;
      }

      weapon.phase = "firing";
      weapon.timer = 0;
    }

    while (
      owner.weapon === weapon &&
      weapon.phase === "firing" &&
      weapon.timer <= 0
    ) {
      fireWeapon(owner, weapon, config);
      weapon.shotsRemaining -= 1;

      if (weapon.shotsRemaining <= 0) {
        owner.weapon = null;
        break;
      }

      weapon.timer += config.burstInterval;
    }
  }
}

function getKnifeBladeSegment(
  ball: Ball,
  angle: number,
): { start: Vector2; end: Vector2 } {
  const iconScale = EQUIPPED_WEAPON_SIZE / 100;
  const weaponCenterDistance =
    ball.radius + EQUIPPED_WEAPON_OFFSET;
  const bladeStartDistance =
    weaponCenterDistance - 6 * iconScale;
  const bladeEndDistance =
    weaponCenterDistance + 46 * iconScale;

  return {
    start: {
      x:
        ball.position.x +
        Math.cos(angle) * bladeStartDistance,
      y:
        ball.position.y +
        Math.sin(angle) * bladeStartDistance,
    },
    end: {
      x:
        ball.position.x +
        Math.cos(angle) * bladeEndDistance,
      y:
        ball.position.y +
        Math.sin(angle) * bladeEndDistance,
    },
  };
}

function getWeaponTarget(
  owner: Ball,
  weapon: EquippedWeapon,
): Ball | null {
  if (weapon.targetId === null) {
    return null;
  }

  return (
    balls.find(
      (ball) =>
        ball.id === weapon.targetId &&
        ball.id !== owner.id &&
        ball.lives > 0,
    ) ?? null
  );
}

function damageShield(target: Ball, damage: number): boolean {
  const shield = target.weapon;

  if (!shield) {
    return false;
  }

  const config = WEAPON_CONFIGS[shield.type];

  if (config.kind !== "shield") {
    return false;
  }

  const currentDurability = shield.durability ?? config.durability;
  shield.durability = Math.max(0, currentDurability - damage);

  console.info(
    `${target.id} shield took ${damage} hit; ${shield.durability} durability remains`,
  );

  if (shield.durability === 0 && target.weapon === shield) {
    target.weapon = null;
    console.info(`${target.id} shield broke`);
  }

  return true;
}

function updateContactWeapons(deltaTime: number): void {
  for (const owner of balls) {
    const weapon = owner.weapon;

    if (!weapon || owner.lives <= 0) {
      continue;
    }

    weapon.contactCooldown = Math.max(
      0,
      weapon.contactCooldown - deltaTime,
    );

    if (weapon.contactCooldown > 0) {
      continue;
    }

    const config = WEAPON_CONFIGS[weapon.type];

    if (config.kind === "ranged") {
      continue;
    }

    const target = getWeaponTarget(owner, weapon);

    if (!target) {
      continue;
    }

    if (config.kind === "knife") {
      const blade = getKnifeBladeSegment(owner, weapon.angle);
      const targetShield = target.weapon;

      if (targetShield?.type === "shield") {
        const shieldConfig = WEAPON_CONFIGS[targetShield.type];
        const shieldCenter = getEquippedWeaponCenter(
          target,
          targetShield.angle,
        );

        if (
          segmentCircleHitTime(
            blade.start,
            blade.end,
            shieldCenter,
            shieldConfig.hitRadius + config.hitRadius,
          ) !== null
        ) {
          damageShield(target, 1);
          owner.weapon = null;
          continue;
        }
      }

      if (
        segmentCircleHitTime(
          blade.start,
          blade.end,
          target.position,
          target.radius + config.hitRadius,
        ) !== null
      ) {
        applyDamage(target, config.contactDamage);
        owner.weapon = null;
      }

      continue;
    }

    const shieldCenter = getEquippedWeaponCenter(owner, weapon.angle);

    if (
      circlesOverlap(
        shieldCenter,
        config.hitRadius,
        target.position,
        target.radius,
      )
    ) {
      applyDamage(target, config.contactDamage);
      weapon.contactCooldown = config.contactCooldown;
      damageShield(owner, 1);
    }
  }
}

function updateProjectiles(deltaTime: number): void {
  for (const projectile of projectiles) {
    projectile.previousPosition.x = projectile.position.x;
    projectile.previousPosition.y = projectile.position.y;

    projectile.position.x += projectile.velocity.x * deltaTime;
    projectile.position.y += projectile.velocity.y * deltaTime;
  }
}

function segmentCircleHitTime(
  start: Vector2,
  end: Vector2,
  center: Vector2,
  radius: number,
): number | null {
  const directionX = end.x - start.x;
  const directionY = end.y - start.y;
  const offsetX = start.x - center.x;
  const offsetY = start.y - center.y;

  const a =
    directionX * directionX +
    directionY * directionY;

  const c =
    offsetX * offsetX +
    offsetY * offsetY -
    radius * radius;

  if (c <= 0) {
    return 0;
  }

  if (a <= 1e-12) {
    return null;
  }

  const b =
    2 *
    (offsetX * directionX +
      offsetY * directionY);

  const discriminant = b * b - 4 * a * c;

  if (discriminant < -1e-9) {
    return null;
  }

  const squareRoot = Math.sqrt(Math.max(0, discriminant));
  const firstTime = (-b - squareRoot) / (2 * a);
  const secondTime = (-b + squareRoot) / (2 * a);

  if (firstTime >= -1e-9 && firstTime <= 1 + 1e-9) {
    return Math.max(0, Math.min(1, firstTime));
  }

  if (secondTime >= -1e-9 && secondTime <= 1 + 1e-9) {
    return Math.max(0, Math.min(1, secondTime));
  }

  return null;
}

function getProjectileHitPriority(hit: ProjectileHit): number {
  switch (hit.kind) {
    case "shield":
      return 0;
    case "ball":
      return 1;
    case "arena":
      return 2;
  }
}

function chooseEarlierProjectileHit(
  current: ProjectileHit | null,
  candidate: ProjectileHit,
): ProjectileHit {
  if (!current) {
    return candidate;
  }

  const timeDifference = candidate.time - current.time;

  if (timeDifference < -1e-9) {
    return candidate;
  }

  if (
    Math.abs(timeDifference) <= 1e-9 &&
    getProjectileHitPriority(candidate) <
      getProjectileHitPriority(current)
  ) {
    return candidate;
  }

  return current;
}

function getArenaExitTime(projectile: Projectile): number | null {
  const startX = projectile.previousPosition.x - arena.center.x;
  const startY = projectile.previousPosition.y - arena.center.y;
  const endX = projectile.position.x - arena.center.x;
  const endY = projectile.position.y - arena.center.y;
  const limit = arena.radius - projectile.radius;
  const limitSquared = limit * limit;
  const endDistanceSquared = endX * endX + endY * endY;

  if (endDistanceSquared <= limitSquared) {
    return null;
  }

  const startDistanceSquared =
    startX * startX +
    startY * startY;

  if (startDistanceSquared > limitSquared + 1e-9) {
    return 0;
  }

  const directionX = endX - startX;
  const directionY = endY - startY;
  const a =
    directionX * directionX +
    directionY * directionY;

  if (a <= 1e-12) {
    return 0;
  }

  const b =
    2 *
    (startX * directionX +
      startY * directionY);

  const c = startDistanceSquared - limitSquared;
  const discriminant = Math.max(0, b * b - 4 * a * c);
  const exitTime =
    (-b + Math.sqrt(discriminant)) /
    (2 * a);

  return Math.max(0, Math.min(1, exitTime));
}

function getEarliestProjectileHit(
  projectile: Projectile,
): ProjectileHit | null {
  let earliestHit: ProjectileHit | null = null;

  for (const target of balls) {
    if (target.id === projectile.ownerId || target.lives <= 0) {
      continue;
    }

    if (target.weapon?.type === "shield") {
      const shieldConfig = WEAPON_CONFIGS[target.weapon.type];
      const shieldCenter = getEquippedWeaponCenter(
        target,
        target.weapon.angle,
      );

      const shieldHitTime = segmentCircleHitTime(
        projectile.previousPosition,
        projectile.position,
        shieldCenter,
        shieldConfig.hitRadius + projectile.radius,
      );

      if (shieldHitTime !== null) {
        earliestHit = chooseEarlierProjectileHit(earliestHit, {
          kind: "shield",
          time: shieldHitTime,
          target,
        });
      }
    }

    const ballHitTime = segmentCircleHitTime(
      projectile.previousPosition,
      projectile.position,
      target.position,
      target.radius + projectile.radius,
    );

    if (ballHitTime !== null) {
      earliestHit = chooseEarlierProjectileHit(earliestHit, {
        kind: "ball",
        time: ballHitTime,
        target,
      });
    }
  }

  const arenaExitTime = getArenaExitTime(projectile);

  if (arenaExitTime !== null) {
    earliestHit = chooseEarlierProjectileHit(earliestHit, {
      kind: "arena",
      time: arenaExitTime,
    });
  }

  return earliestHit;
}

function applyDamage(target: Ball, damage: number): void {
  if (target.lives <= 0) {
    return;
  }

  target.lives = Math.max(0, target.lives - damage);
  target.hurtTimer = .32;
  playDamageSound();

  console.info(
    `${target.id} took ${damage} damage; ${target.lives} lives remain`,
  );

  if (target.lives === 0) {
    target.weapon = null;

    if (isBattleOver()) {
      for (const ball of balls) {
        ball.velocity.x = 0;
        ball.velocity.y = 0;
      }
    }
  }
}

function isBattleOver(): boolean {
  return balls.filter((ball) => ball.lives > 0).length <= 1;
}

function resolveProjectileCollisions(): void {
  while (true) {
    let nextCollision:
      | {
          projectile: Projectile;
          hit: ProjectileHit;
        }
      | null = null;

    for (const projectile of projectiles) {
      const hit = getEarliestProjectileHit(projectile);

      if (
        hit &&
        (
          !nextCollision ||
          hit.time < nextCollision.hit.time - 1e-9 ||
          (
            Math.abs(hit.time - nextCollision.hit.time) <= 1e-9 &&
            projectile.id < nextCollision.projectile.id
          )
        )
      ) {
        nextCollision = { projectile, hit };
      }
    }

    if (!nextCollision) {
      return;
    }

    const projectileIndex = projectiles.indexOf(
      nextCollision.projectile,
    );

    if (projectileIndex === -1) {
      continue;
    }

    const { projectile, hit } = nextCollision;

    if (hit.kind === "ball") {
      applyDamage(hit.target, projectile.damage);
    } else if (hit.kind === "shield") {
      damageShield(hit.target, 1);
      console.info(
        `projectile ${projectile.id} was blocked by a shield`,
      );
    }

    projectiles.splice(projectileIndex, 1);
  }
}

function getCanvas(selector: string): HTMLCanvasElement {
  const element = document.querySelector(selector);

  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(`Canvas ${selector} was not found!`);
  }

  return element;
}

function getContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D is unavailable!");
  }

  return context;
}

const canvas = getCanvas("#game");
const ctx = getContext2D(canvas);
const toggleButton = document.querySelector<HTMLButtonElement>("#toggle");
const restartButton = document.querySelector<HTMLButtonElement>("#restart");
const startButton = document.querySelector<HTMLButtonElement>("#start");
const setupPanel = document.querySelector<HTMLElement>("#setup");

let paused = true;

function startBattle(count: number): void {
  enableAudio();
  balls.splice(0, balls.length, ...createBalls(count));
  weaponPickups.length = 0;
  heartPickups.length = 0;
  projectiles.length = 0;
  weaponSpawnTimer = .35;
  pickupReminderTimer = 0;
  heartSpawnTimer = randomBetween(4, 7);
  accumulator = 0;
  paused = false;
  setupPanel?.setAttribute("hidden", "");
  if (toggleButton) {
    toggleButton.textContent = "Pause";
    toggleButton.setAttribute("aria-label", "Put the fight on pause");
  }
}

function showBattleSetup(): void {
  paused = true;
  setupPanel?.removeAttribute("hidden");
}

startButton?.addEventListener("click", () => {
  const selected = document.querySelector<HTMLInputElement>('input[name="fighters"]:checked');
  const count = Math.max(2, Math.min(6, Number(selected?.value ?? 2)));
  enabledWeaponTypes = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[data-weapon]:checked'),
    (input) => input.dataset.weapon as WeaponType,
  );
  healingEnabled = document.querySelector<HTMLInputElement>("#healing")?.checked ?? true;
  startBattle(count);
});

toggleButton?.addEventListener("click", () => {
  paused = !paused;
  toggleButton.textContent = paused ? "Continue" : "Pause";
  toggleButton.setAttribute(
    "aria-label",
    paused ? "Continue the fight" : "Put the fight on pause",
  );
});

restartButton?.addEventListener("click", showBattleSetup);

function drawCircle(
  x: number,
  y: number,
  radius: number,
  fill: string,
  stroke: string,
  lineWidth: number,
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  ctx.fillStyle = fill;
  ctx.fill();

  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function update(deltaTime: number): void {
  if (isBattleOver()) {
    return;
  }

  for (const ball of balls) {
    if (ball.lives <= 0) {
      continue;
    }

    ball.hurtTimer = Math.max(0, ball.hurtTimer - deltaTime);
    ball.position.x += ball.velocity.x * deltaTime;
    ball.position.y += ball.velocity.y * deltaTime;
  }

  for (let first = 0; first < balls.length; first++) {
    for (let second = first + 1; second < balls.length; second++) {
      if (balls[first].lives <= 0 || balls[second].lives <= 0) {
        continue;
      }

      resolveBallCollision(balls[first], balls[second]);
    }
  }

  for (const ball of balls) {
    if (ball.lives <= 0) {
      continue;
    }

    resolveArenaCollision(ball);
  }

  updateWeaponSpawner(deltaTime);
  updatePickupReminder(deltaTime);
  updateHeartPickups(deltaTime);
  collectWeaponPickups();
  updateWeaponAiming();
  updateContactWeapons(deltaTime);
  updateRangedWeapons(deltaTime);
  updateProjectiles(deltaTime);
  resolveProjectileCollisions();
}

function drawArenaGrid(): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(arena.center.x, arena.center.y, arena.radius - 5, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(116, 132, 204, 0.13)";
  ctx.lineWidth = 2;

  for (let x = arena.center.x - arena.radius; x <= arena.center.x + arena.radius; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, arena.center.y - arena.radius);
    ctx.lineTo(x, arena.center.y + arena.radius);
    ctx.stroke();
  }

  for (let y = arena.center.y - arena.radius; y <= arena.center.y + arena.radius; y += 64) {
    ctx.beginPath();
    ctx.moveTo(arena.center.x - arena.radius, y);
    ctx.lineTo(arena.center.x + arena.radius, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFace(ball: Ball): void {
  ctx.save();
  const eyeOffset = ball.radius * .32;
  const eyeY = ball.position.y - ball.radius * .12;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";

  if (ball.hurtTimer > 0) {
    for (const direction of [-1, 1]) {
      const eyeX = ball.position.x + eyeOffset * direction;
      ctx.beginPath();
      ctx.moveTo(eyeX - 7, eyeY - 7);
      ctx.lineTo(eyeX + 7, eyeY + 7);
      ctx.moveTo(eyeX + 7, eyeY - 7);
      ctx.lineTo(eyeX - 7, eyeY + 7);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(ball.position.x, ball.position.y + 20, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  drawCircle(ball.position.x - eyeOffset, eyeY, 7, "#fff", "#fff", 0);
  drawCircle(ball.position.x + eyeOffset, eyeY, 7, "#fff", "#fff", 0);

  if (ball.weapon) {
    ctx.beginPath();
    ctx.moveTo(ball.position.x - 28, ball.position.y - 25);
    ctx.lineTo(ball.position.x - 7, ball.position.y - 15);
    ctx.moveTo(ball.position.x + 28, ball.position.y - 25);
    ctx.lineTo(ball.position.x + 7, ball.position.y - 15);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      ball.position.x,
      ball.position.y + 29,
      18,
      Math.PI + .18,
      Math.PI * 2 - .18,
    );
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(ball.position.x, ball.position.y + 10, 18, .15, Math.PI - .15);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHeartPickup(heart: HeartPickup): void {
  const scale = 1 + Math.sin(heart.pulse) * .1;

  ctx.save();
  ctx.translate(heart.position.x, heart.position.y);
  ctx.scale(scale, scale);
  ctx.shadowColor = "#ff5277";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "#ff416c";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 28);
  ctx.bezierCurveTo(-8, 18, -34, 3, -34, -15);
  ctx.bezierCurveTo(-34, -38, -8, -44, 0, -25);
  ctx.bezierCurveTo(8, -44, 34, -38, 34, -15);
  ctx.bezierCurveTo(34, 3, 8, 18, 0, 28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawWeaponPickup(pickup: WeaponPickup): void {
  drawCircle(
    pickup.position.x,
    pickup.position.y,
    pickup.radius,
    "#f2c94c",
    "#ffffff",
    4,
  );

  drawWeaponIcon(
    pickup.type,
    pickup.position.x,
    pickup.position.y,
    pickup.radius * 1.65,
    pickup.angle,
  );
}

function drawEquippedWeapon(ball: Ball): void {
  if (!ball.weapon) {
    return;
  }

  const weaponCenter = getEquippedWeaponCenter(
    ball,
    ball.weapon.angle,
  );

  drawWeaponIcon(
    ball.weapon.type,
    weaponCenter.x,
    weaponCenter.y,
    EQUIPPED_WEAPON_SIZE,
    ball.weapon.angle,
    "#f2c94c",
    "#111322",
  );

  if (
    ball.weapon.type === "shield" &&
    ball.weapon.durability !== null
  ) {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      String(ball.weapon.durability),
      weaponCenter.x,
      weaponCenter.y - 52,
    );
    ctx.restore();
  }
}

function drawProjectile(projectile: Projectile): void {
  const speed = Math.hypot(
    projectile.velocity.x,
    projectile.velocity.y,
  );

  const directionX =
    speed === 0 ? 0 : projectile.velocity.x / speed;
  const directionY =
    speed === 0 ? 0 : projectile.velocity.y / speed;

  const trailLength = projectile.radius * 4;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 216, 77, 0.45)";
  ctx.lineWidth = projectile.radius * 1.2;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(
    projectile.position.x - directionX * trailLength,
    projectile.position.y - directionY * trailLength,
  );
  ctx.lineTo(projectile.position.x, projectile.position.y);
  ctx.stroke();

  drawCircle(
    projectile.position.x,
    projectile.position.y,
    projectile.radius,
    "#ffd84d",
    "#fff3a6",
    2,
  );

  ctx.restore();
}

function drawLives(ball: Ball, row: number): void {
  const y = 95 + row * 80;
  const firstHeartX = 180;
  const heartSpacing = 82;

  drawCircle(95, y, 30, ball.color, "#ffffff", 4);

  ctx.save();
  ctx.font = "56px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let index = 0; index < MAX_LIVES; index++) {
    ctx.fillStyle = index < ball.lives ? ball.color : "#292d47";

    ctx.fillText("♥", firstHeartX + index * heartSpacing, y);
  }

  ctx.restore();
}

function render(): void {
  ctx.fillStyle = "#090b20";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawCircle(
    arena.center.x,
    arena.center.y,
    arena.radius,
    "#10142c",
    "#ffffff",
    8,
  );
  drawArenaGrid();

  for (const heart of heartPickups) {
    drawHeartPickup(heart);
  }

  for (const pickup of weaponPickups) {
    drawWeaponPickup(pickup);
  }

  for (const projectile of projectiles) {
    drawProjectile(projectile);
  }

  for (const ball of balls) {
    if (ball.lives <= 0) {
      continue;
    }

    drawCircle(
      ball.position.x,
      ball.position.y,
      ball.radius,
      ball.color,
      "#ffffff",
      5,
    );

    drawFace(ball);

    drawEquippedWeapon(ball);
  }

  balls.forEach((ball, index) => {
    drawLives(ball, index);
  });

  const livingBalls = balls.filter((ball) => ball.lives > 0);
  const winner = livingBalls.length === 1 ? livingBalls[0] : null;
  if (winner) {
    ctx.save();
    ctx.fillStyle = "rgba(3, 4, 12, .76)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.fillStyle = winner.color;
    ctx.font = "900 76px Arial";
    ctx.fillText(`${winner.name} WINS`, 540, 930);
    ctx.fillStyle = "#fff";
    ctx.font = "600 28px Arial";
    ctx.fillText("Click “New battle” to play again", 540, 990);
    ctx.restore();
  }
}

function resolveArenaCollision(ball: Ball): void {
  const dx = ball.position.x - arena.center.x;
  const dy = ball.position.y - arena.center.y;

  const distance = Math.hypot(dx, dy);
  const limit = arena.radius - ball.radius;

  if (distance <= limit || distance === 0) {
    return;
  }

  const nx = dx / distance;
  const ny = dy / distance;

  ball.position.x = arena.center.x + nx * limit;
  ball.position.y = arena.center.y + ny * limit;

  const outwardSpeed = ball.velocity.x * nx + ball.velocity.y * ny;

  if (outwardSpeed > 0) {
    ball.velocity.x -= 2 * outwardSpeed * nx;
    ball.velocity.y -= 2 * outwardSpeed * ny;
  }
}

function resolveBallCollision(first: Ball, second: Ball): void {
  const dx = second.position.x - first.position.x;
  const dy = second.position.y - first.position.y;

  const minimumDistance = first.radius + second.radius;
  const distanceSquared = dx * dx + dy * dy;

  if (distanceSquared >= minimumDistance * minimumDistance) {
    return;
  }

  const distance = Math.sqrt(distanceSquared);

  const nx = distance === 0 ? 1 : dx / distance;
  const ny = distance === 0 ? 0 : dy / distance;

  const overlap = minimumDistance - distance;
  const correctionX = nx * overlap * 0.5;
  const correctionY = ny * overlap * 0.5;

  first.position.x -= correctionX;
  first.position.y -= correctionY;

  second.position.x += correctionX;
  second.position.y += correctionY;

  const relativeVelocityX = second.velocity.x - first.velocity.x;

  const relativeVelocityY = second.velocity.y - first.velocity.y;

  const speedAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny;

  if (speedAlongNormal >= 0) {
    return;
  }

  const impulse = -speedAlongNormal;

  first.velocity.x -= impulse * nx;
  first.velocity.y -= impulse * ny;

  second.velocity.x += impulse * nx;
  second.velocity.y += impulse * ny;
}

const FIXED_STEP = 1 / 120;

let previousTime = performance.now();
let accumulator = 0;

function gameLoop(currentTime: number): void {
  const frameTime = Math.min((currentTime - previousTime) / 1000, 0.1);

  previousTime = currentTime;
  if (!paused) accumulator += frameTime;

  while (accumulator >= FIXED_STEP) {
    update(FIXED_STEP);
    accumulator -= FIXED_STEP;
  }

  render();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
