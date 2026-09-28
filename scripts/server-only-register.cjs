/* eslint-disable @typescript-eslint/no-require-imports -- Node preloader executes before script modules. */
const Module = require("node:module");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveServerOnlyMarker(request, parent, isMain, options) {
  if (request === "server-only") return require.resolve("./server-only-noop.cjs");
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
