/* eslint-disable @typescript-eslint/no-require-imports -- Node preloader executes before ESM test modules. */
// Next.js replaces `server-only` at build time. The database integration suite
// executes server services directly in Node, so map only that marker to a no-op.
const Module = require("node:module");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveServerOnlyMarker(request, parent, isMain, options) {
  if (request === "server-only") return require.resolve("./server-only-noop.cjs");
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
