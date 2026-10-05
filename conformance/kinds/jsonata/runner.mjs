// Test bridge to the incorporated upstream evaluator; no custom interpreter.
import jsonata from 'jsonata';
import { createInterface } from 'node:readline';

function jsonValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(jsonValue);
  if (typeof value !== 'object') return false;
  return Object.values(value).every(jsonValue);
}

export async function run(message) {
  if (typeof message.expression !== 'string') return { error: 'invalid' };
  let expression;
  try { expression = jsonata(message.expression); }
  catch { return { error: 'invalid' }; }
  if (message.check) return { valid: true };
  try {
    const value = await expression.evaluate(message.present ? message.value : undefined);
    if (value === undefined) return { present: false };
    if (!jsonValue(value)) return { error: 'mapping' };
    return { present: true, value };
  } catch { return { error: 'mapping' }; }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  for await (const line of createInterface({ input: process.stdin })) {
    process.stdout.write(JSON.stringify(await run(JSON.parse(line))) + '\n');
  }
}
