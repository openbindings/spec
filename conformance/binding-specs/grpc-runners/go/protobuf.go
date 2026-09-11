package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/encoding/protowire"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
	"google.golang.org/protobuf/types/dynamicpb"
)

func pinnedClosedEnum(field protoreflect.FieldDescriptor) bool {
	return field.Kind() == protoreflect.EnumKind && field.Enum().IsClosed()
}

func pinnedKnownEnum(field protoreflect.FieldDescriptor, raw uint64) (protoreflect.EnumNumber, bool) {
	number := protoreflect.EnumNumber(int32(raw))
	return number, field.Enum().Values().ByNumber(number) != nil
}

func pinnedOneofHasClosedEnum(oneof protoreflect.OneofDescriptor) bool {
	if oneof == nil {
		return false
	}
	fields := oneof.Fields()
	for index := 0; index < fields.Len(); index++ {
		if pinnedClosedEnum(fields.Get(index)) {
			return true
		}
	}
	return false
}

func consumePinnedValueVarint(raw []byte) (uint64, int) {
	var value uint64
	for index := 0; index < len(raw) && index < 10; index++ {
		octet := raw[index]
		if index < 9 {
			value |= uint64(octet&0x7f) << (7 * index)
		} else {
			// The pinned C++ parser consumes a terminating tenth value octet
			// even when its discarded high bits are nonzero. Only bit 63 is
			// representable in the resulting uint64 value.
			value |= uint64(octet&0x01) << 63
		}
		if octet&0x80 == 0 {
			return value, index + 1
		}
	}
	return 0, -1
}

func consumePinnedClosedEnumVarint(raw []byte) (uint64, int) {
	value, consumed := consumePinnedValueVarint(raw)
	if consumed < 0 {
		return 0, consumed
	}
	// The pinned C++ enum parser converts through int32. Preserve that
	// semantic value as a canonical sign-extended unknown varint.
	return uint64(int64(int32(value))), consumed
}

func pinnedVarintKind(kind protoreflect.Kind) bool {
	switch kind {
	case protoreflect.BoolKind, protoreflect.EnumKind,
		protoreflect.Int32Kind, protoreflect.Sint32Kind, protoreflect.Uint32Kind,
		protoreflect.Int64Kind, protoreflect.Sint64Kind, protoreflect.Uint64Kind:
		return true
	default:
		return false
	}
}

func consumePinnedFieldValue(number protowire.Number, wireType protowire.Type, raw []byte) int {
	if wireType == protowire.VarintType {
		_, consumed := consumePinnedValueVarint(raw)
		return consumed
	}
	return protowire.ConsumeFieldValue(number, wireType, raw)
}

func normalizePinnedClosedEnumWire(descriptor protoreflect.MessageDescriptor, raw []byte) ([]byte, error) {
	var out []byte
	fields := descriptor.Fields()
	for len(raw) > 0 {
		number, wireType, tagBytes := protowire.ConsumeTag(raw)
		if tagBytes < 0 || number <= 0 {
			return nil, fmt.Errorf("invalid Protobuf tag")
		}
		remainder := raw[tagBytes:]
		field := fields.ByNumber(number)
		if wireType == protowire.VarintType {
			value, consumed := consumePinnedValueVarint(remainder)
			if consumed < 0 {
				return nil, fmt.Errorf("malformed Protobuf value varint")
			}
			if field != nil && pinnedClosedEnum(field) {
				value = uint64(int64(int32(value)))
			}
			out = protowire.AppendTag(out, number, wireType)
			out = protowire.AppendVarint(out, value)
			raw = remainder[consumed:]
			continue
		}
		if field != nil && field.IsList() && field.IsPacked() && pinnedVarintKind(field.Kind()) && wireType == protowire.BytesType {
			packed, consumed := protowire.ConsumeBytes(remainder)
			if consumed < 0 {
				return nil, fmt.Errorf("malformed packed closed enum")
			}
			var normalized []byte
			for len(packed) > 0 {
				value, size := consumePinnedValueVarint(packed)
				if size < 0 {
					return nil, fmt.Errorf("malformed packed Protobuf value varint")
				}
				if pinnedClosedEnum(field) {
					value = uint64(int64(int32(value)))
				}
				normalized = protowire.AppendVarint(normalized, value)
				packed = packed[size:]
			}
			out = protowire.AppendTag(out, number, wireType)
			out = protowire.AppendBytes(out, normalized)
			raw = remainder[consumed:]
			continue
		}
		if field != nil && field.Kind() == protoreflect.MessageKind && wireType == protowire.BytesType {
			payload, consumed := protowire.ConsumeBytes(remainder)
			if consumed < 0 {
				return nil, fmt.Errorf("malformed nested message")
			}
			normalized, err := normalizePinnedClosedEnumWire(field.Message(), payload)
			if err != nil {
				return nil, err
			}
			out = protowire.AppendTag(out, number, wireType)
			out = protowire.AppendBytes(out, normalized)
			raw = remainder[consumed:]
			continue
		}
		consumed := consumePinnedFieldValue(number, wireType, remainder)
		if consumed < 0 {
			return nil, fmt.Errorf("malformed Protobuf field")
		}
		out = append(out, raw[:tagBytes+consumed]...)
		raw = remainder[consumed:]
	}
	return out, nil
}

