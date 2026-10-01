package main

import (
	"context"
	"errors"
	"net"
	"strings"
	"testing"

	openbindings "github.com/openbindings/openbindings-go"
	"github.com/openbindings/openbindings-go/schemaeval"
)

// The runner's judges are held to standing controls: a tiny synthetic corpus
// with one deliberately wrong expectation per action and per judging branch,
// each of which must FAIL (or fall short), beside a correct twin that must
// pass, so a judge made lenient fails here and so fails the CI job before
// it can pass a broken run.

type judgeControl struct {
	name   string
	action string
	raw    string
	want   string // the run category the judge must report
	detail string // a fragment its detail must hold
}

const (
	twoBindings = `{"openbindings": "0.2.0", "operations": {"createTask": {"aliases": ["tasks.create"]}, "other": {}},
		"sources": {"s": {"kind": "example.test@1"}},
		"bindings": {"primary": {"operation": "createTask", "source": "s"}, "elsewhere": {"operation": "other", "source": "s"}}}`
	collision = `{"openbindings": "0.2.0", "operations": {"a": {}, "b": {"aliases": ["a"]}}}`
	stringOp  = `{"openbindings": "0.2.0", "operations": {"op": {"input": {"type": "string", "pattern": "^a$"}}}}`
	cycle     = `{"openbindings": "0.2.0", "operations": {"op": {"input": {"$ref": "#/schemas/Node"}}},
		"schemas": {"Node": {"type": "object", "properties": {"next": {"$ref": "#/schemas/Node"}}}}}`
	badPattern = `{"openbindings": "0.2.0", "operations": {"op": {"input": {"type": "string", "pattern": "(?i)^a$"}}}}`
	kinds      = `{"openbindings": "0.2.0", "operations": {"op": {}},
		"sources": {"s": {"kind": "example.openapi@1"}}, "bindings": {"b": {"operation": "op", "source": "s"}},
		"dependencies": {"d": {"operation": "op", "kinds": ["example.openapi@1"]}}}`
	examples = `{"openbindings": "0.2.0", "operations": {"op": {"input": {"type": "string"}, "output": {"type": "integer"},
		"examples": {"good": {"input": "x", "output": 1}, "bad": {"input": 5}}}}}`
	future = `{"openbindings": "9.9.9", "operations": {}}`
)

func evidence(overrides map[string]string) string {
	out := []string{}
	for _, rule := range openbindings.DocumentRules() {
		status := "satisfied"
		if s, ok := overrides[rule]; ok {
			status = s
		}
		out = append(out, `"`+rule+`": "`+status+`"`)
	}
	return "{" + strings.Join(out, ", ") + "}"
}

