// Independently written bounded execution witness for candidate §5.
// No primary evaluator, fixture expectations, or peer scripts are imported.
package main

import (
	"bufio"
	"bytes"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"os"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type object = map[string]any
type witnessLimit string

func (e witnessLimit) Error() string { return string(e) }

// Apparatus exhaustion must never masquerade as a protocol result or a kill.
func markApparatusFailure(r *result, err error) {
	var timeout net.Error
	var limit witnessLimit
	if (errors.As(err, &timeout) && timeout.Timeout()) || errors.As(err, &limit) {
		r.Disposition = "witness-unsupported"
		r.Limitation = err.Error()
	}
}

type cell struct{ op, server, selector, message, authority, path, state, invalidOwner string }
type result struct {
	Disposition string   `json:"disposition"`
	Phase       string   `json:"phase"`
	Outputs     []any    `json:"outputs"`
	Events      []string `json:"events"`
	Request     string   `json:"request"`
	Statuses    []int    `json:"statuses"`
	Synthesis   any      `json:"synthesis,omitempty"`
	Limitation  string   `json:"limitation,omitempty"`
	Trace       object   `json:"trace,omitempty"`
}

func terminal(r result) object {
	return object{"disposition": r.Disposition, "phase": r.Phase, "outputs": r.Outputs,
		"events": append([]string{}, r.Events...), "statuses": append([]int{}, r.Statuses...), "request": r.Request}
}

func obj(v any) object            { x, _ := v.(map[string]any); return x }
func str(v any) string            { x, _ := v.(string); return x }
func has(m object, k string) bool { _, ok := m[k]; return ok }
func empty(v any) bool            { m := obj(v); return m != nil && len(m) == 0 }
func keys(m object) []string {
	a := []string{}
	for k := range m {
		a = append(a, k)
	}
	sort.Strings(a)
	return a
}
func token(s string) string { return strings.ReplaceAll(strings.ReplaceAll(s, "~", "~0"), "/", "~1") }
func key(role, s string) string {
	if role == "source" {
		return "asyncapi31.source.30"
	}
	return "asyncapi31." + role + ".3000" + hex.EncodeToString([]byte(s))
}
func contract() object {
	return object{"type": "object", "properties": object{}, "additionalProperties": false}
}

type resolved struct {
	value   object
	pointer string
	hops    []string
}

func (r resolved) firstRoot(kind string) string {
	for _, p := range r.hops {
		parts := strings.Split(p, "/")
		if len(parts) == 3 && parts[1] == kind {
			return parts[2]
		}
	}
	return ""
}
func local(root object, v any, pointer string) (resolved, error) {
	seen := map[string]bool{}
	r := resolved{pointer: pointer, hops: []string{pointer}}
	for {
		m := obj(v)
		if m == nil {
			return r, fmt.Errorf("non-object typed target")
		}
		if !has(m, "$ref") {
			r.value = m
			return r, nil
		}
		ref := str(m["$ref"])
		if !strings.HasPrefix(ref, "#/") || strings.Contains(ref, "%") {
			return r, fmt.Errorf("witness supports unescaped local URI fragments only")
		}
		if seen[ref] {
			return r, fmt.Errorf("reference cycle")
		}
		seen[ref] = true
		pointer = ref[1:]
		r.pointer = pointer
		r.hops = append(r.hops, pointer)
		v = root
		for _, part := range strings.Split(pointer[1:], "/") {
			if regexp.MustCompile(`~(?:[^01]|$)`).MatchString(part) {
				return r, fmt.Errorf("invalid pointer")
			}
			name := strings.ReplaceAll(strings.ReplaceAll(part, "~1", "/"), "~0", "~")
			v = obj(v)[name]
		}
	}
}

var pathPattern = regexp.MustCompile(`^/(?:[A-Za-z0-9._~!$&'()*+,;=:@/-]|%[0-9A-F]{2})*$`)
var regName = regexp.MustCompile(`^(?:[A-Za-z0-9._~!$&'()*+,;=-]|%[0-9A-F]{2})+$`)
var decimal = regexp.MustCompile(`^(0|[1-9][0-9]*)$`)
var portDigits = regexp.MustCompile(`^[0-9]+$`)

func authority(s string) bool {
	host, port := s, ""
	if strings.HasPrefix(s, "[") {
		end := strings.IndexByte(s, ']')
		if end < 0 {
			return false
		}
		host = s[1:end]
		suffix := s[end+1:]
		if suffix != "" {
			if !strings.HasPrefix(suffix, ":") {
				return false
			}
			port = suffix[1:]
			if port == "" {
				return false
			}
		}
		if !(strings.Contains(host, ":") && net.ParseIP(host) != nil) && !regexp.MustCompile(`^[vV][0-9a-fA-F]+\.[A-Za-z0-9._~!$&'()*+,;=:-]+$`).MatchString(host) {
			return false
		}
	} else {
		if strings.Contains(s, ":") {
			parts := strings.Split(s, ":")
			if len(parts) != 2 || parts[1] == "" {
				return false
			}
			host, port = parts[0], parts[1]
		}
		if !regName.MatchString(host) {
			return false
		}
	}
	if port != "" {
		n, err := strconv.ParseUint(port, 10, 16)
		if !portDigits.MatchString(port) || err != nil || n > 65535 {
			return false
		}
	}
	return true
}
func emptyHTTP(v any) bool {
	if v == nil {
		return false
	}
	m := obj(v)
	return m != nil && (len(m) == 0 || (len(m) == 1 && empty(m["http"])))
}
func inventory(source object) ([]cell, error) {
	root := obj(source["content"])
	if root == nil {
		return nil, fmt.Errorf("object carriage required by this witness packet")
	}
	if root["asyncapi"] != "3.1.0" {
		return nil, nil
	}
	cells := []cell{}
	for _, opKey := range keys(obj(root["operations"])) {
		opResolved, err := local(root, obj(root["operations"])[opKey], "/operations/"+token(opKey))
		if err != nil {
			return nil, err
		}
		op := opResolved.value
		if op["action"] != "send" && op["action"] != "receive" {
			cells = append(cells, cell{op: opKey, state: "invalid", invalidOwner: "#" + opResolved.pointer})
			continue
		}
		chResolved, err := local(root, op["channel"], "")
		if err != nil {
			return nil, err
		}
		ch, chp := chResolved.value, chResolved.pointer
		if chResolved.firstRoot("channels") == "" {
			return nil, fmt.Errorf("component-only channel ownership outside witness packet")
		}
		servers := keys(obj(root["servers"]))
		if has(ch, "servers") {
			list, ok := ch["servers"].([]any)
			if !ok {
				return nil, fmt.Errorf("invalid membership")
			}
			if len(list) > 0 {
				servers = []string{}
				for _, v := range list {
					membership, err := local(root, v, "")
					if err != nil {
						return nil, err
					}
					s := membership.firstRoot("servers")
					if s == "" {
						return nil, fmt.Errorf("nonroot membership outside witness packet")
					}
					if strings.ContainsAny(s, "/%~") {
						return nil, fmt.Errorf("escaped membership outside witness packet")
					}
					servers = append(servers, s)
				}
			}
		}
		if len(servers) == 0 {
			return nil, fmt.Errorf("zero-server accounting outside witness packet")
		}
		seen := map[string]bool{}
		for _, s := range servers {
			if seen[s] {
				continue
			}
			seen[s] = true
			srvResolved, err := local(root, obj(root["servers"])[s], "/servers/"+token(s))
			if err != nil {
				return nil, err
			}
			srv := srvResolved.value
			c := cell{op: opKey, server: s, selector: "#/servers/" + s + "/operations/" + token(opKey), state: "excluded"}
			bindings := obj(op["bindings"])
			hb := obj(bindings["http"])
			admitted := op["action"] == "receive" && len(bindings) == 1 && hb != nil
			for k, v := range hb {
				if (k != "method" && k != "bindingVersion") || (k == "method" && v != "POST") || (k == "bindingVersion" && v != "0.3.0") {
					admitted = false
				}
			}
			for _, field := range []string{"messages", "traits", "reply"} {
				if has(op, field) {
					admitted = false
				}
			}
			if has(op, "security") {
				v, ok := op["security"].([]any)
				admitted = admitted && ok && len(v) == 0
			}
			admitted = admitted && srv["protocol"] == "http" && (!has(srv, "protocolVersion") || srv["protocolVersion"] == "1.1")
			admitted = admitted && !has(srv, "security") && !has(srv, "variables") && (!has(srv, "bindings") || emptyHTTP(srv["bindings"])) && authority(str(srv["host"]))
			base := "/"
			if has(srv, "pathname") {
				base = str(srv["pathname"])
			}
			addr := str(ch["address"])
			admitted = admitted && pathPattern.MatchString(base) && pathPattern.MatchString(addr) && !has(ch, "parameters") && (!has(ch, "bindings") || emptyHTTP(ch["bindings"]))
			messages := obj(ch["messages"])
			admitted = admitted && len(messages) == 1
			for k, v := range messages {
				admitted = admitted && empty(v)
				c.message = "#" + chp + "/messages/" + token(k)
			}
			if admitted {
				c.state = "represented"
				c.authority = str(srv["host"])
				c.path = strings.TrimSuffix(base, "/") + "/" + strings.TrimPrefix(addr, "/")
			}
			cells = append(cells, c)
		}
	}
	return cells, nil
}
func synth(source object, cells []cell) object {
	operations := object{}
	bindings := object{}
	entries := []any{}
	opList := []any{}
	bindingList := []any{}
	for _, c := range cells {
		if c.state == "represented" {
			operations[key("operation", c.op)] = object{"input": contract()}
		}
	}
	for _, k := range keys(operations) {
		opList = append(opList, k)
	}
	all := true
	for _, c := range cells {
		if c.state == "invalid" {
			all = false
			entries = append(entries, object{"sourceIndex": 0, "sourceRef": c.invalidOwner, "scope": "target", "status": "invalid", "operationKey": c.op, "rule": "ASYNC31-S-02", "requirements": []any{}})
			continue
		}
		opKey := c.op
		if has(operations, key("operation", c.op)) {
			opKey = key("operation", c.op)
		}
		rule := "ASYNC31-S-03"
		if c.state == "represented" {
			rule = "ASYNC31-S-08"
		} else {
			all = false
		}
		entry := object{"sourceIndex": 0, "sourceRef": c.selector, "scope": "protocol-cell", "status": c.state, "operationKey": opKey, "bindingSelector": c.selector, "rule": rule, "requirements": []any{}}
		entries = append(entries, entry)
		if c.state == "represented" {
			bindings[key("binding", c.selector)] = object{"operation": opKey, "source": key("source", ""), "selector": c.selector}
			bindingList = append(bindingList, object{"operationKey": opKey, "bindingSelector": c.selector})
			entries = append(entries, object{"sourceIndex": 0, "sourceRef": c.message, "scope": "message-alternative", "status": "represented", "operationKey": opKey, "bindingSelector": c.selector, "rule": "ASYNC31-S-11", "requirements": []any{}})
		}
	}
	return object{"operations": opList, "bindings": bindingList, "document": object{"sources": object{key("source", ""): source}, "operations": operations, "bindings": bindings}, "coverage": object{"exhaustive": true, "fullyRepresented": all, "entries": entries}}
}
func readHead(r *bufio.Reader) (*http.Response, []byte, error) {
	var raw bytes.Buffer
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			return nil, nil, err
		}
		raw.WriteString(line)
		if raw.Len() > 65536 {
			return nil, nil, witnessLimit("witness head limit")
		}
		if line == "\r\n" {
			break
		}
		if !strings.HasSuffix(line, "\r\n") {
			return nil, nil, fmt.Errorf("bare newline")
		}
	}
	b := raw.Bytes()
	// net/http stores Content-Length in int64. A larger canonical decimal is
	// outside this witness's numeric apparatus, not malformed HTTP grammar.
	for _, line := range strings.Split(string(b), "\r\n")[1:] {
		name, value, ok := strings.Cut(line, ":")
		value = strings.Trim(value, " \t")
		if ok && strings.EqualFold(name, "Content-Length") && decimal.MatchString(value) {
			if _, err := strconv.ParseInt(value, 10, 64); err != nil {
				return nil, nil, witnessLimit("Content-Length exceeds witness int64 capacity")
			}
		}
	}
	resp, err := http.ReadResponse(bufio.NewReader(bytes.NewReader(b)), &http.Request{Method: "POST"})
	return resp, b, err
}

