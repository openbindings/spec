package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"
)

// strictJSONParser recognizes exactly one RFC 8259 JSON value. It retains
// number spellings as json.Number and rejects duplicate decoded member names,
// non-JSON whitespace, invalid UTF-8, and unpaired UTF-16 surrogate escapes
// before any descriptor-driven normalization can change the source.
type strictJSONParser struct {
	raw    []byte
	offset int
}

type orderedJSONEntry struct {
	Key   string
	Value any
}
type orderedJSONObject struct{ Entries []orderedJSONEntry }

func (object orderedJSONObject) MarshalJSON() ([]byte, error) {
	var out bytes.Buffer
	out.WriteByte('{')
	for index, entry := range object.Entries {
		if index > 0 {
			out.WriteByte(',')
		}
		key, err := json.Marshal(entry.Key)
		if err != nil {
			return nil, err
		}
		value, err := json.Marshal(entry.Value)
		if err != nil {
			return nil, err
		}
		out.Write(key)
		out.WriteByte(':')
		out.Write(value)
	}
	out.WriteByte('}')
	return out.Bytes(), nil
}

func orderedObjectEntries(value any) ([]orderedJSONEntry, bool) {
	switch object := value.(type) {
	case orderedJSONObject:
		return object.Entries, true
	case map[string]any:
		keys := make([]string, 0, len(object))
		for key := range object {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		entries := make([]orderedJSONEntry, 0, len(keys))
		for _, key := range keys {
			entries = append(entries, orderedJSONEntry{key, object[key]})
		}
		return entries, true
	default:
		return nil, false
	}
}

func orderedObjectMap(value any) (map[string]any, bool) {
	entries, ok := orderedObjectEntries(value)
	if !ok {
		return nil, false
	}
	out := map[string]any{}
	for _, entry := range entries {
		out[entry.Key] = entry.Value
	}
	return out, true
}

func orderedObjectValue(value any, key string) (any, bool) {
	entries, ok := orderedObjectEntries(value)
	if !ok {
		return nil, false
	}
	for _, entry := range entries {
		if entry.Key == key {
			return entry.Value, true
		}
	}
	return nil, false
}

func parseStrictLosslessJSON(raw []byte) (any, error) {
	if !utf8.Valid(raw) {
		return nil, fmt.Errorf("JSON is not UTF-8")
	}
	parser := &strictJSONParser{raw: raw}
	value, err := parser.value()
	if err != nil {
		return nil, err
	}
	parser.whitespace()
	if parser.offset != len(parser.raw) {
		return nil, fmt.Errorf("trailing JSON")
	}
	return value, nil
}

func (parser *strictJSONParser) whitespace() {
	for parser.offset < len(parser.raw) {
		switch parser.raw[parser.offset] {
		case ' ', '\t', '\r', '\n':
			parser.offset++
		default:
			return
		}
	}
}

func (parser *strictJSONParser) value() (any, error) {
	parser.whitespace()
	if parser.offset >= len(parser.raw) {
		return nil, fmt.Errorf("missing JSON value")
	}
	switch parser.raw[parser.offset] {
	case '{':
		return parser.object()
	case '[':
		return parser.array()
	case '"':
		return parser.stringValue()
	case 't':
		return parser.literal("true", true)
	case 'f':
		return parser.literal("false", false)
	case 'n':
		return parser.literal("null", nil)
	default:
		return parser.number()
	}
}

func (parser *strictJSONParser) object() (any, error) {
	parser.offset++
	parser.whitespace()
	result := orderedJSONObject{}
	seen := map[string]bool{}
	if parser.take('}') {
		return result, nil
	}
	for {
		parser.whitespace()
		key, err := parser.stringValue()
		if err != nil {
			return nil, err
		}
		name := key.(string)
		if seen[name] {
			return nil, fmt.Errorf("duplicate JSON member %s", name)
		}
		seen[name] = true
		parser.whitespace()
		if !parser.take(':') {
			return nil, fmt.Errorf("JSON object colon")
		}
		item, err := parser.value()
		if err != nil {
			return nil, err
		}
		result.Entries = append(result.Entries, orderedJSONEntry{name, item})
		parser.whitespace()
		if parser.take('}') {
			return result, nil
		}
		if !parser.take(',') {
			return nil, fmt.Errorf("JSON object separator")
		}
	}
}

func (parser *strictJSONParser) array() (any, error) {
	parser.offset++
	parser.whitespace()
	result := []any{}
	if parser.take(']') {
		return result, nil
	}
	for {
		item, err := parser.value()
		if err != nil {
			return nil, err
		}
		result = append(result, item)
		parser.whitespace()
		if parser.take(']') {
			return result, nil
		}
		if !parser.take(',') {
			return nil, fmt.Errorf("JSON array separator")
		}
	}
}

func (parser *strictJSONParser) stringValue() (any, error) {
	if !parser.take('"') {
		return nil, fmt.Errorf("JSON string")
	}
	start := parser.offset - 1
	for parser.offset < len(parser.raw) {
		current := parser.raw[parser.offset]
		if current < 0x20 {
			return nil, fmt.Errorf("unescaped JSON control character")
		}
		if current == '"' {
			parser.offset++
			var value string
			if err := json.Unmarshal(parser.raw[start:parser.offset], &value); err != nil {
				return nil, err
			}
			return value, nil
		}
		if current != '\\' {
			_, size := utf8.DecodeRune(parser.raw[parser.offset:])
			if size == 0 || (size == 1 && current >= utf8.RuneSelf) {
				return nil, fmt.Errorf("invalid UTF-8 in JSON string")
			}
			parser.offset += size
			continue
		}
		parser.offset++
		if parser.offset >= len(parser.raw) {
			return nil, fmt.Errorf("truncated JSON escape")
		}
		escape := parser.raw[parser.offset]
		parser.offset++
		if escape != 'u' {
			if !containsByte(`"\\/bfnrt`, escape) {
				return nil, fmt.Errorf("invalid JSON escape")
			}
			continue
		}
		unit, err := parser.hexCodeUnit()
		if err != nil {
			return nil, err
		}
		if unit >= 0xd800 && unit <= 0xdbff {
			if parser.offset+2 > len(parser.raw) || parser.raw[parser.offset] != '\\' || parser.raw[parser.offset+1] != 'u' {
				return nil, fmt.Errorf("unpaired JSON high surrogate")
			}
			parser.offset += 2
			low, err := parser.hexCodeUnit()
			if err != nil || low < 0xdc00 || low > 0xdfff {
				return nil, fmt.Errorf("unpaired JSON high surrogate")
			}
		} else if unit >= 0xdc00 && unit <= 0xdfff {
			return nil, fmt.Errorf("unpaired JSON low surrogate")
		}
	}
	return nil, fmt.Errorf("unterminated JSON string")
}

func (parser *strictJSONParser) hexCodeUnit() (uint16, error) {
	if parser.offset+4 > len(parser.raw) {
		return 0, fmt.Errorf("truncated JSON Unicode escape")
	}
	var result uint16
	for index := 0; index < 4; index++ {
		current := parser.raw[parser.offset+index]
		var digit byte
		switch {
		case current >= '0' && current <= '9':
			digit = current - '0'
		case current >= 'a' && current <= 'f':
			digit = current - 'a' + 10
		case current >= 'A' && current <= 'F':
			digit = current - 'A' + 10
		default:
			return 0, fmt.Errorf("invalid JSON Unicode escape")
		}
		result = result*16 + uint16(digit)
	}
	parser.offset += 4
	return result, nil
}

func (parser *strictJSONParser) number() (any, error) {
	start := parser.offset
	parser.take('-')
	if parser.take('0') {
		if parser.offset < len(parser.raw) && parser.raw[parser.offset] >= '0' && parser.raw[parser.offset] <= '9' {
			return nil, fmt.Errorf("leading zero in JSON number")
		}
	} else if parser.offset < len(parser.raw) && parser.raw[parser.offset] >= '1' && parser.raw[parser.offset] <= '9' {
		for parser.offset < len(parser.raw) && parser.raw[parser.offset] >= '0' && parser.raw[parser.offset] <= '9' {
			parser.offset++
		}
	} else {
		return nil, fmt.Errorf("invalid JSON number")
	}
	if parser.take('.') {
		fractionStart := parser.offset
		for parser.offset < len(parser.raw) && parser.raw[parser.offset] >= '0' && parser.raw[parser.offset] <= '9' {
			parser.offset++
		}
		if parser.offset == fractionStart {
			return nil, fmt.Errorf("invalid JSON fraction")
		}
	}
	if parser.offset < len(parser.raw) && (parser.raw[parser.offset] == 'e' || parser.raw[parser.offset] == 'E') {
		parser.offset++
		if parser.offset < len(parser.raw) && (parser.raw[parser.offset] == '+' || parser.raw[parser.offset] == '-') {
			parser.offset++
		}
		exponentStart := parser.offset
		for parser.offset < len(parser.raw) && parser.raw[parser.offset] >= '0' && parser.raw[parser.offset] <= '9' {
			parser.offset++
		}
		if parser.offset == exponentStart {
			return nil, fmt.Errorf("invalid JSON exponent")
		}
	}
	return json.Number(string(parser.raw[start:parser.offset])), nil
}

func (parser *strictJSONParser) literal(token string, value any) (any, error) {
	if parser.offset+len(token) > len(parser.raw) || string(parser.raw[parser.offset:parser.offset+len(token)]) != token {
		return nil, fmt.Errorf("invalid JSON token")
	}
	parser.offset += len(token)
	return value, nil
}

func (parser *strictJSONParser) take(wanted byte) bool {
	if parser.offset < len(parser.raw) && parser.raw[parser.offset] == wanted {
		parser.offset++
		return true
	}
	return false
}

func containsByte(value string, wanted byte) bool {
	for index := 0; index < len(value); index++ {
		if value[index] == wanted {
			return true
		}
	}
	return false
}

var pinnedDurationPattern = regexp.MustCompile(`^(-?)(0|[1-9][0-9]*)(?:\.([0-9]{1,9}))?s$`)
var pinnedCanonicalSignedInteger = regexp.MustCompile(`^(?:0|-[1-9][0-9]*|[1-9][0-9]*)$`)
var pinnedCanonicalUnsignedInteger = regexp.MustCompile(`^(?:0|[1-9][0-9]*)$`)

func pinnedQuotedEnumNumber(value string) (json.Number, bool) {
	return "", false
}

func pinnedProtoJSONBase64(value string) (string, error) {
	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return "", fmt.Errorf("invalid ProtoJSON Base64")
	}
	canonical := base64.StdEncoding.EncodeToString(decoded)
	if canonical != value {
		return "", fmt.Errorf("noncanonical ProtoJSON Base64")
	}
	return canonical, nil
}

