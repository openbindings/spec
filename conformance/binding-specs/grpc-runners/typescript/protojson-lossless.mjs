import protobuf from "protobufjs";

export class JsonNumber {
  constructor(token) { this.token = token; }
}

export const isJsonNumber = (value) => value instanceof JsonNumber;

export function strictUtf8(bytes, label = "UTF-8") {
  // Preserve a leading U+FEFF so the strict JSON lexer rejects it as a token;
  // TextDecoder otherwise consumes an initial UTF-8 BOM before lexing.
  try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new Error(`invalid ${label}`); }
}

function setOwn(object, key, value) {
  Object.defineProperty(object, key, { value, enumerable: true, writable: true, configurable: true });
}

function wireVarint(bytes, start) {
  let value = 0n, shift = 0n, index = start;
  while (index < bytes.length && index-start < 10) {
    const octet = bytes[index++];
    if (index-start === 10 && octet > 1) throw new Error("overflowing Protobuf varint");
    value |= BigInt(octet & 0x7f) << shift;
    if ((octet & 0x80) === 0) return { value, index };
    shift += 7n;
  }
  throw new Error("malformed Protobuf varint");
}

// Value occurrences use the pinned protobuf parser's uint64 accumulator: it
// consumes at most ten octets and accepts a terminating tenth octet even when
// high bits are discarded. Tags and lengths continue to use wireVarint.
function wireValueVarint(bytes, start) {
  let value = 0n, shift = 0n, index = start;
  while (index < bytes.length && index-start < 10) {
    const octet = bytes[index++];
    value = BigInt.asUintN(64, value | (BigInt(octet & 0x7f) << shift));
    if ((octet & 0x80) === 0) return { value, index };
    shift += 7n;
  }
  throw new Error("malformed Protobuf value varint");
}

function wireBytes(bytes, start) {
  const length = wireVarint(bytes, start);
  if (length.value > BigInt(bytes.length - length.index)) throw new Error("truncated Protobuf bytes");
  const end = length.index + Number(length.value);
  return { value: bytes.subarray(length.index, end), index: end };
}

function skipWire(bytes, index, wireType, fieldNumber) {
  if (wireType === 0) return wireValueVarint(bytes, index).index;
  if (wireType === 1) { if (index + 8 > bytes.length) throw new Error("truncated fixed64"); return index + 8; }
  if (wireType === 2) return wireBytes(bytes, index).index;
  if (wireType === 5) { if (index + 4 > bytes.length) throw new Error("truncated fixed32"); return index + 4; }
  if (wireType === 3) {
    while (index < bytes.length) {
      const tag = wireVarint(bytes, index); index = tag.index;
      const nestedNumber = Number(tag.value >> 3n), nestedWire = Number(tag.value & 7n);
      if (nestedWire === 4) { if (nestedNumber !== fieldNumber) throw new Error("mismatched end group"); return index; }
      index = skipWire(bytes, index, nestedWire, nestedNumber);
    }
  }
  throw new Error("invalid Protobuf wire type");
}

const closedEnum = (enumeration) => enumeration?._features?.enum_type === "CLOSED";
const knownEnumNumber = (enumeration, raw) => {
  const number = Number(BigInt.asIntN(32, raw));
  return enumeration.valuesById[number] === undefined ? undefined : number;
};
const normalizedUnknownEnumVarint = (raw) => BigInt.asUintN(64, BigInt.asIntN(32, raw));
const concatWire = (values) => Buffer.concat(values.map(Buffer.from));

function mapKeyFromEntry(field, bytes) {
  let index=0,key=field.keyType==="string"?"":field.keyType==="bool"?"false":"0",stringBytes;
  while(index<bytes.length){const tag=wireVarint(bytes,index);index=tag.index;const number=Number(tag.value>>3n),wireType=Number(tag.value&7n);
    if(number===1&&field.keyType==="string"&&wireType===2){const value=wireBytes(bytes,index);index=value.index;stringBytes=value.value;continue}
    if(number===1&&wireType===0){const value=wireValueVarint(bytes,index);index=value.index;const raw=value.value;
      if(field.keyType==="bool")key=raw===0n?"false":"true";
      else if(["int32","int64"].includes(field.keyType))key=String(BigInt.asIntN(field.keyType.endsWith("32")?32:64,raw));
      else if(["sint32","sint64"].includes(field.keyType)){const decoded=(raw>>1n)^-(raw&1n);key=String(BigInt.asIntN(field.keyType.endsWith("32")?32:64,decoded))}
      else if(["uint32","uint64"].includes(field.keyType))key=String(BigInt.asUintN(field.keyType.endsWith("32")?32:64,raw));
      continue}
    if(number===1&&wireType===5&&["fixed32","sfixed32"].includes(field.keyType)){if(index+4>bytes.length)throw new Error("truncated map fixed32 key");const raw=Buffer.from(bytes).readUInt32LE(index);index+=4;key=field.keyType==="sfixed32"?String(raw|0):String(raw);continue}
    if(number===1&&wireType===1&&["fixed64","sfixed64"].includes(field.keyType)){if(index+8>bytes.length)throw new Error("truncated map fixed64 key");const raw=Buffer.from(bytes).readBigUInt64LE(index);index+=8;key=field.keyType==="sfixed64"?String(BigInt.asIntN(64,raw)):String(raw);continue}
    index=skipWire(bytes,index,wireType,number)}
  if(stringBytes!==undefined)key=strictUtf8(stringBytes,`Protobuf map key ${field.fullName}`);
  return key;
}

