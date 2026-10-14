/// <reference types="vite/client" />

declare module '@shared/physics' {
  export type PullKind = 'calm' | 'pull' | 'surge' | 'run';
  export interface PullEvent { start: number; duration: number; power: number; kind: PullKind }
  export interface PhysParams { strength: number; maxLoad: number; control: number; speed: number; depth: number; giant: boolean }
  export interface PhysicsCore { t: number; tension: number; progress: number; integrity: number; stamina: number; slack: number }
  export type Outcome = 'land' | 'break' | 'slip' | 'timeout' | null;
  export const PHYS: {
    TICK: number; IDEAL_MIN: number; IDEAL_MAX: number; TENSION_MIN: number; TENSION_MAX: number;
    REEL_TENSION: number; RELEASE_TENSION: number; REEL_PROGRESS: number; RELEASE_PROGRESS: number;
    SLACK_LIMIT: number; MAX_MS: number; INTEGRITY_SOFT: number; SLIP_TENSION: number;
  };
  export function activeEvent(events: PullEvent[], t: number): PullEvent | null;
  export function applyPhysics(core: PhysicsCore, p: PhysParams, dtMs: number, reeling: boolean, power: number): { core: PhysicsCore; outcome: Outcome };
  export function difficultyStars(p: PhysParams): number;
  export function weightBand(weightG: number): string;
}

interface Window {
  Telegram?: any;
}
