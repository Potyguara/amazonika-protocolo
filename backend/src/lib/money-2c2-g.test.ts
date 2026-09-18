import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { allocateProLabore } from "./pro-labore-money";

function values(total: number, count: number) {
  const result = allocateProLabore(total, Array.from({ length: count }, (_, index) => ({ id: index + 1 })));
  return [...result.shares.values()];
}

test("2C2-G pro-labore allocation conserves every cent deterministically", () => {
  for (const [total, count, expected] of [
    [1, 2, [1, 0]], [1, 3, [1, 0, 0]], [2, 3, [1, 1, 0]],
    [100, 3, [34, 33, 33]], [10000, 3, [3334, 3333, 3333]],
  ] as const) {
    const shares = values(total, count);
    assert.deepEqual(shares, expected);
    assert.equal(shares.reduce((sum, value) => sum + value, 0), total);
    assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
  }
  assert.equal(allocateProLabore(100, [{ id: 2 }, { id: 1 }]).shares.get(1), 50);
});

test("2C2-G operational pro-labore summaries use individual allocations", () => {
  const source = fs.readFileSync("src/server.ts", "utf8");
  assert.doesNotMatch(source, /divideCents\(\s*(?:proLaboreDistribuivelCents|liquidoDistribuivelCents)/);
  assert.match(source, /proLaboreAllocation\.shares\.get\(manager\.id\)/);
  assert.match(source, /uniformShareCents/);
});