function mapEntryState(field, bytes) {
  const key=mapKeyFromEntry(field,bytes);let index=0,valueOccurrences=[];
  while(index<bytes.length){const tag=wireVarint(bytes,index);index=tag.index;const number=Number(tag.value>>3n),wireType=Number(tag.value&7n);
    if(number===2){
      if(field.resolvedType instanceof protobuf.Enum&&wireType===0){const value=wireValueVarint(bytes,index);index=value.index;valueOccurrences.push({kind:"enum",raw:value.value});continue}
      if((field.resolvedType instanceof protobuf.Type||field.type==="string")&&wireType===2){const value=wireBytes(bytes,index);index=value.index;valueOccurrences.push({kind:field.type==="string"?"string":"message",raw:value.value});continue}
    }
    index=skipWire(bytes,index,wireType,number)
  }
  if(field.resolvedType instanceof protobuf.Enum&&closedEnum(field.resolvedType)){
    if(valueOccurrences.length===0){const value=Object.values(field.resolvedType.values)[0];return{key,kind:"enum",value,admitted:value!==undefined}}
    const raw=valueOccurrences.at(-1).raw,number=knownEnumNumber(field.resolvedType,raw);
    const writer=protobuf.Writer.create();
    const keyWire=field.keyType==="string"?2:["fixed32","sfixed32"].includes(field.keyType)?5:["fixed64","sfixed64"].includes(field.keyType)?1:0;
    writer.uint32(8|keyWire)[field.keyType](field.keyType==="bool"?key==="true":key);
    writer.uint32(16).int32(Number(BigInt.asIntN(32,raw)));
    return{key,kind:"enum",value:number,admitted:number!==undefined,unknownBytes:writer.finish()};
  }
  const kind=valueOccurrences.at(-1)?.kind;
  return{key,kind,raw:kind==="message"?concatWire(valueOccurrences.filter((entry)=>entry.kind==="message").map((entry)=>entry.raw)):valueOccurrences.at(-1)?.raw,admitted:true};
}

const normalizedUnknownMaterial = new WeakMap();
export const protoUnknownMaterial = (message) => normalizedUnknownMaterial.get(message) ?? [];

function sanitizeDecodedMessage(type, message, rawBytes, root, unknown=[],path="") {
  const bytes=Buffer.from(rawBytes),states=new Map(),maps=new Map(),oneofs=new Map();let index=0;
  const state=(field)=>{if(!states.has(field.name))states.set(field.name,{enum:[],strings:[],messages:[]});return states.get(field.name)};
  const select=(field,admitted=true)=>{if(!field.partOf||!admitted)return;if(oneofs.get(field.partOf.name)!==field.name){for(const member of field.partOf.oneof)states.delete(member);oneofs.set(field.partOf.name,field.name)}};
  while(index<bytes.length){const tag=wireVarint(bytes,index);index=tag.index;const number=Number(tag.value>>3n),wireType=Number(tag.value&7n);if(number<=0)throw new Error("invalid Protobuf field number");const field=type.fieldsById[number];if(!field){index=skipWire(bytes,index,wireType,number);continue}
    if(field.map&&wireType===2){const value=wireBytes(bytes,index);index=value.index;const entry=mapEntryState(field,value.value);if(entry.admitted){if(!maps.has(field.name))maps.set(field.name,new Map());maps.get(field.name).set(entry.key,entry)}else unknown.push({path,fieldNumber:number,wireType:2,valueBase64:Buffer.from(entry.unknownBytes).toString("base64")});continue}
    if(field.resolvedType instanceof protobuf.Enum){let values=[];if(wireType===0){const value=wireValueVarint(bytes,index);index=value.index;values=[value.value]}else if(wireType===2&&field.repeated){const packed=wireBytes(bytes,index);index=packed.index;let cursor=0;while(cursor<packed.value.length){const value=wireValueVarint(packed.value,cursor);cursor=value.index;values.push(value.value)}}else{index=skipWire(bytes,index,wireType,number);continue}
      if(closedEnum(field.resolvedType)){const known=[];for(const raw of values){const numberValue=knownEnumNumber(field.resolvedType,raw);if(numberValue===undefined)unknown.push({path,fieldNumber:number,wireType:0,varint:normalizedUnknownEnumVarint(raw).toString()});else known.push(numberValue)}if(field.repeated)state(field).enum.push(...known);else if(known.length){select(field);state(field).enum=[known.at(-1)]}}else select(field);continue}
    if(wireType===2&&field.type==="string"){const value=wireBytes(bytes,index);index=value.index;if(field.repeated)state(field).strings.push(value.value);else{select(field);state(field).strings=[value.value]}continue}
    if(wireType===2&&field.resolvedType instanceof protobuf.Type){const value=wireBytes(bytes,index);index=value.index;if(field.repeated)state(field).messages.push(value.value);else{select(field);state(field).messages.push(value.value)}continue}
    select(field);index=skipWire(bytes,index,wireType,number)
  }
  for(const oneof of type.oneofsArray??[]){const selected=oneofs.get(oneof.name);for(const member of oneof.oneof)if(member!==selected)delete message[member]}
  for(const field of type.fieldsArray){const item=states.get(field.name);
    if(field.resolvedType instanceof protobuf.Enum&&closedEnum(field.resolvedType)){if(field.repeated)message[field.name]=item?.enum??[];else if(item?.enum?.length)message[field.name]=item.enum.at(-1);else delete message[field.name]}
    if(field.type==="string"&&item?.strings){for(const raw of item.strings)strictUtf8(raw,`Protobuf string ${field.fullName}`)}
    if(field.resolvedType instanceof protobuf.Type&&item?.messages){if(field.repeated){for(let i=0;i<item.messages.length;i++)sanitizeDecodedMessage(field.resolvedType,message[field.name][i],item.messages[i],root,unknown,`${path}/${field.name}/${i}`)}else sanitizeDecodedMessage(field.resolvedType,message[field.name],concatWire(item.messages),root,unknown,`${path}/${field.name}`)}
    if(field.map&&maps.has(field.name)){const entries=maps.get(field.name);if(field.resolvedType instanceof protobuf.Enum&&closedEnum(field.resolvedType))message[field.name]=Object.fromEntries([...entries].map(([key,entry])=>[key,entry.value]));for(const [key,entry]of entries){if(entry.kind==="string")strictUtf8(entry.raw,`Protobuf map value ${field.fullName}`);if(entry.kind==="message")sanitizeDecodedMessage(field.resolvedType,message[field.name][key],entry.raw,root,unknown,`${path}/${field.name}/${key}`)}}
  }
  if(type.fullName===".google.protobuf.Any"&&message.type_url&&message.value!==undefined){const slash=message.type_url.lastIndexOf("/");if(slash>0&&slash<message.type_url.length-1){let embedded;try{embedded=root.lookupType(message.type_url.slice(slash+1))}catch{embedded=undefined}if(embedded){const decoded=embedded.decode(message.value);sanitizeDecodedMessage(embedded,decoded,message.value,root,unknown,`${path}/@any`)}}}
  normalizedUnknownMaterial.set(message,unknown);
  return message;
}

