#!/usr/bin/env node
// TEST-ONLY fixture verifier. This is not a JSONata evaluator or SDK numeric API.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corpus = resolve(root, 'conformance/transforms');
const minimum = [1n, 2n ** 1074n];
const maximum = [(2n ** 53n - 1n) * 2n ** 971n, 1n];

// Exact rational comparisons here prevent the test harness from rounding its
// own capacity endpoints. Bounds protect the verifier, not a conforming tool.
export function rational(text) {
  if (text === 'binary64-min-positive') return minimum;
  if (text === 'binary64-max-finite') return maximum;
  assert.ok(text.length <= 4096, 'test-only token bound');
  const m = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(text);
  assert.ok(m, `not a numeric JSON token: ${text}`);
  const exponent = Number(m[4] || 0) - (m[3] || '').length;
  assert.ok(Number.isInteger(exponent) && Math.abs(exponent) <= 8192, 'test-only exponent bound');
  const coefficient = BigInt(m[1] + m[2] + (m[3] || ''));
  return exponent >= 0 ? [coefficient * 10n ** BigInt(exponent), 1n]
    : [coefficient, 10n ** BigInt(-exponent)];
}
export function compare(a, b) {
  const [an, ad] = rational(a), [bn, bd] = rational(b);
  const delta = an * bd - bn * ad;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}
export function eligibleCapacity(c) {
  assert.ok(Number.isInteger(c.radix) && c.radix >= 2 && c.radix <= 36);
  assert.ok(Number.isInteger(c.precision) && c.precision >= 1 && c.precision <= 4096);
  return BigInt(c.radix) ** BigInt(c.precision - 1) >= 2n ** 52n
    && c.rounding === 'nearest-ties-even'
    && compare(c.minimumPositive, '0') > 0
    && compare(c.minimumPositive, 'binary64-min-positive') <= 0
    && compare(c.maximumFinite, 'binary64-max-finite') >= 0
    && compare(c.underflowStep, '0') > 0
    && compare(c.underflowStep, 'binary64-min-positive') <= 0;
}
export function relationViolations(values, comparator) {
  const failures = [];
  const relation = values.map(a => values.map(b => comparator(a, b)));
  for (let a = 0; a < values.length; a++) {
    if (relation[a][a] !== 0) failures.push('reflexivity');
    for (let b = 0; b < values.length; b++) {
      if (![-1, 0, 1].includes(relation[a][b])) failures.push('trichotomy');
      if (relation[a][b] !== -relation[b][a]) failures.push('antisymmetry');
      for (let c = 0; c < values.length; c++) {
        if (relation[a][b] === 0 && relation[b][c] === 0 && relation[a][c] !== 0) failures.push('equality-transitivity');
        if (relation[a][b] <= 0 && relation[b][c] <= 0 && relation[a][c] > 0) failures.push('order-transitivity');
      }
    }
  }
  return failures;
}

export function verify() {
  const file = JSON.parse(readFileSync(resolve(corpus, 'numerical/scenarios.json'), 'utf8'));
  const ids = new Set();
  function addId(id) { assert.ok(!ids.has(id), `duplicate id ${id}`); ids.add(id); }
  for (const dir of ['agree', 'known-divergence']) {
    for (const path of readdirSync(resolve(corpus, dir)).filter(p => p.endsWith('.json'))) {
      for (const c of JSON.parse(readFileSync(resolve(corpus, dir, path))).cases) addId(c.id);
    }
  }
  for (const c of file.capacity) {
    addId(c.id);
    assert.equal(eligibleCapacity(c), c.eligible, c.id);
  }
  for (const c of file.cases) {
    addId(c.id);
    // Syntax only: never compare the parsed native values. A downstream
    // evaluator must start from the original inputJSON text.
    JSON.parse(c.inputJSON);
    for (const model of ['reference', 'exact34']) {
      if (c[model].status === 'json') JSON.parse(c[model].json);
      if (!c.syntaxValid) assert.equal(c[model].status, 'failure', c.id);
    }
  }

  const values = ['-1', '-0', '0', '0.10', '0.1', '1', '1.0',
    '9007199254740992', '9007199254740993'].flatMap(value =>
    ['input', 'literal', 'constructor', 'computed'].map(origin => ({value, origin})));
  const exact = (a, b) => compare(a.value, b.value);
  const reference = (a, b) => {
    const x = Number(a.value), y = Number(b.value);
    return x < y ? -1 : x > y ? 1 : 0;
  };
  assert.deepEqual(relationViolations(values, exact), []);
  assert.deepEqual(relationViolations(values, reference), []);
  const mixed = (a, b) => a.origin === 'computed' || b.origin === 'computed'
    ? reference(a, b) : exact(a, b);
  assert.ok(relationViolations(values, mixed).includes('equality-transitivity'));

  // Adjacent precision thresholds, not a rounded logarithm comparison.
  const binary = file.capacity.find(c => c.id === 'cap-binary64');
  assert.equal(eligibleCapacity({...binary, precision: 52}), false);
  const decimal = file.capacity.find(c => c.id === 'cap-decimal17');
  assert.equal(eligibleCapacity({...decimal, precision: 16}), false);
  assert.equal(compare('4.9406564584124654e-324', 'binary64-min-positive'), -1);
  assert.equal(compare('1.7976931348623157e308', 'binary64-max-finite'), -1);
  return {capacityScenarios: file.capacity.length, expressionScenarios: file.cases.length,
    relationWitnessValues: values.length, coherentRelations: 2, mixedRelationRejected: true,
    qualification: 'CORPUS_AND_CONTRACT_WITNESSES_NOT_EVALUATOR_EXECUTION'};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(verify()));
}
