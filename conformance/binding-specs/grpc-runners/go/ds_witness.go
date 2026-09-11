package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
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

type dCorpus struct {
	Rule  string  `json:"rule"`
	Tests []dTest `json:"tests"`
}

type dTest struct {
	Description string         `json:"description"`
	Document    map[string]any `json:"document"`
	Valid       bool           `json:"valid"`
}

type synthesisCorpus struct {
	Format    string     `json:"format"`
	Scenarios []scenario `json:"scenarios"`
}

type scenario struct {
	Source    map[string]any `json:"source"`
	Discovery map[string]any `json:"discovery"`
	Expected  map[string]any `json:"expected"`
}

type methodInfo struct {
	Selector string
	Input    string
	Output   string
}

type messageInfo struct {
	File   string
	Name   string
	Fields []*descriptorpb.FieldDescriptorProto
	Proto  *descriptorpb.DescriptorProto
}

type enumInfo struct {
	File        string
	Name        string
	InputNames  []string
	OutputNames []string
	Open        bool
}

type graph struct {
	Set          *descriptorpb.FileDescriptorSet
	Methods      []methodInfo
	Messages     map[string]messageInfo
	Enums        map[string]enumInfo
	FileExtendee map[string]bool
}

type summary struct {
	Format             string `json:"format"`
	DFiles             int    `json:"dFiles"`
	DTests             int    `json:"dTests"`
	SynthesisScenarios int    `json:"synthesisScenarios"`
	Operations         int    `json:"operations"`
	Bindings           int    `json:"bindings"`
	CoverageEntries    int    `json:"coverageEntries"`
	SchemaAssertions   int    `json:"schemaAssertions"`
	SchemaInstances    int    `json:"schemaInstances"`
}

var ident = `[A-Za-z_][A-Za-z0-9_]*`
var selectorPattern = regexp.MustCompile(`^` + ident + `(?:\.` + ident + `)*/` + ident + `$`)

var allowedImports = []string{
	"google/protobuf/any.proto", "google/protobuf/api.proto",
	"google/protobuf/descriptor.proto", "google/protobuf/duration.proto",
	"google/protobuf/empty.proto", "google/protobuf/field_mask.proto",
	"google/protobuf/json_enumvalue_options.proto", "google/protobuf/json_options.proto",
	"google/protobuf/source_context.proto", "google/protobuf/struct.proto",
	"google/protobuf/timestamp.proto", "google/protobuf/type.proto",
	"google/protobuf/wrappers.proto",
}

var bootstrapRoot string
var bootstrapTypes *protoregistry.Types
var bootstrapFDS protoreflect.MessageDescriptor
var bootstrapEnumJSONExtension protoreflect.ExtensionType
var bootstrapErr error
var activeMutant string

func failf(format string, values ...any) {
	fmt.Fprintf(os.Stderr, "gRPC D/S Go witness: "+format+"\n", values...)
	os.Exit(1)
}

func main() {
	if len(os.Args) < 3 {
		failf("usage: go run ds_witness.go ROOT PROTOC_ROOT [MUTANT]")
	}
	root, protocRoot := os.Args[1], os.Args[2]
	mutant := ""
	if len(os.Args) > 3 {
		mutant = os.Args[3]
	}
	activeMutant = mutant
	if _, err := compileSource("syntax = \"proto3\"; import 'google/protobuf/cpp_features.proto'; message Probe {}", protocRoot); err == nil {
		failf("single-quoted import escaped the closed 13-file virtual root")
	}
	bootstrapProbe := map[string]any{"file": []any{map[string]any{
		"name": "enum.proto", "package": "demo", "syntax": "editions", "edition": "EDITION_2026",
		"enumType": []any{map[string]any{"name": "E", "value": []any{map[string]any{
			"name": "E_UNSPECIFIED", "number": json.Number("0"),
			"options": map[string]any{"[pb.enumvalue.json]": map[string]any{"string": "unspecified"}},
		}}}},
	}}}
	if _, err := descriptorFromValue(bootstrapProbe, protocRoot); err != nil {
		failf("exact Edition 2026 pb.enumvalue.json JSON-FDS bootstrap failed: %v", err)
	}

	dPaths, err := filepath.Glob(filepath.Join(root, "conformance/binding-specs/grpc/GRPC-D-*.json"))
	if err != nil || len(dPaths) == 0 {
		failf("cannot discover GRPC-D fixtures: %v", err)
	}
	sort.Strings(dPaths)
	result := summary{Format: "openbindings.grpc-ds-witness-result@1", DFiles: len(dPaths)}
	flipped := false
	for _, path := range dPaths {
		var corpus dCorpus
		readJSON(path, &corpus)
		for index, test := range corpus.Tests {
			actual, err := adjudicate(corpus.Rule, test.Document, protocRoot)
			if mutant == "flipped-d-validity" && !flipped {
				actual, flipped = !actual, true
			}
			if err != nil && actual {
				failf("%s test %d returned a successful verdict with error: %v", filepath.Base(path), index, err)
			}
			if actual != test.Valid {
				failf("%s test %d (%s): computed valid=%v, expected %v (%v)", filepath.Base(path), index, test.Description, actual, test.Valid, err)
			}
			result.DTests++
		}
	}

	var synth synthesisCorpus
	readJSON(filepath.Join(root, "conformance/binding-specs/synthesis/grpc.json"), &synth)
	if synth.Format != "openbindings.binding-spec-synthesis-scenarios@7" {
		failf("unexpected synthesis corpus format %q", synth.Format)
	}
	for index, item := range synth.Scenarios {
		actual, err := synthesize(item, protocRoot)
		if err != nil {
			failf("synthesis scenario %d: %v", index, err)
		}
		mutate(actual, mutant, index)
		if err := validateSynthesized(actual); err != nil {
			failf("synthesis scenario %d violates witness invariant: %v", index, err)
		}
		if err := compareExpected(actual, item.Expected); err != nil {
			failf("synthesis scenario %d: %v", index, err)
		}
		checked, err := validateSchemaInstances(actual, item.Expected["schemaInstances"])
		if err != nil {
			failf("synthesis scenario %d: %v", index, err)
		}
		result.SynthesisScenarios++
		result.Operations += len(actual["operations"].([]any))
		result.Bindings += len(actual["bindings"].([]any))
		coverage := actual["coverage"].(map[string]any)
		result.CoverageEntries += len(coverage["entries"].([]any))
		result.SchemaAssertions += len(assertionSlice(item.Expected["assertions"]))
		result.SchemaInstances += checked
	}
	encoded, _ := json.Marshal(result)
	fmt.Println(string(encoded))
}

func readJSON(path string, target any) {
	data, err := os.ReadFile(path)
	if err != nil {
		failf("read %s: %v", path, err)
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	if err := decoder.Decode(target); err != nil {
		failf("parse %s: %v", path, err)
	}
}

func adjudicate(rule string, document map[string]any, protocRoot string) (bool, error) {
	sources, ok := document["sources"].(map[string]any)
	if !ok || len(sources) == 0 {
		return false, errors.New("sources missing")
	}
	switch rule {
	case "GRPC-D-01":
		for _, raw := range sources {
			source := raw.(map[string]any)
			content, present := source["content"]
			if !present {
				continue
			}
			if _, err := descriptorFromValue(content, protocRoot); err != nil {
				return false, err
			}
		}
		return true, nil
	case "GRPC-D-02":
		for _, raw := range sources {
			source := raw.(map[string]any)
			location, ok := source["location"].(string)
			if !ok || !validLocation(location) {
				return false, errors.New("invalid location")
			}
		}
		return true, nil
	case "GRPC-D-03":
		bindings, ok := document["bindings"].(map[string]any)
		if !ok {
			return false, errors.New("bindings missing")
		}
		for _, raw := range bindings {
			binding := raw.(map[string]any)
			selector, ok := binding["selector"].(string)
			if !ok || !selectorPattern.MatchString(selector) {
				return false, errors.New("invalid selector grammar")
			}
			sourceName, _ := binding["source"].(string)
			rawSource, ok := sources[sourceName].(map[string]any)
			if !ok {
				return false, errors.New("binding source missing")
			}
			content, present := rawSource["content"]
			if !present {
				continue
			}
			set, err := descriptorFromValue(content, protocRoot)
			if err != nil {
				return false, err
			}
			g := buildGraph(set)
			found := false
			for _, method := range g.Methods {
				found = found || method.Selector == selector
			}
			if !found {
				return false, errors.New("selector unresolved")
			}
		}
		return true, nil
	case "GRPC-D-04":
		for _, raw := range sources {
			if raw.(map[string]any)["bindingSpec"] != "openbindings.grpc@1" {
				return false, errors.New("wrong bindingSpec")
			}
		}
		return true, nil
	default:
		return false, fmt.Errorf("unsupported rule %s", rule)
	}
}

func validLocation(value string) bool {
	if strings.HasPrefix(value, "grpc://") {
		value = strings.TrimPrefix(value, "grpc://")
	} else if strings.HasPrefix(value, "grpcs://") {
		value = strings.TrimPrefix(value, "grpcs://")
	} else if strings.Contains(value, "://") {
		return false
	}
	if strings.ContainsAny(value, "/?#@") {
		return false
	}
	bracketed := strings.HasPrefix(value, "[")
	host, port, err := net.SplitHostPort(value)
	if err != nil || host == "" || port == "" || (len(port) > 1 && port[0] == '0') {
		return false
	}
	p, err := strconv.Atoi(port)
	if err != nil || p < 1 || p > 65535 {
		return false
	}
	if ip := net.ParseIP(host); ip != nil {
		if ip.To4() != nil {
			return !bracketed
		}
		return bracketed
	}
	if strings.HasPrefix(value, "[") || len(host) > 253 {
		return false
	}
	labels := strings.Split(host, ".")
	for _, label := range labels {
		if len(label) < 1 || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, r := range label {
			if !(r >= 'A' && r <= 'Z') && !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9') && r != '-' {
				return false
			}
		}
	}
	return true
}