export function decodeProtoMessage(type, bytes, root) {
  const message=type.decode(bytes);
  return sanitizeDecodedMessage(type,message,bytes,root);
}

function unicodeScalarString(value, label = "string") {
  if (typeof value !== "string") throw new Error(`invalid ${label}`);
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error(`unpaired surrogate in ${label}`);
      index++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new Error(`unpaired surrogate in ${label}`);
  }
  return value;
}

export function unicodeScalarCompare(left, right) {
  const leftScalars = Array.from(unicodeScalarString(left));
  const rightScalars = Array.from(unicodeScalarString(right));
  const length = Math.min(leftScalars.length, rightScalars.length);
  for (let index = 0; index < length; index++) {
    const difference = leftScalars[index].codePointAt(0) - rightScalars[index].codePointAt(0);
    if (difference) return difference;
  }
  return leftScalars.length - rightScalars.length;
}

const jsonMemberOrder = new WeakMap();
const jsonKeysInEncounterOrder = (value) => jsonMemberOrder.get(value) ?? Object.keys(value);

export function parseUniqueJson(text) {
  let index = 0;
  const fail = (message) => { throw new Error(message); };
  const whitespace = () => { while (text[index] === " " || text[index] === "\t" || text[index] === "\r" || text[index] === "\n") index++; };
  const string = () => {
    if (text[index] !== '"') fail("JSON string");
    const start = index++;
    let escaped = false;
    while (index < text.length) {
      const char = text[index++];
      if (!escaped && char === '"') return unicodeScalarString(JSON.parse(text.slice(start, index)), "JSON string");
      if (!escaped && char === "\\") escaped = true;
      else escaped = false;
    }
    fail("unterminated JSON string");
  };
  const value = () => {
    whitespace();
    const char = text[index];
    if (char === '"') return string();
    if (char === "{") {
      index++;
      const out = {}, seen = new Set();
      whitespace();
      if (text[index] === "}") { index++; jsonMemberOrder.set(out, []); return out; }
      while (true) {
        whitespace();
        const key = string();
        if (seen.has(key)) fail(`duplicate JSON member ${key}`);
        seen.add(key);
        whitespace();
        if (text[index++] !== ":") fail("JSON colon");
        setOwn(out, key, value());
        whitespace();
        const separator = text[index++];
        if (separator === "}") { jsonMemberOrder.set(out, [...seen]); return out; }
        if (separator !== ",") fail("JSON object separator");
      }
    }
    if (char === "[") {
      index++;
      const out = [];
      whitespace();
      if (text[index] === "]") { index++; return out; }
      while (true) {
        out.push(value());
        whitespace();
        const separator = text[index++];
        if (separator === "]") return out;
        if (separator !== ",") fail("JSON array separator");
      }
    }
    const match = text.slice(index).match(/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/);
    if (!match) fail("JSON token");
    index += match[0].length;
    return /^(?:true|false|null)$/.test(match[0]) ? JSON.parse(match[0]) : new JsonNumber(match[0]);
  };
  const parsed = value();
  whitespace();
  if (index !== text.length) fail("trailing JSON");
  return parsed;
}

