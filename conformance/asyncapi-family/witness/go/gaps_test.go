package main

// Literal expectations frozen from candidate §§3–5 in GAP-EXECUTION-R0.md.
// No primary evaluator output is imported to construct an expected result.
import (
	"encoding/json"
	"io"
	"net"
	"os"
	"reflect"
	"testing"
)

func baseGiven(t *testing.T) object {
	t.Helper()
	b, err := os.ReadFile("../http-cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture object
	if err := json.Unmarshal(b, &fixture); err != nil {
		t.Fatal(err)
	}
	return obj(fixture["base"])
}

func TestLoadEnvelope(t *testing.T) {
	for _, field := range []string{"info", "info.title", "info.version", "servers", "channels", "operations", "components"} {
		for _, value := range []any{nil, false, 42, "wrong", []any{}} {
			t.Run(field+"/"+typeLabel(value), func(t *testing.T) {
				given := baseGiven(t)
				root := obj(obj(given["source"])["content"])
				if field == "info.title" {
					obj(root["info"])["title"] = value
				} else if field == "info.version" {
					obj(root["info"])["version"] = value
				} else {
					root[field] = value
				}
				if (field == "info.title" || field == "info.version") && value == "wrong" {
					return
				}
				r := run(object{"mode": "synthesis", "given": given})
				if r.Disposition != "refusal" || r.Phase != "load" {
					t.Fatalf("G01.load: got %s/%s", r.Disposition, r.Phase)
				}
				want := object{"outcome": "refused", "operations": []any{}, "bindings": []any{}, "coverage": object{"exhaustive": true, "fullyRepresented": false, "entries": []any{}}}
				if !reflect.DeepEqual(r.Synthesis, want) {
					t.Fatalf("G01.no-generated-artifacts: %#v", r.Synthesis)
				}
				if len(r.Events) != 0 || r.Request != "" {
					t.Fatal("G01.no-activity")
				}
			})
		}
	}
	for _, field := range []string{"info", "title", "version"} {
		t.Run("missing/"+field, func(t *testing.T) {
			g := baseGiven(t)
			root := obj(obj(g["source"])["content"])
			if field == "info" {
				delete(root, field)
			} else {
				delete(obj(root["info"]), field)
			}
			r := run(object{"given": g})
			if r.Disposition != "refusal" || r.Phase != "load" || len(r.Events) != 0 {
				t.Fatalf("G01.missing: %#v", r)
			}
		})
	}
	g := baseGiven(t)
	info := obj(obj(obj(g["source"])["content"])["info"])
	info["title"] = ""
	info["version"] = ""
	if r := run(object{"mode": "synthesis", "given": g}); r.Disposition != "synthesized" {
		t.Fatalf("empty strings are valid required strings: %#v", r)
	}
}

func typeLabel(v any) string {
	if v == nil {
		return "null"
	}
	return reflect.TypeOf(v).String()
}

func TestInvalidOperationOwner(t *testing.T) {
	for _, referenced := range []bool{false, true} {
		for _, action := range []any{"invalid", nil, 42} {
			g := baseGiven(t)
			root := obj(obj(g["source"])["content"])
			ops := obj(root["operations"])
			good := obj(ops["op"])
			bad := object{"action": action, "channel": good["channel"], "bindings": good["bindings"]}
			ops["bad"] = bad
			owner := "#/operations/bad"
			if referenced {
				root["components"] = object{"operations": object{"broken": bad}}
				ops["bad"] = object{"$ref": "#/components/operations/broken"}
				owner = "#/components/operations/broken"
			}
			r := run(object{"mode": "synthesis", "given": g})
			s := obj(r.Synthesis)
			if r.Disposition != "synthesized" {
				t.Fatalf("G02.sibling-survives: %#v", r)
			}
			wantOps := []any{"asyncapi31.operation.30006f70"}
			if !reflect.DeepEqual(s["operations"], wantOps) {
				t.Fatalf("G02.no-ghost: %#v", s)
			}
			want := object{"sourceIndex": 0, "sourceRef": owner, "scope": "target", "status": "invalid", "operationKey": "bad", "rule": "ASYNC31-S-02", "requirements": []any{}}
			entries := obj(s["coverage"])["entries"].([]any)
			if len(entries) != 3 || !reflect.DeepEqual(entries[0], want) {
				t.Fatalf("G02.exact-owner: %#v", entries)
			}
			if obj(s["coverage"])["fullyRepresented"] != false || len(obj(obj(s["document"])["bindings"])) != 1 {
				t.Fatalf("G02.accounting: %#v", s)
			}
		}
	}
	g := baseGiven(t)
	obj(obj(obj(obj(g["source"])["content"])["operations"])["op"])["action"] = "send"
	r := run(object{"mode": "synthesis", "given": g})
	entries := obj(obj(r.Synthesis)["coverage"])["entries"].([]any)
	if len(entries) != 1 || obj(entries[0])["status"] != "excluded" || obj(entries[0])["scope"] != "protocol-cell" {
		t.Fatalf("valid send is excluded, not invalid: %#v", entries)
	}
}

func TestAuthorityCompatibility(t *testing.T) {
	for _, host := range []string{"example.test", "123", "127.0.0.1", "[::1]", "[2001:DB8:0:0:0:0:0:1]", "[::ffff:192.0.2.1]", "[vF.name:part]", "host:0", "host:65535", "host:00080", "a%2Fb"} {
		if !authority(host) {
			t.Errorf("G03.valid %q", host)
		}
	}
	for _, host := range []string{"[127.0.0.1]", "[127.0.0.1]:80", "[::1", "::1", "[::1]x", "[192.0.2.1::]", "[fe80::1%25en0]", "host:", "host:-1", "host:65536", "user@host", "host/path", "host?query", "host#fragment", "host name", "a%2fb", ""} {
		if authority(host) {
			t.Errorf("G03.invalid %q", host)
		}
	}
}

func TestApparatusFailures(t *testing.T) {
	for _, err := range []error{&net.DNSError{IsTimeout: true}, witnessLimit("head size")} {
		r := result{Disposition: "error", Phase: "response"}
		markApparatusFailure(&r, err)
		if r.Disposition != "witness-unsupported" || r.Limitation == "" {
			t.Fatalf("apparatus failure is not a protocol verdict: %#v", r)
		}
	}
	r := result{Disposition: "error", Phase: "response"}
	markApparatusFailure(&r, io.ErrUnexpectedEOF)
	if r.Disposition != "error" {
		t.Fatal("truncated protocol content remains a response error")
	}
}