// applyPinnedClosedEnumSemantics repairs the intentionally looser dynamic
// decoder view to the pinned proto2/Editions semantics: unknown closed-enum
// numbers remain unknown-field material and never become typed values.
func applyPinnedClosedEnumSemantics(message protoreflect.Message, raw []byte, types *protoregistry.Types) error {
	fields := message.Descriptor().Fields()
	for index := 0; index < fields.Len(); index++ {
		field := fields.Get(index)
		if pinnedClosedEnum(field) || (field.IsMap() && pinnedClosedEnum(field.MapValue())) {
			message.Clear(field)
		}
		if pinnedOneofHasClosedEnum(field.ContainingOneof()) {
			if selected := message.WhichOneof(field.ContainingOneof()); selected != nil {
				message.Clear(selected)
			}
		}
	}
	nested := map[protoreflect.FieldNumber][][]byte{}
	for len(raw) > 0 {
		number, wireType, tagBytes := protowire.ConsumeTag(raw)
		if tagBytes < 0 || number <= 0 {
			return fmt.Errorf("invalid Protobuf tag")
		}
		raw = raw[tagBytes:]
		field := fields.ByNumber(number)
		if field == nil {
			consumed := consumePinnedFieldValue(number, wireType, raw)
			if consumed < 0 {
				return fmt.Errorf("invalid unknown Protobuf field")
			}
			raw = raw[consumed:]
			continue
		}
		if oneof := field.ContainingOneof(); pinnedOneofHasClosedEnum(oneof) && !pinnedClosedEnum(field) {
			consumed := consumePinnedFieldValue(number, wireType, raw)
			if consumed < 0 {
				return fmt.Errorf("invalid oneof field")
			}
			occurrence := protowire.AppendTag(nil, number, wireType)
			occurrence = append(occurrence, raw[:consumed]...)
			raw = raw[consumed:]
			temporary := dynamicpb.NewMessage(message.Descriptor())
			normalizedOccurrence, err := normalizePinnedClosedEnumWire(message.Descriptor(), occurrence)
			if err != nil {
				return err
			}
			if err := (proto.UnmarshalOptions{DiscardUnknown: false, Resolver: types}).Unmarshal(normalizedOccurrence, temporary); err != nil {
				return err
			}
			if temporary.Has(field) {
				if selected := message.WhichOneof(oneof); selected != nil {
					message.Clear(selected)
				}
				message.Set(field, temporary.Get(field))
			}
			continue
		}
		if field.IsMap() && wireType == protowire.BytesType {
			entryRaw, consumed := protowire.ConsumeBytes(raw)
			if consumed < 0 {
				return fmt.Errorf("invalid map entry")
			}
			raw = raw[consumed:]
			if pinnedClosedEnum(field.MapValue()) {
				entry := dynamicpb.NewMessage(field.Message())
				normalizedEntry, err := normalizePinnedClosedEnumWire(field.Message(), entryRaw)
				if err != nil {
					return err
				}
				if err := (proto.UnmarshalOptions{DiscardUnknown: false, Resolver: types}).Unmarshal(normalizedEntry, entry); err != nil {
					return err
				}
				keyField, valueField := field.Message().Fields().ByNumber(1), field.Message().Fields().ByNumber(2)
				var enumRaw uint64
				found := false
				for cursor := entryRaw; len(cursor) > 0; {
					n, wt, tb := protowire.ConsumeTag(cursor)
					if tb < 0 {
						return fmt.Errorf("invalid map entry tag")
					}
					cursor = cursor[tb:]
					if n == 2 && wt == protowire.VarintType {
						value, size := consumePinnedClosedEnumVarint(cursor)
						if size < 0 {
							return fmt.Errorf("invalid map enum")
						}
						enumRaw, found, cursor = value, true, cursor[size:]
						continue
					}
					size := consumePinnedFieldValue(n, wt, cursor)
					if size < 0 {
						return fmt.Errorf("invalid map field")
					}
					cursor = cursor[size:]
				}
				if !found {
					enumRaw = uint64(valueField.Default().Enum())
				}
				if enumNumber, known := pinnedKnownEnum(valueField, enumRaw); known {
					message.Mutable(field).Map().Set(entry.Get(keyField).MapKey(), protoreflect.ValueOfEnum(enumNumber))
				} else {
					// C++ retains the resolved map entry, not duplicate input
					// assignments or an overlong spelling of its key/value.
					resolved := dynamicpb.NewMessage(field.Message())
					resolved.Set(keyField, entry.Get(keyField))
					resolved.Set(valueField, protoreflect.ValueOfEnum(protoreflect.EnumNumber(int32(enumRaw))))
					resolvedBytes, err := (proto.MarshalOptions{Deterministic: true}).Marshal(resolved)
					if err != nil {
						return err
					}
					unknown := protowire.AppendTag(nil, number, wireType)
					unknown = protowire.AppendBytes(unknown, resolvedBytes)
					message.SetUnknown(append(message.GetUnknown(), unknown...))
				}
				continue
			}
			nested[number] = append(nested[number], entryRaw)
			continue
		}
		if pinnedClosedEnum(field) {
			values := []uint64{}
			switch {
			case wireType == protowire.VarintType:
				value, consumed := consumePinnedClosedEnumVarint(raw)
				if consumed < 0 {
					return fmt.Errorf("invalid enum")
				}
				raw, values = raw[consumed:], append(values, value)
			case wireType == protowire.BytesType && field.IsList():
				packed, consumed := protowire.ConsumeBytes(raw)
				if consumed < 0 {
					return fmt.Errorf("invalid packed enum")
				}
				raw = raw[consumed:]
				for len(packed) > 0 {
					value, size := consumePinnedClosedEnumVarint(packed)
					if size < 0 {
						return fmt.Errorf("invalid packed enum value")
					}
					packed, values = packed[size:], append(values, value)
				}
			default:
				consumed := consumePinnedFieldValue(number, wireType, raw)
				if consumed < 0 {
					return fmt.Errorf("invalid enum field")
				}
				raw = raw[consumed:]
				continue
			}
			for _, value := range values {
				if enumNumber, known := pinnedKnownEnum(field, value); known {
					if field.IsList() {
						message.Mutable(field).List().Append(protoreflect.ValueOfEnum(enumNumber))
					} else {
						message.Set(field, protoreflect.ValueOfEnum(enumNumber))
					}
				} else {
					unknown := protowire.AppendTag(nil, number, protowire.VarintType)
					unknown = protowire.AppendVarint(unknown, value)
					message.SetUnknown(append(message.GetUnknown(), unknown...))
				}
			}
			continue
		}
		if wireType == protowire.BytesType && field.Kind() == protoreflect.MessageKind {
			value, consumed := protowire.ConsumeBytes(raw)
			if consumed < 0 {
				return fmt.Errorf("invalid nested message")
			}
			raw = raw[consumed:]
			nested[number] = append(nested[number], value)
			continue
		}
		consumed := consumePinnedFieldValue(number, wireType, raw)
		if consumed < 0 {
			return fmt.Errorf("invalid Protobuf field")
		}
		raw = raw[consumed:]
	}
	for number, occurrences := range nested {
		field := fields.ByNumber(number)
		if field == nil || field.Kind() != protoreflect.MessageKind || field.IsMap() {
			continue
		}
		if field.IsList() {
			list := message.Get(field).List()
			for index, occurrence := range occurrences {
				if index < list.Len() {
					if err := applyPinnedClosedEnumSemantics(list.Get(index).Message(), occurrence, types); err != nil {
						return err
					}
				}
			}
		} else if message.Has(field) {
			joined := bytes.Join(occurrences, nil)
			if err := applyPinnedClosedEnumSemantics(message.Get(field).Message(), joined, types); err != nil {
				return err
			}
		}
	}
	if message.Descriptor().FullName() == "google.protobuf.Any" {
		urlField, valueField := fields.ByNumber(1), fields.ByNumber(2)
		if message.Has(urlField) && message.Has(valueField) {
			url, payload := message.Get(urlField).String(), message.Get(valueField).Bytes()
			if embedded, err := types.FindMessageByURL(url); err == nil {
				decoded := dynamicpb.NewMessage(embedded.Descriptor())
				if err := (proto.UnmarshalOptions{DiscardUnknown: false, Resolver: types}).Unmarshal(payload, decoded); err != nil {
					return err
				}
				if err := applyPinnedClosedEnumSemantics(decoded.ProtoReflect(), payload, types); err != nil {
					return err
				}
				encoded, err := proto.Marshal(decoded)
				if err != nil {
					return err
				}
				message.Set(valueField, protoreflect.ValueOfBytes(encoded))
			}
		}
	}
	return nil
}

