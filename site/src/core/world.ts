/** The contract every universe signs. */
import type { WorldSound } from './audio-bus';

export interface WorldLook {
  /** the world's ground colour, used by the seam shaders as its base */
  readonly base: [number, number, number];
  /** its accent, used for rims, sparks and glows in the seam */
  readonly accent: [number, number, number];
}

export interface World {
  readonly id: WorldSound;
  /** Called once when the section comes within half a viewport. */
  mount(section: HTMLElement): void;
  /** Frees GPU and DOM resources. Called when the section is far behind. */
  unmount(): void;
  /** Stops the world's tick and releases heavy textures. */
  pause(): void;
  resume(): void;
  /** Optional per-frame hook driven by the director, progress 0..1 through the section. */
  progress?(p: number): void;
  readonly look: WorldLook;
}

export interface WorldFactory { create(): World }

export const LOOKS: Record<WorldSound, WorldLook> = {
  hero:     { base: [0.039, 0.039, 0.043], accent: [0.949, 0.921, 0.867] },
  pain:     { base: [0.043, 0.062, 0.098], accent: [0.972, 0.835, 0.282] },
  truth:    { base: [0.015, 0.027, 0.039], accent: [0.364, 1.000, 0.607] },
  craft:    { base: [0.086, 0.109, 0.078], accent: [0.941, 0.823, 0.290] },
  cases:    { base: [0.058, 0.058, 0.078], accent: [1.000, 0.271, 0.427] },
  pricing:  { base: [0.047, 0.047, 0.062], accent: [0.372, 0.690, 0.949] },
  route:    { base: [0.027, 0.031, 0.050], accent: [1.000, 0.541, 0.121] },
  gains:    { base: [0.113, 0.176, 0.117], accent: [0.847, 0.925, 0.611] },
  portal:   { base: [0.062, 0.043, 0.031], accent: [1.000, 0.603, 0.235] },
  brief:    { base: [0.949, 0.921, 0.867], accent: [0.043, 0.043, 0.043] },
  basement: { base: [0.031, 0.043, 0.070], accent: [0.494, 0.760, 0.960] },
  credits:  { base: [0.004, 0.004, 0.011], accent: [0.949, 0.921, 0.867] },
};
