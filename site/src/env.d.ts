/// <reference types="vite/client" />

/** Replaced at build time: true only in the `build:single` target. */
declare const __SINGLE__: boolean;

declare module 'virtual:reel-inline' {
  /** The hero reel as data URIs. Empty in every build but `build:single`. */
  export const FRAMES: string[];
}
