// Informative design aid for core §§7.1 and 7.6; not a conformance validator.
// See conformance/resource-model-draft/README.md for the deliberate limits.

const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const schema = value => typeof value === "boolean" || object(value);
const own = (value, key) => Object.hasOwn(value, key);
const pointer = tokens => tokens.length ? "/" + tokens.map(t => t.replaceAll("~", "~0").replaceAll("/", "~1")).join("/") : "";
const documentResource = "document";

export function fragmentPointer(reference) {
  // RFC 3986 fragment characters; decode percent encoding exactly once.
  if (typeof reference !== "string" || !/^#(?:[A-Za-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9A-Fa-f]{2})*$/.test(reference)) return null;
  let decoded;
  try { decoded = decodeURIComponent(reference.slice(1)); } catch { return null; }
  if (!decoded.startsWith("/")) return null;
  const tokens = decoded.slice(1).split("/");
  if (tokens.some(token => /~(?:[^01]|$)/.test(token))) return null;
  return tokens.map(token => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}

export function select(document, tokens) {
  let value = document;
  for (const token of tokens) {
    if (Array.isArray(value)) {
      if (!/^(0|[1-9][0-9]*)$/.test(token) || !own(value, token)) return { found: false };
    } else if (!object(value) || !own(value, token)) return { found: false };
    value = value[token];
  }
  return { found: true, value };
}

export function sharedValue(document, reference) {
  if (!object(reference) || Object.keys(reference).length !== 1 || !own(reference, "$ref")) return { found: false };
  const tokens = fragmentPointer(reference.$ref);
  if (!tokens || tokens.length < 2 || tokens[0] !== "resources") return { found: false };
  return select(document, tokens);
}

const maps = ["$defs", "properties", "patternProperties", "dependentSchemas", "definitions", "dependencies"];
const singles = ["additionalProperties", "propertyNames", "items", "contains", "not", "if", "then", "else", "unevaluatedItems", "unevaluatedProperties", "contentSchema"];
const arrays = ["prefixItems", "allOf", "anyOf", "oneOf"];

export function schemaInventory(document) {
  const entries = new Set();
  const records = new Map();
  const queue = [];
  const enqueue = (tokens, resource, entry = false) => {
    const target = select(document, tokens);
    if (!target.found || !schema(target.value)) return;
    if (entry) entries.add(pointer(tokens));
    queue.push({ tokens, inherited: resource, value: target.value });
  };

  for (const [key, operation] of Object.entries(document.operations ?? {})) {
    if (!object(operation)) continue;
    for (const side of ["input", "output"]) {
      if (own(operation, side)) enqueue(["operations", key, side], documentResource, true);
    }
  }

  for (let i = 0; i < queue.length; i++) {
    const { tokens, inherited, value } = queue[i];
    const path = pointer(tokens);
    const identified = object(value) && own(value, "$id");
    const owner = identified ? path : inherited;
    let record = records.get(path);
    if (!record) {
      record = { owners: new Set(), incoming: new Set(), identified, value };
      records.set(path, record);
    }
    record.incoming.add(inherited);
    if (record.owners.has(owner)) continue;
    record.owners.add(owner);
    if (!object(value)) continue;

    for (const keyword of maps) {
      if (!own(value, keyword) || !object(value[keyword])) continue;
      for (const key of Object.keys(value[keyword])) enqueue([...tokens, keyword, key], owner);
    }
    for (const keyword of singles) {
      if (own(value, keyword)) enqueue([...tokens, keyword], owner);
    }
    for (const keyword of arrays) {
      if (!own(value, keyword) || !Array.isArray(value[keyword])) continue;
      value[keyword].forEach((_, index) => enqueue([...tokens, keyword, String(index)], owner));
    }

    if (owner === documentResource) {
      for (const keyword of ["$ref", "$dynamicRef"]) {
        if (!own(value, keyword)) continue;
        const target = fragmentPointer(value[keyword]);
        if (target && target.length >= 2 && target[0] === "resources") enqueue(target, documentResource, true);
      }
    }
  }

  const conflicts = [];
  for (const [path, record] of records) {
    // A relative identifier selected independently would also violate OBI-11;
    // it cannot be used to erase the differing inherited resource contexts.
    const absoluteId = record.identified && typeof record.value.$id === "string" && /^[A-Za-z][A-Za-z0-9+.-]*:/.test(record.value.$id);
    if (record.owners.size > 1 || (record.identified && !absoluteId && record.incoming.size > 1)) conflicts.push(path);
  }
  return { entries: [...entries].sort(), schemas: [...records.keys()].sort(), conflicts: conflicts.sort() };
}
