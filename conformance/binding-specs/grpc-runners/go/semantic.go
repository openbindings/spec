package main

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	reflectionv1 "google.golang.org/grpc/reflection/grpc_reflection_v1"
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
			outerOccurrence := protowire.AppendTag(nil, number, wireType)
			entryRaw, consumed := protowire.ConsumeBytes(raw)
			if consumed < 0 {
				return fmt.Errorf("invalid map entry")
			}
			outerOccurrence = append(outerOccurrence, raw[:consumed]...)
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
					message.SetUnknown(append(message.GetUnknown(), outerOccurrence...))
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

type semanticAction struct {
	Type              string `json:"type"`
	Value             any    `json:"value"`
	Index             int    `json:"index"`
	Name, Nanoseconds string
}
type semanticAfter struct {
	Start  bool   `json:"start"`
	Action *int   `json:"action"`
	Native string `json:"native"`
}
type semanticHeader struct {
	Name   string `json:"name"`
	Values []any  `json:"values"`
}
type semanticPeer struct {
	ID                string                             `json:"id"`
	After             semanticAfter                      `json:"after"`
	Type              string                             `json:"type"`
	Success           bool                               `json:"success"`
	FailureCause      string                             `json:"failureCause"`
	Headers           []semanticHeader                   `json:"headers"`
	DataBase64        string                             `json:"dataBase64"`
	EndStream         bool                               `json:"endStream"`
	CurrentRPC        bool                               `json:"currentRpcAccepted"`
	ErrorCode         uint32                             `json:"errorCode"`
	ReflectionVersion string                             `json:"reflectionVersion"`
	Stream            int                                `json:"stream"`
	ValidHost         string                             `json:"validHost"`
	OriginalRequest   struct{ Kind, Value, Host string } `json:"originalRequest"`
	ElapsedNs         string                             `json:"elapsedNs"`
	RPCStatus         int                                `json:"rpcStatus"`
	MessageBase64     string                             `json:"messageBase64"`
	ResponseKind      string                             `json:"responseKind"`
	Compressed        bool                               `json:"compressed"`
	ServiceList       []string                           `json:"serviceList"`
	ErrorResponse     *struct {
		ErrorCode    int32  `json:"errorCode"`
		ErrorMessage string `json:"errorMessage"`
	} `json:"errorResponse"`
}
type semanticMetadata struct {
	Name   string `json:"name"`
	Values []any  `json:"values"`
}
type semanticMeasurement struct {
	Algorithm    string `json:"algorithm"`
	RequestBytes int    `json:"requestBytes"`
}
type semanticConfiguration struct {
	Transport                                  string             `json:"transport"`
	Metadata                                   []semanticMetadata `json:"metadata"`
	DiscoveryMetadata                          []semanticMetadata `json:"discoveryMetadata"`
	Compression, TimeoutNs, DiscoveryTimeoutNs string
	TLS                                        map[string]any `json:"tls"`
	Limits                                     struct {
		MaxInbound  *int `json:"maxInboundMessageBytes"`
		MaxOutbound *int `json:"maxOutboundMessageBytes"`
		MaxMetadata *int `json:"maxMetadataBytes"`
	} `json:"limits"`
}
type semanticAlternative struct {
	Disposition, Phase string
	Assertions         []map[string]any `json:"assertions"`
	Timeline           []map[string]any `json:"timeline"`
	Native             struct {
		RequestHeaders, RequestMessages, Reflection []map[string]any
		LeadingMetadata, TrailingMetadata           []map[string]any `json:",omitempty"`
		GrpcMessageRaw                              []string         `json:"grpcMessageRaw"`
		StatusDetails                               []map[string]any `json:"statusDetails"`
		Cancellations                               int
		Channel                                     map[string]any
		MetadataMeasurement                         *semanticMeasurement `json:"metadataMeasurement"`
	} `json:"native"`
}
type semanticScenario struct {
	ID    string `json:"id"`
	Given struct {
		Source struct {
			Location string
			Content  json.RawMessage
		} `json:"source"`
		Binding       struct{ Selector string } `json:"binding"`
		Configuration semanticConfiguration     `json:"configuration"`
		Runtime       struct {
			ClockStartNs string `json:"clockStartNs"`
		} `json:"runtime"`
		Invocation struct {
			InputPresent bool             `json:"inputPresent"`
			Input        any              `json:"input"`
			Actions      []semanticAction `json:"actions"`
		} `json:"invocation"`
		Peer struct {
			Events              []semanticPeer       `json:"events"`
			MetadataMeasurement *semanticMeasurement `json:"metadataMeasurement"`
		} `json:"peer"`
	} `json:"given"`
	Expected []semanticAlternative `json:"expected"`
}
type semanticCorpus struct {
	Format    string
	Scenarios []semanticScenario
}
type semanticField struct {
	Kind, Name, JSONName string
	Number               int
}
type semanticMethod struct {
	ClientStreaming, ServerStreaming bool
	Input, Output                    string
}
type semanticModel struct {
	Messages map[string][]semanticField
	Services map[string]map[string]semanticMethod
	Files    *protoregistry.Files
	Types    *protoregistry.Types
}
type semanticTarget struct{ Transport, Authority, Hostname string }

func semanticFail(format string, values ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", values...)
	os.Exit(1)
}
func jsonText(value any) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		semanticFail("JSON: %v", err)
	}
	return string(encoded)
}
func jsonEqual(a, b any) bool { return jsonText(a) == jsonText(b) }
func canonicalEvidenceValue(value any) any {
	switch current := value.(type) {
	case orderedJSONObject:
		out := map[string]any{}
		for _, entry := range current.Entries {
			out[entry.Key] = canonicalEvidenceValue(entry.Value)
		}
		return out
	case []any:
		out := make([]any, len(current))
		for index, entry := range current {
			out[index] = canonicalEvidenceValue(entry)
		}
		return out
	case map[string]any:
		out := map[string]any{}
		for key, entry := range current {
			out[key] = canonicalEvidenceValue(entry)
		}
		return out
	default:
		return value
	}
}
func emptyNative() map[string]any {
	return map[string]any{"requestHeaders": []map[string]any{}, "requestMessages": []map[string]any{}, "reflection": []map[string]any{}, "cancellations": 0}
}
func terminalActual(disposition, phase, cause string, native map[string]any, timeline []map[string]any) map[string]any {
	if native == nil {
		native = emptyNative()
	}
	timeline = append(timeline, map[string]any{"event": "terminal", "disposition": disposition, "cause": cause})
	return map[string]any{"disposition": disposition, "phase": phase, "timeline": timeline, "native": native, "context": map[string]any{}}
}
func canonicalBase64(value string) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(value)
	if err != nil || base64.StdEncoding.EncodeToString(data) != value {
		return nil, fmt.Errorf("noncanonical Base64")
	}
	return data, nil
}
func metadataBase64(value string) ([]byte, error) {
	if strings.ContainsAny(value, "-_") {
		return nil, fmt.Errorf("nonstandard Base64")
	}
	encoding := base64.RawStdEncoding
	if len(value)%4 == 0 {
		encoding = base64.StdEncoding
	}
	data, err := encoding.DecodeString(value)
	if err != nil || encoding.EncodeToString(data) != value {
		return nil, fmt.Errorf("noncanonical metadata Base64")
	}
	return data, nil
}
func lowerCamel(value string) string {
	return regexp.MustCompile(`_([a-z])`).ReplaceAllStringFunc(value, func(part string) string { return strings.ToUpper(part[1:]) })
}
func qualify(pkg, name string) string {
	name = strings.TrimPrefix(name, ".")
	if strings.Contains(name, ".") {
		return name
	}
	if pkg == "" {
		return name
	}
	return pkg + "." + name
}

var semanticProtocRoot = func() string {
	if value := os.Getenv("OPENBINDINGS_PROTOC_36_1_ROOT"); value != "" {
		return value
	}
	return "/private/tmp/protoc-36.1"
}()

var semanticAllowedImports = []string{
	"google/protobuf/any.proto", "google/protobuf/api.proto", "google/protobuf/descriptor.proto",
	"google/protobuf/duration.proto", "google/protobuf/empty.proto", "google/protobuf/field_mask.proto",
	"google/protobuf/json_enumvalue_options.proto", "google/protobuf/json_options.proto",
	"google/protobuf/source_context.proto", "google/protobuf/struct.proto", "google/protobuf/timestamp.proto",
	"google/protobuf/type.proto", "google/protobuf/wrappers.proto",
}

func textModel(source string) (semanticModel, error) {
	temporary, err := os.MkdirTemp("", "openbindings-grpc-semantic-go-")
	if err != nil {
		return semanticModel{}, err
	}
	defer os.RemoveAll(temporary)
	if err := os.WriteFile(filepath.Join(temporary, "source.proto"), []byte(source), 0o600); err != nil {
		return semanticModel{}, err
	}
	for _, name := range semanticAllowedImports {
		destination := filepath.Join(temporary, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(destination), 0o700); err != nil {
			return semanticModel{}, err
		}
		data, err := os.ReadFile(filepath.Join(semanticProtocRoot, "include", filepath.FromSlash(name)))
		if err != nil {
			return semanticModel{}, err
		}
		if err := os.WriteFile(destination, data, 0o600); err != nil {
			return semanticModel{}, err
		}
	}
	output := filepath.Join(temporary, "source.pb")
	command := exec.Command(filepath.Join(semanticProtocRoot, "bin", "protoc"), "--proto_path="+temporary, "--include_imports", "--descriptor_set_out="+output, "source.proto")
	if raw, err := command.CombinedOutput(); err != nil {
		return semanticModel{}, fmt.Errorf("pinned protoc failed: %s", strings.TrimSpace(string(raw)))
	}
	raw, err := os.ReadFile(output)
	if err != nil {
		return semanticModel{}, err
	}
	set := new(descriptorpb.FileDescriptorSet)
	if err := proto.Unmarshal(raw, set); err != nil {
		return semanticModel{}, err
	}
	return descriptorModel(set)
}
func registerSemanticMessages(messages protoreflect.MessageDescriptors, types *protoregistry.Types) {
	for index := 0; index < messages.Len(); index++ {
		descriptor := messages.Get(index)
		_ = types.RegisterMessage(dynamicpb.NewMessageType(descriptor))
		registerSemanticMessages(descriptor.Messages(), types)
		for extensionIndex := 0; extensionIndex < descriptor.Extensions().Len(); extensionIndex++ {
			_ = types.RegisterExtension(dynamicpb.NewExtensionType(descriptor.Extensions().Get(extensionIndex)))
		}
	}
}