var judgeControls = []judgeControl{
	// validity fixtures
	{"validity: a violating document expected valid", "validity",
		`{"document": {"openbindings": "0.2.0", "operations": {}, "dependencies": {"d": {"operation": "missing"}}}, "valid": true}`, Fail, "established violations"},
	{"validity: a conforming document expected violating", "validity", `{"document": {"openbindings": "0.2.0", "operations": {}}, "valid": false, "violates": ["OBI-D-11"]}`, Fail, "concluded"},
	{"validity: violates names a rule the document keeps", "validity",
		`{"document": {"openbindings": "0.2.0", "operations": {}, "dependencies": {"d": {"operation": "missing"}}}, "valid": false, "violates": ["OBI-D-03"]}`, Fail, "OBI-D-03"},
	{"validity: notViolated names the rule the document violates", "validity",
		`{"document": {"openbindings": "0.2.0", "operations": {}, "dependencies": {"d": {"operation": "missing"}}}, "valid": false, "violates": ["OBI-D-11"], "notViolated": ["OBI-D-11"]}`, Fail, "notViolated"},
	{"validity: its correct twin", "validity",
		`{"document": {"openbindings": "0.2.0", "operations": {}, "dependencies": {"d": {"operation": "missing"}}}, "valid": false, "violates": ["OBI-D-11"], "notViolated": ["OBI-D-03"]}`, Pass, ""},
	{"validity: a refused document expects a conclusion", "validity", `{"document": ` + future + `, "valid": false, "violates": ["OBI-D-09"]}`, Fail, "version-refusal"},
	// validate-document
	{"validate-document: a wrong conclusion", "validate-document", `{"given": {"document": {"openbindings": "0.2.0", "operations": {}}}, "expected": {"outcome": "non-conformant"}}`, Fail, "concluded"},
	{"validate-document: conformant expected of a violating document", "validate-document",
		`{"given": {"document": {"openbindings": "0.2.0", "operations": {}, "dependencies": {"d": {"operation": "missing"}}}}, "expected": {"outcome": "conformant"}}`, Fail, "concluded non-conformant"},
	{"validate-document: violates names a rule the document keeps", "validate-document",
		`{"given": {"document": {"openbindings": "0.2.0", "operations": {}, "dependencies": {"d": {"operation": "missing"}}}}, "expected": {"outcome": "non-conformant", "violates": ["OBI-D-03"]}}`, Fail, "OBI-D-03"},
	{"validate-document: a refusal where a conclusion is expected", "validate-document", `{"given": {"document": ` + future + `}, "expected": {"outcome": "interpreted"}}`, Fail, "version-refusal"},
	{"validate-document: a conclusion where a refusal is expected", "validate-document", `{"given": {"document": {"openbindings": "0.2.0", "operations": {}}}, "expected": {"outcome": "version-refusal"}}`, Fail, "expected version-refusal"},
	{"validate-document: its correct twin", "validate-document", `{"given": {"document": ` + future + `}, "expected": {"outcome": "version-refusal"}}`, Pass, ""},
	// resolve-operation
	{"resolve-operation: binding keys of another operation", "resolve-operation",
		`{"given": {"document": ` + twoBindings + `, "name": "tasks.create"}, "expected": {"outcome": "resolved", "operationKey": "createTask", "bindingKeys": ["elsewhere", "primary"]}}`, Fail, "binding keys"},
	{"resolve-operation: no binding keys where there is one", "resolve-operation",
		`{"given": {"document": ` + twoBindings + `, "name": "createTask"}, "expected": {"outcome": "resolved", "operationKey": "createTask", "bindingKeys": []}}`, Fail, "binding keys"},
	{"resolve-operation: its correct twin", "resolve-operation",
		`{"given": {"document": ` + twoBindings + `, "name": "tasks.create"}, "expected": {"outcome": "resolved", "operationKey": "createTask", "bindingKeys": ["primary"]}}`, Pass, ""},
	{"resolve-operation: a wrong operation key", "resolve-operation",
		`{"given": {"document": ` + twoBindings + `, "name": "createTask"}, "expected": {"outcome": "resolved", "operationKey": "other", "bindingKeys": []}}`, Fail, "resolved"},
	{"resolve-operation: not-found for a name that resolves", "resolve-operation", `{"given": {"document": ` + twoBindings + `, "name": "other"}, "expected": {"outcome": "not-found"}}`, Fail, "expected not-found"},
	{"resolve-operation: a collision resolved to neither candidate", "resolve-operation",
		`{"given": {"document": ` + twoBindings + `, "name": "other"}, "expected": {"outcome": "collision", "keyMatch": "x", "aliasMatch": "y"}}`, Fail, "neither candidate"},
	{"resolve-operation: a collision is advisory (its correct twin)", "resolve-operation",
		`{"given": {"document": ` + collision + `, "name": "a", "nonConformant": ["OBI-D-04"]}, "expected": {"outcome": "collision", "keyMatch": "a", "aliasMatch": "b"}}`, Advisory, ""},
	{"resolve-operation: a refusal where a resolution is expected", "resolve-operation", `{"given": {"document": ` + future + `, "name": "x"}, "expected": {"outcome": "not-found"}}`, Fail, "version-refusal"},
	// conclude-conformance
	{"conclude-conformance: conformant despite a violation", "conclude-conformance",
		`{"given": {"evidence": ` + evidence(map[string]string{"OBI-D-05": "violated"}) + `}, "expected": {"conclusion": "conformant"}}`, Fail, "concluded non-conformant"},
	{"conclude-conformance: non-conformant without a violation", "conclude-conformance",
		`{"given": {"evidence": ` + evidence(map[string]string{"OBI-D-05": "inconclusive"}) + `}, "expected": {"conclusion": "non-conformant"}}`, Fail, "concluded"},
	{"conclude-conformance: conformant admits undetermined (its correct twin)", "conclude-conformance",
		`{"given": {"evidence": ` + evidence(map[string]string{"OBI-D-05": "inconclusive"}) + `}, "expected": {"conclusion": "conformant"}}`, Pass, ""},
	// check-dependency-kind
	{"check-dependency-kind: meets for a kind the list does not hold", "check-dependency-kind",
		`{"given": {"document": ` + strings.Replace(kinds, `"kinds": ["example.openapi@1"]`, `"kinds": ["example.openapi@2"]`, 1) + `, "dependency": "d", "binding": "b"}, "expected": {"outcome": "meets"}}`, Fail, "does-not-meet"},
	{"check-dependency-kind: does-not-meet for a listed kind", "check-dependency-kind",
		`{"given": {"document": ` + kinds + `, "dependency": "d", "binding": "b"}, "expected": {"outcome": "does-not-meet"}}`, Fail, "meets"},
	{"check-dependency-kind: its correct twin, observed", "check-dependency-kind",
		`{"given": {"document": ` + strings.Replace(kinds, `"example.openapi@1"]`, `"{retrieval-sentinel:http}"]`, 1) + `, "dependency": "d", "binding": "b", "retrievalSentinels": ["http"]}, "expected": {"outcome": "does-not-meet"}}`, Pass, ""},
	// validate-operation-values
	{"values: a wrong verdict", "validate-operation-values",
		`{"given": {"document": ` + stringOp + `, "operation": "op", "side": "input", "values": ["a", "b"]}, "expected": {"results": ["valid", "valid"]}}`, Fail, "value 1"},
	{"values: fewer results than values", "validate-operation-values",
		`{"given": {"document": ` + stringOp + `, "operation": "op", "side": "input", "values": ["a", "b"]}, "expected": {"results": ["valid"]}}`, Fail, "expected results"},
	{"values: a forbidden reason", "validate-operation-values",
		`{"given": {"document": ` + badPattern + `, "operation": "op", "side": "input", "values": ["a"]}, "expected": {"results": ["no-verdict"], "forbidReasons": ["undefined-result"]}}`, Fail, "forbidden"},
	{"values: its correct twin", "validate-operation-values",
		`{"given": {"document": ` + badPattern + `, "operation": "op", "side": "input", "values": ["a"]}, "expected": {"results": ["no-verdict"], "forbidReasons": ["invalid-reference"]}}`, Pass, ""},
	{"values: orNoVerdict does not admit the opposite verdict", "validate-operation-values",
		`{"given": {"document": ` + stringOp + `, "operation": "op", "side": "input", "values": ["b"]}, "expected": {"results": [{"verdict": "valid", "orNoVerdict": true}]}}`, Fail, "value 0"},
	{"values: no verdict where none is permitted falls short", "validate-operation-values",
		`{"given": {"document": ` + badPattern + `, "operation": "op", "side": "input", "values": ["a"]}, "expected": {"results": ["valid"]}}`, Shortfall, "no verdict"},
	{"values: dependsOn a feature declared unsupported requires no verdict", "validate-operation-values",
		`{"given": {"document": ` + stringOp + `, "operation": "op", "side": "input", "values": ["a"]}, "expected": {"results": ["valid"], "dependsOn": ["draft-07-dialect"]}}`, Fail, "unsupported"},
	{"values: dependsOn a feature the profile does not declare", "validate-operation-values",
		`{"given": {"document": ` + stringOp + `, "operation": "op", "side": "input", "values": ["a"]}, "expected": {"results": ["valid"], "dependsOn": ["no-such-feature"]}}`, Fail, "does not declare"},
	{"values: a per-value dependsOn replaces the scenario's", "validate-operation-values",
		`{"given": {"document": ` + cycle + `, "operation": "op", "side": "input", "values": [{"next": {}}]}, "expected": {"results": [{"verdict": "valid", "dependsOn": ["draft-07-dialect"]}], "dependsOn": ["recursive-references"]}}`, Fail, "unsupported"},
	{"values: a refusal where values are expected", "validate-operation-values",
		`{"given": {"document": ` + future + `, "operation": "op", "side": "input", "values": ["a"]}, "expected": {"results": ["valid"]}}`, Fail, "version-refusal"},
	{"values: values where a refusal is expected", "validate-operation-values",
		`{"given": {"document": ` + stringOp + `, "operation": "op", "side": "input", "values": ["a"]}, "expected": {"outcome": "version-refusal"}}`, Fail, "expected version-refusal"},
	// check-examples
	{"check-examples: a false claim expected to hold", "check-examples",
		`{"given": {"document": ` + examples + `, "operation": "op"}, "expected": {"examples": {"good": {"input": "holds", "output": "holds"}, "bad": {"input": "holds"}}}}`, Fail, "false-claim"},
	{"check-examples: an example expected that the operation does not have", "check-examples",
		`{"given": {"document": ` + examples + `, "operation": "op"}, "expected": {"examples": {"good": {"input": "holds", "output": "holds"}, "bad": {"input": "false-claim"}, "missing": {"input": "holds"}}}}`, Fail, "missing"},
	{"check-examples: its correct twin", "check-examples",
		`{"given": {"document": ` + examples + `, "operation": "op"}, "expected": {"examples": {"good": {"input": "holds", "output": "holds"}, "bad": {"input": "false-claim"}}}}`, Pass, ""},
}

