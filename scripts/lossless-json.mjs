// A small complete JSON parser used by the revision-6 reference matcher. It
// retains number lexemes as mathematical decimals and rejects duplicate object
// names, so conformance cannot depend on IEEE-754 rounding or last-name-wins.
export function parseLosslessJson(text) {
  if (typeof text !== "string") return { ok: false, error: "not text" };
  let i = 0;
  const ws = () => {
    while (i < text.length && /[\u0009\u000a\u000d\u0020]/.test(text[i])) i++;
  };
  const numberNode = (lexeme) => {
    const m = lexeme.match(/^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/);
    if (!m) throw new Error("invalid number");
    let digits = `${m[2]}${m[3] || ""}`.replace(/^0+/, "");
    let exponent = BigInt(m[4] || "0") - BigInt((m[3] || "").length);
    if (digits === "") return { kind: "number", value: "0e0" };
    while (digits.endsWith("0")) {
      digits = digits.slice(0, -1);
      exponent++;
    }
    return { kind: "number", value: `${m[1]}${digits}e${exponent}` };
  };
  const stringValue = () => {
    const start = i++;
    let escaped = false;
    while (i < text.length) {
      const code = text.charCodeAt(i);
      if (!escaped && code === 0x22) {
        i++;
        return JSON.parse(text.slice(start, i));
      }
      if (!escaped && code < 0x20) throw new Error("control character in string");
      if (!escaped && code === 0x5c) escaped = true;
      else escaped = false;
      i++;
    }
    throw new Error("unterminated string");
  };
  const value = () => {
    ws();
    if (i >= text.length) throw new Error("missing value");
    if (text[i] === '"') return { kind: "string", value: stringValue() };
    if (text.startsWith("true", i)) { i += 4; return { kind: "boolean", value: true }; }
    if (text.startsWith("false", i)) { i += 5; return { kind: "boolean", value: false }; }
    if (text.startsWith("null", i)) { i += 4; return { kind: "null" }; }
    if (text[i] === "[") {
      i++; ws();
      const members = [];
      if (text[i] === "]") { i++; return { kind: "array", members }; }
      while (true) {
        members.push(value()); ws();
        if (text[i] === "]") { i++; return { kind: "array", members }; }
        if (text[i++] !== ",") throw new Error("expected array comma");
      }
    }
    if (text[i] === "{") {
      i++; ws();
      const members = new Map();
      if (text[i] === "}") { i++; return { kind: "object", members }; }
      while (true) {
        ws();
        if (text[i] !== '"') throw new Error("expected object name");
        const name = stringValue();
        if (members.has(name)) throw new Error(`duplicate object name '${name}'`);
        ws();
        if (text[i++] !== ":") throw new Error("expected name separator");
        members.set(name, value()); ws();
        if (text[i] === "}") { i++; return { kind: "object", members }; }
        if (text[i++] !== ",") throw new Error("expected object comma");
      }
    }
    const tail = text.slice(i);
    const m = tail.match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if (!m) throw new Error("invalid value");
    i += m[0].length;
    return numberNode(m[0]);
  };
  try {
    const node = value();
    ws();
    if (i !== text.length) throw new Error("trailing data");
    return { ok: true, node };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function losslessJsonEqual(left, right) {
  if (!left || !right || left.kind !== right.kind) return false;
  if (["string", "boolean", "number"].includes(left.kind)) return left.value === right.value;
  if (left.kind === "null") return true;
  if (left.kind === "array")
    return left.members.length === right.members.length
      && left.members.every((member, index) => losslessJsonEqual(member, right.members[index]));
  if (left.kind === "object") {
    if (left.members.size !== right.members.size) return false;
    for (const [name, member] of left.members) {
      if (!right.members.has(name) || !losslessJsonEqual(member, right.members.get(name))) return false;
    }
    return true;
  }
  return false;
}
