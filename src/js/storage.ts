/*
 * One-time move of a localStorage entry from an old key to a new one.
 *
 * This is deliberately not part of the schema ladder in migrations.ts. That
 * ladder versions the *shape* of a payload; this changes *where* the payload
 * lives. Conflating the two would mean a key rename burning a schema version
 * for a change no parser can see. So the value is moved as opaque text and the
 * ladder still validates it on read, unchanged.
 *
 * TEMPORARY. Delete `migrateKey`, its call sites, and the LEGACY_* constants in
 * store.ts once every browser holding data under the old keys has loaded the app
 * at least once. At the time of writing that is two testers, so this is a
 * question you can answer by asking them — which is the only reason the shim was
 * worth adding rather than accepting the data loss.
 */
export const migrateKey = (storage: Storage, from: string, to: string): void => {
  try {
    // Never overwrite: whatever is under the new key is newer by definition.
    if (storage.getItem(to) !== null) return;

    const legacy = storage.getItem(from);
    if (legacy === null) return;

    /*
     * Written before the old one is removed. If setItem throws — quota, private
     * mode — the old value is still there to be found on the next load, rather
     * than having been deleted with nowhere to put it.
     */
    storage.setItem(to, legacy);
    storage.removeItem(from);
  } catch {
    // Storage unavailable. Reads fall back to seeds and defaults on their own.
  }
};