func descriptorFromValue(value any, protocRoot string) (*descriptorpb.FileDescriptorSet, error) {
	switch typed := value.(type) {
	case string:
		return compileSource(typed, protocRoot)
	case map[string]any:
		resolver, resolverErr := descriptorOptionResolver(protocRoot)
		if resolverErr != nil {
			return nil, resolverErr
		}
		if tagged, ok := typed["$fileDescriptorSet"]; ok {
			if len(typed) != 1 {
				return nil, errors.New("binary descriptor carrier has extra members")
			}
			text, ok := tagged.(string)
			if !ok {
				return nil, errors.New("binary descriptor is not a string")
			}
			data, err := base64.StdEncoding.Strict().DecodeString(text)
			if err != nil || base64.StdEncoding.EncodeToString(data) != text {
				return nil, errors.New("binary descriptor is not canonical padded Base64")
			}
			set, err := decodeExactDescriptorSet(data, false, resolver)
			if err != nil {
				return nil, fmt.Errorf("decode binary descriptor: %w", err)
			}
			return set, validateDescriptorSet(set)
		}
		data, err := json.Marshal(typed)
		if err != nil {
			return nil, err
		}
		set, err := decodeExactDescriptorSet(data, true, resolver)
		if err != nil {
			return nil, fmt.Errorf("strict descriptor JSON: %w", err)
		}
		return set, validateDescriptorSet(set)
	default:
		return nil, errors.New("content is neither source text nor descriptor object")
	}
}

func compileSource(source, protocRoot string) (*descriptorpb.FileDescriptorSet, error) {
	temp, err := os.MkdirTemp("", "openbindings-grpc-ds-go-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(temp)
	input, output := filepath.Join(temp, "source.proto"), filepath.Join(temp, "source.pb")
	if err := os.WriteFile(input, []byte(source), 0o600); err != nil {
		return nil, err
	}
	include := filepath.Join(protocRoot, "include")
	for _, name := range allowedImports {
		destination := filepath.Join(temp, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(destination), 0o700); err != nil {
			return nil, err
		}
		data, err := os.ReadFile(filepath.Join(include, filepath.FromSlash(name)))
		if err != nil {
			return nil, fmt.Errorf("read pinned allowlist member %s: %w", name, err)
		}
		if err := os.WriteFile(destination, data, 0o600); err != nil {
			return nil, err
		}
	}
	protoc := filepath.Join(protocRoot, "bin", "protoc")
	arguments := []string{"--proto_path=" + temp}
	if activeMutant == "single-quote-import-bypass" {
		arguments = append(arguments, "--proto_path="+include)
	}
	arguments = append(arguments, "--include_imports", "--descriptor_set_out="+output, "source.proto")
	cmd := exec.Command(protoc, arguments...)
	if raw, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("pinned protoc failed: %s", strings.TrimSpace(string(raw)))
	}
	data, err := os.ReadFile(output)
	if err != nil {
		return nil, err
	}
	set := &descriptorpb.FileDescriptorSet{}
	if err := proto.Unmarshal(data, set); err != nil {
		return nil, err
	}
	if activeMutant != "single-quote-import-bypass" {
		for _, file := range set.File {
			if file.GetName() != "source.proto" {
				continue
			}
			for _, dependency := range file.Dependency {
				if !allowedImport(dependency) {
					return nil, fmt.Errorf("import %q is outside the closed allowlist", dependency)
				}
			}
		}
	}
	return set, validateDescriptorSet(set)
}

func decodeExactDescriptorSet(data []byte, jsonForm bool, resolver *protoregistry.Types) (*descriptorpb.FileDescriptorSet, error) {
	if bootstrapFDS == nil {
		return nil, errors.New("exact FileDescriptorSet bootstrap is unavailable")
	}
	dynamic := dynamicpb.NewMessage(bootstrapFDS)
	var err error
	if jsonForm {
		err = (protojson.UnmarshalOptions{DiscardUnknown: false, Resolver: resolver}).Unmarshal(data, dynamic)
	} else {
		err = (proto.UnmarshalOptions{Resolver: resolver}).Unmarshal(data, dynamic)
	}
	if err != nil {
		return nil, err
	}
	binary, err := proto.Marshal(dynamic)
	if err != nil {
		return nil, err
	}
	set := &descriptorpb.FileDescriptorSet{}
	if err := (proto.UnmarshalOptions{Resolver: resolver}).Unmarshal(binary, set); err != nil {
		return nil, err
	}
	return set, nil
}

func allowedImport(name string) bool {
	for _, candidate := range allowedImports {
		if candidate == name {
			return true
		}
	}
	return false
}

func descriptorOptionResolver(protocRoot string) (*protoregistry.Types, error) {
	if bootstrapRoot == protocRoot {
		return bootstrapTypes, bootstrapErr
	}
	bootstrapRoot = protocRoot
	temp, err := os.MkdirTemp("", "openbindings-grpc-bootstrap-go-")
	if err != nil {
		bootstrapErr = err
		return nil, err
	}
	defer os.RemoveAll(temp)
	output := filepath.Join(temp, "bootstrap.pb")
	include := filepath.Join(protocRoot, "include")
	cmd := exec.Command(filepath.Join(protocRoot, "bin", "protoc"), "--proto_path="+include, "--include_imports", "--descriptor_set_out="+output, "google/protobuf/json_enumvalue_options.proto")
	if raw, commandErr := cmd.CombinedOutput(); commandErr != nil {
		bootstrapErr = fmt.Errorf("compile exact descriptor-option bootstrap: %s", strings.TrimSpace(string(raw)))
		return nil, bootstrapErr
	}
	data, err := os.ReadFile(output)
	if err != nil {
		bootstrapErr = err
		return nil, err
	}
	set := &descriptorpb.FileDescriptorSet{}
	if err := proto.Unmarshal(data, set); err != nil {
		bootstrapErr = err
		return nil, err
	}
	files, err := protodesc.NewFiles(set)
	if err != nil {
		bootstrapErr = err
		return nil, err
	}
	value, err := files.FindDescriptorByName("pb.enumvalue.json")
	if err != nil {
		bootstrapErr = err
		return nil, err
	}
	extension, ok := value.(protoreflect.ExtensionDescriptor)
	if !ok {
		bootstrapErr = errors.New("pb.enumvalue.json is not an extension descriptor")
		return nil, bootstrapErr
	}
	types := new(protoregistry.Types)
	extensionType := dynamicpb.NewExtensionType(extension)
	if err := types.RegisterExtension(extensionType); err != nil {
		bootstrapErr = err
		return nil, err
	}
	fds, err := files.FindDescriptorByName("google.protobuf.FileDescriptorSet")
	if err != nil {
		bootstrapErr = err
		return nil, err
	}
	message, ok := fds.(protoreflect.MessageDescriptor)
	if !ok {
		bootstrapErr = errors.New("google.protobuf.FileDescriptorSet is not a message descriptor")
		return nil, bootstrapErr
	}
	bootstrapFDS = message
	bootstrapEnumJSONExtension = extensionType
	bootstrapTypes = types
	return bootstrapTypes, nil
}