func validatePinnedDecodedStrings(message protoreflect.Message, types *protoregistry.Types) error {
	var validationError error
	message.Range(func(field protoreflect.FieldDescriptor, value protoreflect.Value) bool {
		validate := func(descriptor protoreflect.FieldDescriptor, item protoreflect.Value) bool {
			switch descriptor.Kind() {
			case protoreflect.StringKind:
				if !utf8.ValidString(item.String()) {
					validationError = fmt.Errorf("invalid UTF-8 in surviving Protobuf string %s", descriptor.FullName())
					return false
				}
			case protoreflect.MessageKind, protoreflect.GroupKind:
				if err := validatePinnedDecodedStrings(item.Message(), types); err != nil {
					validationError = err
					return false
				}
			}
			return true
		}
		switch {
		case field.IsList():
			list := value.List()
			for index := 0; index < list.Len(); index++ {
				if !validate(field, list.Get(index)) {
					return false
				}
			}
		case field.IsMap():
			value.Map().Range(func(key protoreflect.MapKey, item protoreflect.Value) bool {
				if field.MapKey().Kind() == protoreflect.StringKind && !utf8.ValidString(key.String()) {
					validationError = fmt.Errorf("invalid UTF-8 in surviving Protobuf map key %s", field.FullName())
					return false
				}
				return validate(field.MapValue(), item)
			})
		default:
			if !validate(field, value) {
				return false
			}
		}
		return validationError == nil
	})
	if validationError != nil {
		return validationError
	}
	if message.Descriptor().FullName() == "google.protobuf.Any" {
		urlField, valueField := message.Descriptor().Fields().ByNumber(1), message.Descriptor().Fields().ByNumber(2)
		if message.Has(urlField) && message.Has(valueField) {
			url, payload := message.Get(urlField).String(), message.Get(valueField).Bytes()
			if embedded, err := types.FindMessageByURL(url); err == nil {
				decoded := dynamicpb.NewMessage(embedded.Descriptor())
				if err := (proto.UnmarshalOptions{DiscardUnknown: false, Resolver: types}).Unmarshal(payload, decoded); err != nil {
					return err
				}
				return validatePinnedDecodedStrings(decoded.ProtoReflect(), types)
			}
		}
	}
	return nil
}

type valueCase struct {
	ID            string   `json:"id"`
	Kind          string   `json:"kind"`
	Type          string   `json:"type"`
	ValueJSON     string   `json:"valueJson"`
	LeftBase64    string   `json:"leftBase64"`
	RightBase64   string   `json:"rightBase64"`
	DataBase64    string   `json:"dataBase64"`
	Direction     string   `json:"direction"`
	Accepted      bool     `json:"accepted"`
	CanonicalJSON string   `json:"canonicalJson"`
	RequiredFacts []string `json:"requiredFacts"`
}
type valueCorpus struct {
	Format         string      `json:"format"`
	Source         string      `json:"source"`
	EditionSources []string    `json:"editionSources"`
	Cases          []valueCase `json:"cases"`
}
type caseResult struct {
	ID            string   `json:"id"`
	Accepted      bool     `json:"accepted"`
	CanonicalJSON string   `json:"canonicalJson,omitempty"`
	Facts         []string `json:"facts,omitempty"`
}

func protobufLowerCamel(value string) string {
	parts := strings.Split(value, "_")
	for index := 1; index < len(parts); index++ {
		if parts[index] != "" {
			parts[index] = strings.ToUpper(parts[index][:1]) + parts[index][1:]
		}
	}
	return strings.Join(parts, "")
}

func protobufWrapperDefault(name protoreflect.FullName) (any, bool) {
	switch name {
	case "google.protobuf.DoubleValue", "google.protobuf.FloatValue":
		return float64(0), true
	case "google.protobuf.Int64Value", "google.protobuf.UInt64Value":
		return "0", true
	case "google.protobuf.Int32Value", "google.protobuf.UInt32Value":
		return json.Number("0"), true
	case "google.protobuf.BoolValue":
		return false, true
	case "google.protobuf.StringValue", "google.protobuf.BytesValue":
		return "", true
	default:
		return nil, false
	}
}

func normalizePinnedProtoJSONField(field protoreflect.FieldDescriptor, value any, types *protoregistry.Types) (any, error) {
	if value == nil {
		return value, nil
	}
	if field.Kind() == protoreflect.EnumKind {
		normalize := func(item any) (any, error) {
			if text, ok := item.(string); ok {
				if field.Enum().Values().ByName(protoreflect.Name(text)) == nil {
					return nil, fmt.Errorf("unknown or quoted-numeric enum caller value %q", text)
				}
			}
			return item, nil
		}
		if field.IsList() {
			if items, ok := value.([]any); ok {
				out := make([]any, len(items))
				for index, item := range items {
					converted, err := normalize(item)
					if err != nil {
						return nil, err
					}
					out[index] = converted
				}
				return out, nil
			}
		}
		return normalize(value)
	}
	if field.Kind() == protoreflect.BytesKind && !field.IsMap() {
		normalize := func(item any) (any, error) {
			text, ok := item.(string)
			if !ok {
				return item, nil
			}
			return pinnedProtoJSONBase64(text)
		}
		if field.IsList() {
			items, ok := value.([]any)
			if !ok {
				return value, nil
			}
			out := make([]any, len(items))
			for index, item := range items {
				converted, err := normalize(item)
				if err != nil {
					return nil, err
				}
				out[index] = converted
			}
			return out, nil
		}
		return normalize(value)
	}
	if field.IsMap() {
		entries, ok := orderedObjectEntries(value)
		if !ok {
			return value, nil
		}
		out := map[string]any{}
		for _, entry := range entries {
			rawKey, item := entry.Key, entry.Value
			if item == nil && field.MapValue().Kind() == protoreflect.MessageKind {
				if _, wrapper := protobufWrapperDefault(field.MapValue().Message().FullName()); wrapper {
					return nil, fmt.Errorf("null wrapper map value")
				}
			}
			key, err := normalizePinnedProtoJSONMapKey(field.MapKey().Kind().String(), rawKey)
			if err != nil {
				return nil, err
			}
			if field.MapValue().Kind() == protoreflect.MessageKind {
				item, err = normalizePinnedProtoJSONInput(field.MapValue().Message(), item, types)
				if err != nil {
					return nil, err
				}
			}
			if field.MapValue().Kind() == protoreflect.BytesKind {
				if text, ok := item.(string); ok {
					item, err = pinnedProtoJSONBase64(text)
					if err != nil {
						return nil, err
					}
				}
			}
			if field.MapValue().Kind() == protoreflect.EnumKind {
				if text, quoted := item.(string); quoted && field.MapValue().Enum().Values().ByName(protoreflect.Name(text)) == nil {
					return nil, fmt.Errorf("unknown or quoted-numeric enum map value %q", text)
				}
			}
			if field.MapValue().Kind() != protoreflect.MessageKind && field.MapValue().Kind() != protoreflect.EnumKind && field.MapValue().Kind() != protoreflect.BytesKind {
				item, err = normalizePortableCallerScalar(field.MapValue().Kind().String(), item)
				if err != nil {
					return nil, err
				}
			}
			out[key] = item
		}
		return out, nil
	}
	if field.Kind() != protoreflect.MessageKind {
		if field.IsList() {
			items, ok := value.([]any)
			if !ok {
				return value, nil
			}
			out := make([]any, len(items))
			for index, item := range items {
				converted, err := normalizePortableCallerScalar(field.Kind().String(), item)
				if err != nil {
					return nil, err
				}
				out[index] = converted
			}
			return out, nil
		}
		return normalizePortableCallerScalar(field.Kind().String(), value)
	}
	normalizeOne := func(item any) (any, error) {
		return normalizePinnedProtoJSONInput(field.Message(), item, types)
	}
	if field.IsList() {
		items, ok := value.([]any)
		if !ok {
			return value, nil
		}
		out := make([]any, len(items))
		for index, item := range items {
			if item == nil {
				if _, wrapper := protobufWrapperDefault(field.Message().FullName()); wrapper {
					return nil, fmt.Errorf("null repeated wrapper")
				}
			}
			converted, err := normalizeOne(item)
			if err != nil {
				return nil, err
			}
			out[index] = converted
		}
		return out, nil
	}
	return normalizeOne(value)
}