export function exactInteger(value) {
  const token = isJsonNumber(value) ? value.token : typeof value === "number" && Number.isSafeInteger(value) ? String(value) : typeof value === "string" ? value : null;
  if (token === null || !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(token)) throw new Error("invalid integer spelling");
  const match = token.match(/^(-?)([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/);
  const sign = match[1];
  let digits = `${match[2]}${match[3] ?? ""}`;
  const shift = Number(match[4] ?? 0) - (match[3]?.length ?? 0);
  if (!Number.isSafeInteger(shift) || Math.abs(shift) > 100000) throw new Error("integer exponent out of range");
  if (shift >= 0) digits += "0".repeat(shift);
  else {
    const cut = digits.length + shift;
    if (cut <= 0) {
      if (/[^0]/.test(digits)) throw new Error("nonintegral number");
      digits = "0";
    } else {
      if (/[^0]/.test(digits.slice(cut))) throw new Error("nonintegral number");
      digits = digits.slice(0, cut);
    }
  }
  return BigInt(`${sign}${digits}`);
}

const jsonNumberPattern = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;

export function floatValue(value, type = "double") {
  if (typeof value === "string" && ["NaN", "Infinity", "-Infinity"].includes(value)) return Number(value);
  const token = isJsonNumber(value) ? value.token : typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" ? value : null;
  if (token === null || !jsonNumberPattern.test(token)) throw new Error("invalid floating-point spelling");
  const number = Number(token);
  if (!Number.isFinite(number)) throw new Error("floating-point overflow");
  return number;
}

function float32Rational(value) {
  const bytes = new ArrayBuffer(4);
  new DataView(bytes).setFloat32(0, Math.abs(value), false);
  const bits = new DataView(bytes).getUint32(0, false);
  const exponent = (bits >>> 23) & 0xff;
  const mantissa = exponent === 0 ? BigInt(bits & 0x7fffff) : BigInt(0x800000 | (bits & 0x7fffff));
  const binaryPower = exponent === 0 ? -149 : exponent - 150;
  return binaryPower >= 0
    ? { numerator: mantissa << BigInt(binaryPower), denominator: 1n }
    : { numerator: mantissa, denominator: 1n << BigInt(-binaryPower) };
}

function decimalRational(coefficient, power) {
  if (power >= 0) return { numerator: coefficient * 10n ** BigInt(power), denominator: 1n };
  return { numerator: coefficient, denominator: 10n ** BigInt(-power) };
}

function compareDecimalDistance(left, right, exact) {
  const leftValue = decimalRational(left.coefficient, left.power);
  const rightValue = decimalRational(right.coefficient, right.power);
  const leftDelta = leftValue.numerator * exact.denominator - exact.numerator * leftValue.denominator;
  const rightDelta = rightValue.numerator * exact.denominator - exact.numerator * rightValue.denominator;
  const leftMagnitude = (leftDelta < 0n ? -leftDelta : leftDelta) * rightValue.denominator;
  const rightMagnitude = (rightDelta < 0n ? -rightDelta : rightDelta) * leftValue.denominator;
  if (leftMagnitude < rightMagnitude) return -1;
  if (leftMagnitude > rightMagnitude) return 1;
  const leftEven = (left.coefficient & 1n) === 0n;
  const rightEven = (right.coefficient & 1n) === 0n;
  if (leftEven !== rightEven) return leftEven ? -1 : 1;
  return left.coefficient < right.coefficient ? -1 : left.coefficient > right.coefficient ? 1 : 0;
}

function float32JsonNumber(value) {
  const rounded = Math.fround(value);
  if (!Number.isFinite(rounded)) return String(rounded);
  if (Object.is(rounded, -0)) return new JsonNumber("-0");
  if (rounded === 0) return 0;
  const negative = rounded < 0;
  const magnitude = Math.abs(rounded);
  const exact = float32Rational(magnitude);
  for (let precision = 1; precision <= 9; precision++) {
    const approximate = magnitude.toExponential(precision - 1);
    const [mantissa, exponentText] = approximate.split("e");
    const coefficient = BigInt(mantissa.replace(".", ""));
    const power = Number(exponentText) - precision + 1;
    const candidates = [];
    for (let delta = -3n; delta <= 3n; delta++) {
      const candidateCoefficient = coefficient + delta;
      if (candidateCoefficient <= 0n) continue;
      const candidateText = `${negative ? "-" : ""}${candidateCoefficient}e${power}`;
      if (Object.is(Math.fround(Number(candidateText)), rounded)) candidates.push({coefficient:candidateCoefficient,power});
    }
    if (candidates.length) {
      candidates.sort((left,right)=>compareDecimalDistance(left,right,exact));
      const chosen = Number(`${negative ? "-" : ""}${candidates[0].coefficient}e${candidates[0].power}`);
      return new JsonNumber(String(chosen));
    }
  }
  throw new Error("cannot format float32");
}

const leapYear = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const monthDays = (year, month) => [31, leapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
const floorDiv = (left, right) => Math.floor(left / right);
const civilDays = (year, month, day) => {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = floorDiv(adjustedYear, 400);
  const yearOfEra = adjustedYear - era * 400;
  const shiftedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = floorDiv(153 * shiftedMonth + 2, 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + floorDiv(yearOfEra, 4) - floorDiv(yearOfEra, 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
};

export function timestampParts(value) {
  const match = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/);
  if (!match) throw new Error("invalid timestamp");
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6]);
  const offsetHour = Number(match[10] ?? 0), offsetMinute = Number(match[11] ?? 0);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthDays(year, month)
      || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) throw new Error("invalid timestamp");
  const offsetSign = match[9] === "-" ? -1 : 1;
  const localSeconds = BigInt(civilDays(year, month, day) * 86400 + hour * 3600 + minute * 60 + second);
  const seconds = localSeconds - BigInt(offsetSign * (offsetHour * 3600 + offsetMinute * 60));
  if (seconds < -62135596800n || seconds > 253402300799n) throw new Error("timestamp range");
  return { seconds: String(seconds), nanos: Number((match[7] ?? "").padEnd(9, "0")) };
}

export function formatTimestamp(secondsValue, nanosValue) {
  const seconds = BigInt(secondsValue?.toString?.() ?? secondsValue);
  const nanos = Number(nanosValue ?? 0);
  if (seconds < -62135596800n || seconds > 253402300799n || !Number.isInteger(nanos) || nanos < 0 || nanos > 999999999) throw new Error("invalid decoded timestamp");
  const base = new Date(Number(seconds) * 1000).toISOString().replace(/\.000Z$/, "Z");
  if (nanos === 0) return base;
  const digits = String(nanos).padStart(9, "0");
  const fraction = nanos % 1000000 === 0 ? digits.slice(0, 3) : nanos % 1000 === 0 ? digits.slice(0, 6) : digits;
  return base.replace("Z", `.${fraction}Z`);
}

export function durationParts(value) {
  const match = typeof value === "string" && value.match(/^(-?)(0|[1-9][0-9]*)(?:\.(\d{1,9}))?s$/);
  if (!match) throw new Error("invalid duration");
  const seconds = BigInt(`${match[1] === "-" ? "-" : ""}${match[2] ?? "0"}`);
  const fraction = match[3] ?? "";
  const nanos = (match[1] === "-" ? -1 : 1) * Number(fraction.padEnd(9, "0"));
  if (seconds < -315576000000n || seconds > 315576000000n) throw new Error("duration range");
  return { seconds: String(seconds), nanos };
}

export function formatDuration(secondsValue, nanosValue) {
  const seconds = BigInt(secondsValue?.toString?.() ?? secondsValue);
  const nanos = Number(nanosValue ?? 0);
  if (seconds < -315576000000n || seconds > 315576000000n || !Number.isInteger(nanos) || nanos < -999999999 || nanos > 999999999
      || (seconds > 0n && nanos < 0) || (seconds < 0n && nanos > 0)) throw new Error("invalid decoded duration");
  const negative = seconds < 0n || nanos < 0;
  const whole = (seconds < 0n ? -seconds : seconds).toString();
  if (nanos === 0) return `${negative ? "-" : ""}${whole}s`;
  const digits = String(Math.abs(nanos)).padStart(9, "0");
  const fraction = Math.abs(nanos) % 1000000 === 0 ? digits.slice(0, 3) : Math.abs(nanos) % 1000 === 0 ? digits.slice(0, 6) : digits;
  return `${negative ? "-" : ""}${whole}.${fraction}s`;
}

const lowerCamel = (value) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const snakeCase = (value) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

export function fieldMaskPaths(value) {
  if (typeof value !== "string" || (value !== "" && !/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*(?:,[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*)*$/.test(value))) throw new Error("invalid field mask");
  if (value === "") return [];
  return value.split(",").map((path) => path.split(".").map((part) => {
    const snake = snakeCase(part);
    if (lowerCamel(snake) !== part) throw new Error("nonreversible field mask");
    return snake;
  }).join("."));
}

export function formatFieldMask(paths) {
  if (!Array.isArray(paths)) throw new Error("invalid decoded field mask");
  return paths.map((path) => {
    if (typeof path !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(path)) throw new Error("invalid decoded field mask");
    const json = path.split(".").map(lowerCamel).join(".");
    if (fieldMaskPaths(json).join(".") !== path) throw new Error("nonreversible decoded field mask");
    return json;
  }).join(",");
}

export function anyTypeName(typeUrl) {
  unicodeScalarString(typeUrl, "Any type URL");
  const slash = typeUrl.lastIndexOf("/");
  const name = slash >= 0 ? typeUrl.slice(slash + 1) : "";
  if (slash <= 0 || !/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(name)) throw new Error("invalid Any type URL");
  return name;
}

const canonical = (value) => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === "object" && !isJsonNumber(value)
    ? Object.fromEntries(Object.keys(value).sort(unicodeScalarCompare).map((key) => [key, canonical(value[key])]))
    : value;

export function protoJsonText(value) {
  const encode = (item) => isJsonNumber(item)
    ? item.token
    : Array.isArray(item)
      ? `[${item.map(encode).join(",")}]`
      : item && typeof item === "object"
        ? `{${Object.keys(item).sort(unicodeScalarCompare).map((key) => `${JSON.stringify(unicodeScalarString(key, "JSON member name"))}:${encode(item[key])}`).join(",")}}`
        : typeof item === "number" && Object.is(item, -0)
          ? "-0"
          : JSON.stringify(typeof item === "string" ? unicodeScalarString(item, "JSON string") : item);
  return encode(value);
}
const specialNames = new Set([
  "google.protobuf.Any", "google.protobuf.Timestamp", "google.protobuf.Duration",
  "google.protobuf.FieldMask", "google.protobuf.Struct", "google.protobuf.Value",
  "google.protobuf.ListValue", "google.protobuf.Empty", "google.protobuf.DoubleValue",
  "google.protobuf.FloatValue", "google.protobuf.Int64Value", "google.protobuf.UInt64Value",
  "google.protobuf.Int32Value", "google.protobuf.UInt32Value", "google.protobuf.BoolValue",
  "google.protobuf.StringValue", "google.protobuf.BytesValue",
]);

export const isProtoJsonSpecialType = (type) => specialNames.has(type.fullName.slice(1));

function protoJsonBase64(value) {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("invalid ProtoJSON Base64");
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error("noncanonical ProtoJSON Base64");
  return bytes;
}

function simpleAtoi(value) {
  if (typeof value !== "string") throw new Error("invalid quoted enum number");
  const match = value.match(/^[\x09-\x0d\x20]*([+-]?[0-9]+)[\x09-\x0d\x20]*$/);
  if (!match) throw new Error("invalid quoted enum number");
  const integer = BigInt(match[1]);
  if (integer < -2147483648n || integer > 2147483647n) throw new Error("invalid enum number");
  return integer;
}

function customEnumValue(enumeration, name, customEnums) {
  return customEnums?.get(enumeration.fullName.slice(1))?.byName?.get(name)
    ?? enumeration.valuesOptions?.[name]?.["(pb.enumvalue.json).string"];
}

function enumInput(field, value, customEnums) {
  const enumeration = field.resolvedType;
  if (enumeration.fullName === ".google.protobuf.NullValue" && value === null) return { internal:0, json:null };
  if (typeof value === "string") {
    const name = Object.keys(enumeration.values).find((candidate) => candidate === value || customEnumValue(enumeration, candidate, customEnums) === value);
    if (name !== undefined) {
      const number = enumeration.values[name];
      return { internal:number, json:enumOutput(enumeration, number, customEnums) };
    }
    throw new Error("quoted enum numbers are outside the portable caller profile");
  }
  const integer = exactInteger(value);
  if (integer < -2147483648n || integer > 2147483647n) throw new Error("invalid enum number");
  const number = Number(integer);
  return { internal:number, json:enumOutput(enumeration, number, customEnums) };
}

function enumOutput(enumeration, number, customEnums) {
  if (enumeration.fullName === ".google.protobuf.NullValue" && number === 0) return null;
  const name = enumeration.valuesById[number];
  return name === undefined ? number : customEnumValue(enumeration, name, customEnums) ?? name;
}

function scalarInput(field, value) {
  if (["int64", "sint64", "sfixed64"].includes(field.type)) {
    if (typeof value !== "string" || !/^(?:0|-[1-9][0-9]*|[1-9][0-9]*)$/.test(value)) throw new Error("noncanonical int64 spelling");
    const integer = exactInteger(value);
    if (integer < -(1n << 63n) || integer > (1n << 63n) - 1n) throw new Error("int64 overflow");
    return { internal:integer.toString(), json:integer.toString() };
  }
  if (["uint64", "fixed64"].includes(field.type)) {
    if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value)) throw new Error("noncanonical uint64 spelling");
    const integer = exactInteger(value);
    if (integer < 0n || integer > (1n << 64n) - 1n) throw new Error("uint64 overflow");
    return { internal:integer.toString(), json:integer.toString() };
  }
  if (["int32", "sint32", "sfixed32", "uint32", "fixed32"].includes(field.type)) {
    if (typeof value === "string") throw new Error("quoted 32-bit integer is outside the portable caller profile");
    const integer = exactInteger(value), unsigned = field.type.startsWith("u") || field.type === "fixed32";
    if (integer < (unsigned ? 0n : -2147483648n) || integer > (unsigned ? 4294967295n : 2147483647n)) throw new Error("32-bit overflow");
    return { internal:Number(integer), json:Number(integer) };
  }
  if (["float", "double"].includes(field.type)) {
    if (typeof value === "string" && !["NaN", "Infinity", "-Infinity"].includes(value)) throw new Error("quoted finite float is outside the portable caller profile");
    const number = floatValue(value, field.type);
    const internal = field.type === "float" ? Math.fround(number) : number;
    if (field.type === "float" && Number.isFinite(number) && !Number.isFinite(internal)) throw new Error("float overflow");
    return { internal, json:Number.isFinite(internal) ? internal : String(internal) };
  }
  if (field.type === "bool") { if (typeof value !== "boolean") throw new Error("invalid bool"); return {internal:value,json:value}; }
  if (field.type === "string") { return {internal:unicodeScalarString(value, "Protobuf string"),json:value}; }
  if (field.type === "bytes") { const bytes=protoJsonBase64(value); return {internal:bytes,json:bytes.toString("base64")}; }
  throw new Error(`unsupported scalar ${field.type}`);
}