func validateDescriptorSet(set *descriptorpb.FileDescriptorSet) error {
	fileNames := map[string]bool{}
	for _, file := range set.File {
		if fileNames[file.GetName()] {
			return fmt.Errorf("duplicate descriptor filename %q", file.GetName())
		}
		fileNames[file.GetName()] = true
	}
	for _, file := range set.File {
		for _, dependency := range file.Dependency {
			if !fileNames[dependency] {
				return fmt.Errorf("missing descriptor dependency %q", dependency)
			}
		}
	}
	for _, file := range set.File {
		if int32(file.GetEdition()) > int32(descriptorpb.Edition_EDITION_2024) && int32(file.GetEdition()) < int32(descriptorpb.Edition_EDITION_UNSTABLE) {
			g := buildGraph(set)
			for _, method := range g.Methods {
				if _, ok := g.Messages[method.Input]; !ok {
					return fmt.Errorf("unresolved method input %q", method.Input)
				}
				if _, ok := g.Messages[method.Output]; !ok {
					return fmt.Errorf("unresolved method output %q", method.Output)
				}
			}
			return nil
		}
	}
	files := new(protoregistry.Files)
	remaining := append([]*descriptorpb.FileDescriptorProto(nil), set.File...)
	for len(remaining) > 0 {
		progress := false
		next := remaining[:0]
		for _, file := range remaining {
			descriptor, err := protodescNewFile(file, files)
			if err != nil {
				next = append(next, file)
				continue
			}
			if err := files.RegisterFile(descriptor); err != nil {
				return err
			}
			progress = true
		}
		if !progress {
			return errors.New("descriptor references cannot be resolved")
		}
		remaining = next
	}
	return nil
}

// Isolated to keep the witness's descriptor validation explicit.
func protodescNewFile(file *descriptorpb.FileDescriptorProto, files *protoregistry.Files) (protoreflect.FileDescriptor, error) {
	return protodesc.NewFile(file, files)
}

func buildGraph(set *descriptorpb.FileDescriptorSet) graph {
	g := graph{Set: set, Messages: map[string]messageInfo{}, Enums: map[string]enumInfo{}, FileExtendee: map[string]bool{}}
	for _, file := range set.File {
		prefix := file.GetPackage()
		for _, message := range file.MessageType {
			addMessage(&g, file.GetName(), prefix, message, file.GetSyntax())
		}
		for _, enum := range file.EnumType {
			addEnum(&g, file.GetName(), prefix, enum, file.GetSyntax())
		}
		for _, extension := range file.Extension {
			g.FileExtendee[strings.TrimPrefix(extension.GetExtendee(), ".")] = true
		}
		for _, service := range file.Service {
			serviceName := joinName(prefix, service.GetName())
			for _, method := range service.Method {
				g.Methods = append(g.Methods, methodInfo{
					Selector: serviceName + "/" + method.GetName(),
					Input:    strings.TrimPrefix(method.GetInputType(), "."),
					Output:   strings.TrimPrefix(method.GetOutputType(), "."),
				})
			}
		}
	}
	sort.Slice(g.Methods, func(i, j int) bool { return g.Methods[i].Selector < g.Methods[j].Selector })
	return g
}

func addMessage(g *graph, file, prefix string, message *descriptorpb.DescriptorProto, syntax string) {
	name := joinName(prefix, message.GetName())
	g.Messages[name] = messageInfo{File: file, Name: name, Fields: message.Field, Proto: message}
	for _, extension := range message.Extension {
		g.FileExtendee[strings.TrimPrefix(extension.GetExtendee(), ".")] = true
	}
	for _, enum := range message.EnumType {
		addEnum(g, file, name, enum, syntax)
	}
	for _, nested := range message.NestedType {
		addMessage(g, file, name, nested, syntax)
	}
}

func addEnum(g *graph, file, prefix string, enum *descriptorpb.EnumDescriptorProto, syntax string) {
	name := joinName(prefix, enum.GetName())
	inputNames := []string{}
	outputNames := []string{}
	seenNumber := map[int32]bool{}
	seenInput := map[string]bool{}
	for _, value := range enum.Value {
		ordinary := value.GetName()
		custom := enumJSONName(value.GetOptions())
		for _, candidate := range []string{ordinary, custom} {
			if candidate != "" && !seenInput[candidate] {
				inputNames = append(inputNames, candidate)
				seenInput[candidate] = true
			}
		}
		if !seenNumber[value.GetNumber()] {
			emitted := ordinary
			if custom != "" {
				emitted = custom
			}
			outputNames = append(outputNames, emitted)
			seenNumber[value.GetNumber()] = true
		}
	}
	sort.Strings(inputNames)
	sort.Strings(outputNames)
	open := syntax == "proto3" || syntax == "editions"
	if features := enum.GetOptions().GetFeatures(); features != nil {
		if features.GetEnumType() == descriptorpb.FeatureSet_CLOSED {
			open = false
		} else if features.GetEnumType() == descriptorpb.FeatureSet_OPEN {
			open = true
		}
	}
	g.Enums[name] = enumInfo{File: file, Name: name, InputNames: inputNames, OutputNames: outputNames, Open: open}
}

func enumJSONName(options *descriptorpb.EnumValueOptions) string {
	if options == nil {
		return ""
	}
	if bootstrapEnumJSONExtension != nil && proto.HasExtension(options, bootstrapEnumJSONExtension) {
		value := proto.GetExtension(options, bootstrapEnumJSONExtension)
		message, ok := value.(interface{ ProtoReflect() protoreflect.Message })
		if ok {
			reflected := message.ProtoReflect()
			field := reflected.Descriptor().Fields().ByName("string")
			if field != nil && reflected.Has(field) {
				return reflected.Get(field).String()
			}
		}
	}
	raw := options.ProtoReflect().GetUnknown()
	for len(raw) > 0 {
		number, wireType, tagLength := protowire.ConsumeTag(raw)
		if tagLength < 0 {
			return ""
		}
		raw = raw[tagLength:]
		if number == 998 && wireType == protowire.BytesType {
			payload, length := protowire.ConsumeBytes(raw)
			if length < 0 {
				return ""
			}
			fieldNumber, fieldType, nestedTag := protowire.ConsumeTag(payload)
			if nestedTag < 0 || fieldNumber != 1 || fieldType != protowire.BytesType {
				return ""
			}
			text, textLength := protowire.ConsumeString(payload[nestedTag:])
			if textLength < 0 {
				return ""
			}
			return text
		}
		length := protowire.ConsumeFieldValue(number, wireType, raw)
		if length < 0 {
			return ""
		}
		raw = raw[length:]
	}
	return ""
}

func joinName(prefix, name string) string {
	if prefix == "" {
		return name
	}
	return prefix + "." + name
}