func TestJudgeControls(t *testing.T) {
	r := &run{evaluator: schemaeval.New(schemaeval.Options{}), lines: []string{"0.2"}, strict: true}
	for _, c := range judgeControls {
		status, detail := r.judge(Case{ID: c.name, Action: c.action, Raw: []byte(c.raw)})
		if status != c.want || !strings.Contains(detail, c.detail) {
			t.Errorf("%s: %s %q; want %s (%q)", c.name, status, detail, c.want, c.detail)
		}
	}
}

// A version refusal is exclusive: anything it comes with is reported.
func TestRefusalResidueControls(t *testing.T) {
	refusal := &openbindings.VersionRefusalError{Version: "9.9.9"}
	if got := refusalResidue(nil, openbindings.ValidationReport{}, refusal); len(got) != 0 {
		t.Errorf("an exclusive refusal: %v", got)
	}
	got := refusalResidue(&openbindings.Document{}, openbindings.ValidationReport{Conclusion: openbindings.ConclusionNonConformant},
		errors.Join(refusal, &openbindings.ValidationError{}))
	if len(got) != 3 {
		t.Errorf("a refusal with a document, a report, and a violation: %v", got)
	}
}

// The http sentinel counts a connection from any client to the address it
// substitutes; the case then fails.
func TestSentinelControls(t *testing.T) {
	s, err := startSentinels([]string{"http"})
	if err != nil {
		t.Fatal(err)
	}
	doc := string(s.substitute([]byte(`{"kind": "{retrieval-sentinel:http}"}`)))
	addr := strings.TrimSuffix(strings.TrimPrefix(strings.Split(doc, `"`)[3], "http://"), "/obi-kind-sentinel")
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		t.Fatal(err)
	}
	conn.Close()
	if seen := s.stop(); !strings.Contains(seen, "observed 1 connection") {
		t.Errorf("a connection to the http sentinel: %q", seen)
	}
	quiet, err := startSentinels([]string{"http"})
	if err != nil {
		t.Fatal(err)
	}
	if seen := quiet.stop(); seen != "" {
		t.Errorf("no retrieval: %q", seen)
	}
}