function scalarOutput(field, value) {
  if (["int64", "sint64", "sfixed64", "uint64", "fixed64"].includes(field.type)) return value.toString();
  if (field.type === "bytes") return Buffer.from(value).toString("base64");
  if (field.type === "string") return unicodeScalarString(value, "decoded Protobuf string");
  if (field.type === "float") return float32JsonNumber(value);
  if (field.type === "double" && !Number.isFinite(value)) return String(value);
  return value;
}

function structInput(value) {
  if (value === null) return {internal:{nullValue:0,null_value:0},json:null};
  if (isJsonNumber(value)) { const number=Number(value.token); if(!Number.isFinite(number))throw new Error("Struct number overflow");return{internal:{numberValue:number,number_value:number},json:number}; }
  if (typeof value === "number") { if(!Number.isFinite(value))throw new Error("Struct number overflow");return{internal:{numberValue:value,number_value:value},json:value}; }
  if (typeof value === "string") { const string=unicodeScalarString(value,"Struct string");return{internal:{stringValue:string,string_value:string},json:value}; }
  if (typeof value === "boolean") return {internal:{boolValue:value,bool_value:value},json:value};
  if (Array.isArray(value)) { const items=value.map(structInput),list={values:items.map((item)=>item.internal)};return{internal:{listValue:list,list_value:list},json:items.map((item)=>item.json)}; }
  if (value && typeof value === "object") { const entries=Object.entries(value).map(([key,item])=>[unicodeScalarString(key,"Struct key"),structInput(item)]),struct={fields:Object.fromEntries(entries.map(([key,item])=>[key,item.internal]))};return{internal:{structValue:struct,struct_value:struct},json:canonical(Object.fromEntries(entries.map(([key,item])=>[key,item.json])))}; }
  throw new Error("invalid Struct value");
}