func synthesize(item scenario, protocRoot string) (map[string]any, error) {
	content, present := item.Source["content"]
	if !present {
		encoded, ok := item.Discovery["descriptorSetBase64"].(string)
		if !ok {
			return nil, errors.New("location-only scenario has no reflection descriptor set")
		}
		content = map[string]any{"$fileDescriptorSet": encoded}
	}
	set, err := descriptorFromValue(content, protocRoot)
	if err != nil {
		return nil, err
	}
	g := buildGraph(set)
	operations := []any{}
	bindings := []any{}
	entries := []any{}
	schemas := map[string]any{}
	bare := !strings.Contains(item.Source["location"].(string), "://")
	fully := true
	for _, method := range g.Methods {
		operationKey := strings.Replace(method.Selector, "/", ".", 1)
		service := strings.Split(method.Selector, "/")[0]
		if service == "grpc.reflection.v1.ServerReflection" || service == "grpc.reflection.v1alpha.ServerReflection" {
			entries = append(entries, map[string]any{"sourceIndex": json.Number("0"), "sourceRef": method.Selector, "scope": "target", "status": "excluded", "rule": "GRPC-S-01", "requirements": []any{}})
			fully = false
			continue
		}
		owner := exclusionOwner(&g, method.Input, map[string]bool{})
		if owner == "" {
			owner = exclusionOwner(&g, method.Output, map[string]bool{})
		}
		if owner != "" {
			entries = append(entries,
				map[string]any{"sourceIndex": json.Number("0"), "sourceRef": method.Selector, "scope": "target", "status": "excluded", "operationKey": operationKey, "bindingSelector": method.Selector, "rule": "GRPC-S-07", "requirements": []any{}},
				map[string]any{"sourceIndex": json.Number("0"), "sourceRef": owner, "scope": "projection", "status": "excluded", "operationKey": operationKey, "bindingSelector": method.Selector, "rule": "GRPC-S-03", "requirements": []any{}},
			)
			fully = false
			continue
		}
		operations = append(operations, operationKey)
		bindings = append(bindings, map[string]any{"operationKey": operationKey, "bindingSelector": method.Selector})
		requirements := []any{}
		if bare {
			requirements = append(requirements, "configuration.transport")
		}
		entries = append(entries, map[string]any{"sourceIndex": json.Number("0"), "sourceRef": method.Selector, "scope": "target", "status": "represented", "operationKey": operationKey, "bindingSelector": method.Selector, "requirements": requirements})
		projectMessage(&g, method.Input, "input", schemas, map[string]bool{})
		projectMessage(&g, method.Output, "output", schemas, map[string]bool{})
	}
	sort.Slice(entries, func(i, j int) bool {
		left, right := entries[i].(map[string]any), entries[j].(map[string]any)
		for _, key := range []string{"sourceRef", "scope", "operationKey", "bindingSelector"} {
			leftValue, _ := left[key].(string)
			rightValue, _ := right[key].(string)
			if leftValue != rightValue {
				return leftValue < rightValue
			}
		}
		return false
	})
	return map[string]any{
		"outcome": "synthesized", "operations": operations, "bindings": bindings, "schemas": schemas,
		"coverage": map[string]any{"exhaustive": true, "fullyRepresented": fully, "entries": entries},
	}, nil
}

func exclusionOwner(g *graph, name string, visiting map[string]bool) string {
	if visiting[name] {
		return ""
	}
	visiting[name] = true
	defer delete(visiting, name)
	message, ok := g.Messages[name]
	if !ok {
		return ""
	}
	prefix := fmt.Sprintf("file[%d]:%s#%s", len([]byte(message.File)), message.File, message.Name)
	if message.Proto.GetOptions().GetMessageSetWireFormat() || g.FileExtendee[name] || name == "google.protobuf.EnumValueOptions" {
		return prefix
	}
	if activeMutant != "admit-cross-field-json-collision" && hasCrossFieldSpellingCollision(message) {
		return prefix
	}
	for _, field := range message.Fields {
		legacyRequired := field.GetLabel() == descriptorpb.FieldDescriptorProto_LABEL_REQUIRED
		if features := field.GetOptions().GetFeatures(); features != nil && features.GetFieldPresence() == descriptorpb.FeatureSet_LEGACY_REQUIRED {
			legacyRequired = true
		}
		if legacyRequired || field.GetType() == descriptorpb.FieldDescriptorProto_TYPE_GROUP {
			return fmt.Sprintf("%s/field:%d", prefix, field.GetNumber())
		}
		if field.GetType() == descriptorpb.FieldDescriptorProto_TYPE_MESSAGE || field.GetType() == descriptorpb.FieldDescriptorProto_TYPE_GROUP {
			if owner := exclusionOwner(g, strings.TrimPrefix(field.GetTypeName(), "."), visiting); owner != "" {
				return owner
			}
		}
	}
	return ""
}

func projectMessage(g *graph, name, direction string, schemas map[string]any, visiting map[string]bool) {
	key := direction + "." + name
	if _, exists := schemas[key]; exists || visiting[key] {
		return
	}
	message, ok := g.Messages[name]
	if !ok || message.Proto.GetOptions().GetMapEntry() {
		return
	}
	visiting[key] = true
	// Install the key before descending so every recursive edge is a stable
	// same-document reference rather than an expansion-depth choice.
	schemas[key] = map[string]any{}
	if special, ok := wellKnownSchema(g, name, direction, schemas, visiting); ok {
		schemas[key] = special
	} else {
		schemas[key] = ordinaryMessageSchema(g, message, direction, schemas, visiting, "")
	}
	delete(visiting, key)
}

func ordinaryMessageSchema(g *graph, message messageInfo, direction string, schemas map[string]any, visiting map[string]bool, anyType string) map[string]any {
	properties := map[string]any{}
	fieldNames := map[int32][]string{}
	if anyType != "" {
		properties["@type"] = map[string]any{"type": "string", "pattern": `^(?:[^\uD800-\uDFFF])+/` + regexp.QuoteMeta(anyType) + "$"}
	}
	for _, field := range message.Fields {
		jsonName := field.GetJsonName()
		if jsonName == "" {
			jsonName = lowerCamel(field.GetName())
		}
		names := []string{jsonName}
		if direction == "input" && field.GetName() != jsonName {
			names = append(names, field.GetName())
		}
		fieldNames[field.GetNumber()] = names
		value := fieldValueSchema(g, field, direction, schemas, visiting)
		if direction == "input" {
			value = nullableSchema(value)
		}
		for _, name := range names {
			properties[name] = value
		}
	}
	schema := map[string]any{"type": "object", "properties": properties, "additionalProperties": false}
	if anyType != "" {
		schema["required"] = []any{"@type"}
	}
	exclusions := []any{}
	for _, names := range fieldNames {
		if len(names) == 2 {
			exclusions = append(exclusions, forbiddenPair(names[0], names[1]))
		}
	}
	oneofs := map[int32][]string{}
	for _, field := range message.Fields {
		if field.OneofIndex == nil || field.GetProto3Optional() {
			continue
		}
		oneofs[field.GetOneofIndex()] = append(oneofs[field.GetOneofIndex()], fieldNames[field.GetNumber()]...)
	}
	for _, names := range oneofs {
		for i := 0; i < len(names); i++ {
			for j := i + 1; j < len(names); j++ {
				exclusions = append(exclusions, forbiddenPair(names[i], names[j]))
			}
		}
	}
	if len(exclusions) > 0 {
		schema["allOf"] = exclusions
	}
	return schema
}

func hasReservedAnyEnvelopeCollision(message messageInfo) bool {
	for _, field := range message.Fields {
		jsonName := field.GetJsonName()
		if jsonName == "" {
			jsonName = lowerCamel(field.GetName())
		}
		if field.GetName() == "@type" || jsonName == "@type" {
			return true
		}
	}
	return false
}

func hasCrossFieldSpellingCollision(message messageInfo) bool {
	owners := map[string]int32{}
	for _, field := range message.Fields {
		jsonName := field.GetJsonName()
		if jsonName == "" {
			jsonName = lowerCamel(field.GetName())
		}
		seenForField := map[string]bool{}
		for _, spelling := range []string{field.GetName(), jsonName} {
			if seenForField[spelling] {
				continue
			}
			seenForField[spelling] = true
			if owner, exists := owners[spelling]; exists && owner != field.GetNumber() {
				return true
			}
			owners[spelling] = field.GetNumber()
		}
	}
	return false
}

func forbiddenPair(left, right string) map[string]any {
	return map[string]any{"not": map[string]any{"required": []any{left, right}}}
}

func nullableSchema(schema any) map[string]any {
	return map[string]any{"anyOf": []any{schema, map[string]any{"type": "null"}}}
}

func fieldValueSchema(g *graph, field *descriptorpb.FieldDescriptorProto, direction string, schemas map[string]any, visiting map[string]bool) any {
	if entry, ok := mapEntry(g, field); ok {
		keyField, valueField := entry.Fields[0], entry.Fields[1]
		value := fieldScalarSchema(g, valueField, direction, schemas, visiting, true)
		schema := map[string]any{"type": "object", "additionalProperties": value}
		if names := mapKeyPattern(keyField); names != "" {
			schema["propertyNames"] = map[string]any{"pattern": names}
		}
		return schema
	}
	repeated := field.GetLabel() == descriptorpb.FieldDescriptorProto_LABEL_REPEATED
	value := fieldScalarSchema(g, field, direction, schemas, visiting, repeated)
	if repeated {
		return map[string]any{"type": "array", "items": value}
	}
	return value
}

func mapEntry(g *graph, field *descriptorpb.FieldDescriptorProto) (messageInfo, bool) {
	if field.GetLabel() != descriptorpb.FieldDescriptorProto_LABEL_REPEATED || field.GetType() != descriptorpb.FieldDescriptorProto_TYPE_MESSAGE {
		return messageInfo{}, false
	}
	entry, ok := g.Messages[strings.TrimPrefix(field.GetTypeName(), ".")]
	return entry, ok && entry.Proto.GetOptions().GetMapEntry() && len(entry.Fields) == 2
}

