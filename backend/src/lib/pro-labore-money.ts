import { assertMoneyCents } from "./money";

/** Equal shares; remaining cents go to the lowest manager IDs, independent of query order.
 * Zero shares are valid summaries, not payment instructions.
 */
export function allocateProLabore(totalCents: number, managers: readonly { id: number }[]) {
  const total = assertMoneyCents(totalCents);
  if (total < 0) throw new RangeError("O valor distribuível não pode ser negativo.");
  const ids = managers.map(manager => manager.id).sort((a, b) => a - b);
  if (new Set(ids).size !== ids.length) throw new RangeError("Gestores duplicados no rateio.");
  const shares = new Map<number, number>();
  if (!ids.length) return { shares, uniformShareCents: null, unallocatedCents: total };
  const base = BigInt(total) / BigInt(ids.length);
  const remainder = BigInt(total) % BigInt(ids.length);
  ids.forEach((id, index) => shares.set(id,
    assertMoneyCents(Number(base + (BigInt(index) < remainder ? 1n : 0n)))));
  return {
    shares,
    uniformShareCents: remainder === 0n ? assertMoneyCents(Number(base)) : null,
    unallocatedCents: assertMoneyCents(0),
  };
}
