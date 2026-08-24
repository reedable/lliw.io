import { z } from 'zod';

/*
 * Version 1 — the current palette schema. types.ts re-exports from here.
 *
 * This file is already frozen, on the day it was written. Nobody performs a
 * "freeze" step later: to introduce version 2, copy this file to v2.ts, edit
 * v2.ts, point types.ts at it, and add the upgrade in migrations.ts. This file
 * is then left exactly as it stands and becomes history without anyone touching
 * it.
 *
 * Do not edit it in place for anything destructive — removing a field, renaming
 * one, narrowing a type. Additive changes that leave older data still parsing
 * are the only edits allowed here.
 *
 * Do not import anything from outside this directory into it. Symbol names are
 * plain; callers that straddle versions rename on import.
 */

export const SCHEMA_VERSION = 1;

export const PaletteColorSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.string(),
});

/** Colours live in groups, so a palette reads as sections rather than one long list. */
export const ColorGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  colors: z.array(PaletteColorSchema),
});

export const PaletteSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Colours before the first group header. Implicitly the leading bucket. */
  ungrouped: z.array(PaletteColorSchema),
  groups: z.array(ColorGroupSchema),
});

/** The stored payload, and what an export file carries. Where it is stored is
    not this file's concern — see store.ts. */
export const StoredPalettesSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  palettes: z.array(PaletteSchema),
});

export type PaletteColor = z.infer<typeof PaletteColorSchema>;
export type ColorGroup = z.infer<typeof ColorGroupSchema>;
export type Palette = z.infer<typeof PaletteSchema>;
export type StoredPalettes = z.infer<typeof StoredPalettesSchema>;