func fieldScalarSchema(g *graph, field *descriptorpb.FieldDescriptorProto, direction string, schemas map[string]any, visiting map[string]bool, containerMember bool) any {
	if field.GetType() == descriptorpb.FieldDescriptorProto_TYPE_MESSAGE {
		name := strings.TrimPrefix(field.GetTypeName(), ".")
		projectMessage(g, name, direction, schemas, visiting)
		if wrapper, ok := wrapperScalarSchema(name, direction); ok && containerMember {
			return wrapper
		}
		return map[string]any{"$ref": "#/schemas/" + direction + "." + name}
	}
	if field.GetType() == descriptorpb.FieldDescriptorProto_TYPE_ENUM {
		if strings.TrimPrefix(field.GetTypeName(), ".") == "google.protobuf.NullValue" {
			return map[string]any{"type": "null"}
		}
		return enumSchema(g.Enums[strings.TrimPrefix(field.GetTypeName(), ".")], direction)
	}
	switch field.GetType() {
	case descriptorpb.FieldDescriptorProto_TYPE_INT32, descriptorpb.FieldDescriptorProto_TYPE_SINT32, descriptorpb.FieldDescriptorProto_TYPE_SFIXED32:
		return integerSchema(direction, false, "2147483647", "2147483648")
	case descriptorpb.FieldDescriptorProto_TYPE_UINT32, descriptorpb.FieldDescriptorProto_TYPE_FIXED32:
		return integerSchema(direction, false, "4294967295", "")
	case descriptorpb.FieldDescriptorProto_TYPE_INT64, descriptorpb.FieldDescriptorProto_TYPE_SINT64, descriptorpb.FieldDescriptorProto_TYPE_SFIXED64:
		return integerSchema(direction, true, "9223372036854775807", "9223372036854775808")
	case descriptorpb.FieldDescriptorProto_TYPE_UINT64, descriptorpb.FieldDescriptorProto_TYPE_FIXED64:
		return integerSchema(direction, true, "18446744073709551615", "")
	case descriptorpb.FieldDescriptorProto_TYPE_FLOAT:
		return floatSchema(3.4028234663852886e38)
	case descriptorpb.FieldDescriptorProto_TYPE_DOUBLE:
		return floatSchema(1.7976931348623157e308)
	case descriptorpb.FieldDescriptorProto_TYPE_BOOL:
		return map[string]any{"type": "boolean"}
	case descriptorpb.FieldDescriptorProto_TYPE_STRING:
		return scalarStringSchema()
	case descriptorpb.FieldDescriptorProto_TYPE_BYTES:
		return map[string]any{"type": "string", "pattern": `^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/][AQgw]==|[A-Za-z0-9+/]{2}[AEIMQUYcgkosw048]=)?$`}
	default:
		return false
	}
}

func integerSchema(direction string, quotedOutput bool, positiveMax, negativeMax string) any {
	pattern := boundedIntegerPattern(positiveMax, negativeMax)
	if quotedOutput {
		return map[string]any{"type": "string", "pattern": pattern}
	}
	maximum, _ := strconv.ParseInt(positiveMax, 10, 64)
	number := map[string]any{"type": "integer", "maximum": maximum}
	if negativeMax == "" {
		number["minimum"] = int64(0)
	} else {
		minimum, _ := strconv.ParseInt(negativeMax, 10, 64)
		number["minimum"] = -minimum
	}
	return number
}

func floatSchema(maximum float64) map[string]any {
	return map[string]any{"anyOf": []any{
		map[string]any{"type": "number", "minimum": -maximum, "maximum": maximum},
		map[string]any{"enum": []any{"NaN", "Infinity", "-Infinity"}},
	}}
}

func enumSchema(enum enumInfo, direction string) any {
	names := enum.InputNames
	if direction == "output" {
		names = enum.OutputNames
	}
	values := make([]any, len(names))
	for i, name := range names {
		values[i] = name
	}
	nameSchema := map[string]any{"enum": values}
	numberSchema := map[string]any{"type": "integer", "minimum": int64(-2147483648), "maximum": int64(2147483647)}
	if direction == "input" || enum.Open {
		return map[string]any{"anyOf": []any{nameSchema, numberSchema}}
	}
	return nameSchema
}

func mapKeyPattern(field *descriptorpb.FieldDescriptorProto) string {
	switch field.GetType() {
	case descriptorpb.FieldDescriptorProto_TYPE_BOOL:
		return `^(?:true|false)$`
	case descriptorpb.FieldDescriptorProto_TYPE_STRING:
		return `^[^\uD800-\uDFFF]*$`
	case descriptorpb.FieldDescriptorProto_TYPE_INT32, descriptorpb.FieldDescriptorProto_TYPE_SINT32, descriptorpb.FieldDescriptorProto_TYPE_SFIXED32:
		return boundedIntegerPattern("2147483647", "2147483648")
	case descriptorpb.FieldDescriptorProto_TYPE_UINT32, descriptorpb.FieldDescriptorProto_TYPE_FIXED32:
		return boundedIntegerPattern("4294967295", "")
	case descriptorpb.FieldDescriptorProto_TYPE_INT64, descriptorpb.FieldDescriptorProto_TYPE_SINT64, descriptorpb.FieldDescriptorProto_TYPE_SFIXED64:
		return boundedIntegerPattern("9223372036854775807", "9223372036854775808")
	case descriptorpb.FieldDescriptorProto_TYPE_UINT64, descriptorpb.FieldDescriptorProto_TYPE_FIXED64:
		return boundedIntegerPattern("18446744073709551615", "")
	default:
		return ""
	}
}

func boundedIntegerPattern(positiveMax, negativeMagnitudeMax string) string {
	positive := boundedUnsignedBody(positiveMax, true)
	if negativeMagnitudeMax == "" {
		return "^(?:" + positive + ")$"
	}
	negative := boundedUnsignedBody(negativeMagnitudeMax, false)
	return "^(?:" + positive + "|-" + negative + ")$"
}

func boundedUnsignedBody(maximum string, includeZero bool) string {
	alternatives := []string{}
	if includeZero {
		alternatives = append(alternatives, "0")
	}
	for length := 1; length < len(maximum); length++ {
		if length == 1 {
			alternatives = append(alternatives, "[1-9]")
		} else {
			alternatives = append(alternatives, fmt.Sprintf("[1-9][0-9]{%d}", length-1))
		}
	}
	for index := 0; index < len(maximum); index++ {
		limit := int(maximum[index] - '0')
		lower := 0
		if index == 0 {
			lower = 1
		}
		if limit > lower {
			prefix := maximum[:index]
			digits := fmt.Sprintf("[%d-%d]", lower, limit-1)
			rest := len(maximum) - index - 1
			if rest > 0 {
				digits += fmt.Sprintf("[0-9]{%d}", rest)
			}
			alternatives = append(alternatives, prefix+digits)
		} else if limit == lower && index > 0 {
			// There is no strictly smaller digit at this position.
		}
	}
	alternatives = append(alternatives, maximum)
	return "(?:" + strings.Join(alternatives, "|") + ")"
}

func wrapperScalarSchema(name, direction string) (any, bool) {
	switch name {
	case "google.protobuf.DoubleValue", "google.protobuf.FloatValue":
		maximum := 1.7976931348623157e308
		if name == "google.protobuf.FloatValue" {
			maximum = 3.4028234663852886e38
		}
		return floatSchema(maximum), true
	case "google.protobuf.Int64Value", "google.protobuf.UInt64Value":
		positive, negative := "9223372036854775807", "9223372036854775808"
		if name == "google.protobuf.UInt64Value" {
			positive, negative = "18446744073709551615", ""
		}
		return integerSchema(direction, true, positive, negative), true
	case "google.protobuf.Int32Value", "google.protobuf.UInt32Value":
		positive, negative := "2147483647", "2147483648"
		if name == "google.protobuf.UInt32Value" {
			positive, negative = "4294967295", ""
		}
		return integerSchema(direction, false, positive, negative), true
	case "google.protobuf.BoolValue":
		return map[string]any{"type": "boolean"}, true
	case "google.protobuf.StringValue":
		return scalarStringSchema(), true
	case "google.protobuf.BytesValue":
		return map[string]any{"type": "string", "pattern": `^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/][AQgw]==|[A-Za-z0-9+/]{2}[AEIMQUYcgkosw048]=)?$`}, true
	default:
		return nil, false
	}
}

