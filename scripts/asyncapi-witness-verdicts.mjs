// Private apparatus helpers, not a public binding or SDK contract.
import assert from 'node:assert/strict';

export class SemanticMismatch extends Error {
  constructor(assertionId, cause) {
    super(`${assertionId}: ${cause.message}`, {cause});
    this.assertionId = assertionId;
  }
}

export function semantic(assertionId, check) {
  try { check(); } catch (error) {
    if (error instanceof assert.AssertionError) throw new SemanticMismatch(assertionId, error);
    throw error;
  }
}

export async function mutationVerdict(run, expectedAssertionId, matchesActual = () => true) {
  try { await run(); return {status:'survived'}; } catch (error) {
    if (error instanceof SemanticMismatch) return {
      status:error.assertionId === expectedAssertionId && matchesActual(error.cause.actual) ? 'killed' : 'unexplained-failure',
      assertionId:error.assertionId,
    };
    return {status:error instanceof assert.AssertionError ? 'unexplained-failure' : 'infrastructure-error', message:error.message};
  }
}

export function selectPrimary(scenarios, required, supports, filter) {
  const ids = scenarios.map(s=>s.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate corpus scenario');
  assert.equal(new Set(required).size, required.length, 'duplicate locked scenario');
  const capable = scenarios.filter(s=>supports(s.id));
  assert.deepEqual(capable.map(s=>s.id).sort(), [...required].sort(), 'evaluator/locked inventory mismatch');
  const selected = capable.filter(s=>!filter || s.id.includes(filter));
  return selected;
}

export function mutateExactlyOnce(source, from, to) {
  assert.ok(from.length > 0, 'empty mutation point');
  assert.equal(source.split(from).length - 1, 1, 'mutation cardinality must be exactly one');
  return source.replace(from, to);
}