func normalizePortableCallerScalar(kind string, value any) (any, error) {
	switch kind {
	case "int64", "sint64", "sfixed64":
		text, ok := value.(string)
		if !ok || !pinnedCanonicalSignedInteger.MatchString(text) {
			return nil, fmt.Errorf("noncanonical %s caller value", kind)
		}
		if _, err := strconv.ParseInt(text, 10, 64); err != nil {
			return nil, fmt.Errorf("%s caller value out of range", kind)
		}
	case "uint64", "fixed64":
		text, ok := value.(string)
		if !ok || !pinnedCanonicalUnsignedInteger.MatchString(text) {
			return nil, fmt.Errorf("noncanonical %s caller value", kind)
		}
		if _, err := strconv.ParseUint(text, 10, 64); err != nil {
			return nil, fmt.Errorf("%s caller value out of range", kind)
		}
	case "int32", "sint32", "sfixed32", "uint32", "fixed32":
		if _, quoted := value.(string); quoted {
			return nil, fmt.Errorf("quoted %s caller value", kind)
		}
	case "float", "double":
		if text, quoted := value.(string); quoted && text != "NaN" && text != "Infinity" && text != "-Infinity" {
			return nil, fmt.Errorf("quoted finite %s caller value", kind)
		}
	}
	return value, nil
}