func wellKnownSchema(g *graph, name, direction string, schemas map[string]any, visiting map[string]bool) (any, bool) {
	const timestampInput = `^(?:[0-9]{3}[1-9]|[0-9]{2}[1-9][0-9]|[0-9][1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[1-9]|1[0-2])-(?:0[1-9]|1[0-9]|2[0-8])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]{3}(?:[0-9]{3}(?:[0-9]{3})?)?)?Z$`
	const timestampOutput = `^(?:[0-9]{4})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]{3}(?:[0-9]{3}(?:[0-9]{3})?)?)?Z$`
	const durationInput = `^-?(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{3}(?:[0-9]{3}(?:[0-9]{3})?)?)?s$`
	const durationOutput = `^-?(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{3}(?:[0-9]{3}(?:[0-9]{3})?)?)?s$`
	const fieldMaskInput = `^(?:[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*(?:,[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*)*)?$`
	const fieldMaskOutput = `^(?:[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*(?:,[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*)*)?$`
	switch name {
	case "google.protobuf.Timestamp":
		pattern := timestampInput
		if direction == "output" {
			pattern = timestampOutput
		}
		return map[string]any{"type": "string", "pattern": pattern}, true
	case "google.protobuf.Duration":
		pattern := durationInput
		if direction == "output" {
			pattern = durationOutput
		}
		return map[string]any{"type": "string", "pattern": pattern}, true
	case "google.protobuf.FieldMask":
		pattern := fieldMaskInput
		if direction == "output" {
			pattern = fieldMaskOutput
		}
		return map[string]any{"type": "string", "pattern": pattern}, true
	case "google.protobuf.Struct":
		projectMessage(g, "google.protobuf.Value", direction, schemas, visiting)
		return map[string]any{"type": "object", "propertyNames": scalarStringSchema(), "additionalProperties": map[string]any{"$ref": "#/schemas/" + direction + ".google.protobuf.Value"}}, true
	case "google.protobuf.Value":
		projectMessage(g, "google.protobuf.Struct", direction, schemas, visiting)
		projectMessage(g, "google.protobuf.ListValue", direction, schemas, visiting)
		return map[string]any{"anyOf": []any{
			map[string]any{"type": "null"},
			map[string]any{"type": "boolean"},
			finiteBinary64NumberSchema(),
			scalarStringSchema(),
			map[string]any{"$ref": "#/schemas/" + direction + ".google.protobuf.Struct"},
			map[string]any{"$ref": "#/schemas/" + direction + ".google.protobuf.ListValue"},
		}}, true
	case "google.protobuf.ListValue":
		projectMessage(g, "google.protobuf.Value", direction, schemas, visiting)
		return map[string]any{"type": "array", "items": map[string]any{"$ref": "#/schemas/" + direction + ".google.protobuf.Value"}}, true
	case "google.protobuf.NullValue":
		return map[string]any{"type": "null"}, true
	case "google.protobuf.Empty":
		return map[string]any{"type": "object", "properties": map[string]any{}, "additionalProperties": false}, true
	case "google.protobuf.Any":
		return anySchema(g, direction, schemas, visiting), true
	default:
		wrapper, ok := wrapperScalarSchema(name, direction)
		if !ok {
			return nil, false
		}
		if direction == "input" {
			return nullableSchema(wrapper), true
		}
		return wrapper, true
	}
}

func anySchema(g *graph, direction string, schemas map[string]any, visiting map[string]bool) map[string]any {
	names := make([]string, 0, len(g.Messages))
	for name, message := range g.Messages {
		if message.Proto.GetOptions().GetMapEntry() || exclusionOwner(g, name, map[string]bool{}) != "" {
			continue
		}
		names = append(names, name)
	}
	sort.Strings(names)
	alternatives := []any{map[string]any{"type": "object", "properties": map[string]any{}, "additionalProperties": false}}
	for _, name := range names {
		message := g.Messages[name]
		if hasReservedAnyEnvelopeCollision(message) {
			continue
		}
		if name == "google.protobuf.Any" {
			alternatives = append(alternatives, map[string]any{
				"type": "object", "properties": map[string]any{
					"@type": map[string]any{"type": "string", "pattern": `^(?:[^\uD800-\uDFFF])+/google\.protobuf\.Any$`},
					"value": map[string]any{"$ref": "#/schemas/" + direction + ".google.protobuf.Any"},
				}, "required": []any{"@type", "value"}, "additionalProperties": false,
			})
			continue
		}
		if name == "google.protobuf.Empty" {
			projectMessage(g, name, direction, schemas, visiting)
			alternatives = append(alternatives, ordinaryMessageSchema(g, message, direction, schemas, visiting, name))
			continue
		}
		if _, special := wellKnownSchema(g, name, direction, schemas, visiting); special {
			projectMessage(g, name, direction, schemas, visiting)
			alternatives = append(alternatives, map[string]any{
				"type": "object", "properties": map[string]any{
					"@type": map[string]any{"type": "string", "pattern": `^(?:[^\uD800-\uDFFF])+/` + regexp.QuoteMeta(name) + "$"},
					"value": map[string]any{"$ref": "#/schemas/" + direction + "." + name},
				}, "required": []any{"@type", "value"}, "additionalProperties": false,
			})
			continue
		}
		projectMessage(g, name, direction, schemas, visiting)
		alternatives = append(alternatives, ordinaryMessageSchema(g, message, direction, schemas, visiting, name))
	}
	return map[string]any{"anyOf": alternatives}
}

func scalarStringSchema() map[string]any {
	return map[string]any{"type": "string", "pattern": `^[^\uD800-\uDFFF]*$`}
}

func finiteBinary64NumberSchema() map[string]any {
	return map[string]any{"type": "number", "minimum": -1.7976931348623157e308, "maximum": 1.7976931348623157e308}
}

func lowerCamel(value string) string {
	parts := strings.Split(value, "_")
	for i := 1; i < len(parts); i++ {
		if parts[i] != "" {
			parts[i] = strings.ToUpper(parts[i][:1]) + parts[i][1:]
		}
	}
	return strings.Join(parts, "")
}

func validateSynthesized(actual map[string]any) error {
	operations := actual["operations"].([]any)
	bindings := actual["bindings"].([]any)
	if len(operations) != len(bindings) {
		return errors.New("operation/binding cardinality differs")
	}
	seen := map[string]bool{}
	for index, raw := range operations {
		key, ok := raw.(string)
		if !ok || seen[key] || (index > 0 && operations[index-1].(string) >= key) {
			return errors.New("operations are not unique and canonically ordered")
		}
		seen[key] = true
	}
	for _, raw := range bindings {
		binding := raw.(map[string]any)
		key, _ := binding["operationKey"].(string)
		selector, _ := binding["bindingSelector"].(string)
		if !seen[key] || !selectorPattern.MatchString(selector) || strings.Replace(selector, "/", ".", 1) != key {
			return errors.New("binding has no exact operation/selector counterpart")
		}
	}
	for key := range actual["schemas"].(map[string]any) {
		if !strings.HasPrefix(key, "input.") && !strings.HasPrefix(key, "output.") {
			return fmt.Errorf("illegal schema key %q", key)
		}
		if strings.Contains(key, ":") {
			return fmt.Errorf("illegal schema key %q", key)
		}
	}
	coverage := actual["coverage"].(map[string]any)
	for _, raw := range coverage["entries"].([]any) {
		entry := raw.(map[string]any)
		status, _ := entry["status"].(string)
		if status != "represented" && status != "excluded" && status != "invalid" && status != "lossy" && status != "implementation-unsupported" {
			return fmt.Errorf("unknown coverage status %q", status)
		}
		scope, _ := entry["scope"].(string)
		ref, _ := entry["sourceRef"].(string)
		if scope == "target" && !selectorPattern.MatchString(ref) {
			return fmt.Errorf("invalid target coverage owner %q", ref)
		}
		if scope == "projection" && !strings.HasPrefix(ref, "file[") {
			return fmt.Errorf("invalid projection coverage owner %q", ref)
		}
	}
	return nil
}