func normalizePinnedProtoJSONInput(message protoreflect.MessageDescriptor, value any, types *protoregistry.Types) (any, error) {
	if message.FullName() == "google.protobuf.Duration" {
		return normalizePinnedDuration(value)
	}
	if fallback, wrapper := protobufWrapperDefault(message.FullName()); wrapper && value == nil {
		return fallback, nil
	}
	if message.FullName() == "google.protobuf.Any" {
		object, ok := orderedObjectMap(value)
		if !ok {
			return value, nil
		}
		if len(object) == 0 {
			return object, nil
		}
		rawURL, ok := object["@type"].(string)
		if !ok {
			return value, nil
		}
		if slash := strings.LastIndex(rawURL, "/"); slash <= 0 || slash == len(rawURL)-1 {
			return nil, fmt.Errorf("invalid Any type URL")
		}
		messageType, err := types.FindMessageByURL(rawURL)
		if err != nil {
			return value, nil
		}
		embedded := messageType.Descriptor()
		if anyEnvelopeCollision(embedded) {
			return nil, fmt.Errorf("embedded Any type collides with @type")
		}
		out := map[string]any{}
		for key, item := range object {
			out[key] = item
		}
		if embedded.FullName() == "google.protobuf.Empty" {
			if len(object) != 1 {
				return nil, fmt.Errorf("invalid Empty Any")
			}
			out["value"] = map[string]any{}
			return out, nil
		}
		if fallback, wrapper := protobufWrapperDefault(embedded.FullName()); wrapper {
			if len(object) != 2 {
				return value, nil
			}
			if object["value"] == nil {
				out["value"] = fallback
			}
			return out, nil
		}
		if _, special := map[protoreflect.FullName]bool{
			"google.protobuf.Timestamp": true, "google.protobuf.Duration": true, "google.protobuf.FieldMask": true,
			"google.protobuf.Struct": true, "google.protobuf.Value": true, "google.protobuf.ListValue": true,
		}[embedded.FullName()]; special {
			if embedded.FullName() == "google.protobuf.Duration" {
				converted, err := normalizePinnedDuration(object["value"])
				if err != nil {
					return nil, err
				}
				out["value"] = converted
			}
			return out, nil
		}
		body := map[string]any{}
		for key, item := range object {
			if key != "@type" {
				body[key] = item
			}
		}
		converted, err := normalizePinnedProtoJSONInput(embedded, body, types)
		if err != nil {
			return nil, err
		}
		out = map[string]any{"@type": rawURL}
		for key, item := range converted.(map[string]any) {
			out[key] = item
		}
		return out, nil
	}
	entries, ok := orderedObjectEntries(value)
	if !ok {
		return value, nil
	}
	out := map[string]any{}
	aliases := map[string]protoreflect.FieldDescriptor{}
	for index := 0; index < message.Fields().Len(); index++ {
		field := message.Fields().Get(index)
		for _, spelling := range []string{string(field.Name()), protobufLowerCamel(string(field.Name())), field.JSONName()} {
			if owner, exists := aliases[spelling]; exists && owner.Number() != field.Number() {
				return nil, fmt.Errorf("ambiguous field spelling %s", spelling)
			}
			aliases[spelling] = field
		}
	}
	for _, entry := range entries {
		key, item := entry.Key, entry.Value
		field := aliases[key]
		if field == nil {
			out[key] = item
			continue
		}
		converted, err := normalizePinnedProtoJSONField(field, item, types)
		if err != nil {
			return nil, err
		}
		out[key] = converted
	}
	return out, nil
}

func customizePinnedProtoJSONOutput(message protoreflect.MessageDescriptor, value any, types *protoregistry.Types) (any, error) {
	object, ok := value.(map[string]any)
	if !ok {
		return value, nil
	}
	if message.FullName() == "google.protobuf.Any" {
		if len(object) == 0 {
			return value, nil
		}
		rawURL, ok := object["@type"].(string)
		if !ok {
			return value, nil
		}
		if slash := strings.LastIndex(rawURL, "/"); slash <= 0 || slash == len(rawURL)-1 {
			return nil, fmt.Errorf("invalid Any output URL")
		}
		messageType, err := types.FindMessageByURL(rawURL)
		if err != nil {
			return value, nil
		}
		if anyEnvelopeCollision(messageType.Descriptor()) {
			return nil, fmt.Errorf("embedded Any output type collides with @type")
		}
		if messageType.Descriptor().FullName() == "google.protobuf.Empty" {
			return map[string]any{"@type": rawURL}, nil
		}
		return value, nil
	}
	if semantic := message.FullName(); strings.HasPrefix(string(semantic), "google.protobuf.") {
		return value, nil
	}
	out := map[string]any{}
	for key, item := range object {
		field := message.Fields().ByJSONName(key)
		if field == nil || field.Kind() != protoreflect.MessageKind {
			out[key] = item
			continue
		}
		if field.IsList() {
			items, ok := item.([]any)
			if !ok {
				out[key] = item
				continue
			}
			converted := make([]any, len(items))
			for index, entry := range items {
				value, err := customizePinnedProtoJSONOutput(field.Message(), entry, types)
				if err != nil {
					return nil, err
				}
				converted[index] = value
			}
			out[key] = converted
			continue
		}
		if field.IsMap() && field.MapValue().Kind() == protoreflect.MessageKind {
			entries, ok := item.(map[string]any)
			if !ok {
				out[key] = item
				continue
			}
			converted := map[string]any{}
			for mapKey, entry := range entries {
				value, err := customizePinnedProtoJSONOutput(field.MapValue().Message(), entry, types)
				if err != nil {
					return nil, err
				}
				converted[mapKey] = value
			}
			out[key] = converted
			continue
		}
		converted, err := customizePinnedProtoJSONOutput(field.Message(), item, types)
		if err != nil {
			return nil, err
		}
		out[key] = converted
	}
	return out, nil
}