var httpToken = "[!#$%&'*+.^_`|~0-9A-Za-z-]+"
var mediaGrammar = regexp.MustCompile("^" + httpToken + "/" + httpToken +
	`(?:[ \t]*;[ \t]*(?:` + httpToken + `=(?:` + httpToken +
	`|"(?:[\t\x20-\x21\x23-\x5B\x5D-\x7E\x{80}-\x{10FFFF}]|\\[\t\x20-\x7E\x{80}-\x{10FFFF}])*"))?)*$`)

func mediaTypeValid(value string) bool {
	// The standard MIME parser interprets duplicate/extended parameters and
	// admits BWS around '='. This profile only validates HTTP grammar and never
	// interprets parameters: qualify the raw grammar, then parse the base type.
	if !utf8.ValidString(value) || !mediaGrammar.MatchString(value) {
		return false
	}
	base, _, _ := strings.Cut(value, ";")
	_, _, err := mime.ParseMediaType(strings.Trim(base, " \t"))
	return err == nil
}

func headValid(resp *http.Response, raw []byte) (int64, bool) {
	if resp.Proto != "HTTP/1.1" || resp.StatusCode < 100 || resp.StatusCode > 599 || resp.StatusCode == 101 {
		return 0, false
	}
	fields := map[string][]string{}
	lines := strings.Split(string(raw), "\r\n")
	for _, line := range lines[1 : len(lines)-2] {
		k, v, ok := strings.Cut(line, ":")
		if !ok || !regexp.MustCompile("^[!#$%&'*+.^_`|~0-9A-Za-z-]+$").MatchString(k) {
			return 0, false
		}
		v = strings.Trim(v, " \t")
		fields[strings.ToLower(k)] = append(fields[strings.ToLower(k)], v)
	}
	for _, k := range []string{"transfer-encoding", "trailer", "content-encoding"} {
		if len(fields[k]) > 0 {
			return 0, false
		}
	}
	connection := fields["connection"]
	if len(connection) > 1 || (len(connection) == 1 && !strings.EqualFold(connection[0], "close")) {
		return 0, false
	}
	lengths := fields["content-length"]
	if len(lengths) > 1 {
		return 0, false
	}
	length := int64(-1)
	if len(lengths) == 1 {
		if !decimal.MatchString(lengths[0]) {
			return 0, false
		}
		var err error
		length, err = strconv.ParseInt(lengths[0], 10, 64)
		if err != nil {
			return 0, false
		}
	}
	ct := fields["content-type"]
	if len(ct) > 1 {
		return 0, false
	}
	if len(ct) == 1 {
		if !mediaTypeValid(ct[0]) {
			return 0, false
		}
	}
	status := resp.StatusCode
	if status < 200 || status == 204 {
		return 0, len(lengths) == 0
	}
	if status == 304 {
		return 0, true
	}
	if status == 205 {
		return 0, length == 0
	}
	return length, length >= 0
}
func loadEnvelope(root object) bool {
	if root["asyncapi"] != "3.1.0" {
		return false
	}
	info := obj(root["info"])
	if info == nil {
		return false
	}
	if _, ok := info["title"].(string); !ok {
		return false
	}
	if _, ok := info["version"].(string); !ok {
		return false
	}
	for _, field := range []string{"servers", "channels", "operations", "components"} {
		if has(root, field) && obj(root[field]) == nil {
			return false
		}
	}
	return true
}