// The checks below fire only when the SDK misbehaves, so each is held at its
// call site: the control stands in for the misbehaving SDK call (or for a
// retrieval) and drives the judge itself, beside a direct control of the
// helper where there is one.

const conformingDocument = `{"openbindings": "0.2.0", "operations": {}}`

// A conclusion naming another applied text than the declared one fails at
// judgeDocument, even when the declared text is verified.
func TestNamingAtTheCallSite(t *testing.T) {
	_, report, err := openbindings.ValidateDocument([]byte(conformingDocument))
	if err != nil {
		t.Fatal(err)
	}
	raw := []byte(`{"given": {"document": ` + conformingDocument + `}, "expected": {"outcome": "conformant", "namesAppliedText": true}}`)
	declared := &run{evaluator: schemaeval.New(schemaeval.Options{}), lines: []string{"0.2"}, strict: true, release: report.Version, revision: report.Revision, verified: true}
	if status, detail := declared.judge(Case{Action: "validate-document", Raw: raw}); status != Pass {
		t.Errorf("the SDK's own applied text: %s %q", status, detail)
	}
	other := *declared
	other.revision = strings.Repeat("b", 40)
	if status, detail := other.judge(Case{Action: "validate-document", Raw: raw}); status != Fail || !strings.Contains(detail, "names") {
		t.Errorf("another declared applied text: %s %q; want FAIL (names)", status, detail)
	}
}

// What the sentinel observes during the action fails judgeKind: a starter
// that retrieves the kind's address as the action starts stands in for an
// SDK that dereferences it.
func TestKindObservationAtTheCallSite(t *testing.T) {
	defer func(previous func([]string) (*sentinels, error)) { sentinelStarter = previous }(sentinelStarter)
	sentinelStarter = func(channels []string) (*sentinels, error) {
		s, err := startSentinels(channels)
		if err != nil {
			return nil, err
		}
		conn, err := net.Dial("tcp", s.listener.Addr().String())
		if err != nil {
			return nil, err
		}
		conn.Close()
		return s, nil
	}
	raw := []byte(`{"given": {"document": ` + strings.Replace(kinds, `"example.openapi@1"]`, `"{retrieval-sentinel:http}"]`, 1) +
		`, "dependency": "d", "binding": "b", "retrievalSentinels": ["http"]}, "expected": {"outcome": "does-not-meet"}}`)
	r := &run{evaluator: schemaeval.New(schemaeval.Options{}), lines: []string{"0.2"}, strict: true}
	if status, detail := r.judge(Case{Action: "check-dependency-kind", Raw: raw}); status != Fail || !strings.Contains(detail, "observed 1 connection") {
		t.Errorf("a retrieval during the action: %s %q; want FAIL", status, detail)
	}
}