func anyEnvelopeCollision(message protoreflect.MessageDescriptor) bool {
	fields := message.Fields()
	for index := 0; index < fields.Len(); index++ {
		field := fields.Get(index)
		if field.Name() == "@type" || field.JSONName() == "@type" {
			return true
		}
	}
	return false
}

type editionEnum struct {
	values     map[int32]any
	inputNames map[string]int32
	closed     bool
}

type editionField struct {
	name     string
	number   protowire.Number
	jsonName string
	enum     editionEnum
	repeated bool
	packed   bool
	mapEnum  bool
}

type editionMessage struct {
	fields map[protowire.Number]editionField
}

func protobufFail(format string, values ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", values...)
	os.Exit(1)
}
func canonicalJSON(data []byte) string {
	var value any
	if err := json.Unmarshal(data, &value); err != nil {
		protobufFail("canonical JSON: %v", err)
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		protobufFail("canonical JSON marshal: %v", err)
	}
	return string(encoded)
}
func registerMessages(messages protoreflect.MessageDescriptors, types *protoregistry.Types) {
	for index := 0; index < messages.Len(); index++ {
		descriptor := messages.Get(index)
		_ = types.RegisterMessage(dynamicpb.NewMessageType(descriptor))
		registerMessages(descriptor.Messages(), types)
		for extensionIndex := 0; extensionIndex < descriptor.Extensions().Len(); extensionIndex++ {
			_ = types.RegisterExtension(dynamicpb.NewExtensionType(descriptor.Extensions().Get(extensionIndex)))
		}
	}
}
func makeRegistry(files *protoregistry.Files) *protoregistry.Types {
	types := new(protoregistry.Types)
	files.RangeFiles(func(file protoreflect.FileDescriptor) bool {
		registerMessages(file.Messages(), types)
		for index := 0; index < file.Enums().Len(); index++ {
			_ = types.RegisterEnum(dynamicpb.NewEnumType(file.Enums().Get(index)))
		}
		for index := 0; index < file.Extensions().Len(); index++ {
			_ = types.RegisterExtension(dynamicpb.NewExtensionType(file.Extensions().Get(index)))
		}
		return true
	})
	return types
}

func customEnumJSON(options *descriptorpb.EnumValueOptions) string {
	raw := options.ProtoReflect().GetUnknown()
	for len(raw) > 0 {
		number, wireType, tagBytes := protowire.ConsumeTag(raw)
		if tagBytes < 0 {
			return ""
		}
		raw = raw[tagBytes:]
		if number == 998 && wireType == protowire.BytesType {
			value, valueBytes := protowire.ConsumeBytes(raw)
			if valueBytes < 0 {
				return ""
			}
			for len(value) > 0 {
				field, fieldType, fieldTagBytes := protowire.ConsumeTag(value)
				if fieldTagBytes < 0 {
					return ""
				}
				value = value[fieldTagBytes:]
				if field == 1 && fieldType == protowire.BytesType {
					text, textBytes := protowire.ConsumeString(value)
					if textBytes >= 0 {
						return text
					}
				}
				consumed := protowire.ConsumeFieldValue(field, fieldType, value)
				if consumed < 0 {
					return ""
				}
				value = value[consumed:]
			}
		}
		consumed := protowire.ConsumeFieldValue(number, wireType, raw)
		if consumed < 0 {
			return ""
		}
		raw = raw[consumed:]
	}
	return ""
}

func loadEditionMessages(fixtureRoot, protocRoot string, sources []string) map[string]editionMessage {
	result := map[string]editionMessage{}
	for _, source := range sources {
		temp, err := os.MkdirTemp("", "openbindings-protobuf-edition-")
		if err != nil {
			protobufFail("edition temp: %v", err)
		}
		descriptorPath := filepath.Join(temp, "descriptor.pb")
		command := exec.Command(filepath.Join(protocRoot, "bin", "protoc"), "--proto_path="+fixtureRoot, "--proto_path="+filepath.Join(protocRoot, "include"), "--include_imports", "--descriptor_set_out="+descriptorPath, filepath.Join(fixtureRoot, source))
		output, commandErr := command.CombinedOutput()
		if commandErr != nil {
			os.RemoveAll(temp)
			protobufFail("edition protoc: %v\n%s", commandErr, output)
		}
		bytes, readErr := os.ReadFile(descriptorPath)
		os.RemoveAll(temp)
		if readErr != nil {
			protobufFail("edition descriptor: %v", readErr)
		}
		set := new(descriptorpb.FileDescriptorSet)
		if err := proto.Unmarshal(bytes, set); err != nil {
			protobufFail("edition descriptor decode: %v", err)
		}
		for _, file := range set.File {
			if file.GetName() != source {
				continue
			}
			enums := map[string]editionEnum{}
			fileClosed := file.GetOptions().GetFeatures().GetEnumType() == descriptorpb.FeatureSet_CLOSED
			for _, enumeration := range file.EnumType {
				values := map[int32]any{}
				inputNames := map[string]int32{}
				for _, value := range enumeration.Value {
					jsonValue := any(value.GetName())
					if custom := customEnumJSON(value.GetOptions()); custom != "" {
						jsonValue = custom
					}
					values[value.GetNumber()] = jsonValue
					inputNames[value.GetName()] = value.GetNumber()
					inputNames[jsonValue.(string)] = value.GetNumber()
				}
				closed := fileClosed || enumeration.GetOptions().GetFeatures().GetEnumType() == descriptorpb.FeatureSet_CLOSED
				enums["."+file.GetPackage()+"."+enumeration.GetName()] = editionEnum{values: values, inputNames: inputNames, closed: closed}
			}
			for _, message := range file.MessageType {
				nested := map[string]*descriptorpb.DescriptorProto{}
				for _, candidate := range message.NestedType {
					nested["."+file.GetPackage()+"."+message.GetName()+"."+candidate.GetName()] = candidate
				}
				fields := map[protowire.Number]editionField{}
				for _, field := range message.Field {
					enumeration, ok := enums[field.GetTypeName()]
					mapEnum := false
					if !ok && field.GetType() == descriptorpb.FieldDescriptorProto_TYPE_MESSAGE {
						entry := nested[field.GetTypeName()]
						if entry != nil && entry.GetOptions().GetMapEntry() && len(entry.Field) == 2 && entry.Field[0].GetType() == descriptorpb.FieldDescriptorProto_TYPE_STRING {
							enumeration, ok = enums[entry.Field[1].GetTypeName()]
							mapEnum = ok
						}
					}
					if !ok {
						continue
					}
					fields[protowire.Number(field.GetNumber())] = editionField{name: field.GetName(), number: protowire.Number(field.GetNumber()), jsonName: field.GetJsonName(), enum: enumeration, repeated: field.GetLabel() == descriptorpb.FieldDescriptorProto_LABEL_REPEATED && !mapEnum, packed: field.GetOptions().GetPacked(), mapEnum: mapEnum}
				}
				result[file.GetPackage()+"."+message.GetName()] = editionMessage{fields: fields}
			}
		}
	}
	return result
}