function structOutput(value) {
  if (Object.hasOwn(value,"nullValue")||Object.hasOwn(value,"null_value")) return null;
  const number=Object.hasOwn(value,"numberValue")?value.numberValue:value.number_value;
  if (Object.hasOwn(value,"numberValue")||Object.hasOwn(value,"number_value")) { if(!Number.isFinite(number))throw new Error("nonfinite decoded Struct number");return number; }
  const string=Object.hasOwn(value,"stringValue")?value.stringValue:value.string_value;
  if (Object.hasOwn(value,"stringValue")||Object.hasOwn(value,"string_value")) return unicodeScalarString(string,"decoded Struct string");
  if (Object.hasOwn(value,"boolValue")||Object.hasOwn(value,"bool_value")) return Object.hasOwn(value,"boolValue")?value.boolValue:value.bool_value;
  const struct=Object.hasOwn(value,"structValue")?value.structValue:value.struct_value;
  if (Object.hasOwn(value,"structValue")||Object.hasOwn(value,"struct_value")) return canonical(Object.fromEntries(Object.entries(struct.fields??{}).map(([key,item])=>[unicodeScalarString(key,"decoded Struct key"),structOutput(item)])));
  const list=Object.hasOwn(value,"listValue")?value.listValue:value.list_value;
  if (Object.hasOwn(value,"listValue")||Object.hasOwn(value,"list_value")) return (list.values??[]).map(structOutput);
  throw new Error("decoded google.protobuf.Value has no selected kind");
}

function normalizedMapKey(field, value) {
  unicodeScalarString(value, "map key");
  if (field.keyType === "string") return value;
  if (field.keyType === "bool") {
    if (value !== "true" && value !== "false") throw new Error("invalid bool map key");
    return value;
  }
  const unsigned = field.keyType.startsWith("u") || field.keyType === "fixed32" || field.keyType === "fixed64";
  if (!(unsigned ? /^(?:0|[1-9][0-9]*)$/ : /^(?:0|-[1-9][0-9]*|[1-9][0-9]*)$/).test(value)) throw new Error("noncanonical integer map key");
  const integer = BigInt(value);
  const bits = field.keyType.endsWith("32") ? 32n : 64n;
  const minimum = unsigned ? 0n : -(1n << (bits - 1n));
  const maximum = unsigned ? (1n << bits) - 1n : (1n << (bits - 1n)) - 1n;
  if (integer < minimum || integer > maximum) throw new Error("map key out of range");
  return integer.toString();
}

function decodedMapKey(field, value) {
  if (["int64","sint64","sfixed64","uint64","fixed64"].includes(field.keyType)
      && typeof value === "string" && value.length === 8) {
    const unsigned = field.keyType === "uint64" || field.keyType === "fixed64";
    return protobuf.util.longFromHash(value, unsigned).toString();
  }
  return normalizedMapKey(field, value);
}