func compareExpected(actual, expected map[string]any) error {
	for _, key := range []string{"outcome", "operations", "bindings", "coverage"} {
		if !reflect.DeepEqual(normalize(actual[key]), normalize(expected[key])) {
			return fmt.Errorf("computed %s differs from expected\ncomputed: %#v\nexpected: %#v", key, actual[key], expected[key])
		}
	}
	for _, assertion := range assertionSlice(expected["assertions"]) {
		path, _ := assertion["path"].(string)
		value, present := jsonPointer(actual, path)
		if absent, _ := assertion["absent"].(bool); absent {
			if present {
				return fmt.Errorf("assertion %s expected absence", path)
			}
			continue
		}
		if !present || !reflect.DeepEqual(normalize(value), normalize(assertion["equals"])) {
			return fmt.Errorf("assertion %s differs: got %#v", path, value)
		}
	}
	return nil
}

func normalize(value any) any {
	data, _ := json.Marshal(value)
	var result any
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	_ = decoder.Decode(&result)
	return result
}

func assertionSlice(value any) []map[string]any {
	array, _ := value.([]any)
	result := make([]map[string]any, 0, len(array))
	for _, item := range array {
		result = append(result, item.(map[string]any))
	}
	return result
}

func jsonPointer(root any, path string) (any, bool) {
	current := root
	if path == "" {
		return current, true
	}
	if !strings.HasPrefix(path, "/") {
		return nil, false
	}
	for _, token := range strings.Split(path[1:], "/") {
		token = strings.ReplaceAll(strings.ReplaceAll(token, "~1", "/"), "~0", "~")
		switch container := current.(type) {
		case map[string]any:
			value, ok := container[token]
			if !ok {
				return nil, false
			}
			current = value
		case []any:
			index, err := strconv.Atoi(token)
			if err != nil || index < 0 || index >= len(container) {
				return nil, false
			}
			current = container[index]
		default:
			return nil, false
		}
	}
	return current, true
}

func validateSchemaInstances(actual map[string]any, raw any) (int, error) {
	tests, _ := raw.([]any)
	schemas := actual["schemas"].(map[string]any)
	for index, item := range tests {
		test := item.(map[string]any)
		name, _ := test["schema"].(string)
		schema, ok := schemas[name]
		if !ok {
			return index, fmt.Errorf("schema instance %d names missing schema %q", index, name)
		}
		instance := test["value"]
		if raw, present := test["valueJson"].(string); present {
			decoder := json.NewDecoder(strings.NewReader(raw))
			decoder.UseNumber()
			if err := decoder.Decode(&instance); err != nil {
				return index, fmt.Errorf("schema instance %d valueJson: %w", index, err)
			}
			var trailing any
			if err := decoder.Decode(&trailing); err != io.EOF {
				if err == nil {
					err = errors.New("multiple JSON values")
				}
				return index, fmt.Errorf("schema instance %d valueJson: %w", index, err)
			}
		}
		valid, err := schemaValid(schema, instance, schemas)
		if err != nil {
			return index, fmt.Errorf("schema instance %d: %w", index, err)
		}
		want, _ := test["valid"].(bool)
		if valid != want {
			return index, fmt.Errorf("schema instance %d for %s computed valid=%v, expected %v", index, name, valid, want)
		}
	}
	return len(tests), nil
}

func schemaValid(schema any, instance any, schemas map[string]any) (bool, error) {
	if boolean, ok := schema.(bool); ok {
		return boolean, nil
	}
	object, ok := schema.(map[string]any)
	if !ok {
		return false, errors.New("schema is neither boolean nor object")
	}
	if reference, ok := object["$ref"].(string); ok {
		const prefix = "#/schemas/"
		if !strings.HasPrefix(reference, prefix) {
			return false, fmt.Errorf("unsupported reference %q", reference)
		}
		target, present := schemas[strings.TrimPrefix(reference, prefix)]
		if !present {
			return false, fmt.Errorf("missing reference %q", reference)
		}
		return schemaValid(target, instance, schemas)
	}
	if options, ok := object["anyOf"].([]any); ok {
		matched := false
		for _, option := range options {
			valid, err := schemaValid(option, instance, schemas)
			if err != nil {
				return false, err
			}
			matched = matched || valid
		}
		if !matched {
			return false, nil
		}
	}
	if clauses, ok := object["allOf"].([]any); ok {
		for _, clause := range clauses {
			valid, err := schemaValid(clause, instance, schemas)
			if err != nil || !valid {
				return false, err
			}
		}
	}
	if negated, ok := object["not"]; ok {
		valid, err := schemaValid(negated, instance, schemas)
		if err != nil {
			return false, err
		}
		if valid {
			return false, nil
		}
	}
	if required, ok := object["required"].([]any); ok {
		value, objectValue := instance.(map[string]any)
		if !objectValue {
			return false, nil
		}
		for _, rawName := range required {
			if _, present := value[rawName.(string)]; !present {
				return false, nil
			}
		}
	}
	if rawType, ok := object["type"].(string); ok && !matchesJSONType(rawType, instance) {
		return false, nil
	}
	if values, ok := object["enum"].([]any); ok {
		found := false
		for _, value := range values {
			found = found || reflect.DeepEqual(normalize(value), normalize(instance))
		}
		if !found {
			return false, nil
		}
	}
	if pattern, ok := object["pattern"].(string); ok {
		value, stringValue := instance.(string)
		if !stringValue {
			return false, nil
		}
		const scalarClass = `[^\uD800-\uDFFF]`
		if strings.Contains(pattern, scalarClass) {
			if !utf8.ValidString(value) {
				return false, nil
			}
			pattern = strings.ReplaceAll(pattern, scalarClass, `[\x{0}-\x{D7FF}\x{E000}-\x{10FFFF}]`)
		}
		matcher, err := regexp.Compile(pattern)
		if err != nil {
			return false, err
		}
		if !matcher.MatchString(value) {
			return false, nil
		}
	}
	if minimum, ok := object["minimum"]; ok {
		comparison, err := compareJSONNumber(instance, minimum)
		if err != nil || comparison < 0 {
			return false, err
		}
	}
	if maximum, ok := object["maximum"]; ok {
		comparison, err := compareJSONNumber(instance, maximum)
		if err != nil || comparison > 0 {
			return false, err
		}
	}
	if value, objectValue := instance.(map[string]any); objectValue {
		properties, _ := object["properties"].(map[string]any)
		for name, member := range value {
			if propertySchema, present := properties[name]; present {
				valid, err := schemaValid(propertySchema, member, schemas)
				if err != nil || !valid {
					return false, err
				}
				continue
			}
			switch additional := object["additionalProperties"].(type) {
			case bool:
				if !additional {
					return false, nil
				}
			case map[string]any:
				valid, err := schemaValid(additional, member, schemas)
				if err != nil || !valid {
					return false, err
				}
			}
		}
		if propertyNames, present := object["propertyNames"]; present {
			for name := range value {
				valid, err := schemaValid(propertyNames, name, schemas)
				if err != nil || !valid {
					return false, err
				}
			}
		}
	}
	if values, arrayValue := instance.([]any); arrayValue {
		if itemSchema, present := object["items"]; present {
			for _, value := range values {
				valid, err := schemaValid(itemSchema, value, schemas)
				if err != nil || !valid {
					return false, err
				}
			}
		}
	}
	return true, nil
}

func matchesJSONType(kind string, value any) bool {
	switch kind {
	case "null":
		return value == nil
	case "object":
		_, ok := value.(map[string]any)
		return ok
	case "array":
		_, ok := value.([]any)
		return ok
	case "string":
		_, ok := value.(string)
		return ok
	case "boolean":
		_, ok := value.(bool)
		return ok
	case "number":
		_, err := jsonNumberRat(value)
		return err == nil
	case "integer":
		number, err := jsonNumberRat(value)
		return err == nil && number.IsInt()
	default:
		return false
	}
}

func compareJSONNumber(left, right any) (int, error) {
	leftNumber, err := jsonNumberRat(left)
	if err != nil {
		return 0, err
	}
	rightNumber, err := jsonNumberRat(right)
	if err != nil {
		return 0, err
	}
	return leftNumber.Cmp(rightNumber), nil
}

func jsonNumberRat(value any) (*big.Rat, error) {
	var text string
	switch typed := value.(type) {
	case json.Number:
		text = typed.String()
	case int:
		text = strconv.Itoa(typed)
	case int32:
		text = strconv.FormatInt(int64(typed), 10)
	case int64:
		text = strconv.FormatInt(typed, 10)
	case float64:
		text = strconv.FormatFloat(typed, 'g', -1, 64)
	default:
		return nil, errors.New("value is not a JSON number")
	}
	number, ok := new(big.Rat).SetString(text)
	if !ok {
		return nil, fmt.Errorf("invalid JSON number %q", text)
	}
	return number, nil
}

