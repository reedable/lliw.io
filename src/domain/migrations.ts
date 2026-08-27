import { z } from "zod";

/*
 * The one module that straddles versions, so it is the one that renames on
 * import. Each schema file keeps its symbols under their original names; the
 * version lives in the path, and the alias is applied here where two versions
 * meet. Nothing inside a frozen file ever has to be edited to disambiguate it.
 */
import {
  StoredPalettesSchema as StoredPalettesSchemaV0,
  type StoredPalettes as StoredPalettesV0,
} from "../domain/schema/v0";
import {
  SCHEMA_VERSION as SCHEMA_VERSION_V1,
  StoredPalettesSchema as StoredPalettesSchemaV1,
} from "../domain/schema/v1";

import type { StoredPalettes } from "./types";
import { StoredPalettesSchema } from "./types";

/*
 * The version ladder for `lliw.palettes` and for export files.
 *
 * Adding a version is three edits, all in this file:
 *
 *   1. Freeze the outgoing schema — copy its definition in here as a literal,
 *      under its own name. It must not import from types.ts; see FROZEN below.
 *   2. Write one upgrade function from that version to the next.
 *   3. Append an entry to VERSIONS.
 *
 * Nothing outside this file changes. store.ts calls readPalettePayload and
 * readExportPayload and knows nothing about versions.
 *
 * The rule that keeps the ladder honest: an entry is only added in the same
 * commit that ships the destructive change it covers. Never speculatively, for
 * a shape that has not shipped. A previous version of this file described a
 * three-step ladder for shapes that never existed, and that fiction was later
 * cited back as if it were release history.
 */

/*
 * Upgrades step to the *next* version, never straight to current. With one step
 * the difference is invisible; with two it is the whole point, because v0 data
 * has to pass through every transformation between it and today rather than
 * being stamped with a version it never earned.
 *
 * v0 -> v1 added the envelope. The palette shape was unchanged, which is why
 * this is only a wrapping.
 */
const upgradeV0toV1 = (data: StoredPalettesV0) => ({
  schemaVersion: SCHEMA_VERSION_V1,
  palettes: data,
});

export interface VersionStep {
  version: number;
  schema: z.ZodType;
  /** Null on the current version, which has nothing to upgrade to. */
  upgrade: ((data: unknown) => unknown) | null;
}

/** Keeps each entry type-checked where it is written, erased in the array. */
export const step = <T>(
  version: number,
  schema: z.ZodType<T>,
  upgrade: ((data: T) => unknown) | null,
): VersionStep => ({
  version,
  schema: schema as z.ZodType,
  upgrade: upgrade as ((data: unknown) => unknown) | null,
});

/*
 * Oldest first, the last entry being the current version. Every entry names a
 * versioned schema file directly — including the current one, so there is no
 * special case here and no "current becomes legacy" edit when v2 arrives. That
 * step is: add one import, one upgrade function, one line to this array.
 */
const VERSIONS: VersionStep[] = [
  step(0, StoredPalettesSchemaV0, upgradeV0toV1),
  step(SCHEMA_VERSION_V1, StoredPalettesSchemaV1, null),
];

/*
 * A payload carrying a schemaVersion is making a claim about itself, so it is
 * dispatched to the entry it names and nowhere else. An untagged payload can
 * only be version 0 — every version since carries a tag. This is what stops a
 * newer file being claimed by an older parser that happens to accept it: two
 * shapes can be mutually parseable and mean different things, which is the
 * reason the tag exists at all.
 */
const claimedVersion = (value: unknown): unknown =>
  typeof value === "object" && value !== null && "schemaVersion" in value
    ? (value as { schemaVersion: unknown }).schemaVersion
    : 0;

/*
 * Takes the ladder as an argument rather than closing over VERSIONS, so the
 * chaining behaviour can be tested against a synthetic multi-step ladder. With
 * only two real versions today, a one-step chain and a two-step chain are not
 * distinguishable using VERSIONS alone — and "appending an entry is all it
 * takes" would otherwise be an assertion nothing checks.
 */
export const runLadder = (
  versions: VersionStep[],
  value: unknown,
): unknown | null => {
  const index = versions.findIndex((v) => v.version === claimedVersion(value));
  if (index === -1) return null;

  const parsed = versions[index].schema.safeParse(value);
  if (!parsed.success) return null;

  let data: unknown = parsed.data;
  for (let i = index; i < versions.length - 1; i += 1) {
    const { upgrade } = versions[i];
    // Only the last entry may lack an upgrade; a gap here is a bug in the ladder.
    if (!upgrade) return null;
    data = upgrade(data);
  }

  /*
   * Re-parsed rather than trusted. The chain is plain functions, so this is what
   * catches an upgrade that produced something the final schema does not accept
   * — loudly, at the boundary, instead of downstream.
   */
  const final = versions[versions.length - 1].schema.safeParse(data);
  return final.success ? final.data : null;
};

/**
 * Reads a stored palette payload at any known version, upgraded to the current
 * one. Null if it matches nothing — the caller decides whether that means seeds
 * or an error message.
 */
export const readPalettePayload = (value: unknown): StoredPalettes | null => {
  const result = StoredPalettesSchema.safeParse(runLadder(VERSIONS, value));
  return result.success ? result.data : null;
};

/**
 * Same ladder, for the contents of an export file. The envelope adds `format`
 * and `exportedAt` around the payload; a pre-versioning export had no
 * schemaVersion anywhere and carried its palettes as a bare array beside them.
 */
export const readExportPayload = (value: unknown): StoredPalettes | null => {
  if (typeof value !== "object" || value === null) return null;
  if ("schemaVersion" in value) return readPalettePayload(value);
  return readPalettePayload((value as { palettes?: unknown }).palettes);
};
