/*
 * Not crypto.randomUUID(): vite is configured with `server.host: true`, so the dev
 * app is reachable over plain http on a LAN address. That is not a secure context,
 * where crypto.randomUUID is undefined — it would work on localhost and break on a
 * phone. The caller generates the id so it can auto-expand the card it just made.
 */
const randomSuffix = () =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export const createPaletteId = () => `p${randomSuffix()}`;
export const createColorId = () => `c${randomSuffix()}`;
export const createGroupId = () => `g${randomSuffix()}`;