func decodeEditionMessage(message editionMessage, encoded string) (string, []byte, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", nil, err
	}
	value := map[string]any{}
	var unknown []byte
	for len(data) > 0 {
		number, wireType, tagBytes := protowire.ConsumeTag(data)
		if tagBytes < 0 {
			return "", nil, fmt.Errorf("invalid tag")
		}
		data = data[tagBytes:]
		field, known := message.fields[number]
		if known {
			if field.mapEnum {
				if wireType != protowire.BytesType {
					consumed := consumePinnedFieldValue(number, wireType, data)
					if consumed < 0 {
						return "", nil, fmt.Errorf("invalid Edition enum map field")
					}
					data = data[consumed:]
					continue
				}
				entry, consumed := protowire.ConsumeBytes(data)
				if consumed < 0 {
					return "", nil, fmt.Errorf("invalid Edition enum map entry")
				}
				data = data[consumed:]
				key := ""
				var enumRaw uint64
				enumPresent := false
				for len(entry) > 0 {
					entryNumber, entryWire, entryTag := protowire.ConsumeTag(entry)
					if entryTag < 0 {
						return "", nil, fmt.Errorf("invalid Edition enum map entry tag")
					}
					entry = entry[entryTag:]
					switch {
					case entryNumber == 1 && entryWire == protowire.BytesType:
						text, size := protowire.ConsumeString(entry)
						if size < 0 || !utf8.ValidString(text) {
							return "", nil, fmt.Errorf("invalid Edition enum map key")
						}
						key, entry = text, entry[size:]
					case entryNumber == 2 && entryWire == protowire.VarintType:
						raw, size := consumePinnedValueVarint(entry)
						if size < 0 {
							return "", nil, fmt.Errorf("invalid Edition enum map value")
						}
						enumRaw, enumPresent, entry = raw, true, entry[size:]
					default:
						size := consumePinnedFieldValue(entryNumber, entryWire, entry)
						if size < 0 {
							return "", nil, fmt.Errorf("invalid Edition enum map entry field")
						}
						entry = entry[size:]
					}
				}
				if !enumPresent {
					enumRaw = 0
				}
				mapped, admitted := field.enum.values[int32(enumRaw)]
				if admitted || !field.enum.closed {
					if !admitted {
						mapped = int32(enumRaw)
					}
					entries, _ := value[field.jsonName].(map[string]any)
					if entries == nil {
						entries = map[string]any{}
					}
					entries[key] = mapped
					value[field.jsonName] = entries
				} else {
					var normalizedEntry []byte
					// protoc materializes the resolved default map key in the
					// unknown entry even when field 1 was absent on the wire.
					normalizedEntry = protowire.AppendTag(normalizedEntry, 1, protowire.BytesType)
					normalizedEntry = protowire.AppendString(normalizedEntry, key)
					normalizedEntry = protowire.AppendTag(normalizedEntry, 2, protowire.VarintType)
					normalizedEntry = protowire.AppendVarint(normalizedEntry, uint64(int64(int32(enumRaw))))
					unknown = protowire.AppendTag(unknown, number, protowire.BytesType)
					unknown = protowire.AppendBytes(unknown, normalizedEntry)
				}
				continue
			}
			values := []any{}
			consume := func(raw uint64) {
				mapped, ok := field.enum.values[int32(raw)]
				if !ok {
					if field.enum.closed {
						unknown = protowire.AppendTag(unknown, number, protowire.VarintType)
						unknown = protowire.AppendVarint(unknown, uint64(int64(int32(raw))))
						return
					}
					mapped = int32(raw)
				}
				values = append(values, mapped)
			}
			if wireType == protowire.VarintType {
				raw, valueBytes := consumePinnedValueVarint(data)
				if valueBytes < 0 {
					return "", nil, fmt.Errorf("invalid enum value")
				}
				data = data[valueBytes:]
				consume(raw)
			} else if wireType == protowire.BytesType && field.repeated {
				packed, valueBytes := protowire.ConsumeBytes(data)
				if valueBytes < 0 {
					return "", nil, fmt.Errorf("invalid packed enum")
				}
				data = data[valueBytes:]
				for len(packed) > 0 {
					raw, size := consumePinnedValueVarint(packed)
					if size < 0 {
						return "", nil, fmt.Errorf("invalid packed enum value")
					}
					packed = packed[size:]
					consume(raw)
				}
			} else {
				consumed := consumePinnedFieldValue(number, wireType, data)
				if consumed < 0 {
					return "", nil, fmt.Errorf("wrong enum wire type")
				}
				data = data[consumed:]
				continue
			}
			if field.repeated && len(values) > 0 {
				existing, _ := value[field.jsonName].([]any)
				value[field.jsonName] = append(existing, values...)
			} else if len(values) > 0 && values[len(values)-1] != int32(0) {
				value[field.jsonName] = values[len(values)-1]
			}
			continue
		}
		consumed := consumePinnedFieldValue(number, wireType, data)
		if consumed < 0 {
			return "", nil, fmt.Errorf("invalid unknown field")
		}
		data = data[consumed:]
	}
	encodedJSON, err := json.Marshal(value)
	if err != nil {
		return "", nil, err
	}
	return canonicalJSON(encodedJSON), unknown, nil
}

func editionJSONInteger(value any) (int32, error) {
	number, ok := value.(json.Number)
	if !ok {
		return 0, fmt.Errorf("Edition enum input is neither a name nor an exact-integral JSON number")
	}
	text := number.String()
	integerPart, fraction, exponent := text, "", 0
	if marker := strings.IndexAny(integerPart, "eE"); marker >= 0 {
		parsed, err := strconv.Atoi(integerPart[marker+1:])
		if err != nil || parsed < -1000 || parsed > 1000 {
			return 0, fmt.Errorf("Edition enum input exponent")
		}
		exponent, integerPart = parsed, integerPart[:marker]
	}
	if point := strings.IndexByte(integerPart, '.'); point >= 0 {
		fraction, integerPart = integerPart[point+1:], integerPart[:point]
	}
	negative := strings.HasPrefix(integerPart, "-")
	digits := strings.TrimPrefix(integerPart, "-") + fraction
	shift := exponent - len(fraction)
	if shift < 0 {
		cut := len(digits) + shift
		if cut <= 0 {
			if strings.Trim(digits, "0") != "" {
				return 0, fmt.Errorf("nonintegral Edition enum input")
			}
			digits = "0"
		} else {
			if strings.Trim(digits[cut:], "0") != "" {
				return 0, fmt.Errorf("nonintegral Edition enum input")
			}
			digits = digits[:cut]
		}
	} else {
		digits += strings.Repeat("0", shift)
	}
	if negative {
		digits = "-" + digits
	}
	integer, ok := new(big.Int).SetString(digits, 10)
	if !ok || !integer.IsInt64() || integer.Int64() < -2147483648 || integer.Int64() > 2147483647 {
		return 0, fmt.Errorf("Edition enum input out of int32 range")
	}
	return int32(integer.Int64()), nil
}

