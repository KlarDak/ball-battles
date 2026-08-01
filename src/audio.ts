import type { WeaponType } from "./types";

let audioContext: AudioContext | null = null;
const noiseBufferCache = new Map<number, AudioBuffer>();

export function enableAudio(): void {
  audioContext ??= new AudioContext();
  if (audioContext.state === "suspended") void audioContext.resume();
}

function getNoiseBuffer(audio: AudioContext, duration: number): AudioBuffer {
  const cacheKey = Math.round(duration * 1000);
  const cached = noiseBufferCache.get(cacheKey);
  if (cached) return cached;

  const sampleCount = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index++) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
  }
  noiseBufferCache.set(cacheKey, buffer);
  return buffer;
}

export function playShotSound(type: WeaponType): void {
  const audio = audioContext;
  if (!audio || audio.state !== "running" || type === "knife" || type === "shield") return;

  const now = audio.currentTime;
  const settings = {
    assaultRifle: { frequency: 135, duration: .065, volume: .09 },
    uzi: { frequency: 190, duration: .04, volume: .065 },
    pistol: { frequency: 115, duration: .11, volume: .13 },
    shotgun: { frequency: 75, duration: .18, volume: .18 },
  } as const;
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

  const noise = audio.createBufferSource();
  const noiseGain = audio.createGain();
  noise.buffer = getNoiseBuffer(audio, setting.duration);
  noiseGain.gain.setValueAtTime(setting.volume * (type === "shotgun" ? 1.5 : .65), now);
  noiseGain.gain.exponentialRampToValueAtTime(.001, now + setting.duration);
  noise.connect(noiseGain).connect(audio.destination);
  noise.start(now);
}

function playNotes(frequencies: number[], spacing: number, duration: number, volume: number): void {
  const audio = audioContext;
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;
  for (const [index, frequency] of frequencies.entries()) {
    const start = now + index * spacing;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }
}

export function playPickupReminderSound(): void {
  playNotes([660, 880], .09, .16, .055);
}

export function playHealSound(): void {
  playNotes([523, 659, 784], .075, .22, .07);
}

export function playDamageSound(): void {
  const audio = audioContext;
  if (!audio || audio.state !== "running") return;

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

  const noise = audio.createBufferSource();
  const noiseGain = audio.createGain();
  noise.buffer = getNoiseBuffer(audio, .07);
  noiseGain.gain.setValueAtTime(.075, now);
  noiseGain.gain.exponentialRampToValueAtTime(.001, now + .07);
  noise.connect(noiseGain).connect(audio.destination);
  noise.start(now);
}