func mutate(actual map[string]any, mutant string, scenarioIndex int) {
	if mutant == "" {
		return
	}
	if mutant == "admit-cross-field-json-collision" {
		return
	}
	if mutant == "empty-any-typeurl-prefix" {
		if scenarioIndex != 11 {
			return
		}
		alternatives := actual["schemas"].(map[string]any)["input.google.protobuf.Any"].(map[string]any)["anyOf"].([]any)
		for _, candidate := range alternatives {
			object, ok := candidate.(map[string]any)
			if !ok {
				continue
			}
			properties, ok := object["properties"].(map[string]any)
			if !ok {
				continue
			}
			typeSchema, ok := properties["@type"].(map[string]any)
			if !ok || !strings.HasSuffix(fmt.Sprint(typeSchema["pattern"]), `/demo\.Nested$`) {
				continue
			}
			typeSchema["pattern"] = `^[\s\S]*/demo\.Nested$`
			return
		}
		failf("Any prefix mutant could not find the demo.Nested alternative")
	}
	if mutant == "open-proto2-closed-enum-output" || mutant == "open-editions-closed-enum-output" {
		targetIndex := 16
		packageName := "closedproto2"
		if mutant == "open-editions-closed-enum-output" {
			targetIndex = 17
			packageName = "closededition"
		}
		if scenarioIndex != targetIndex {
			return
		}
		shape := actual["schemas"].(map[string]any)["output."+packageName+".Shape"].(map[string]any)
		properties := shape["properties"].(map[string]any)
		properties["singular"] = map[string]any{"anyOf": []any{
			properties["singular"],
			map[string]any{"type": "integer", "minimum": int64(-2147483648), "maximum": int64(2147483647)},
		}}
		return
	}
	if mutant == "open-schema-object" || mutant == "unbounded-int64-string" {
		if scenarioIndex != 11 {
			return
		}
		shape := actual["schemas"].(map[string]any)["input.demo.Shape"].(map[string]any)
		if mutant == "open-schema-object" {
			delete(shape, "additionalProperties")
		} else {
			properties := shape["properties"].(map[string]any)
			bigSchema := properties["big"].(map[string]any)
			bigSchema["anyOf"].([]any)[0].(map[string]any)["pattern"] = "^-?[0-9]+$"
		}
		return
	}
	if mutant == "nullable-wrapper-container-schema" || mutant == "nullable-wrapper-output-schema" {
		if scenarioIndex != 11 {
			return
		}
		schemas := actual["schemas"].(map[string]any)
		if mutant == "nullable-wrapper-container-schema" {
			shape := schemas["input.demo.Shape"].(map[string]any)
			properties := shape["properties"].(map[string]any)
			items := properties["wrapperItems"].(map[string]any)["anyOf"].([]any)[0].(map[string]any)
			items["items"] = map[string]any{"$ref": "#/schemas/input.google.protobuf.StringValue"}
			mapped := properties["wrapperMap"].(map[string]any)["anyOf"].([]any)[0].(map[string]any)
			mapped["additionalProperties"] = map[string]any{"$ref": "#/schemas/input.google.protobuf.StringValue"}
		} else {
			schemas["output.google.protobuf.StringValue"] = nullableSchema(schemas["output.google.protobuf.StringValue"])
		}
		return
	}
	if mutant == "unbounded-value-number-schema" || mutant == "reject-value-null-schema" {
		if scenarioIndex != 11 {
			return
		}
		schemas := actual["schemas"].(map[string]any)
		if mutant == "unbounded-value-number-schema" {
			for _, direction := range []string{"input", "output"} {
				options := schemas[direction+".google.protobuf.Value"].(map[string]any)["anyOf"].([]any)
				for _, option := range options {
					candidate := option.(map[string]any)
					if candidate["type"] == "number" {
						delete(candidate, "minimum")
						delete(candidate, "maximum")
					}
				}
			}
		} else {
			value := schemas["input.google.protobuf.Value"].(map[string]any)
			kept := []any{}
			for _, option := range value["anyOf"].([]any) {
				if option.(map[string]any)["type"] != "null" {
					kept = append(kept, option)
				}
			}
			value["anyOf"] = kept
		}
		return
	}
	if mutant == "noncanonical-base64-schema" || mutant == "admit-integer-map-alias-schema" ||
		mutant == "admit-quoted-int32-schema" || mutant == "admit-json-int64-schema" ||
		mutant == "admit-quoted-enum-schema" || mutant == "admit-third-field-alias-schema" ||
		mutant == "admit-noncanonical-wkt-schema" || mutant == "open-unicode-string-schema" {
		if scenarioIndex != 11 {
			return
		}
		shape := actual["schemas"].(map[string]any)["input.demo.Shape"].(map[string]any)
		properties := shape["properties"].(map[string]any)
		switch mutant {
		case "noncanonical-base64-schema":
			blob := properties["blob"].(map[string]any)["anyOf"].([]any)[0].(map[string]any)
			blob["pattern"] = `^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$`
		case "admit-integer-map-alias-schema":
			labels := properties["labels"].(map[string]any)["anyOf"].([]any)[0].(map[string]any)
			labels["propertyNames"].(map[string]any)["pattern"] = `^(?:\+?0*[0-9]+|-0*[0-9]+)$`
		case "admit-quoted-int32-schema":
			count := properties["count"].(map[string]any)["anyOf"].([]any)
			count[0] = map[string]any{"anyOf": []any{count[0], map[string]any{"type": "string", "pattern": `^-?[0-9]+$`}}}
		case "admit-json-int64-schema":
			big := properties["big"].(map[string]any)["anyOf"].([]any)
			big[0] = map[string]any{"anyOf": []any{big[0], map[string]any{"type": "integer"}}}
		case "admit-quoted-enum-schema":
			state := properties["state"].(map[string]any)["anyOf"].([]any)[0].(map[string]any)
			names := state["anyOf"].([]any)[0].(map[string]any)
			names["enum"] = append(names["enum"].([]any), "123")
		case "admit-third-field-alias-schema":
			properties["snakeCase"] = properties["customName"]
		case "admit-noncanonical-wkt-schema":
			timestamp := actual["schemas"].(map[string]any)["input.google.protobuf.Timestamp"].(map[string]any)
			timestamp["pattern"] = `^[\s\S]+$`
		case "open-unicode-string-schema":
			snake := properties["snake_case"].(map[string]any)["anyOf"].([]any)[0].(map[string]any)
			delete(snake, "pattern")
		}
		return
	}
	if mutant == "admit-any-envelope-collision" {
		if scenarioIndex != 14 {
			return
		}
		anySchema := actual["schemas"].(map[string]any)["input.google.protobuf.Any"].(map[string]any)
		anySchema["anyOf"] = append(anySchema["anyOf"].([]any), map[string]any{
			"type": "object",
			"properties": map[string]any{
				"@type":   map[string]any{"type": "string", "pattern": `^[\s\S]+/collision\.Collision$`},
				"payload": map[string]any{"type": "string"},
			},
			"required":             []any{"@type"},
			"additionalProperties": false,
		})
		return
	}
	if scenarioIndex != 0 {
		return
	}
	operations := actual["operations"].([]any)
	bindings := actual["bindings"].([]any)
	coverage := actual["coverage"].(map[string]any)
	entries := coverage["entries"].([]any)
	switch mutant {
	case "ghost-method":
		actual["operations"] = append(operations, "ghost.Service.Call")
	case "missing-method":
		actual["operations"] = operations[1:]
	case "ghost-binding":
		actual["bindings"] = append(bindings, map[string]any{"operationKey": "ghost.Service.Call", "bindingSelector": "ghost.Service/Call"})
	case "missing-binding":
		actual["bindings"] = bindings[1:]
	case "illegal-schema-key":
		actual["schemas"].(map[string]any)["input:ghost.Bad"] = map[string]any{"type": "object"}
	case "wrong-coverage-owner":
		entries[0].(map[string]any)["sourceRef"] = "ghost.Service/Call"
	case "wrong-coverage-status":
		entries[0].(map[string]any)["status"] = "excluded"
	case "flipped-d-validity":
		// Applied during D adjudication.
	case "single-quote-import-bypass":
		// Applied by widening the compiler include roots.
	default:
		failf("unknown mutant %q", mutant)
	}
}
