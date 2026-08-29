module.exports = {
  globDirectory: "www/",
  globPatterns: ["**/*.{woff,woff2,js,css,png,jpg,svg,html}"],
  /* pass array of globs to exclude from caching */
  globIgnores: [],
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
  swDest: "www/service-worker.js",

  /*
   * Without these two, Workbox's default lifecycle applies: a new worker installs
   * and then waits until every client using the old one is gone. An installed PWA
   * on iOS is suspended rather than closed, so the old worker keeps serving its
   * precached index.html and bundle across deploys — the app on the device stays
   * on an old build indefinitely while the browser shows the new one.
   *
   * skipWaiting activates the new worker as soon as it installs; clientsClaim puts
   * existing pages under it immediately. The trade-off is that a page open at the
   * moment of activation is then served by a newer precache than the one it
   * loaded from. Everything here is precached up front rather than fetched lazily,
   * so there is no chunk left to arrive from the older revision.
   */
  skipWaiting: true,
  clientsClaim: true,
};