function isImplicitDefault(field, value) {
  if (field.partOf || field._features?.field_presence !== "IMPLICIT") return false;
  if (field.resolvedType instanceof protobuf.Type || field.repeated || field.map) return false;
  if (field.resolvedType instanceof protobuf.Enum) return value === 0;
  if (["float","double"].includes(field.type)) return value === 0 && !Object.is(value,-0);
  if (field.type === "bool") return value === false;
  if (field.type === "string") return value === "";
  if (field.type === "bytes") return Buffer.from(value).length === 0;
  return value === 0 || value === "0";
}

function collidesWithAnyEnvelope(type) {
  return type.fieldsArray.some((field) =>
    field.name === "@type" ||
    (field.options?.json_name ?? field.jsonName ?? lowerCamel(field.name)) === "@type"
  );
}

function specialInput(type, value, root, customEnums) {
  const name = type.fullName.slice(1);
  if (name === "google.protobuf.Timestamp") { const internal=timestampParts(value);return{internal,json:formatTimestamp(internal.seconds,internal.nanos)}; }
  if (name === "google.protobuf.Duration") { const internal=durationParts(value);return{internal,json:formatDuration(internal.seconds,internal.nanos)}; }
  if (name === "google.protobuf.FieldMask") { const paths=fieldMaskPaths(value);return{internal:{paths},json:formatFieldMask(paths)}; }
  if (/^google\.protobuf\.(?:Double|Float|Int64|UInt64|Int32|UInt32|Bool|String|Bytes)Value$/.test(name)) {
    const defaultValue=name==="google.protobuf.BoolValue"?false:name==="google.protobuf.StringValue"?"":name==="google.protobuf.BytesValue"?Buffer.alloc(0):["google.protobuf.Int64Value","google.protobuf.UInt64Value"].includes(name)?"0":0;
    const converted=scalarInput(type.fields.value,value===null?defaultValue:value);return{internal:{value:converted.internal},json:value===null?null:converted.json};
  }
  if (name === "google.protobuf.Empty") { if(!value||Array.isArray(value)||typeof value!=="object"||Object.keys(value).length)throw new Error("invalid Empty");return{internal:{},json:{}}; }
  if (name === "google.protobuf.Struct") { if(!value||Array.isArray(value)||typeof value!=="object")throw new Error("invalid Struct");const entries=Object.entries(value).map(([key,item])=>[key,structInput(item)]);return{internal:{fields:Object.fromEntries(entries.map(([key,item])=>[key,item.internal]))},json:canonical(Object.fromEntries(entries.map(([key,item])=>[key,item.json])))}; }
  if (name === "google.protobuf.Value") return structInput(value);
  if (name === "google.protobuf.ListValue") { if(!Array.isArray(value))throw new Error("invalid ListValue");const items=value.map(structInput);return{internal:{values:items.map((item)=>item.internal)},json:items.map((item)=>item.json)}; }
  if (name === "google.protobuf.Any") {
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("invalid Any");
    if (Object.keys(value).length === 0) return {internal:{},json:{}};
    if (typeof value["@type"] !== "string") throw new Error("invalid Any");
    const typeName=anyTypeName(value["@type"]);let embedded;try{embedded=root.lookupType(typeName)}catch{throw new Error("unknown Any type")}
    const body={...value};delete body["@type"];
    let parsed;
    if (isProtoJsonSpecialType(embedded) && embedded.fullName !== ".google.protobuf.Empty") {
      if (Object.keys(body).length !== 1 || !Object.hasOwn(body,"value")) throw new Error("invalid well-known Any");
      parsed=specialInput(embedded,body.value,root,customEnums);
    } else if (embedded.fullName === ".google.protobuf.Empty") {
      if (Object.keys(body).length !== 0) throw new Error("invalid Empty Any");
      parsed=specialInput(embedded,{},root,customEnums);
    } else {
      if (collidesWithAnyEnvelope(embedded)) throw new Error("embedded Any type collides with @type");
      parsed=parseProtoJsonMessage(embedded,body,root,customEnums);
      if (Object.hasOwn(parsed.json,"@type")) throw new Error("embedded Any message collides with @type");
    }
    const bytes=Buffer.from(embedded.encode(embedded.fromObject(parsed.internal)).finish());
    return{internal:{type_url:value["@type"],value:bytes},json:isProtoJsonSpecialType(embedded)&&embedded.fullName!==".google.protobuf.Empty"?{"@type":value["@type"],value:parsed.json}:embedded.fullName===".google.protobuf.Empty"?{"@type":value["@type"]}:{"@type":value["@type"],...parsed.json}};
  }
  throw new Error(`unsupported well-known type ${name}`);
}

function specialOutput(type, message, root, customEnums) {
  const name=type.fullName.slice(1);
  if(name==="google.protobuf.Timestamp")return formatTimestamp(message.seconds??0,message.nanos??0);
  if(name==="google.protobuf.Duration")return formatDuration(message.seconds??0,message.nanos??0);
  if(name==="google.protobuf.FieldMask")return formatFieldMask(message.paths??[]);
  if(name==="google.protobuf.Empty")return{};
  if(/^google\.protobuf\.(?:Double|Float|Int64|UInt64|Int32|UInt32|Bool|String|Bytes)Value$/.test(name)){const defaultValue=name==="google.protobuf.BoolValue"?false:name==="google.protobuf.StringValue"?"":name==="google.protobuf.BytesValue"?Buffer.alloc(0):["google.protobuf.Int64Value","google.protobuf.UInt64Value"].includes(name)?"0":0;return scalarOutput(type.fields.value,message.value??defaultValue)}
  if(name==="google.protobuf.Struct")return canonical(Object.fromEntries(Object.entries(message.fields??{}).map(([key,item])=>[key,structOutput(item)])));
  if(name==="google.protobuf.Value")return structOutput(message);
  if(name==="google.protobuf.ListValue")return(message.values??[]).map(structOutput);
  if(name==="google.protobuf.Any"){
    const url=message.type_url??"";
    if(url===""&&Buffer.from(message.value??Buffer.alloc(0)).length===0)return{};
    const typeName=anyTypeName(url);let embedded;try{embedded=root.lookupType(typeName)}catch{throw new Error("unknown Any output type")}
    if (!isProtoJsonSpecialType(embedded) && collidesWithAnyEnvelope(embedded)) throw new Error("embedded Any output type collides with @type");
    const decoded=decodeProtoMessage(embedded,message.value??Buffer.alloc(0),root),body=protoJsonMessageToValue(embedded,decoded,root,customEnums);
    if (!isProtoJsonSpecialType(embedded) && Object.hasOwn(body,"@type")) throw new Error("embedded Any output collides with @type");
    return isProtoJsonSpecialType(embedded)&&embedded.fullName!==".google.protobuf.Empty"?{"@type":url,value:body}:embedded.fullName===".google.protobuf.Empty"?{"@type":url}:{"@type":url,...body};
  }
  throw new Error(`unsupported well-known type ${name}`);
}