func TestParseRefusalResidue(t *testing.T) {
	refusal := &openbindings.VersionRefusalError{Version: "9.9.9"}
	for _, c := range []struct {
		name   string
		doc    *openbindings.Document
		err    error
		want   int
		detail string
	}{
		{"an exclusive refusal", nil, refusal, 0, ""},
		{"a refusal with a document", &openbindings.Document{}, refusal, 1, "a document"},
		{"a refusal with a violation", nil, errors.Join(refusal, &openbindings.ValidationError{}), 1, "ValidationError"},
		{"no refusal", nil, nil, 1, "no version refusal"},
		{"a document and no refusal", &openbindings.Document{}, nil, 2, "a document"},
	} {
		got := parseRefusalResidue(c.doc, c.err)
		if len(got) != c.want || (c.want > 0 && !strings.Contains(strings.Join(got, ", "), c.detail)) {
			t.Errorf("%s: %v", c.name, got)
		}
	}
}

func TestValueRefusalResidue(t *testing.T) {
	refusal := &openbindings.VersionRefusalError{Version: "9.9.9"}
	for _, c := range []struct {
		name      string
		contracts *openbindings.ValueContracts
		err       error
		want      int
	}{
		{"an exclusive refusal", nil, refusal, 0},
		{"a refusal with value contracts", &openbindings.ValueContracts{}, refusal, 1},
		{"a refusal with a violation", nil, errors.Join(refusal, &openbindings.ValidationError{}), 1},
	} {
		if got := valueRefusalResidue(c.contracts, c.err); len(got) != c.want {
			t.Errorf("%s: %v", c.name, got)
		}
	}
}

// A refusal ParseDocument does not share exclusively fails judgeDocument.
func TestParseExclusivityAtTheCallSite(t *testing.T) {
	defer func(previous func([]byte) (*openbindings.Document, error)) { parseDocument = previous }(parseDocument)
	raw := []byte(`{"given": {"document": ` + future + `}, "expected": {"outcome": "version-refusal"}}`)
	r := &run{evaluator: schemaeval.New(schemaeval.Options{}), lines: []string{"0.2"}, strict: true}
	if status, detail := r.judge(Case{Action: "validate-document", Raw: raw}); status != Pass {
		t.Fatalf("the SDK's own ParseDocument: %s %q", status, detail)
	}
	parseDocument = func(data []byte) (*openbindings.Document, error) {
		_, err := openbindings.ParseDocument(data)
		return &openbindings.Document{}, err
	}
	if status, detail := r.judge(Case{Action: "validate-document", Raw: raw}); status != Fail || !strings.Contains(detail, "does not refuse exclusively") {
		t.Errorf("a ParseDocument refusal that comes with a document: %s %q; want FAIL", status, detail)
	}
}

// A value-contract refusal that comes with contracts fails judgeValues.
func TestValueRefusalAtTheCallSite(t *testing.T) {
	defer func(previous func(context.Context, *openbindings.ValueContractCompiler, *openbindings.Document) (*openbindings.ValueContracts, error)) {
		resolveContracts = previous
	}(resolveContracts)
	raw := []byte(`{"given": {"document": ` + future + `, "operation": "op", "side": "input", "values": ["a"]}, "expected": {"outcome": "version-refusal"}}`)
	r := &run{evaluator: schemaeval.New(schemaeval.Options{}), lines: []string{"0.2"}, strict: true}
	if status, detail := r.judge(Case{Action: "validate-operation-values", Raw: raw}); status != Pass {
		t.Fatalf("the SDK's own Resolve: %s %q", status, detail)
	}
	resolveContracts = func(ctx context.Context, c *openbindings.ValueContractCompiler, doc *openbindings.Document) (*openbindings.ValueContracts, error) {
		_, err := c.Resolve(ctx, doc)
		return &openbindings.ValueContracts{}, err
	}
	if status, detail := r.judge(Case{Action: "validate-operation-values", Raw: raw}); status != Fail || !strings.Contains(detail, "came with value contracts") {
		t.Errorf("a value refusal that comes with contracts: %s %q; want FAIL", status, detail)
	}
}
