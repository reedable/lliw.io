import { beforeEach, describe, expect, it, vi } from 'vitest';

import { migrateKey } from './storage';

/*
 * A Storage stand-in. Not jsdom's — the interesting cases here are the ones
 * where storage misbehaves, and those are easier to arrange directly.
 */
const fakeStorage = (initial: Record<string, string> = {}): Storage => {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

describe('migrateKey', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = fakeStorage({ old: 'value' });
  });

  it('moves the value and removes the old key', () => {
    migrateKey(storage, 'old', 'new');
    expect(storage.getItem('new')).toBe('value');
    expect(storage.getItem('old')).toBeNull();
  });

  it('does nothing when the old key is absent', () => {
    const empty = fakeStorage();
    migrateKey(empty, 'old', 'new');
    expect(empty.getItem('new')).toBeNull();
  });

  it('never overwrites the new key, and leaves the old one alone if it did not', () => {
    const both = fakeStorage({ old: 'stale', new: 'current' });
    migrateKey(both, 'old', 'new');
    expect(both.getItem('new')).toBe('current');
    expect(both.getItem('old')).toBe('stale');
  });

  it('is idempotent — a second run is a no-op', () => {
    migrateKey(storage, 'old', 'new');
    migrateKey(storage, 'old', 'new');
    expect(storage.getItem('new')).toBe('value');
    expect(storage.getItem('old')).toBeNull();
  });

  it('moves the value opaquely, without parsing it', () => {
    const junk = fakeStorage({ old: 'not json {{{' });
    migrateKey(junk, 'old', 'new');
    expect(junk.getItem('new')).toBe('not json {{{');
  });

  /*
   * The case the ordering in migrateKey exists for. If the write fails, the old
   * value must survive — deleting it first would destroy the only copy.
   */
  it('keeps the old value when the write throws', () => {
    const failing = fakeStorage({ old: 'value' });
    vi.spyOn(failing, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    migrateKey(failing, 'old', 'new');
    expect(failing.getItem('old')).toBe('value');
  });

  it('does not throw when storage is unavailable entirely', () => {
    const hostile = fakeStorage();
    vi.spyOn(hostile, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(() => migrateKey(hostile, 'old', 'new')).not.toThrow();
  });
});