export function parseProtoJsonMessage(type, value, root, customEnums = new Map()) {
  if (isProtoJsonSpecialType(type)) return specialInput(type,value,root,customEnums);
  if (!value || Array.isArray(value) || typeof value !== "object") throw new Error(`expected object for ${type.fullName}`);
  const aliases=new Map();
  for(const field of type.fieldsArray){const jsonName=field.options?.json_name??field.jsonName??lowerCamel(field.name);for(const alias of new Set([field.name,jsonName])){if(aliases.has(alias)&&aliases.get(alias).field!==field)throw new Error(`ambiguous field spelling ${alias}`);aliases.set(alias,{field,jsonName})}}
  const seenFields=new Set(),presentFields=new Set(),internal={},json={};
  for(const key of jsonKeysInEncounterOrder(value)){const raw=value[key];
    const alias=aliases.get(key);if(!alias)throw new Error(`unknown field ${key}`);const field=alias.field;if(seenFields.has(field.name))throw new Error(`duplicate field assignment ${key}`);seenFields.add(field.name);
    const wrapper=/^\.google\.protobuf\.(?:Double|Float|Int64|UInt64|Int32|UInt32|Bool|String|Bytes)Value$/.test(field.resolvedType?.fullName??"");
    if(raw===null&&field.resolvedType?.fullName!==".google.protobuf.NullValue"&&field.resolvedType?.fullName!==".google.protobuf.Value")continue;
    presentFields.add(field.name);
    const one=(item)=>field.resolvedType instanceof protobuf.Enum?enumInput(field,item,customEnums):field.resolvedType instanceof protobuf.Type?parseProtoJsonMessage(field.resolvedType,item,root,customEnums):scalarInput(field,item);
    let converted;
    if(field.map){if(!raw||Array.isArray(raw)||typeof raw!=="object")throw new Error("invalid map");const entries=new Map();for(const rawKey of jsonKeysInEncounterOrder(raw)){const mapKey=normalizedMapKey(field,rawKey);if(wrapper&&raw[rawKey]===null)throw new Error("null wrapper map value");entries.set(mapKey,one(raw[rawKey]));}converted={internal:Object.fromEntries([...entries].map(([mapKey,item])=>[mapKey,item.internal])),json:canonical(Object.fromEntries([...entries].map(([mapKey,item])=>[mapKey,item.json])))};}
    else if(field.repeated){if(!Array.isArray(raw))throw new Error("invalid repeated");if(wrapper&&raw.some((item)=>item===null))throw new Error("null repeated wrapper");const items=raw.map(one);converted={internal:items.map((item)=>item.internal),json:items.map((item)=>item.json)};}
    else converted=one(raw);
    if (!isImplicitDefault(field,converted.internal)) { setOwn(internal,field.name,converted.internal);setOwn(json,alias.jsonName,converted.json); }
  }
  for(const oneof of type.oneofsArray)if(oneof.oneof.filter((name)=>presentFields.has(name)).length>1)throw new Error(`oneof ${oneof.name}`);
  return{internal,json:canonical(json)};
}

export function protoJsonMessageFromInternal(type, internal) {
  const message = type.fromObject(internal);
  for (const field of type.fieldsArray) {
    if (!Object.hasOwn(internal,field.name)) continue;
    const raw = internal[field.name];
    if (field.resolvedType instanceof protobuf.Enum && field.resolvedType._features?.enum_type === "CLOSED") {
      message[field.name] = field.repeated ? raw.map(Number) : Number(raw);
      continue;
    }
    if (!(field.resolvedType instanceof protobuf.Type)) continue;
    if (field.map) {
      const entries = Object.entries(raw).map(([key,value])=>[key,protoJsonMessageFromInternal(field.resolvedType,value)]);
      message[field.name] = Object.fromEntries(entries);
    } else if (field.repeated) message[field.name] = raw.map((value)=>protoJsonMessageFromInternal(field.resolvedType,value));
    else message[field.name] = protoJsonMessageFromInternal(field.resolvedType,raw);
  }
  return message;
}

export function protoJsonMessageToValue(type, message, root, customEnums = new Map()) {
  if(isProtoJsonSpecialType(type))return specialOutput(type,message,root,customEnums);
  const out={};
  for(const field of type.fieldsArray){if(!Object.hasOwn(message,field.name))continue;const value=message[field.name];if((field.repeated&&value.length===0)||(field.map&&Object.keys(value).length===0)||isImplicitDefault(field,value))continue;const one=(item)=>field.resolvedType instanceof protobuf.Enum?enumOutput(field.resolvedType,item,customEnums):field.resolvedType instanceof protobuf.Type?protoJsonMessageToValue(field.resolvedType,item,root,customEnums):scalarOutput(field,item);const jsonName=field.options?.json_name??field.jsonName??lowerCamel(field.name);if(field.map){const normalized=new Set(),entries=Object.entries(value).map(([rawKey,item])=>{const key=decodedMapKey(field,rawKey);if(normalized.has(key))throw new Error("duplicate normalized decoded map key");normalized.add(key);return[key,one(item)]});setOwn(out,jsonName,canonical(Object.fromEntries(entries)))}else setOwn(out,jsonName,field.repeated?value.map(one):one(value))}
  return canonical(out);
}