func normalizePinnedProtoJSONMapKey(kind, value string) (string, error) {
	switch kind {
	case "string":
		return value, nil
	case "bool":
		if value == "true" || value == "false" {
			return value, nil
		}
	case "int32", "sint32", "sfixed32":
		if !pinnedCanonicalSignedInteger.MatchString(value) {
			break
		}
		number, err := strconv.ParseInt(value, 10, 32)
		if err == nil {
			return strconv.FormatInt(number, 10), nil
		}
	case "int64", "sint64", "sfixed64":
		if !pinnedCanonicalSignedInteger.MatchString(value) {
			break
		}
		number, err := strconv.ParseInt(value, 10, 64)
		if err == nil {
			return strconv.FormatInt(number, 10), nil
		}
	case "uint32", "fixed32":
		if pinnedCanonicalUnsignedInteger.MatchString(value) {
			number, err := strconv.ParseUint(value, 10, 32)
			if err == nil {
				return strconv.FormatUint(number, 10), nil
			}
		}
	case "uint64", "fixed64":
		if pinnedCanonicalUnsignedInteger.MatchString(value) {
			number, err := strconv.ParseUint(value, 10, 64)
			if err == nil {
				return strconv.FormatUint(number, 10), nil
			}
		}
	}
	return "", fmt.Errorf("invalid %s map key", kind)
}

func normalizePinnedDuration(value any) (any, error) {
	text, ok := value.(string)
	if !ok {
		return value, nil
	}
	match := pinnedDurationPattern.FindStringSubmatch(text)
	if match == nil {
		return nil, fmt.Errorf("invalid duration")
	}
	whole := match[2]
	if whole == "" {
		whole = "0"
	}
	seconds, err := strconv.ParseInt(whole, 10, 64)
	if err != nil || seconds > 315576000000 {
		return nil, fmt.Errorf("duration range")
	}
	fraction := match[3]
	nanos := int64(0)
	if fraction != "" {
		nanos, err = strconv.ParseInt(fraction+strings.Repeat("0", 9-len(fraction)), 10, 32)
		if err != nil {
			return nil, fmt.Errorf("invalid duration fraction")
		}
	}
	negative := match[1] == "-"
	if negative {
		seconds = -seconds
		nanos = -nanos
	}
	prefix := ""
	if negative {
		prefix = "-"
	}
	absSeconds := seconds
	if absSeconds < 0 {
		absSeconds = -absSeconds
	}
	if nanos == 0 {
		return fmt.Sprintf("%s%ds", prefix, absSeconds), nil
	}
	absNanos := nanos
	if absNanos < 0 {
		absNanos = -absNanos
	}
	digits := fmt.Sprintf("%09d", absNanos)
	if absNanos%1000000 == 0 {
		digits = digits[:3]
	} else if absNanos%1000 == 0 {
		digits = digits[:6]
	}
	return fmt.Sprintf("%s%d.%ss", prefix, absSeconds, digits), nil
}