func run(in object) result { return runObserved(in, nil) }

func runObserved(in object, observe func(object)) (r result) {
	given := obj(in["given"])
	source := obj(given["source"])
	r = result{Disposition: "refusal", Phase: "pre-dispatch", Outputs: []any{}, Events: []string{}, Statuses: []int{}, Trace: object{"status": "not-observed"}}
	published := false
	publish := func() {
		if !published && in["mode"] != "synthesis" && r.Disposition != "witness-unsupported" {
			published = true
			if observe != nil {
				observe(terminal(r))
			}
		}
	}
	defer publish()
	for _, field := range []string{"keyMaterializations", "resources", "resourceBytes"} {
		if has(given, field) {
			r.Disposition = "witness-unsupported"
			r.Limitation = "External/byte/non-scalar carriage outside M1a"
			return r
		}
	}
	if obj(source["content"]) == nil {
		r.Disposition = "witness-unsupported"
		r.Limitation = "Only object carriage implemented in M1a"
		return r
	}
	if !loadEnvelope(obj(source["content"])) {
		r.Phase = "load"
		r.Synthesis = object{"outcome": "refused", "operations": []any{}, "bindings": []any{}, "coverage": object{"exhaustive": true, "fullyRepresented": false, "entries": []any{}}}
		return r
	}
	cells, err := inventory(source)
	if err != nil {
		r.Disposition = "witness-unsupported"
		r.Limitation = err.Error()
		return r
	}
	r.Synthesis = synth(source, cells)
	if in["mode"] == "synthesis" {
		r.Disposition = "synthesized"
		r.Phase = "synthesis"
		return r
	}
	binding := obj(given["binding"])
	selector := str(binding["selector"])
	selected := []cell{}
	for _, c := range cells {
		if (selector != "" && c.selector == selector) || (selector == "" && c.state == "represented") {
			selected = append(selected, c)
		}
	}
	if len(selected) != 1 {
		r.Phase = "resolution"
		return r
	}
	c := selected[0]
	if c.state != "represented" {
		return r
	}
	if has(given, "configuration") && !empty(given["configuration"]) {
		return r
	}
	operation := obj(given["operation"])
	if !reflect.DeepEqual(operation["input"], contract()) || has(operation, "output") || has(binding, "inputTransform") || has(binding, "outputTransform") {
		return r
	}
	inv := obj(given["invocation"])
	cancel := ""
	values := []any{}
	if has(inv, "actions") {
		actions, ok := inv["actions"].([]any)
		if !ok {
			r.Disposition = "witness-unsupported"
			return r
		}
		for _, v := range actions {
			a := obj(v)
			switch a["kind"] {
			case "write":
				values = append(values, a["value"])
			case "await-native":
				cancel = str(a["name"])
			case "cancel":
				if cancel == "" {
					cancel = "connection-attempted"
				}
			default:
				r.Disposition = "witness-unsupported"
				return r
			}
		}
		if len(actions) == 0 || obj(actions[len(actions)-1])["kind"] != "cancel" {
			cancel = ""
		}
	} else if inv["inputPresent"] == true {
		values = append(values, inv["input"])
	}
	if len(values) != 1 || !empty(values[0]) {
		return r
	}
	if actions, ok := inv["actions"].([]any); ok {
		// This packet implements one explicit causal barrier, not arbitrary
		// action traces. Unsupported traces must never look like conformance.
		valid := len(actions) == 3 && obj(actions[0])["kind"] == "write" && obj(actions[1])["kind"] == "await-native" && obj(actions[1])["count"] == json.Number("1") && obj(actions[2])["kind"] == "cancel"
		known := map[string]bool{"connection-attempted": true, "connection-opened": true, "request-started": true, "dispatch": true, "acknowledgement": true}
		if !valid || !known[cancel] {
			r.Disposition = "witness-unsupported"
			r.Limitation = "Only one count-1 cancellation barrier implemented in M1a"
			return r
		}
	}
	r.Events = append(r.Events, "input-accepted", "connection-attempted")
	r.Trace = object{"status": "invalid"}
	r.Disposition = "error"
	r.Phase = "interaction"
	cancelled := func() {
		r.Events = append(r.Events, "cancellation-propagated")
		r.Disposition = "cancelled"
		r.Trace = object{"status": "valid"}
	}
	if cancel == "connection-attempted" {
		cancelled()
		return r
	}
	// Explicit harness routing only: never dial an authored external endpoint.
	endpoint := str(in["peerAddress"])
	host, _, err := net.SplitHostPort(endpoint)
	if err != nil || host != "127.0.0.1" {
		r.Disposition = "witness-unsupported"
		r.Limitation = "Explicit loopback peer mapping required"
		return r
	}
	conn, err := net.DialTimeout("tcp", endpoint, time.Second)
	if err != nil {
		markApparatusFailure(&r, err)
		return r
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(3 * time.Second))
	r.Events = append(r.Events, "connection-opened")
	if cancel == "connection-opened" {
		cancelled()
		r.Events = append(r.Events, "connection-closed")
		return r
	}
	wire := "POST " + c.path + " HTTP/1.1\r\nHost: " + c.authority + "\r\n\r\n"
	n, err := io.WriteString(conn, wire[:1])
	r.Request = wire[:n]
	if err != nil {
		markApparatusFailure(&r, err)
		return r
	}
	r.Events = append(r.Events, "request-started")
	if cancel == "request-started" {
		cancelled()
		r.Events = append(r.Events, "connection-closed")
		return r
	}
	n, err = io.WriteString(conn, wire[1:])
	r.Request += wire[1 : 1+n]
	if err != nil {
		markApparatusFailure(&r, err)
		return r
	}
	r.Events = append(r.Events, "dispatch")
	if cancel == "dispatch" {
		cancelled()
		r.Events = append(r.Events, "connection-closed")
		return r
	}
	reader := bufio.NewReader(conn)
	r.Phase = "response"
	for i := 0; i < 32; i++ {
		resp, raw, err := readHead(reader)
		if err != nil {
			markApparatusFailure(&r, err)
			return r
		}
		length, valid := headValid(resp, raw)
		if !valid {
			return r
		}
		r.Statuses = append(r.Statuses, resp.StatusCode)
		r.Events = append(r.Events, "acknowledgement")
		if cancel == "acknowledgement" && (resp.StatusCode < 200 || length > 0) {
			cancelled()
			r.Phase = "interaction"
			r.Events = append(r.Events, "connection-closed")
			return r
		}
		if resp.StatusCode < 200 {
			continue
		}
		if length > 1048576 {
			r.Disposition = "witness-unsupported"
			r.Limitation = "One MiB witness body limit"
			return r
		}
		if _, err := io.CopyN(io.Discard, reader, length); err != nil {
			markApparatusFailure(&r, err)
			return r
		}
		if resp.StatusCode < 300 && length != 0 {
			return r
		}
		r.Phase = "completion"
		if resp.StatusCode < 300 {
			r.Disposition = "complete"
		}
		r.Trace = object{"status": "incomplete"}
		// Publish at the framed boundary before inspecting even an already
		// buffered next octet. The trace observer cannot replace this result.
		publish()
		if observe == nil {
			return r
		}
		if _, err := reader.ReadByte(); err == io.EOF {
			r.Trace = object{"status": "valid"}
		} else if err == nil {
			r.Trace = object{"status": "invalid", "connectionPoisoned": true}
		} else {
			r.Limitation = "Trace observation incomplete: " + err.Error()
		}
		return r
	}
	r.Disposition = "witness-unsupported"
	r.Limitation = "32-head witness limit"
	return r
}
func main() {
	dec := json.NewDecoder(os.Stdin)
	dec.UseNumber()
	var input object
	if err := dec.Decode(&input); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	if err := dec.Decode(new(any)); err != io.EOF {
		fmt.Fprintln(os.Stderr, "trailing input")
		os.Exit(2)
	}
	encoder := json.NewEncoder(os.Stdout)
	r := runObserved(input, func(value object) {
		if err := encoder.Encode(object{"kind": "terminal", "value": value}); err != nil {
			panic(err)
		}
	})
	if err := encoder.Encode(r); err != nil {
		panic(err)
	}
}
