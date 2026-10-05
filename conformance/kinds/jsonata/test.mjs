import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { run } from './runner.mjs';

// Expected values are authored directly from the incorporated language rules,
// not computed by an encoder/decoder or a replacement interpreter.
const cases = [
  ['absent identity', '$', false, null, { present: false }],
  ['present null', '$', true, null, { present: true, value: null }],
  ['constant with absent context', 'null', false, null, { present: true, value: null }],
  ['absent member', 'missing', true, {}, { present: false }],
  ['absent object member is omitted', '{"a": missing, "b": null}', true, {}, { present: true, value: { b: null } }],
  ['absent array item follows JSONata', '[missing]', true, {}, { present: true, value: [] }],
  ['singleton sequence', 'rows.id', true, { rows: [{ id: 7 }] }, { present: true, value: 7 }],
  ['explicit singleton array', 'rows.id[]', true, { rows: [{ id: 7 }] }, { present: true, value: [7] }],
  ['multiple values form one array', 'rows.id', true, { rows: [{ id: 7 }, { id: 8 }] }, { present: true, value: [7, 8] }],
  ['arithmetic', 'price * count', true, { price: 2, count: 3 }, { present: true, value: 6 }],
  ['author function', '($twice := function($n){2*$n}; $twice(3))', true, {}, { present: true, value: 6 }],
  ['no host credential binding', '$credentials', true, {}, { present: false }],
  ['host function unavailable', '$readFile("secret")', true, {}, { error: 'mapping' }],
  ['throw', '$error("stop")', true, {}, { error: 'mapping' }],
  ['type failure', '$sum("wrong")', true, {}, { error: 'mapping' }],
  ['function result', 'function($x){$x}', true, {}, { error: 'mapping' }],
  ['nested function result', '{"callback":function($x){$x}}', true, {}, { error: 'mapping' }],
  ['ordinary object member names preserved', '$', true, { _jsonata_lambda: true }, { present: true, value: { _jsonata_lambda: true } }],
  ['unreached syntax error still invalid', 'false ? ( : 1', true, {}, { error: 'invalid' }],
  ['legacy object is invalid', { at: '' }, true, {}, { error: 'invalid' }],
];
for (const [name, expression, present, value, expected] of cases) {
  test(name, async () => assert.deepEqual(JSON.parse(JSON.stringify(await run({ expression, present, value }))), expected));
}

const remainder = '{"parameters":{"petId":petId},"body":$merge([{},$sift($,function($value,$key){$key!="petId"})])}';
test('open caller body retains unknown future members', async () => {
  const value = { petId: 7, name: 'Ada', extra: true, future: { nested: [null, false] } };
  const before = structuredClone(value);
  assert.deepEqual(await run({ expression: remainder, present: true, value }), {
    present: true, value: { parameters: { petId: 7 }, body: { name: 'Ada', extra: true, future: { nested: [null, false] } } },
  });
  assert.deepEqual(value, before);
});
test('empty remainder is an empty body object', async () => {
  assert.deepEqual(await run({ expression: remainder, present: true, value: { petId: 7 } }), {
    present: true, value: { parameters: { petId: 7 }, body: {} },
  });
});
test('published value-flow example and its empty/null cases', async () => {
  const text = readFileSync(new URL('../../../binding-specs/openapi-value-flow.md', import.meta.url), 'utf8');
  const blocks = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]));
  const binding = blocks.find(value => value.operation === 'submitBatch').content;
  const caller = { tenant: 't-7', rows: [{ name: 'alpha' }, { name: 'beta' }], note: null };
  assert.deepEqual(await run({ expression: binding.input, present: true, value: caller }), {
    present: true, value: { parameters: { tenant: 't-7' }, body: {
      items: [{ tenant: 't-7', name: 'alpha' }, { tenant: 't-7', name: 'beta' }], note: null,
    } },
  });
  assert.deepEqual(await run({ expression: binding.input, present: true, value: { tenant: 't-7', rows: [] } }), {
    present: true, value: { parameters: { tenant: 't-7' }, body: { items: [] } },
  });
  assert.deepEqual(await run({ expression: binding.input, present: true, value: { tenant: 't-7', rows: null } }), { error: 'mapping' });
  assert.deepEqual(await run({ expression: binding.output, present: true, value: { accepted: 2 } }), { present: true, value: { count: 2 } });
  assert.deepEqual(await run({ expression: binding.output, present: true, value: null }), { present: true, value: {} });
});
