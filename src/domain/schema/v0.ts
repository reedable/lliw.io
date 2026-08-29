import { z } from "zod";

/*
 * FROZEN — version 0. Do not edit. Do not import anything from outside this
 * directory into it.
 *
 * Version 0 is the shape stored before versioning existed: `palette.palettes`
 * held a bare array of palettes with no envelope, and export files carried no
 * schemaVersion. It is the one version reconstructed rather than copied, because
 * there was no schema file at the time it was current.
 *
 * Symbol names are as they were. Callers that straddle versions rename on
 * import — `import { PaletteSchema as PaletteSchemaV0 } from '../domain/schema/v0'` —
 * so nothing in here has to be touched to disambiguate it.
 */

export const PaletteColorSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.string(),
});

export const ColorGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  colors: z.array(PaletteColorSchema),
});

export const PaletteSchema = z.object({
  id: z.string(),
  name: z.string(),
  ungrouped: z.array(PaletteColorSchema),
  groups: z.array(ColorGroupSchema),
});

/** No envelope: the stored value was the array itself. */
export const StoredPalettesSchema = z.array(PaletteSchema);

export type PaletteColor = z.infer<typeof PaletteColorSchema>;
export type ColorGroup = z.infer<typeof ColorGroupSchema>;
export type Palette = z.infer<typeof PaletteSchema>;
export type StoredPalettes = z.infer<typeof StoredPalettesSchema>;
