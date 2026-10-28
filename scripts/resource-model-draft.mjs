// Informative design aid for core §7 and §7.6; not a conformance validator.
// See conformance/resource-model-draft/README.md for the deliberate limits.

const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const schema = value => typeof value === "boolean" || object(value);
const own = (value, key) => Object.hasOwn(value, key);
const pointer = tokens => tokens.length ? "/" + tokens.map(t => t.replaceAll("~", "~0").replaceAll("/", "~1")).join("/") : "";
const documentResource = "document";
// JSON Schema Core §8.2.2's plain-name grammar, and RFC 3986 URI-reference characters.
const plainName = /^[A-Za-z_][-A-Za-z0-9._]*$/;
const uriReference = /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:@/?#\[\]]|%[0-9A-Fa-f]{2})*$/;

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

// §7.6: a shared-value reference names an entry of `resources` or `schemas`, or a location within one.
export function sharedValue(document, reference) {
  if (!object(reference) || Object.keys(reference).length !== 1 || !own(reference, "$ref")) return { found: false };
  const tokens = fragmentPointer(reference.$ref);
  if (!tokens || tokens.length < 2 || (tokens[0] !== "resources" && tokens[0] !== "schemas")) return { found: false };
  return select(document, tokens);
}

const maps = ["$defs", "properties", "patternProperties", "dependentSchemas", "definitions", "dependencies"];
const singles = ["additionalProperties", "propertyNames", "items", "contains", "not", "if", "then", "else", "unevaluatedItems", "unevaluatedProperties", "contentSchema"];
const arrays = ["prefixItems", "allOf", "anyOf", "oneOf"];

// §7: the schemas the document contains are each operation's input and output, each `schemas`
// entry, and their subschemas through the schema keywords. Nothing is discovered by reference.
// `unresolved` lists the same-document references in the document resource that identify no
// schema the document contains (OBI-12's first sentence); `documentDynamicAnchors` lists the
// schemas in the document resource that declare `$dynamicAnchor` (OBI-14).
export function schemaInventory(document) {
  const entries = [];
  const schemas = new Map(); // path -> { value, resource }
  const visit = (tokens, value, resource) => {
    if (!schema(value)) return;
    const path = pointer(tokens);
    if (schemas.has(path)) return;
    const here = object(value) && own(value, "$id") ? path : resource;
    schemas.set(path, { value, resource: here });
    if (!object(value)) return;
    for (const keyword of maps) {
      if (!own(value, keyword) || !object(value[keyword])) continue;
      for (const key of Object.keys(value[keyword])) visit([...tokens, keyword, key], value[keyword][key], here);
    }
    for (const keyword of singles) if (own(value, keyword)) visit([...tokens, keyword], value[keyword], here);
    for (const keyword of arrays) {
      if (!own(value, keyword) || !Array.isArray(value[keyword])) continue;
      value[keyword].forEach((item, index) => visit([...tokens, keyword, String(index)], item, here));
    }
  };
  for (const [key, operation] of Object.entries(object(document.operations) ? document.operations : {})) {
    if (!object(operation)) continue;
    for (const side of ["input", "output"]) {
      if (own(operation, side) && schema(operation[side])) { entries.push(pointer(["operations", key, side])); visit(["operations", key, side], operation[side], documentResource); }
    }
  }
  for (const [name, value] of Object.entries(object(document.schemas) ? document.schemas : {})) {
    if (schema(value)) { entries.push(pointer(["schemas", name])); visit(["schemas", name], value, documentResource); }
  }
  const anchors = new Map();
  const documentDynamicAnchors = [];
  for (const [path, { value, resource }] of schemas) {
    if (!object(value) || resource !== documentResource) continue;
    for (const keyword of ["$anchor", "$dynamicAnchor"]) {
      const name = value[keyword];
      if (typeof name === "string" && plainName.test(name)) anchors.set(name, [...(anchors.get(name) ?? []), path]);
    }
    if (own(value, "$dynamicAnchor")) documentDynamicAnchors.push(path);
  }
  const unresolved = [];
  for (const [path, { value, resource }] of schemas) {
    if (!object(value) || resource !== documentResource) continue;
    for (const keyword of ["$ref", "$dynamicRef"]) {
      const reference = value[keyword];
      // Only same-document references (§7.1); a malformed string is no reference at all (OBI-11's business).
      if (typeof reference !== "string" || !reference.startsWith("#") && reference !== "") continue;
      if (!uriReference.test(reference) || (reference.match(/#/g) ?? []).length > 1) continue;
      const tokens = fragmentPointer(reference);
      let identified;
      if (tokens) identified = schemas.has(pointer(tokens));
      else {
        let name;
        try { name = decodeURIComponent(reference.slice(1)); } catch { name = ""; }
        identified = name !== "" && !name.startsWith("/") && new Set(anchors.get(name) ?? []).size === 1;
      }
      if (!identified) unresolved.push(`${path}#${keyword}`);
    }
  }
  return { entries: entries.sort(), schemas: [...schemas.keys()].sort(), unresolved: unresolved.sort(), documentDynamicAnchors: documentDynamicAnchors.sort() };
}