func parseEditionMessage(message editionMessage, encoded string) (string, error) {
	parsed, err := parseStrictLosslessJSON([]byte(encoded))
	if err != nil {
		return "", fmt.Errorf("Edition input JSON: %w", err)
	}
	entries, ok := orderedObjectEntries(parsed)
	if !ok {
		return "", fmt.Errorf("Edition input is not an object")
	}
	fieldsByName := map[string]editionField{}
	for _, field := range message.fields {
		fieldsByName[field.name] = field
		fieldsByName[field.jsonName] = field
	}
	seenFields := map[protowire.Number]bool{}
	var wire []byte
	for _, entry := range entries {
		field, ok := fieldsByName[entry.Key]
		if !ok {
			return "", fmt.Errorf("unknown Edition field")
		}
		if seenFields[field.number] {
			return "", fmt.Errorf("duplicate Edition field assignment")
		}
		seenFields[field.number] = true
		if entry.Value == nil {
			continue
		}
		if field.mapEnum {
			mapEntries, ok := orderedObjectEntries(entry.Value)
			if !ok {
				return "", fmt.Errorf("Edition enum map input is not an object")
			}
			for _, mapEntry := range mapEntries {
				var number int32
				if text, named := mapEntry.Value.(string); named {
					resolved, exists := field.enum.inputNames[text]
					if !exists {
						return "", fmt.Errorf("unknown or quoted-numeric Edition enum map input")
					}
					number = resolved
				} else {
					resolved, err := editionJSONInteger(mapEntry.Value)
					if err != nil {
						return "", err
					}
					number = resolved
				}
				var encodedEntry []byte
				if mapEntry.Key != "" {
					encodedEntry = protowire.AppendTag(encodedEntry, 1, protowire.BytesType)
					encodedEntry = protowire.AppendString(encodedEntry, mapEntry.Key)
				}
				encodedEntry = protowire.AppendTag(encodedEntry, 2, protowire.VarintType)
				encodedEntry = protowire.AppendVarint(encodedEntry, uint64(int64(number)))
				wire = protowire.AppendTag(wire, field.number, protowire.BytesType)
				wire = protowire.AppendBytes(wire, encodedEntry)
			}
			continue
		}
		items := []any{entry.Value}
		if field.repeated {
			items, ok = entry.Value.([]any)
			if !ok {
				return "", fmt.Errorf("Edition repeated enum input is not an array")
			}
		}
		values := make([]uint64, 0, len(items))
		for _, item := range items {
			var number int32
			if text, named := item.(string); named {
				resolved, exists := field.enum.inputNames[text]
				if !exists {
					return "", fmt.Errorf("unknown or quoted-numeric Edition enum input")
				}
				number = resolved
			} else {
				resolved, err := editionJSONInteger(item)
				if err != nil {
					return "", err
				}
				number = resolved
			}
			values = append(values, uint64(int64(number)))
		}
		if field.repeated && field.packed {
			var packed []byte
			for _, value := range values {
				packed = protowire.AppendVarint(packed, value)
			}
			wire = protowire.AppendTag(wire, field.number, protowire.BytesType)
			wire = protowire.AppendBytes(wire, packed)
			continue
		}
		for _, value := range values {
			wire = protowire.AppendTag(wire, field.number, protowire.VarintType)
			wire = protowire.AppendVarint(wire, value)
		}
	}
	canonical, _, err := decodeEditionMessage(message, base64.StdEncoding.EncodeToString(wire))
	return canonical, err
}
func schemaFacts(message protoreflect.MessageDescriptor, direction string) []string {
	facts := map[string]bool{"closed-object": true}
	for index := 0; index < message.Fields().Len(); index++ {
		field := message.Fields().Get(index)
		if string(field.Name()) != field.JSONName() {
			if direction == "input" {
				facts["original-and-json-name"] = true
			} else {
				facts["json-name-only"] = true
			}
		}
		if field.ContainingOneof() != nil {
			facts["oneof-exclusive"] = true
		}
		if field.Kind() == protoreflect.Int64Kind || field.Kind() == protoreflect.Sint64Kind || field.Kind() == protoreflect.Sfixed64Kind || field.Kind() == protoreflect.Uint64Kind || field.Kind() == protoreflect.Fixed64Kind {
			facts["int64-string"] = true
		}
		if field.Kind() == protoreflect.EnumKind {
			if direction == "input" {
				facts["open-enum-string-or-number"] = true
			} else {
				facts["open-enum-known-string-or-number"] = true
			}
		}
		if field.Kind() == protoreflect.MessageKind && field.Message().FullName() == message.FullName() {
			facts["recursive-ref"] = true
		}
		if field.Kind() == protoreflect.MessageKind && field.Message().FullName() == "google.protobuf.Any" {
			facts["any-closed-union"] = true
		}
	}
	out := make([]string, 0, len(facts))
	for fact := range facts {
		out = append(out, fact)
	}
	sort.Strings(out)
	return out
}
func main() {
	if len(os.Args) != 3 {
		protobufFail("usage: go run protobuf.go <value-cases.json> <protoc-root>")
	}
	corpusBytes, err := os.ReadFile(os.Args[1])
	if err != nil {
		protobufFail("corpus: %v", err)
	}
	if _, err := parseStrictLosslessJSON(corpusBytes); err != nil {
		protobufFail("corpus JSON: %v", err)
	}
	var corpus valueCorpus
	if err := json.Unmarshal(corpusBytes, &corpus); err != nil {
		protobufFail("corpus JSON: %v", err)
	}
	if corpus.Format != "openbindings.protobuf-value-cases@1" {
		protobufFail("wrong corpus format")
	}
	fixtureRoot := filepath.Dir(os.Args[1])
	temp, err := os.MkdirTemp("", "openbindings-protobuf-values-")
	if err != nil {
		protobufFail("temp: %v", err)
	}
	defer os.RemoveAll(temp)
	descriptorPath := filepath.Join(temp, "descriptor.pb")
	protocRoot := os.Args[2]
	command := exec.Command(filepath.Join(protocRoot, "bin", "protoc"), "--proto_path="+fixtureRoot, "--proto_path="+filepath.Join(protocRoot, "include"), "--include_imports", "--descriptor_set_out="+descriptorPath, filepath.Join(fixtureRoot, corpus.Source))
	if output, err := command.CombinedOutput(); err != nil {
		protobufFail("protoc: %v\n%s", err, output)
	}
	descriptorBytes, err := os.ReadFile(descriptorPath)
	if err != nil {
		protobufFail("descriptor: %v", err)
	}
	set := new(descriptorpb.FileDescriptorSet)
	if err := proto.Unmarshal(descriptorBytes, set); err != nil {
		protobufFail("descriptor decode: %v", err)
	}
	files, err := protodesc.NewFiles(set)
	if err != nil {
		protobufFail("descriptor pool: %v", err)
	}
	types := makeRegistry(files)
	editionMessages := loadEditionMessages(fixtureRoot, protocRoot, corpus.EditionSources)
	results := make([]caseResult, 0, len(corpus.Cases))
	seen := map[string]bool{}
	for _, test := range corpus.Cases {
		if seen[test.ID] {
			protobufFail("duplicate id %s", test.ID)
		}
		seen[test.ID] = true
		result := caseResult{ID: test.ID}
		if editionMessage, ok := editionMessages[test.Type]; ok {
			switch test.Kind {
			case "binary":
				result.CanonicalJSON, _, err = decodeEditionMessage(editionMessage, test.DataBase64)
			case "binary-equivalent":
				var leftUnknown, rightUnknown []byte
				var rightJSON string
				result.CanonicalJSON, leftUnknown, err = decodeEditionMessage(editionMessage, test.LeftBase64)
				if err == nil {
					rightJSON, rightUnknown, err = decodeEditionMessage(editionMessage, test.RightBase64)
				}
				if err == nil && (result.CanonicalJSON != rightJSON || !bytes.Equal(leftUnknown, rightUnknown)) {
					err = fmt.Errorf("Edition binary semantic values differ")
				}
			case "input":
				result.CanonicalJSON, err = parseEditionMessage(editionMessage, test.ValueJSON)
			default:
				protobufFail("%s unsupported Edition witness kind %s", test.ID, test.Kind)
			}
			result.Accepted = err == nil
			if !result.Accepted {
				result.CanonicalJSON = ""
			}
			if result.Accepted != test.Accepted || (test.CanonicalJSON != "" && result.CanonicalJSON != test.CanonicalJSON) {
				protobufFail("%s mismatch: %#v", test.ID, result)
			}
			results = append(results, result)
			continue
		}
		descriptor, err := files.FindDescriptorByName(protoreflect.FullName(test.Type))
		if err != nil {
			protobufFail("%s type: %v", test.ID, err)
		}
		messageDescriptor, ok := descriptor.(protoreflect.MessageDescriptor)
		if !ok {
			protobufFail("%s is not a message", test.ID)
		}
		switch test.Kind {
		case "input":
			message := dynamicpb.NewMessage(messageDescriptor)
			var input any
			var normalizedJSON []byte
			input, err := parseStrictLosslessJSON([]byte(test.ValueJSON))
			if err == nil {
				originalInput := input
				input, err = normalizePinnedProtoJSONInput(messageDescriptor, input, types)
				if err == nil && reflect.DeepEqual(originalInput, input) {
					normalizedJSON = []byte(test.ValueJSON)
				}
			}
			if err == nil && normalizedJSON == nil {
				normalizedJSON, err = json.Marshal(input)
			}
			if err == nil {
				err = (protojson.UnmarshalOptions{DiscardUnknown: false, Resolver: types}).Unmarshal(normalizedJSON, message)
			}
			if err == nil {
				wire, marshalErr := proto.Marshal(message)
				if marshalErr != nil {
					err = marshalErr
				} else {
					decoded := dynamicpb.NewMessage(messageDescriptor)
					err = (proto.UnmarshalOptions{DiscardUnknown: false, Resolver: types}).Unmarshal(wire, decoded)
					if err == nil {
						err = applyPinnedClosedEnumSemantics(decoded.ProtoReflect(), wire, types)
					}
					if err == nil {
						message = decoded
					}
				}
			}
			result.Accepted = err == nil
			if err == nil {
				if outputErr := validatePinnedDecodedStrings(message.ProtoReflect(), types); outputErr != nil {
					protobufFail("%s output validation: %v", test.ID, outputErr)
				}
				encoded, marshalErr := (protojson.MarshalOptions{Resolver: types}).Marshal(message)
				if marshalErr != nil {
					protobufFail("%s marshal: %v", test.ID, marshalErr)
				}
				var output any
				decoder := json.NewDecoder(strings.NewReader(string(encoded)))
				decoder.UseNumber()
				if decoder.Decode(&output) != nil {
					protobufFail("%s invalid Any output URL", test.ID)
				}
				output, marshalErr = customizePinnedProtoJSONOutput(messageDescriptor, output, types)
				if marshalErr != nil {
					protobufFail("%s output customization: %v", test.ID, marshalErr)
				}
				encoded, marshalErr = json.Marshal(output)
				if marshalErr != nil {
					protobufFail("%s output JSON: %v", test.ID, marshalErr)
				}
				result.CanonicalJSON = canonicalJSON(encoded)
			}
		case "binary", "binary-equivalent":
			decode := func(value string) (*dynamicpb.Message, error) {
				bytes, err := base64.StdEncoding.DecodeString(value)
				if err != nil {
					return nil, err
				}
				normalizedWire, err := normalizePinnedClosedEnumWire(messageDescriptor, bytes)
				if err != nil {
					return nil, err
				}
				message := dynamicpb.NewMessage(messageDescriptor)
				if err := (proto.UnmarshalOptions{DiscardUnknown: false, Resolver: types}).Unmarshal(normalizedWire, message); err != nil {
					return nil, err
				}
				if err := applyPinnedClosedEnumSemantics(message.ProtoReflect(), bytes, types); err != nil {
					return nil, err
				}
				if err := validatePinnedDecodedStrings(message.ProtoReflect(), types); err != nil {
					return nil, err
				}
				return message, nil
			}
			leftValue := test.DataBase64
			if test.Kind == "binary-equivalent" {
				leftValue = test.LeftBase64
			}
			left, leftErr := decode(leftValue)
			result.Accepted = leftErr == nil
			if test.Kind == "binary-equivalent" && leftErr == nil {
				right, rightErr := decode(test.RightBase64)
				result.Accepted = rightErr == nil && proto.Equal(left, right)
			}
			if result.Accepted {
				encoded, marshalErr := (protojson.MarshalOptions{Resolver: types}).Marshal(left)
				var output any
				if marshalErr == nil {
					decoder := json.NewDecoder(strings.NewReader(string(encoded)))
					decoder.UseNumber()
					marshalErr = decoder.Decode(&output)
				}
				if marshalErr == nil {
					output, marshalErr = customizePinnedProtoJSONOutput(messageDescriptor, output, types)
				}
				if marshalErr != nil {
					result.Accepted = false
				} else {
					encoded, marshalErr = json.Marshal(output)
					if marshalErr != nil {
						result.Accepted = false
					} else {
						result.CanonicalJSON = canonicalJSON(encoded)
					}
				}
			}
		case "schema":
			result.Accepted = true
			result.Facts = schemaFacts(messageDescriptor, test.Direction)
		default:
			protobufFail("%s unknown kind %s", test.ID, test.Kind)
		}
		if result.Accepted != test.Accepted || (test.CanonicalJSON != "" && result.CanonicalJSON != test.CanonicalJSON) || (len(test.RequiredFacts) > 0 && fmt.Sprint(result.Facts) != fmt.Sprint(test.RequiredFacts)) {
			protobufFail("%s mismatch: %#v", test.ID, result)
		}
		results = append(results, result)
	}
	digest := sha256.Sum256(corpusBytes)
	encoded, _ := json.Marshal(map[string]any{"format": "openbindings.protobuf-value-result@1", "runtime": "go-protobuf", "corpusSha256": hex.EncodeToString(digest[:]), "caseCount": len(results), "results": results})
	fmt.Println(string(encoded))
}