func makeSemanticRegistry(files *protoregistry.Files) *protoregistry.Types {
	types := new(protoregistry.Types)
	files.RangeFiles(func(file protoreflect.FileDescriptor) bool {
		registerSemanticMessages(file.Messages(), types)
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

func descriptorModel(set *descriptorpb.FileDescriptorSet) (semanticModel, error) {
	// The pinned protoc may emit a newer, forward-compatible Edition number than
	// the Go reflection package knows. The companion rules use only descriptor
	// shapes and the pinned EnumValueOptions extension here; project the unknown
	// future Edition to the newest supported feature baseline for dynamic I/O.
	runtimeSet := proto.Clone(set).(*descriptorpb.FileDescriptorSet)
	for _, file := range runtimeSet.File {
		if int32(file.GetEdition()) > int32(descriptorpb.Edition_EDITION_2024) && int32(file.GetEdition()) < int32(descriptorpb.Edition_EDITION_UNSTABLE) {
			file.Edition = descriptorpb.Edition_EDITION_2024.Enum()
		}
	}
	files, err := protodesc.NewFiles(runtimeSet)
	if err != nil {
		return semanticModel{}, err
	}
	model := semanticModel{Messages: map[string][]semanticField{}, Services: map[string]map[string]semanticMethod{}, Files: files, Types: makeSemanticRegistry(files)}
	var addMessage func(string, *descriptorpb.DescriptorProto)
	addMessage = func(prefix string, message *descriptorpb.DescriptorProto) {
		name := qualify(prefix, message.GetName())
		fields := []semanticField{}
		for _, field := range message.Field {
			kind := strings.ToLower(strings.TrimPrefix(field.GetType().String(), "TYPE_"))
			jsonName := field.GetJsonName()
			if jsonName == "" {
				jsonName = lowerCamel(field.GetName())
			}
			fields = append(fields, semanticField{kind, field.GetName(), jsonName, int(field.GetNumber())})
		}
		model.Messages[name] = fields
		for _, nested := range message.NestedType {
			addMessage(name, nested)
		}
	}
	for _, file := range set.File {
		pkg := file.GetPackage()
		for _, message := range file.MessageType {
			addMessage(pkg, message)
		}
		for _, service := range file.Service {
			name := qualify(pkg, service.GetName())
			methods := map[string]semanticMethod{}
			for _, method := range service.Method {
				methods[method.GetName()] = semanticMethod{method.GetClientStreaming(), method.GetServerStreaming(), strings.TrimPrefix(method.GetInputType(), "."), strings.TrimPrefix(method.GetOutputType(), ".")}
			}
			model.Services[name] = methods
		}
	}
	return model, nil
}
func loadModel(raw json.RawMessage) (semanticModel, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return semanticModel{}, fmt.Errorf("absent content")
	}
	if raw[0] == '"' {
		var source string
		if err := json.Unmarshal(raw, &source); err != nil {
			return semanticModel{}, err
		}
		return textModel(source)
	}
	var object map[string]json.RawMessage
	if err := json.Unmarshal(raw, &object); err != nil {
		return semanticModel{}, err
	}
	set := new(descriptorpb.FileDescriptorSet)
	if tagged, ok := object["$fileDescriptorSet"]; ok {
		if len(object) != 1 {
			return semanticModel{}, fmt.Errorf("binary carrier fields")
		}
		var encoded string
		if json.Unmarshal(tagged, &encoded) != nil {
			return semanticModel{}, fmt.Errorf("binary carrier")
		}
		data, err := canonicalBase64(encoded)
		if err != nil {
			return semanticModel{}, err
		}
		if err = proto.Unmarshal(data, set); err != nil {
			return semanticModel{}, err
		}
	} else if err := protojson.Unmarshal(raw, set); err != nil {
		return semanticModel{}, err
	}
	if len(set.File) == 0 {
		return semanticModel{}, fmt.Errorf("empty descriptor set")
	}
	return descriptorModel(set)
}
func selected(model semanticModel, selector string) (semanticMethod, error) {
	parts := strings.Split(selector, "/")
	if len(parts) != 2 {
		return semanticMethod{}, fmt.Errorf("selector")
	}
	methods, ok := model.Services[parts[0]]
	if !ok {
		return semanticMethod{}, fmt.Errorf("service")
	}
	method, ok := methods[parts[1]]
	if !ok {
		return semanticMethod{}, fmt.Errorf("method")
	}
	if _, ok = model.Messages[method.Input]; !ok {
		return semanticMethod{}, fmt.Errorf("input owner")
	}
	if _, ok = model.Messages[method.Output]; !ok {
		return semanticMethod{}, fmt.Errorf("output owner")
	}
	for _, name := range []string{method.Input, method.Output} {
		descriptor, err := semanticMessageDescriptor(model, name)
		if err != nil || semanticMessageHasSpellingCollision(descriptor, map[protoreflect.FullName]bool{}) {
			return semanticMethod{}, fmt.Errorf("message spelling collision")
		}
	}
	return method, nil
}

func semanticMessageHasSpellingCollision(message protoreflect.MessageDescriptor, seen map[protoreflect.FullName]bool) bool {
	if seen[message.FullName()] {
		return false
	}
	seen[message.FullName()] = true
	owners := map[string]protoreflect.FieldNumber{}
	fields := message.Fields()
	for index := 0; index < fields.Len(); index++ {
		field := fields.Get(index)
		for _, spelling := range []string{string(field.Name()), field.JSONName()} {
			if owner, exists := owners[spelling]; exists && owner != field.Number() {
				return true
			}
			owners[spelling] = field.Number()
		}
	}
	for index := 0; index < fields.Len(); index++ {
		field := fields.Get(index)
		candidate := field.Message()
		if field.IsMap() {
			candidate = field.MapValue().Message()
		}
		if candidate != nil && !strings.HasPrefix(string(candidate.FullName()), "google.protobuf.") && semanticMessageHasSpellingCollision(candidate, seen) {
			return true
		}
	}
	return false
}
func appendVarint(out []byte, value uint64) []byte {
	for value >= 128 {
		out = append(out, byte(value)|128)
		value >>= 7
	}
	return append(out, byte(value))
}
func readVarint(data []byte, offset *int) (uint64, error) {
	var value uint64
	for shift := uint(0); shift < 64 && *offset < len(data); shift += 7 {
		b := data[*offset]
		*offset++
		value |= uint64(b&127) << shift
		if b&128 == 0 {
			return value, nil
		}
	}
	return 0, fmt.Errorf("truncated varint")
}
func semanticCustomEnumJSON(value protoreflect.EnumValueDescriptor) string {
	options, ok := value.Options().(*descriptorpb.EnumValueOptions)
	if !ok {
		return ""
	}
	raw := options.ProtoReflect().GetUnknown()
	for len(raw) > 0 {
		number, wireType, tagBytes := protowire.ConsumeTag(raw)
		if tagBytes < 0 {
			return ""
		}
		raw = raw[tagBytes:]
		if number == 998 && wireType == protowire.BytesType {
			option, optionBytes := protowire.ConsumeBytes(raw)
			if optionBytes < 0 {
				return ""
			}
			for len(option) > 0 {
				field, fieldType, fieldTagBytes := protowire.ConsumeTag(option)
				if fieldTagBytes < 0 {
					return ""
				}
				option = option[fieldTagBytes:]
				if field == 1 && fieldType == protowire.BytesType {
					text, textBytes := protowire.ConsumeString(option)
					if textBytes >= 0 {
						return text
					}
				}
				consumed := protowire.ConsumeFieldValue(field, fieldType, option)
				if consumed < 0 {
					return ""
				}
				option = option[consumed:]
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

func semanticMessageDescriptor(model semanticModel, name string) (protoreflect.MessageDescriptor, error) {
	if model.Files == nil {
		return nil, fmt.Errorf("descriptor pool is absent")
	}
	descriptor, err := model.Files.FindDescriptorByName(protoreflect.FullName(name))
	if err != nil {
		return nil, err
	}
	message, ok := descriptor.(protoreflect.MessageDescriptor)
	if !ok {
		return nil, fmt.Errorf("%s is not a message", name)
	}
	return message, nil
}

func semanticWellKnownJSON(name protoreflect.FullName) bool {
	switch name {
	case "google.protobuf.Any", "google.protobuf.Timestamp", "google.protobuf.Duration", "google.protobuf.FieldMask",
		"google.protobuf.Struct", "google.protobuf.Value", "google.protobuf.ListValue", "google.protobuf.NullValue",
		"google.protobuf.DoubleValue", "google.protobuf.FloatValue", "google.protobuf.Int64Value", "google.protobuf.UInt64Value",
		"google.protobuf.Int32Value", "google.protobuf.UInt32Value", "google.protobuf.BoolValue", "google.protobuf.StringValue", "google.protobuf.BytesValue":
		return true
	default:
		return false
	}
}

func semanticWrapperDefault(name protoreflect.FullName) (any, bool) {
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

func normalizeSemanticPinnedField(field protoreflect.FieldDescriptor, value any, types *protoregistry.Types) (any, error) {
	if value == nil {
		return value, nil
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
				if _, wrapper := semanticWrapperDefault(field.MapValue().Message().FullName()); wrapper {
					return nil, fmt.Errorf("null wrapper map value")
				}
			}
			key, err := normalizeSemanticMapKey(field.MapKey(), rawKey)
			if err != nil {
				return nil, err
			}
			if field.MapValue().Kind() == protoreflect.MessageKind {
				item, err = normalizeSemanticPinnedInput(field.MapValue().Message(), item, types)
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
			out[key] = item
		}
		return out, nil
	}
	if field.Kind() != protoreflect.MessageKind {
		return value, nil
	}
	if field.IsList() {
		items, ok := value.([]any)
		if !ok {
			return value, nil
		}
		out := make([]any, len(items))
		for index, item := range items {
			if item == nil {
				if _, wrapper := semanticWrapperDefault(field.Message().FullName()); wrapper {
					return nil, fmt.Errorf("null repeated wrapper")
				}
			}
			converted, err := normalizeSemanticPinnedInput(field.Message(), item, types)
			if err != nil {
				return nil, err
			}
			out[index] = converted
		}
		return out, nil
	}
	return normalizeSemanticPinnedInput(field.Message(), value, types)
}

func normalizeSemanticMapKey(field protoreflect.FieldDescriptor, value string) (string, error) {
	return normalizePinnedProtoJSONMapKey(field.Kind().String(), value)
}

func normalizeSemanticPinnedInput(message protoreflect.MessageDescriptor, value any, types *protoregistry.Types) (any, error) {
	if message.FullName() == "google.protobuf.Duration" {
		return normalizePinnedDuration(value)
	}
	if fallback, wrapper := semanticWrapperDefault(message.FullName()); wrapper && value == nil {
		return fallback, nil
	}
	if message.FullName() == "google.protobuf.Any" {
		object, ok := orderedObjectMap(value)
		if !ok || len(object) == 0 {
			return value, nil
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
		if semanticAnyEnvelopeCollision(embedded) {
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
		if fallback, wrapper := semanticWrapperDefault(embedded.FullName()); wrapper {
			if len(object) == 2 && object["value"] == nil {
				out["value"] = fallback
			}
			return out, nil
		}
		if embedded.FullName() == "google.protobuf.Duration" {
			converted, err := normalizePinnedDuration(object["value"])
			if err != nil {
				return nil, err
			}
			out["value"] = converted
			return out, nil
		}
		return out, nil
	}
	if semanticWellKnownJSON(message.FullName()) {
		return value, nil
	}
	entries, ok := orderedObjectEntries(value)
	if !ok {
		return value, nil
	}
	out := map[string]any{}
	for _, entry := range entries {
		key, item := entry.Key, entry.Value
		field := message.Fields().ByJSONName(key)
		if field == nil {
			field = message.Fields().ByName(protoreflect.Name(key))
		}
		if field == nil {
			out[key] = item
			continue
		}
		converted, err := normalizeSemanticPinnedField(field, item, types)
		if err != nil {
			return nil, err
		}
		out[key] = converted
	}
	return out, nil
}

func customizeSemanticPinnedOutput(message protoreflect.MessageDescriptor, value any, types *protoregistry.Types) (any, error) {
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
		if semanticAnyEnvelopeCollision(messageType.Descriptor()) {
			return nil, fmt.Errorf("embedded Any output type collides with @type")
		}
		if messageType.Descriptor().FullName() == "google.protobuf.Empty" {
			return map[string]any{"@type": rawURL}, nil
		}
		return value, nil
	}
	if semanticWellKnownJSON(message.FullName()) {
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
				value, err := customizeSemanticPinnedOutput(field.Message(), entry, types)
				if err != nil {
					return nil, err
				}
				converted[index] = value
			}
			out[key] = converted
			continue
		}
		converted, err := customizeSemanticPinnedOutput(field.Message(), item, types)
		if err != nil {
			return nil, err
		}
		out[key] = converted
	}
	return out, nil
}

func semanticAnyEnvelopeCollision(message protoreflect.MessageDescriptor) bool {
	fields := message.Fields()
	for index := 0; index < fields.Len(); index++ {
		field := fields.Get(index)
		if field.Name() == "@type" || field.JSONName() == "@type" {
			return true
		}
	}
	return false
}

func normalizeSemanticFieldInput(field protoreflect.FieldDescriptor, value any) (any, error) {
	if value == nil {
		return nil, nil
	}
	if field.IsMap() {
		entries, ok := orderedObjectEntries(value)
		if !ok {
			return nil, fmt.Errorf("map field %s", field.FullName())
		}
		out := map[string]any{}
		for _, entry := range entries {
			key, item := entry.Key, entry.Value
			normalizedKey, err := normalizePinnedProtoJSONMapKey(field.MapKey().Kind().String(), key)
			if err != nil {
				return nil, err
			}
			converted, err := normalizeSemanticSingularInput(field.MapValue(), item)
			if err != nil {
				return nil, err
			}
			out[normalizedKey] = converted
		}
		return out, nil
	}
	if field.IsList() {
		items, ok := value.([]any)
		if !ok {
			return nil, fmt.Errorf("repeated field %s", field.FullName())
		}
		out := make([]any, 0, len(items))
		for _, item := range items {
			converted, err := normalizeSemanticSingularInput(field, item)
			if err != nil {
				return nil, err
			}
			out = append(out, converted)
		}
		return out, nil
	}
	return normalizeSemanticSingularInput(field, value)
}

func normalizeSemanticSingularInput(field protoreflect.FieldDescriptor, value any) (any, error) {
	if field.Kind() == protoreflect.EnumKind {
		text, ok := value.(string)
		if !ok {
			return value, nil
		}
		values := field.Enum().Values()
		for index := 0; index < values.Len(); index++ {
			candidate := values.Get(index)
			if string(candidate.Name()) == text || semanticCustomEnumJSON(candidate) == text {
				return string(candidate.Name()), nil
			}
		}
		return nil, fmt.Errorf("unknown or quoted-numeric enum caller value %q", text)
	}
	if field.Kind() == protoreflect.MessageKind {
		if semanticWellKnownJSON(field.Message().FullName()) {
			return value, nil
		}
		return normalizeSemanticMessageInput(field.Message(), value)
	}
	if field.Kind() == protoreflect.BytesKind {
		text, ok := value.(string)
		if !ok {
			return nil, fmt.Errorf("bytes caller value")
		}
		return pinnedProtoJSONBase64(text)
	}
	return normalizePortableCallerScalar(field.Kind().String(), value)
}

func normalizeSemanticMessageInput(message protoreflect.MessageDescriptor, value any) (any, error) {
	if semanticWellKnownJSON(message.FullName()) {
		return value, nil
	}
	entries, ok := orderedObjectEntries(value)
	if !ok {
		return nil, fmt.Errorf("message %s must be an object", message.FullName())
	}
	aliases := map[string]protoreflect.FieldDescriptor{}
	for index := 0; index < message.Fields().Len(); index++ {
		field := message.Fields().Get(index)
		for _, spelling := range []string{string(field.Name()), field.JSONName()} {
			if owner, exists := aliases[spelling]; exists && owner.Number() != field.Number() {
				return nil, fmt.Errorf("ambiguous field spelling %s", spelling)
			}
			aliases[spelling] = field
		}
	}
	seen := map[protoreflect.FieldNumber]bool{}
	out := map[string]any{}
	for _, entry := range entries {
		key, raw := entry.Key, entry.Value
		field, exists := aliases[key]
		if !exists {
			return nil, fmt.Errorf("unknown field %s", key)
		}
		if seen[field.Number()] {
			return nil, fmt.Errorf("duplicate field assignment %s", key)
		}
		seen[field.Number()] = true
		converted, err := normalizeSemanticFieldInput(field, raw)
		if err != nil {
			return nil, err
		}
		out[field.JSONName()] = converted
	}
	return out, nil
}

func customizeSemanticFieldOutput(field protoreflect.FieldDescriptor, value any) (any, error) {
	if value == nil {
		return nil, nil
	}
	if field.IsMap() {
		object, ok := value.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("map output %s", field.FullName())
		}
		out := map[string]any{}
		for key, item := range object {
			converted, err := customizeSemanticSingularOutput(field.MapValue(), item)
			if err != nil {
				return nil, err
			}
			out[key] = converted
		}
		return out, nil
	}
	if field.IsList() {
		items, ok := value.([]any)
		if !ok {
			return nil, fmt.Errorf("repeated output %s", field.FullName())
		}
		out := make([]any, 0, len(items))
		for _, item := range items {
			converted, err := customizeSemanticSingularOutput(field, item)
			if err != nil {
				return nil, err
			}
			out = append(out, converted)
		}
		return out, nil
	}
	return customizeSemanticSingularOutput(field, value)
}

func customizeSemanticSingularOutput(field protoreflect.FieldDescriptor, value any) (any, error) {
	if field.Kind() == protoreflect.EnumKind {
		name, ok := value.(string)
		if !ok {
			return value, nil
		}
		descriptor := field.Enum().Values().ByName(protoreflect.Name(name))
		if descriptor != nil {
			if custom := semanticCustomEnumJSON(descriptor); custom != "" {
				return custom, nil
			}
		}
		return value, nil
	}
	if field.Kind() == protoreflect.MessageKind && !semanticWellKnownJSON(field.Message().FullName()) {
		return customizeSemanticMessageOutput(field.Message(), value)
	}
	return value, nil
}

func customizeSemanticMessageOutput(message protoreflect.MessageDescriptor, value any) (any, error) {
	if semanticWellKnownJSON(message.FullName()) {
		return value, nil
	}
	object, ok := value.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("message output %s", message.FullName())
	}
	out := map[string]any{}
	for key, raw := range object {
		field := message.Fields().ByJSONName(key)
		if field == nil {
			return nil, fmt.Errorf("unknown output field %s", key)
		}
		converted, err := customizeSemanticFieldOutput(field, raw)
		if err != nil {
			return nil, err
		}
		out[key] = converted
	}
	return out, nil
}

func encodeMessage(model semanticModel, name string, value any) ([]byte, error) {
	descriptor, err := semanticMessageDescriptor(model, name)
	if err != nil {
		return nil, err
	}
	value, err = normalizeSemanticPinnedInput(descriptor, value, model.Types)
	if err != nil {
		return nil, err
	}
	normalized, err := normalizeSemanticMessageInput(descriptor, value)
	if err != nil {
		return nil, err
	}
	encodedJSON, err := json.Marshal(normalized)
	if err != nil {
		return nil, err
	}
	message := dynamicpb.NewMessage(descriptor)
	if err := (protojson.UnmarshalOptions{DiscardUnknown: false, Resolver: model.Types, AllowPartial: true}).Unmarshal(encodedJSON, message); err != nil {
		return nil, err
	}
	return (proto.MarshalOptions{Deterministic: true, AllowPartial: true}).Marshal(canonicalDynamicMessage(message.ProtoReflect()).Interface())
}

// dynamicpb preserves field insertion order, while protobuf deterministic mode only
// promises stable bytes within one implementation. Reinsert fields by number so the
// normalized native evidence has the same legal wire order in both witness runtimes.
func canonicalDynamicMessage(input protoreflect.Message) protoreflect.Message {
	output := dynamicpb.NewMessage(input.Descriptor()).ProtoReflect()
	fields := make([]protoreflect.FieldDescriptor, 0)
	input.Range(func(field protoreflect.FieldDescriptor, _ protoreflect.Value) bool {
		fields = append(fields, field)
		return true
	})
	sort.Slice(fields, func(i, j int) bool { return fields[i].Number() < fields[j].Number() })
	for _, field := range fields {
		value := input.Get(field)
		switch {
		case field.IsList():
			target := output.Mutable(field).List()
			for index, source := 0, value.List(); index < source.Len(); index++ {
				item := source.Get(index)
				if field.Kind() == protoreflect.MessageKind || field.Kind() == protoreflect.GroupKind {
					item = protoreflect.ValueOfMessage(canonicalDynamicMessage(item.Message()))
				}
				target.Append(item)
			}
		case field.IsMap():
			target := output.Mutable(field).Map()
			keys := make([]protoreflect.MapKey, 0)
			value.Map().Range(func(key protoreflect.MapKey, _ protoreflect.Value) bool {
				keys = append(keys, key)
				return true
			})
			sort.Slice(keys, func(i, j int) bool { return fmt.Sprint(keys[i].Interface()) < fmt.Sprint(keys[j].Interface()) })
			for _, key := range keys {
				item := value.Map().Get(key)
				if field.MapValue().Kind() == protoreflect.MessageKind || field.MapValue().Kind() == protoreflect.GroupKind {
					item = protoreflect.ValueOfMessage(canonicalDynamicMessage(item.Message()))
				}
				target.Set(key, item)
			}
		case field.Kind() == protoreflect.MessageKind || field.Kind() == protoreflect.GroupKind:
			output.Set(field, protoreflect.ValueOfMessage(canonicalDynamicMessage(value.Message())))
		default:
			output.Set(field, value)
		}
	}
	output.SetUnknown(append([]byte(nil), input.GetUnknown()...))
	return output
}
func requestEvidence(payload []byte, value any, compression string) (map[string]any, error) {
	flag := byte(0)
	encoded := append([]byte(nil), payload...)
	evidence := map[string]any{"compressedFlag": 0, "decodedLength": len(payload), "decodedPayloadBase64": base64.StdEncoding.EncodeToString(payload), "lengthMatchesEncodedPayload": true, "valueJson": jsonText(canonicalEvidenceValue(value))}
	if compression == "gzip" {
		flag = 1
		var buffer bytes.Buffer
		writer := gzip.NewWriter(&buffer)
		if _, err := writer.Write(payload); err != nil {
			return nil, err
		}
		if err := writer.Close(); err != nil {
			return nil, err
		}
		encoded = buffer.Bytes()
		evidence["compressedFlag"] = 1
		evidence["gzipMemberValid"] = true
		reader, err := gzip.NewReader(bytes.NewReader(encoded))
		if err != nil {
			return nil, err
		}
		decoded, err := io.ReadAll(reader)
		reader.Close()
		if err != nil || !bytes.Equal(decoded, payload) {
			return nil, fmt.Errorf("outbound gzip roundtrip")
		}
	}
	frame := make([]byte, 5+len(encoded))
	frame[0] = flag
	binary.BigEndian.PutUint32(frame[1:5], uint32(len(encoded)))
	copy(frame[5:], encoded)
	evidence["frameBase64"] = base64.StdEncoding.EncodeToString(frame)
	evidence["lengthMatchesEncodedPayload"] = int(binary.BigEndian.Uint32(frame[1:5])) == len(frame)-5
	return evidence, nil
}
func decodeMessage(model semanticModel, name string, data []byte) (any, error) {
	descriptor, err := semanticMessageDescriptor(model, name)
	if err != nil {
		return nil, err
	}
	message := dynamicpb.NewMessage(descriptor)
	normalizedWire, err := normalizePinnedClosedEnumWire(descriptor, data)
	if err != nil {
		return nil, err
	}
	if err := (proto.UnmarshalOptions{DiscardUnknown: false, Resolver: model.Types}).Unmarshal(normalizedWire, message); err != nil {
		return nil, err
	}
	if err := applyPinnedClosedEnumSemantics(message.ProtoReflect(), data, model.Types); err != nil {
		return nil, err
	}
	if err := validatePinnedDecodedStrings(message.ProtoReflect(), model.Types); err != nil {
		return nil, err
	}
	encoded, err := (protojson.MarshalOptions{Resolver: model.Types}).Marshal(message)
	if err != nil {
		return nil, err
	}
	var value any
	if err := json.Unmarshal(encoded, &value); err != nil {
		return nil, err
	}
	value, err = customizeSemanticPinnedOutput(descriptor, value, model.Types)
	if err != nil {
		return nil, err
	}
	return customizeSemanticMessageOutput(descriptor, value)
}

func headerValues(headers []semanticHeader, name string) []string {
	out := []string{}
	for _, header := range headers {
		if header.Name == name {
			for _, value := range header.Values {
				if text, ok := value.(string); ok {
					out = append(out, text)
				}
			}
		}
	}
	return out
}
func legalResponseHeaderBlock(headers []semanticHeader, trailers bool) bool {
	regularSeen := false
	namePattern := regexp.MustCompile(`^(?::[a-z]+|[0-9a-z_.-]+)$`)
	for _, header := range headers {
		if !namePattern.MatchString(header.Name) || len(header.Values) == 0 {
			return false
		}
		for _, value := range header.Values {
			if _, ok := value.(string); !ok {
				return false
			}
		}
		if strings.HasPrefix(header.Name, ":") {
			if trailers || header.Name != ":status" || regularSeen {
				return false
			}
		} else {
			regularSeen = true
		}
		if trailers {
			if strings.HasPrefix(header.Name, "grpc-") && header.Name != "grpc-status" && header.Name != "grpc-message" && header.Name != "grpc-status-details-bin" {
				return false
			}
			if header.Name == "content-type" || header.Name == "te" {
				return false
			}
		} else {
			allowed := header.Name == "grpc-encoding" || header.Name == "grpc-accept-encoding" || header.Name == "grpc-status" || header.Name == "grpc-message" || header.Name == "grpc-status-details-bin"
			if strings.HasPrefix(header.Name, "grpc-") && !allowed {
				return false
			}
			if header.Name == "te" {
				return false
			}
		}
	}
	_, err := inboundMetadata(headers, trailers)
	return err == nil
}
func inboundMetadata(headers []semanticHeader, trailers bool) ([]map[string]any, error) {
	owned := map[string]bool{":status": true, "content-type": true, "te": true, "grpc-status": true, "grpc-message": true, "grpc-status-details-bin": true}
	if !trailers {
		owned["grpc-encoding"] = true
		owned["grpc-accept-encoding"] = true
	}
	values := map[string][]string{}
	for _, header := range headers {
		if strings.HasPrefix(header.Name, ":") || owned[header.Name] {
			continue
		}
		if strings.HasPrefix(header.Name, "grpc-") {
			return nil, fmt.Errorf("unknown reserved response metadata")
		}
		for _, raw := range header.Values {
			text, ok := raw.(string)
			if !ok {
				return nil, fmt.Errorf("response metadata value")
			}
			values[header.Name] = append(values[header.Name], text)
		}
	}
	names := make([]string, 0, len(values))
	for name := range values {
		names = append(names, name)
	}
	sort.Strings(names)
	out := make([]map[string]any, 0, len(names))
	for _, name := range names {
		if strings.HasSuffix(name, "-bin") {
			parts := strings.Split(strings.Join(values[name], ","), ",")
			decoded := make([]string, 0, len(parts))
			for _, part := range parts {
				data, err := metadataBase64(part)
				if err != nil {
					return nil, err
				}
				decoded = append(decoded, base64.StdEncoding.EncodeToString(data))
			}
			out = append(out, map[string]any{"name": name, "value": decoded})
			continue
		}
		for _, text := range values[name] {
			if text == "" {
				return nil, fmt.Errorf("empty ASCII response metadata")
			}
			for _, value := range []byte(text) {
				if value < 0x20 || value > 0x7e {
					return nil, fmt.Errorf("non-printable ASCII response metadata")
				}
			}
		}
		out = append(out, map[string]any{"name": name, "value": strings.Join(values[name], ",")})
	}
	return out, nil
}
func stringMetadata(values []any, binary bool) ([]string, error) {
	if binary {
		joined := []string{}
		for _, value := range values {
			object, ok := value.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("binary metadata")
			}
			text, ok := object["base64"].(string)
			if !ok {
				return nil, fmt.Errorf("binary metadata")
			}
			if _, err := metadataBase64(text); err != nil {
				return nil, err
			}
			joined = append(joined, text)
		}
		return []string{strings.Join(joined, ",")}, nil
	}
	out := []string{}
	for _, value := range values {
		text, ok := value.(string)
		if !ok {
			return nil, fmt.Errorf("metadata")
		}
		out = append(out, text)
	}
	return out, nil
}
func metadataHeaders(groups []semanticMetadata) ([]map[string]any, error) {
	ordered := append([]semanticMetadata(nil), groups...)
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].Name < ordered[j].Name })
	out := []map[string]any{}
	for _, group := range ordered {
		values, err := stringMetadata(group.Values, strings.HasSuffix(group.Name, "-bin"))
		if err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"name": group.Name, "values": values})
	}
	return out, nil
}
func metadataCollision(groups []semanticMetadata) bool {
	for _, group := range groups {
		if group.Name == "content-type" || group.Name == "te" || group.Name == "user-agent" || strings.HasPrefix(group.Name, "grpc-") || strings.HasPrefix(group.Name, ":") {
			return true
		}
	}
	return false
}
func admittedServerName(value string) bool {
	if value == "" || strings.HasSuffix(value, ".") || strings.Contains(value, "%") || strings.HasPrefix(value, "[") || strings.HasSuffix(value, "]") {
		return false
	}
	if net.ParseIP(value) != nil {
		return true
	}
	if strings.Contains(value, ":") || len(value) > 253 {
		return false
	}
	valid := regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$`)
	for _, label := range strings.Split(value, ".") {
		if len(label) == 0 || len(label) > 63 || !valid.MatchString(label) {
			return false
		}
	}
	return true
}
func parseTarget(location, configured string) (semanticTarget, error) {
	splitAuthority := func(authority string) (string, error) {
		if strings.HasPrefix(authority, "[") {
			close := strings.Index(authority, "]")
			if close < 0 || close+1 >= len(authority) || authority[close+1] != ':' {
				return "", fmt.Errorf("bracketed authority")
			}
			return authority[1:close], nil
		}
		colon := strings.LastIndex(authority, ":")
		if colon < 1 || strings.Index(authority, ":") != colon {
			return "", fmt.Errorf("authority")
		}
		return authority[:colon], nil
	}
	if strings.HasPrefix(location, "grpc://") || strings.HasPrefix(location, "grpcs://") {
		if configured != "" {
			return semanticTarget{}, fmt.Errorf("explicit transport")
		}
		transport := "plaintext"
		prefix := 7
		if strings.HasPrefix(location, "grpcs://") {
			transport = "tls"
			prefix = 8
		}
		authority := location[prefix:]
		if strings.ContainsAny(authority, "/?#@") {
			return semanticTarget{}, fmt.Errorf("target authority")
		}
		hostname, err := splitAuthority(authority)
		return semanticTarget{transport, authority, hostname}, err
	}
	if configured == "" {
		return semanticTarget{}, fmt.Errorf("bare transport")
	}
	hostname, err := splitAuthority(location)
	return semanticTarget{configured, location, hostname}, err
}
func timeoutHeader(text string) (string, error) {
	value, ok := new(big.Int).SetString(text, 10)
	if !ok {
		return "", fmt.Errorf("timeout")
	}
	units := []struct {
		suffix string
		size   int64
	}{{"n", 1}, {"u", 1000}, {"m", 1000000}, {"S", 1000000000}, {"M", 60000000000}, {"H", 3600000000000}}
	limit := big.NewInt(99999999)
	for _, unit := range units {
		size := big.NewInt(unit.size)
		encoded := new(big.Int).Add(value, new(big.Int).Sub(size, big.NewInt(1)))
		encoded.Div(encoded, size)
		if encoded.Cmp(limit) <= 0 {
			return encoded.String() + unit.suffix, nil
		}
	}
	return "", fmt.Errorf("timeout")
}
func decodeStatusDetails(raw string) map[string]any {
	result := map[string]any{"rawBase64": raw, "decoded": false}
	data, err := metadataBase64(raw)
	if err != nil {
		return result
	}
	offset := 0
	present := false
	var code int32
	for offset < len(data) {
		tag, err := readVarint(data, &offset)
		if err != nil {
			return result
		}
		field, wire := int(tag>>3), int(tag&7)
		switch {
		case field == 1 && wire == 0:
			value, e := readVarint(data, &offset)
			if e != nil {
				return result
			}
			present = true
			code = int32(value)
		case wire == 0:
			_, err = readVarint(data, &offset)
		case wire == 1:
			offset += 8
		case wire == 2:
			var length uint64
			length, err = readVarint(data, &offset)
			offset += int(length)
		case wire == 5:
			offset += 4
		default:
			return result
		}
		if err != nil || offset > len(data) {
			return result
		}
	}
	result["decoded"] = true
	result["codePresent"] = present
	if present {
		result["code"] = code
	}
	return result
}
func httpStatus(code int) int {
	switch code {
	case 400:
		return 13
	case 401:
		return 16
	case 403:
		return 7
	case 404:
		return 12
	case 429, 502, 503, 504:
		return 14
	default:
		return 2
	}
}

type decodedReflection struct {
	ValidHost, OriginalKind, OriginalValue, OriginalHost, ResponseKind string
	Model                                                              semanticModel
	ServiceList                                                        []string
	ErrorCode                                                          int32
	ErrorMessage                                                       string
}

func decodeReflectionResponse(data []byte) (decodedReflection, error) {
	response := new(reflectionv1.ServerReflectionResponse)
	if err := proto.Unmarshal(data, response); err != nil || response.OriginalRequest == nil {
		return decodedReflection{}, fmt.Errorf("reflection response decode")
	}
	decoded := decodedReflection{ValidHost: response.ValidHost, OriginalHost: response.OriginalRequest.Host}
	switch request := response.OriginalRequest.MessageRequest.(type) {
	case *reflectionv1.ServerReflectionRequest_FileContainingSymbol:
		decoded.OriginalKind, decoded.OriginalValue = "file-containing-symbol", request.FileContainingSymbol
	case *reflectionv1.ServerReflectionRequest_ListServices:
		decoded.OriginalKind, decoded.OriginalValue = "list-services", request.ListServices
	default:
		return decodedReflection{}, fmt.Errorf("unsupported reflection original_request")
	}
	switch payload := response.MessageResponse.(type) {
	case *reflectionv1.ServerReflectionResponse_FileDescriptorResponse:
		if len(payload.FileDescriptorResponse.FileDescriptorProto) == 0 {
			return decodedReflection{}, fmt.Errorf("empty reflection descriptor response")
		}
		set := new(descriptorpb.FileDescriptorSet)
		for _, raw := range payload.FileDescriptorResponse.FileDescriptorProto {
			file := new(descriptorpb.FileDescriptorProto)
			if err := proto.Unmarshal(raw, file); err != nil {
				return decodedReflection{}, fmt.Errorf("reflection descriptor decode")
			}
			set.File = append(set.File, file)
		}
		model, err := descriptorModel(set)
		if err != nil {
			return decodedReflection{}, fmt.Errorf("reflection descriptor pool: %w", err)
		}
		decoded.ResponseKind, decoded.Model = "file-descriptor-response", model
	case *reflectionv1.ServerReflectionResponse_ListServicesResponse:
		decoded.ResponseKind = "list-services-response"
		for _, service := range payload.ListServicesResponse.Service {
			decoded.ServiceList = append(decoded.ServiceList, service.Name)
		}
	case *reflectionv1.ServerReflectionResponse_ErrorResponse:
		decoded.ResponseKind, decoded.ErrorCode, decoded.ErrorMessage = "error-response", payload.ErrorResponse.ErrorCode, payload.ErrorResponse.ErrorMessage
	default:
		return decodedReflection{}, fmt.Errorf("unsupported reflection response variant")
	}
	return decoded, nil
}

func resolveReflection(s semanticScenario) (semanticModel, map[string]any, int, map[string]any, error) {
	target, err := parseTarget(s.Given.Source.Location, s.Given.Configuration.Transport)
	if err != nil {
		return semanticModel{}, nil, 0, nil, err
	}
	if metadataCollision(s.Given.Configuration.DiscoveryMetadata) {
		return semanticModel{}, nil, 0, terminalActual("refusal", "resolution", "configuration", nil, nil), nil
	}
	clock := new(big.Int)
	clock.SetString(s.Given.Runtime.ClockStartNs, 10)
	if s.Given.Runtime.ClockStartNs == "" {
		clock.SetInt64(0)
	}
	var deadline *big.Int
	if s.Given.Configuration.DiscoveryTimeoutNs != "" {
		duration, _ := new(big.Int).SetString(s.Given.Configuration.DiscoveryTimeoutNs, 10)
		deadline = new(big.Int).Add(new(big.Int).Set(clock), duration)
	}
	reflection := []map[string]any{}
	cursor := 0
	request := func(version string, stream int) (map[string]any, error) {
		headers := []map[string]any{
			{"name": ":method", "values": []string{"POST"}},
			{"name": ":scheme", "values": []string{map[bool]string{true: "https", false: "http"}[target.Transport == "tls"]}},
			{"name": ":authority", "values": []string{target.Authority}},
			{"name": ":path", "values": []string{fmt.Sprintf("/grpc.reflection.%s.ServerReflection/ServerReflectionInfo", version)}},
			{"name": "te", "values": []string{"trailers"}},
			{"name": "content-type", "values": []string{"application/grpc+proto"}},
		}
		metadata, err := metadataHeaders(s.Given.Configuration.DiscoveryMetadata)
		if err != nil {
			return nil, err
		}
		headers = append(headers, metadata...)
		var deadlineValue any = nil
		if deadline != nil {
			deadlineValue = deadline.String()
			remaining := new(big.Int).Sub(deadline, clock)
			timeout, e := timeoutHeader(remaining.String())
			if e != nil {
				return nil, e
			}
			headers = append(headers, map[string]any{"name": "grpc-timeout", "values": []string{timeout}})
		}
		service := strings.Split(s.Given.Binding.Selector, "/")[0]
		requestBytes := appendVarint(nil, 10)
		requestBytes = appendVarint(requestBytes, uint64(len([]byte(target.Authority))))
		requestBytes = append(requestBytes, []byte(target.Authority)...)
		requestBytes = appendVarint(requestBytes, 34)
		requestBytes = appendVarint(requestBytes, uint64(len([]byte(service))))
		requestBytes = append(requestBytes, []byte(service)...)
		return map[string]any{"version": version, "stream": stream, "requestKind": "file-containing-symbol", "requestValue": service, "host": target.Authority, "requestBase64": base64.StdEncoding.EncodeToString(requestBytes), "openedAtNs": clock.String(), "deadlineNs": deadlineValue, "requestHeaders": headers}, nil
	}
	consume := func(version string, stream int) (semanticModel, string, error) {
		req, e := request(version, stream)
		if e != nil {
			return semanticModel{}, "", e
		}
		reflection = append(reflection, req)
		if cursor >= len(s.Given.Peer.Events) || (s.Given.Peer.Events[cursor].Type != "reflection-message" && s.Given.Peer.Events[cursor].Type != "reflection-status") {
			return semanticModel{}, "transport", nil
		}
		event := s.Given.Peer.Events[cursor]
		cursor++
		if event.ReflectionVersion != version || event.Stream != stream {
			return semanticModel{}, "", fmt.Errorf("reflection correlation")
		}
		elapsed, _ := new(big.Int).SetString(event.ElapsedNs, 10)
		clock.Add(clock, elapsed)
		if deadline != nil && clock.Cmp(deadline) >= 0 {
			return semanticModel{}, "deadline", nil
		}
		if event.Type == "reflection-status" {
			if event.RPCStatus == 12 {
				return semanticModel{}, "fallback", nil
			}
			return semanticModel{}, "protocol", nil
		}
		service := strings.Split(s.Given.Binding.Selector, "/")[0]
		if event.OriginalRequest.Kind != "file-containing-symbol" || event.OriginalRequest.Value != service || event.OriginalRequest.Host != target.Authority {
			return semanticModel{}, "", fmt.Errorf("reflection message correlation")
		}
		if event.Compressed {
			return semanticModel{}, "protocol", nil
		}
		data, e := canonicalBase64(event.MessageBase64)
		if e != nil {
			return semanticModel{}, "protocol", nil
		}
		decoded, e := decodeReflectionResponse(data)
		if e != nil {
			return semanticModel{}, "protocol", nil
		}
		if decoded.ValidHost != event.ValidHost || decoded.OriginalKind != event.OriginalRequest.Kind || decoded.OriginalValue != event.OriginalRequest.Value || decoded.OriginalHost != event.OriginalRequest.Host || decoded.ResponseKind != event.ResponseKind {
			return semanticModel{}, "", fmt.Errorf("reflection raw/normalized mismatch")
		}
		if decoded.ResponseKind == "error-response" {
			if event.ErrorResponse == nil || decoded.ErrorCode != event.ErrorResponse.ErrorCode || decoded.ErrorMessage != event.ErrorResponse.ErrorMessage {
				return semanticModel{}, "", fmt.Errorf("reflection error response mismatch")
			}
			return semanticModel{}, "protocol", nil
		}
		if decoded.ResponseKind == "list-services-response" {
			if !jsonEqual(decoded.ServiceList, event.ServiceList) {
				return semanticModel{}, "", fmt.Errorf("reflection service list mismatch")
			}
			return semanticModel{}, "protocol", nil
		}
		return decoded.Model, "model", nil
	}
	model, kind, err := consume("v1", 0)
	if err != nil {
		return semanticModel{}, nil, 0, nil, err
	}
	if kind == "fallback" {
		model, kind, err = consume("v1alpha", 1)
		if err != nil {
			return semanticModel{}, nil, 0, nil, err
		}
	}
	native := emptyNative()
	native["reflection"] = reflection
	if kind == "deadline" {
		native["cancellations"] = 1
		return semanticModel{}, native, cursor, terminalActual("refusal", "resolution", "deadline", native, []map[string]any{{"event": "cancelled", "cause": "deadline"}}), nil
	}
	if kind != "model" {
		return semanticModel{}, native, cursor, terminalActual("error", "resolution", kind, native, nil), nil
	}
	return model, native, cursor, nil, nil
}

func executeSemantic(s semanticScenario) (map[string]any, error) {
	config := s.Given.Configuration
	if metadataCollision(config.Metadata) {
		return terminalActual("refusal", "pre-dispatch", "configuration", nil, nil), nil
	}
	var model semanticModel
	var native map[string]any
	cursor := 0
	var failure map[string]any
	var err error
	if len(s.Given.Source.Content) == 0 || string(s.Given.Source.Content) == "null" {
		model, native, cursor, failure, err = resolveReflection(s)
		if err != nil {
			return nil, err
		}
		if failure != nil {
			return failure, nil
		}
	} else {
		model, err = loadModel(s.Given.Source.Content)
		if err != nil {
			return terminalActual("refusal", "load", "configuration", nil, nil), nil
		}
		native = emptyNative()
	}
	method, err := selected(model, s.Given.Binding.Selector)
	if err != nil {
		if len(s.Given.Source.Content) == 0 || string(s.Given.Source.Content) == "null" {
			return terminalActual("error", "resolution", "protocol", native, nil), nil
		}
		return terminalActual("refusal", "resolution", "configuration", native, nil), nil
	}
	if method.ClientStreaming && s.Given.Invocation.InputPresent {
		return terminalActual("refusal", "pre-dispatch", "configuration", native, nil), nil
	}
	target, err := parseTarget(s.Given.Source.Location, config.Transport)
	if err != nil {
		return terminalActual("refusal", "pre-dispatch", "configuration", native, nil), nil
	}
	tls := config.TLS
	_, hasCert := tls["clientCertificateSha256"]
	_, hasKey := tls["clientPrivateKeySha256"]
	serverName, _ := tls["serverName"].(string)
	if (target.Transport == "plaintext" && len(tls) > 0) || (hasCert != hasKey) || (serverName != "" && !admittedServerName(serverName)) {
		return terminalActual("refusal", "pre-dispatch", "configuration", native, nil), nil
	}
	timeout := ""
	if config.TimeoutNs != "" {
		timeout, err = timeoutHeader(config.TimeoutNs)
		if err != nil {
			return terminalActual("refusal", "pre-dispatch", "configuration", native, nil), nil
		}
	}
	headers := []map[string]any{
		{"name": ":method", "values": []string{"POST"}},
		{"name": ":scheme", "values": []string{map[bool]string{true: "https", false: "http"}[target.Transport == "tls"]}},
		{"name": ":authority", "values": []string{target.Authority}},
		{"name": ":path", "values": []string{"/" + s.Given.Binding.Selector}},
		{"name": "te", "values": []string{"trailers"}},
		{"name": "content-type", "values": []string{"application/grpc+proto"}},
		{"name": "grpc-accept-encoding", "values": []string{"gzip"}},
	}
	if config.Compression == "gzip" {
		headers = append(headers, map[string]any{"name": "grpc-encoding", "values": []string{"gzip"}})
	}
	if timeout != "" {
		headers = append(headers, map[string]any{"name": "grpc-timeout", "values": []string{timeout}})
	}
	metadata, err := metadataHeaders(config.Metadata)
	if err != nil {
		return terminalActual("refusal", "pre-dispatch", "configuration", native, nil), nil
	}
	headers = append(headers, metadata...)
	native["requestHeaders"] = headers
	native["requestMessages"] = []map[string]any{}
	if s.Given.Peer.MetadataMeasurement != nil {
		native["metadataMeasurement"] = map[string]any{"algorithm": s.Given.Peer.MetadataMeasurement.Algorithm, "requestBytes": s.Given.Peer.MetadataMeasurement.RequestBytes}
	}
	events := s.Given.Peer.Events[cursor:]
	peerCursor := 0
	timeline := []map[string]any{}
	facts := map[string]bool{"start": true}
	var connection *semanticPeer
	if len(events) > 0 && events[0].Type == "connection-outcome" {
		connection = &events[0]
		peerCursor++
		if !connection.Success {
			return terminalActual("error", "dispatch", connection.FailureCause, emptyNative(), nil), nil
		}
		timeline = append(timeline, map[string]any{"event": "channel-ready"})
		facts["channel-ready"] = true
		identity := target.Hostname
		if serverName != "" {
			identity = serverName
		}
		var sni any = identity
		if net.ParseIP(identity) != nil {
			sni = nil
		}
		channel := map[string]any{"transport": target.Transport, "dialAuthority": target.Authority, "httpAuthority": target.Authority}
		if target.Transport == "tls" {
			channel["tlsVersion"] = "1.3"
			channel["alpn"] = "h2"
			channel["sni"] = sni
			channel["peerCertificateSha256"] = "f1fedc36f62ae3335c39f3e2de1b5719ed4c8377f3c9ee7271ecbfff76c423fd"
			if hasCert {
				channel["clientCertificateSha256"] = tls["clientCertificateSha256"]
			}
		}
		native["channel"] = channel
	}
	var initial []byte
	if !method.ClientStreaming {
		value := s.Given.Invocation.Input
		if !s.Given.Invocation.InputPresent {
			value = map[string]any{}
		}
		initial, err = encodeMessage(model, method.Input, value)
		if err != nil {
			return terminalActual("refusal", "pre-dispatch", "conversion", emptyNative(), nil), nil
		}
		if config.Limits.MaxOutbound != nil && len(initial) > *config.Limits.MaxOutbound {
			return terminalActual("refusal", "pre-dispatch", "limit", emptyNative(), nil), nil
		}
	}
	timeline = append(timeline, map[string]any{"event": "rpc-opened"})
	facts["rpc-opened"] = true
	if s.Given.Peer.MetadataMeasurement != nil && config.Limits.MaxMetadata != nil && s.Given.Peer.MetadataMeasurement.RequestBytes > *config.Limits.MaxMetadata {
		native["requestHeaders"] = []map[string]any{}
		native["cancellations"] = 1
		timeline = append(timeline, map[string]any{"event": "cancelled", "cause": "limit"})
		return terminalActual("error", "dispatch", "limit", native, timeline), nil
	}
	requestMessages := native["requestMessages"].([]map[string]any)
	halfClosed := false
	if !method.ClientStreaming {
		value := s.Given.Invocation.Input
		if !s.Given.Invocation.InputPresent {
			value = map[string]any{}
		}
		message, evidenceErr := requestEvidence(initial, value, config.Compression)
		if evidenceErr != nil {
			return nil, evidenceErr
		}
		requestMessages = append(requestMessages, message)
		timeline = append(timeline, map[string]any{"event": "request-message", "index": 0}, map[string]any{"event": "input-half-closed"})
		facts["request-half-closed"] = true
		halfClosed = true
	}
	actionCursor, inputIndex, outputIndex := -1, 0, 0
	cancelled := false
	terminalCause, terminalDisposition, terminalPhase := "", "", "completion"
	statusCode := -1
	pendingHTTP := -1
	wire := []byte{}
	responseEncoding := "identity"
	responseDecodable := false
	responseStarted := false
	undecodableData := false
	elapsed := new(big.Int)
	grpcMessages := []string{}
	statusEvidence := []map[string]any{}
	ready := func(after semanticAfter) bool {
		if after.Start {
			return true
		}
		if after.Action != nil {
			return actionCursor >= *after.Action
		}
		return after.Native != "" && facts[after.Native]
	}
	commitStatus := func(code int, phase string) {
		statusCode = code
		timeline = append(timeline, map[string]any{"event": "final-status", "code": code})
		terminalCause = "status"
		if code == 0 {
			terminalDisposition = "complete"
		} else {
			terminalDisposition = "error"
		}
		terminalPhase = phase
	}
	commitHeaderStatus := func(headers []semanticHeader, phase string) {
		statuses := headerValues(headers, "grpc-status")
		messages := headerValues(headers, "grpc-message")
		grpcMessages = append(grpcMessages, messages...)
		details := headerValues(headers, "grpc-status-details-bin")
		parsed := []map[string]any{}
		for _, raw := range details {
			parsed = append(parsed, decodeStatusDetails(raw))
		}
		statusEvidence = append(statusEvidence, parsed...)
		if len(statuses) != 1 || !regexp.MustCompile(`^(?:0|[1-9][0-9]*)$`).MatchString(statuses[0]) {
			terminalCause, terminalDisposition, terminalPhase = "protocol", "error", phase
			return
		}
		rawCode, _ := new(big.Int).SetString(statuses[0], 10)
		code := 2
		if rawCode.Cmp(big.NewInt(16)) <= 0 {
			code = int(rawCode.Int64())
		}
		commitStatus(code, phase)
		if len(messages) > 1 {
			terminalCause, terminalDisposition = "protocol", "error"
		}
		if code == 0 && undecodableData {
			terminalCause, terminalDisposition = "protocol", "error"
		}
		if len(details) > 0 {
			invalid := len(details) != 1 || len(parsed) != 1 || parsed[0]["decoded"] != true || rawCode.Sign() == 0
			if len(parsed) == 1 {
				if present, _ := parsed[0]["codePresent"].(bool); present {
					switch value := parsed[0]["code"].(type) {
					case int32:
						invalid = invalid || rawCode.Cmp(big.NewInt(int64(value))) != 0
					case float64:
						invalid = invalid || rawCode.Cmp(big.NewInt(int64(value))) != 0
					}
				}
			}
			if invalid {
				terminalCause, terminalDisposition = "protocol", "error"
			}
		}
	}
	peer := func(event semanticPeer) error {
		if cancelled || terminalCause != "" {
			return fmt.Errorf("peer after terminal")
		}
		switch event.Type {
		case "response-headers":
			if responseStarted {
				terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
				break
			}
			responseStarted = true
			if !legalResponseHeaderBlock(event.Headers, false) {
				terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
				break
			}
			http := headerValues(event.Headers, ":status")
			if len(http) != 1 || !regexp.MustCompile(`^[0-9]{3}$`).MatchString(http[0]) {
				terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
				break
			}
			statuses := headerValues(event.Headers, "grpc-status")
			if len(statuses) > 0 {
				metadata, metadataErr := inboundMetadata(event.Headers, true)
				if metadataErr != nil {
					terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
					break
				}
				native["trailingMetadata"] = metadata
				pendingHTTP = -1
				if !event.EndStream {
					terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
				} else {
					commitHeaderStatus(event.Headers, "response")
				}
				break
			}
			metadata, metadataErr := inboundMetadata(event.Headers, false)
			if metadataErr != nil {
				terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
				break
			}
			native["leadingMetadata"] = metadata
			if len(headerValues(event.Headers, "grpc-message")) > 0 || len(headerValues(event.Headers, "grpc-status-details-bin")) > 0 {
				grpcMessages = append(grpcMessages, headerValues(event.Headers, "grpc-message")...)
				for _, raw := range headerValues(event.Headers, "grpc-status-details-bin") {
					statusEvidence = append(statusEvidence, decodeStatusDetails(raw))
				}
				terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
				break
			}
			types := headerValues(event.Headers, "content-type")
			validType := len(types) == 1 && (strings.EqualFold(types[0], "application/grpc") || strings.EqualFold(types[0], "application/grpc+proto"))
			if http[0] != "200" || !validType {
				responseDecodable = false
				code := 0
				if len(http) == 1 {
					code, _ = strconv.Atoi(http[0])
				}
				pendingHTTP = httpStatus(code)
				if event.EndStream {
					commitStatus(pendingHTTP, "response")
				}
				break
			}
			responseDecodable = true
			encodings := headerValues(event.Headers, "grpc-encoding")
			if len(encodings) > 1 || (len(encodings) == 1 && encodings[0] != "identity" && encodings[0] != "gzip") {
				terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
			} else if event.EndStream {
				terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
			} else if len(encodings) == 1 {
				responseEncoding = encodings[0]
			}
		case "data":
			if !responseStarted {
				terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
				break
			}
			chunk, e := canonicalBase64(event.DataBase64)
			if e != nil {
				return e
			}
			if !responseDecodable {
				if len(chunk) > 0 {
					undecodableData = true
				}
				if event.EndStream && pendingHTTP >= 0 {
					commitStatus(pendingHTTP, "response")
				}
				break
			}
			wire = append(wire, chunk...)
			for len(wire) >= 5 && terminalCause == "" {
				compressed := wire[0]
				length := int(binary.BigEndian.Uint32(wire[1:5]))
				if compressed != 0 && compressed != 1 {
					terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
					wire = nil
					break
				}
				if len(wire) < 5+length {
					break
				}
				payload := append([]byte{}, wire[5:5+length]...)
				wire = wire[5+length:]
				if compressed == 1 {
					if responseEncoding != "gzip" {
						terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
						break
					}
					source := bytes.NewReader(payload)
					reader, e := gzip.NewReader(source)
					if e != nil {
						terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
						break
					}
					reader.Multistream(false)
					payload, e = io.ReadAll(reader)
					reader.Close()
					if e != nil || source.Len() != 0 {
						terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
						break
					}
				}
				if config.Limits.MaxInbound != nil && len(payload) > *config.Limits.MaxInbound {
					terminalCause, terminalDisposition, terminalPhase = "limit", "error", "response"
					cancelled = true
					break
				}
				value, e := decodeMessage(model, method.Output, payload)
				if e != nil {
					terminalCause, terminalDisposition, terminalPhase = "conversion", "error", "response"
					break
				}
				timeline = append(timeline, map[string]any{"event": "output", "index": outputIndex, "valueJson": jsonText(value)})
				facts[fmt.Sprintf("output-%d", outputIndex)] = true
				outputIndex++
			}
			if event.EndStream && terminalCause == "" {
				if len(wire) > 0 {
					terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
				} else if pendingHTTP >= 0 {
					commitStatus(pendingHTTP, "response")
				} else {
					terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
				}
			}
		case "trailers":
			if !responseStarted {
				terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
				break
			}
			if !legalResponseHeaderBlock(event.Headers, true) {
				terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "completion"
				break
			}
			metadata, metadataErr := inboundMetadata(event.Headers, true)
			if metadataErr != nil {
				terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "completion"
				break
			}
			native["trailingMetadata"] = metadata
			if len(headerValues(event.Headers, "grpc-status")) > 0 {
				pendingHTTP = -1
				commitHeaderStatus(event.Headers, "completion")
			} else if pendingHTTP >= 0 {
				commitStatus(pendingHTTP, "completion")
			} else {
				terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "completion"
			}
		case "transport-close":
			terminalCause, terminalDisposition, terminalPhase = "transport", "error", "response"
		case "rst-stream":
			terminalCause, terminalDisposition, terminalPhase = "protocol", "error", "response"
		case "goaway":
			if !event.CurrentRPC {
				terminalCause, terminalDisposition, terminalPhase = "transport", "error", "response"
			}
		}
		return nil
	}
	drain := func() error { return nil }
	drain = func() error {
		for peerCursor < len(events) && terminalCause == "" && ready(events[peerCursor].After) {
			if err := peer(events[peerCursor]); err != nil {
				return err
			}
			peerCursor++
		}
		return nil
	}
	if err := drain(); err != nil {
		return nil, err
	}
	for index, action := range s.Given.Invocation.Actions {
		actionCursor = index
		switch action.Type {
		case "write":
			if cancelled {
				timeline = append(timeline, map[string]any{"event": "input-rejected", "action": index})
			} else if halfClosed || terminalCause != "" {
				timeline = append(timeline, map[string]any{"event": "action-failed", "action": index, "cause": "closed"})
			} else {
				payload, e := encodeMessage(model, method.Input, action.Value)
				if e != nil {
					timeline = append(timeline, map[string]any{"event": "action-failed", "action": index, "cause": "conversion"})
					timeline = append(timeline, map[string]any{"event": "cancelled", "cause": "conversion"})
					cancelled = true
					terminalCause, terminalDisposition = "conversion", "error"
				} else if config.Limits.MaxOutbound != nil && len(payload) > *config.Limits.MaxOutbound {
					timeline = append(timeline, map[string]any{"event": "action-failed", "action": index, "cause": "limit"})
					timeline = append(timeline, map[string]any{"event": "cancelled", "cause": "limit"})
					cancelled = true
					terminalCause, terminalDisposition = "limit", "error"
				} else {
					timeline = append(timeline, map[string]any{"event": "input-accepted", "action": index, "index": inputIndex})
					message, evidenceErr := requestEvidence(payload, action.Value, config.Compression)
					if evidenceErr != nil {
						return nil, evidenceErr
					}
					requestMessages = append(requestMessages, message)
					timeline = append(timeline, map[string]any{"event": "request-message", "index": inputIndex})
					inputIndex++
				}
			}
		case "half-close":
			if cancelled || terminalCause != "" || halfClosed {
				timeline = append(timeline, map[string]any{"event": "action-failed", "action": index, "cause": "closed"})
			} else {
				halfClosed = true
				timeline = append(timeline, map[string]any{"event": "input-half-closed", "action": index})
				facts["request-half-closed"] = true
			}
		case "cancel":
			if !cancelled && terminalCause == "" {
				cancelled = true
				timeline = append(timeline, map[string]any{"event": "cancelled", "action": index, "cause": "caller"})
			} else {
				timeline = append(timeline, map[string]any{"event": "action-failed", "action": index, "cause": "closed"})
			}
		case "await-output":
			if outputIndex <= action.Index {
				return nil, fmt.Errorf("await output")
			}
		case "await-native":
			if !facts[action.Name] {
				return nil, fmt.Errorf("await native")
			}
		case "advance-clock":
			if config.TimeoutNs != "" {
				advance, _ := new(big.Int).SetString(action.Nanoseconds, 10)
				elapsed.Add(elapsed, advance)
				timeout, _ := new(big.Int).SetString(config.TimeoutNs, 10)
				if elapsed.Cmp(timeout) >= 0 && terminalCause == "" {
					cancelled = true
					terminalCause, terminalDisposition = "deadline", "error"
					timeline = append(timeline, map[string]any{"event": "cancelled", "cause": "deadline"})
				}
			}
		}
		if err := drain(); err != nil {
			return nil, err
		}
	}
	if err := drain(); err != nil {
		return nil, err
	}
	if peerCursor < len(events) {
		if terminalCause != "" {
			return nil, fmt.Errorf("peer effect after terminal or end of stream")
		}
		return nil, fmt.Errorf("causal cycle")
	}
	if cancelled && terminalCause == "" {
		terminalCause, terminalDisposition = "caller", "error"
	}
	if terminalCause == "" {
		terminalCause, terminalDisposition = "transport", "error"
	}
	if terminalCause == "status" && statusCode == 0 && !method.ServerStreaming && outputIndex != 1 {
		terminalCause, terminalDisposition = "protocol", "error"
	}
	if terminalCause == "limit" && cancelled {
		found := false
		for _, event := range timeline {
			if event["event"] == "cancelled" {
				found = true
			}
		}
		if !found {
			timeline = append(timeline, map[string]any{"event": "cancelled", "cause": "limit"})
		}
	}
	timeline = append(timeline, map[string]any{"event": "terminal", "disposition": terminalDisposition, "cause": terminalCause})
	native["requestMessages"] = requestMessages
	cancellations := 0
	for _, event := range timeline {
		if event["event"] == "cancelled" {
			cancellations++
		}
	}
	native["cancellations"] = cancellations
	if len(grpcMessages) > 0 {
		native["grpcMessageRaw"] = grpcMessages
	}
	if len(statusEvidence) > 0 {
		native["statusDetails"] = statusEvidence
	}
	return map[string]any{"disposition": terminalDisposition, "phase": terminalPhase, "timeline": timeline, "native": native, "context": map[string]any{}}, nil
}

func subsetMaps(expected []map[string]any, actual any) bool {
	values, ok := actual.([]map[string]any)
	if !ok {
		return len(expected) == 0
	}
	for _, want := range expected {
		found := false
		for _, candidate := range values {
			if objectSubset(want, candidate) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}
func orderedSubsetMaps(expected []map[string]any, actual any) bool {
	values, ok := actual.([]map[string]any)
	if !ok || len(expected) != len(values) {
		return false
	}
	for index, want := range expected {
		if !objectSubset(want, values[index]) {
			return false
		}
	}
	return true
}
func completeReflectionExpectation(want map[string]any, scenario semanticScenario) (map[string]any, error) {
	target, err := parseTarget(scenario.Given.Source.Location, scenario.Given.Configuration.Transport)
	if err != nil {
		return nil, err
	}
	host, _ := want["host"].(string)
	version, _ := want["version"].(string)
	requestValue, _ := want["requestValue"].(string)
	headers := []any{
		map[string]any{"name": ":method", "values": []string{"POST"}},
		map[string]any{"name": ":scheme", "values": []string{map[bool]string{true: "https", false: "http"}[target.Transport == "tls"]}},
		map[string]any{"name": ":authority", "values": []string{host}},
		map[string]any{"name": ":path", "values": []string{fmt.Sprintf("/grpc.reflection.%s.ServerReflection/ServerReflectionInfo", version)}},
		map[string]any{"name": "te", "values": []string{"trailers"}},
		map[string]any{"name": "content-type", "values": []string{"application/grpc+proto"}},
	}
	if extras, ok := genericValue(want["requestHeaders"]).([]any); ok {
		headers = append(headers, extras...)
	}
	requestBytes := appendVarint(nil, 10)
	requestBytes = appendVarint(requestBytes, uint64(len([]byte(host))))
	requestBytes = append(requestBytes, []byte(host)...)
	requestBytes = appendVarint(requestBytes, 34)
	requestBytes = appendVarint(requestBytes, uint64(len([]byte(requestValue))))
	requestBytes = append(requestBytes, []byte(requestValue)...)
	complete, _ := genericValue(want).(map[string]any)
	complete["requestBase64"] = base64.StdEncoding.EncodeToString(requestBytes)
	complete["requestHeaders"] = headers
	return complete, nil
}
func reflectionExactMaps(expected []map[string]any, actual any, scenario semanticScenario) bool {
	values, ok := actual.([]map[string]any)
	if !ok || len(expected) != len(values) {
		return false
	}
	for index, want := range expected {
		complete, err := completeReflectionExpectation(want, scenario)
		if err != nil || !jsonEqual(complete, values[index]) {
			return false
		}
	}
	return true
}
func nativeTimelineBound(actual map[string]any) bool {
	timeline, ok := actual["timeline"].([]map[string]any)
	if !ok {
		return false
	}
	native, ok := actual["native"].(map[string]any)
	if !ok {
		return false
	}
	messages, ok := native["requestMessages"].([]map[string]any)
	if !ok {
		return false
	}
	index := 0
	for _, event := range timeline {
		if event["event"] != "request-message" {
			continue
		}
		if !jsonEqual(event["index"], index) {
			return false
		}
		index++
	}
	return index == len(messages)
}
func genericValue(value any) any {
	raw, _ := json.Marshal(value)
	var out any
	_ = json.Unmarshal(raw, &out)
	return out
}
func objectSubset(expected any, actual any) bool {
	switch want := expected.(type) {
	case map[string]any:
		candidate, ok := actual.(map[string]any)
		if !ok {
			return false
		}
		for key, value := range want {
			got, present := candidate[key]
			if !present || !objectSubset(value, got) {
				return false
			}
		}
		return true
	default:
		return jsonEqual(expected, actual)
	}
}
func pointer(root any, path string) (any, bool) {
	value := root
	for _, token := range strings.Split(strings.TrimPrefix(path, "/"), "/") {
		token = strings.ReplaceAll(strings.ReplaceAll(token, "~1", "/"), "~0", "~")
		switch current := value.(type) {
		case map[string]any:
			var ok bool
			value, ok = current[token]
			if !ok {
				return nil, false
			}
		case []map[string]any:
			index, err := strconv.Atoi(token)
			if err != nil || index < 0 || index >= len(current) {
				return nil, false
			}
			value = current[index]
		case []any:
			index, err := strconv.Atoi(token)
			if err != nil || index < 0 || index >= len(current) {
				return nil, false
			}
			value = current[index]
		case []string:
			index, err := strconv.Atoi(token)
			if err != nil || index < 0 || index >= len(current) {
				return nil, false
			}
			value = current[index]
		default:
			return nil, false
		}
	}
	return value, true
}
func assertionMatches(root map[string]any, assertion map[string]any) bool {
	path, _ := assertion["path"].(string)
	value, present := pointer(root, path)
	if absent, _ := assertion["absent"].(bool); absent {
		return !present
	}
	if !present {
		return false
	}
	if expected, ok := assertion["equals"]; ok {
		return jsonEqual(value, expected)
	}
	needle, contains := assertion["contains"]
	if !contains {
		needle = assertion["notContains"]
	}
	included := false
	switch current := value.(type) {
	case []map[string]any:
		for _, entry := range current {
			if jsonEqual(entry, needle) {
				included = true
			}
		}
	case []any:
		for _, entry := range current {
			if jsonEqual(entry, needle) {
				included = true
			}
		}
	case string:
		text, _ := needle.(string)
		included = strings.Contains(current, text)
	}
	if contains {
		return included
	}
	return !included
}
func compareSemantic(s semanticScenario, actual map[string]any) error {
	if !nativeTimelineBound(actual) {
		return fmt.Errorf("native request messages are not bound to the ordered timeline")
	}
	for _, expected := range s.Expected {
		if expected.Disposition != actual["disposition"] || expected.Phase != actual["phase"] || !jsonEqual(expected.Timeline, actual["timeline"]) {
			continue
		}
		native := actual["native"].(map[string]any)
		if !subsetMaps(expected.Native.RequestHeaders, native["requestHeaders"]) || !orderedSubsetMaps(expected.Native.RequestMessages, native["requestMessages"]) || !reflectionExactMaps(expected.Native.Reflection, native["reflection"], s) || !jsonEqual(expected.Native.Cancellations, native["cancellations"]) {
			continue
		}
		if expected.Native.Channel != nil && !jsonEqual(expected.Native.Channel, native["channel"]) {
			continue
		}
		if len(expected.Native.GrpcMessageRaw) > 0 && !jsonEqual(expected.Native.GrpcMessageRaw, native["grpcMessageRaw"]) {
			continue
		}
		if len(expected.Native.StatusDetails) > 0 && !jsonEqual(expected.Native.StatusDetails, native["statusDetails"]) {
			continue
		}
		if expected.Native.MetadataMeasurement != nil && !jsonEqual(map[string]any{"algorithm": expected.Native.MetadataMeasurement.Algorithm, "requestBytes": expected.Native.MetadataMeasurement.RequestBytes}, native["metadataMeasurement"]) {
			continue
		}
		if len(expected.Native.LeadingMetadata) > 0 && !jsonEqual(expected.Native.LeadingMetadata, native["leadingMetadata"]) {
			continue
		}
		if len(expected.Native.TrailingMetadata) > 0 && !jsonEqual(expected.Native.TrailingMetadata, native["trailingMetadata"]) {
			continue
		}
		matched := true
		for _, assertion := range expected.Assertions {
			copy := map[string]any{}
			for key, value := range assertion {
				copy[key] = value
			}
			path, _ := copy["path"].(string)
			match := regexp.MustCompile(`^/native/requestHeaders/(\d+)(/.*)?$`).FindStringSubmatch(path)
			if match != nil {
				index, _ := strconv.Atoi(match[1])
				if index < len(expected.Native.RequestHeaders) {
					name, _ := expected.Native.RequestHeaders[index]["name"].(string)
					if actualHeaders, ok := native["requestHeaders"].([]map[string]any); ok {
						for actualIndex, header := range actualHeaders {
							if header["name"] == name {
								copy["path"] = fmt.Sprintf("/native/requestHeaders/%d%s", actualIndex, match[2])
								break
							}
						}
					}
				}
			}
			if !assertionMatches(map[string]any{"native": native, "context": actual["context"]}, copy) {
				matched = false
				break
			}
		}
		if matched {
			return nil
		}
	}
	return fmt.Errorf("no expected alternative")
}
func main() {
	if len(os.Args) != 2 {
		semanticFail("usage: go run semantic.go <grpc.json>")
	}
	raw, err := os.ReadFile(os.Args[1])
	if err != nil {
		semanticFail("read: %v", err)
	}
	strictDocument, err := parseStrictLosslessJSON(raw)
	if err != nil {
		semanticFail("JSON: %v", err)
	}
	var corpus semanticCorpus
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if decoder.Decode(&corpus) != nil {
		semanticFail("JSON")
	}
	if scenariosValue, ok := orderedObjectValue(strictDocument, "scenarios"); ok {
		if strictScenarios, ok := scenariosValue.([]any); ok && len(strictScenarios) == len(corpus.Scenarios) {
			for index, strictScenario := range strictScenarios {
				given, _ := orderedObjectValue(strictScenario, "given")
				invocation, _ := orderedObjectValue(given, "invocation")
				if input, present := orderedObjectValue(invocation, "input"); present {
					corpus.Scenarios[index].Given.Invocation.Input = input
				}
				if actionsValue, present := orderedObjectValue(invocation, "actions"); present {
					if actions, ok := actionsValue.([]any); ok && len(actions) == len(corpus.Scenarios[index].Given.Invocation.Actions) {
						for actionIndex, action := range actions {
							if value, present := orderedObjectValue(action, "value"); present {
								corpus.Scenarios[index].Given.Invocation.Actions[actionIndex].Value = value
							}
						}
					}
				}
			}
		}
	}
	results := []map[string]any{}
	for _, scenario := range corpus.Scenarios {
		actual, err := executeSemantic(scenario)
		if err != nil {
			semanticFail("%s: %v", scenario.ID, err)
		}
		if err = compareSemantic(scenario, actual); err != nil {
			semanticFail("%s: %v %s", scenario.ID, err, jsonText(actual))
		}
		results = append(results, map[string]any{"id": scenario.ID, "disposition": actual["disposition"], "phase": actual["phase"], "timeline": actual["timeline"], "native": actual["native"]})
	}
	digest := sha256.Sum256(raw)
	encoded, _ := json.Marshal(map[string]any{"format": "openbindings.grpc-semantic-runner-result@1", "runtime": "go", "corpusSha256": hex.EncodeToString(digest[:]), "scenarioCount": len(results), "results": results})
	fmt.Println(string(encoded))
}
