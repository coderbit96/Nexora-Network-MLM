import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { MAX_GENEALOGY_DEPTH } from "@/config/genealogy";
import { levelFromUpline } from "@/services/genealogy/genealogy-utils";

// Seeded in-memory multi-level network: Ada → Ben → Chloe → Dev.
const seededNetwork = { ada: new Types.ObjectId(), ben: new Types.ObjectId(), chloe: new Types.ObjectId(), dev: new Types.ObjectId() };

test("calculates levels in a seeded multi-level genealogy", () => {
  assert.equal(levelFromUpline([seededNetwork.ada], seededNetwork.ada), 1);
  assert.equal(levelFromUpline([seededNetwork.ben, seededNetwork.ada], seededNetwork.ada), 2);
  assert.equal(levelFromUpline([seededNetwork.chloe, seededNetwork.ben, seededNetwork.ada], seededNetwork.ada), 3);
  assert.equal(levelFromUpline([seededNetwork.ben], seededNetwork.ada), null);
});

test("genealogy depth is explicitly bounded", () => {
  assert.equal(MAX_GENEALOGY_DEPTH, 10);
});
