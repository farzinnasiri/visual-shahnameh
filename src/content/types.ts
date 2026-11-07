/**
 * Content model for one sub-chapter (بخش). A section is a list of scenes;
 * each scene is one painting that the reader dives through, and it holds the
 * couplets read while that painting fills the screen.
 *
 * Ids follow text/chapters: chapter "10", section "10.01".
 */

import type { SceneSound } from "./sound";

/** One couplet (بیت): [first hemistich, second hemistich]. */
export type Couplet = readonly [string, string];

export interface Scene {
  /** Painting URL under /public, e.g. "/art/01-01/01-cheragh.webp". */
  image: string;
  /** Persian description of the painting for screen readers. */
  alt: string;
  /**
   * 1-based couplet numbers (within the section) read in this scene.
   * The first scene of a section is the threshold and has none.
   */
  couplets: readonly number[];
  /**
   * Where the painting's luminous focal point is, as fractions of width and
   * height. The camera drifts toward it as it zooms (never exposing an edge)
   * and dives into it. Defaults to [0.5, 0.5]. Ignored for the threshold.
   */
  focus?: readonly [number, number];
  /**
   * What the score plays while this painting fills the screen: a named
   * atmosphere from src/content/sound.ts, or one with overrides and cues.
   * See sound/SOUND.md. Defaults: "threshold" for scenes[0], else "contemplative".
   */
  sound?: SceneSound;
}

/** The section after this one, worked out from the table of contents (src/main.ts). */
export type NextSection = SectionRef & { available: boolean };

export interface SectionRef {
  id: string;
  title: string;
}

export interface Section {
  id: string;
  chapter: SectionRef;
  title: string;
  /** All couplets of the section, verbatim from text/chapters/NN.json. */
  couplets: readonly Couplet[];
  /** scenes[0] is the threshold shown with the title; it has no couplets. */
  scenes: readonly Scene[];
  /**
   * Portrait reading composition. Defaults to "stacked" on viewports at most
   * 760px wide whose height exceeds their width: whole painting above the
   * measured verse panel, over a full-bleed atmospheric backdrop.
   * "immersive" retains the full-cover camera and verse overlay. Desktop and
   * landscape layouts are unaffected. Scene.focus remains the light target.
   */
  portraitLayout?: "stacked" | "immersive";
  /**
   * Optional gold-on-black layer the camera flies through between scenes,
   * composited with mix-blend-mode: screen.
   */
  lightLayer?: string;
}
