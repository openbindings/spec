package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	openbindings "github.com/openbindings/openbindings-go"
)

// The runner's judges are held to standing controls: a small synthetic corpus
// run through the SDK, with a deliberately wrong expectation for every row of
// the corpus README's Judging table and every judging branch, each of which
// must fail or fall short, beside a correct twin that must pass, so a judge
// made lenient fails here and so fails the CI job before it can pass a
// broken run.

type judgeControl struct {
	name   string
	action string
	raw    string
	want   string // the run category the judge must report
	detail string // a fragment its detail must hold
}

const (
	conforming = `{"openbindings": "0.2.0", "operations": {}}`
	// violating breaks one rule: a dependency names a missing operation.
	violating = `{"openbindings": "0.2.0", "operations": {}, "dependencies": {"d": {"operation": "missing"}}}`
	// future declares another line, which the SDK refuses: a decline.
	future = `{"openbindings": "9.9.9", "operations": {}}`
	// futureOp is future with an operation that has an example.
	futureOp = `{"openbindings": "9.9.9", "operations": {"op": {"input": {"type": "string"}, "examples": {"e": {"input": "a"}}}}}`
	// The Go core concludes nothing about a text holding a string that
	// escapes a lone surrogate: a decline, on a conforming text and on a
	// violating one.
	loneConforming = `{"openbindings":"0.2.0","description":"\ud800","operations":{}}`
	loneViolating  = `{"openbindings":"0.2.0","description":"\ud800","operations":{},"dependencies":{"d":{"operation":"missing"}}}`

	twoBindings = `{"openbindings": "0.2.0", "operations": {"createTask": {"aliases": ["tasks.create"]}, "other": {}},
		"sources": {"s": {"kind": "example.test@1"}},
		"bindings": {"primary": {"operation": "createTask", "source": "s"}, "elsewhere": {"operation": "other", "source": "s"}}}`
	kinds = `{"openbindings": "0.2.0", "operations": {"op": {}},
		"sources": {"s": {"kind": "example.openapi@1"}}, "bindings": {"b": {"operation": "op", "source": "s"}},
		"dependencies": {"d": {"operation": "op", "kinds": ["example.openapi@1"]}}}`

	// stringOp satisfies "a" and fails "b".
	stringOp = `{"openbindings": "0.2.0", "operations": {"op": {"input": {"type": "string", "pattern": "^a$"}}}}`
	// The SDK declines every value of these: an invalid pattern (undefined),
	// a resource the document does not contain (external), and no schema
	// (no contract).
	badPattern = `{"openbindings": "0.2.0", "operations": {"op": {"input": {"type": "string", "pattern": "(?i)^a$"},
		"examples": {"e": {"input": "a"}}}}}`
	external = `{"openbindings": "0.2.0", "operations": {"op": {"input": {"$ref": "https://absent.example.test/x.json"},
		"examples": {"e": {"input": 1}}}}}`
	noInput = `{"openbindings": "0.2.0", "operations": {"op": {"output": {"type": "integer"}, "examples": {"e": {"input": 1}}}}}`
	// examples: good's values satisfy their contracts, bad's input fails its.
	examples = `{"openbindings": "0.2.0", "operations": {"op": {"input": {"type": "string"}, "output": {"type": "integer"},
		"examples": {"good": {"input": "x", "output": 1}, "bad": {"input": 5}}}}}`
)

// text is a documentText carriage for s.
func text(s string) string {
	b, _ := json.Marshal(s)
	return `"documentText": ` + string(b)
}

// rules returns a rule the SDK reports violated for the violating document,
// and one it reports satisfied, in the identifiers the SDK emits.
func rules(t *testing.T) (violated, kept string) {
	t.Helper()
	_, report, _ := openbindings.ValidateDocument([]byte(violating))
	if len(report.Violated) == 0 {
		t.Fatalf("the violating control document reports no violation: %+v", report)
	}
	violated = report.Violated[0]
	ids := make([]string, 0, len(report.Evidence))
	for id := range report.Evidence {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	for _, id := range ids {
		if report.Evidence[id] == openbindings.EvidenceSatisfied {
			return violated, id
		}
	}
	t.Fatalf("the violating control document reports no satisfied rule: %+v", report)
	return "", ""
}

func controls(violated, kept string) []judgeControl {
	q := func(rule string) string { return `["` + rule + `"]` }
	values := func(document, values, expected string) string {
		return `{"given": {"document": ` + document + `, "operation": "op", "side": "input", "values": ` + values + `}, "expected": ` + expected + `}`
	}
	checkExamples := func(document, expected string) string {
		return `{"given": {"document": ` + document + `, "operation": "op"}, "expected": {"examples": ` + expected + `}}`
	}
	return []judgeControl{
		// Fixture: a conforming text concluded conformant passes; a wrong
		// conclusion fails; every rule in violates violated and none in
		// notViolated; a decline on a conforming text falls short (fixtures
		// carry no dependsOn) and on a non-conforming one fails.
		{"fixture: a conforming text concluded conformant", fixtureAction, `{"document": ` + conforming + `, "valid": true}`, Pass, "conformant"},
		{"fixture: a violating text expected to conform", fixtureAction, `{"document": ` + violating + `, "valid": true}`, Fail, "concluded non-conformant"},
		{"fixture: a conforming text expected to violate", fixtureAction, `{"document": ` + conforming + `, "valid": false, "violates": ` + q(violated) + `}`, Fail, "concluded conformant"},
		{"fixture: violates names a rule the text keeps", fixtureAction, `{"document": ` + violating + `, "valid": false, "violates": ` + q(kept) + `}`, Fail, kept},
		{"fixture: notViolated names the rule the text violates", fixtureAction,
			`{"document": ` + violating + `, "valid": false, "violates": ` + q(violated) + `, "notViolated": ` + q(violated) + `}`, Fail, "notViolated"},
		{"fixture: violates and notViolated (their correct twin)", fixtureAction,
			`{"document": ` + violating + `, "valid": false, "violates": ` + q(violated) + `, "notViolated": ` + q(kept) + `}`, Pass, "non-conformant"},
		{"fixture: a decline on a conforming text falls short", fixtureAction, `{` + text(loneConforming) + `, "valid": true}`, Shortfall, "declined on a conforming text"},
		{"fixture: fixtures carry no dependsOn, so none admits a decline", fixtureAction,
			`{` + text(loneConforming) + `, "valid": true, "dependsOn": ["exact-lone-surrogate-strings"]}`, Shortfall, "declined on a conforming text"},
		{"fixture: a decline on a non-conforming text", fixtureAction, `{` + text(loneViolating) + `, "valid": false}`, Fail, "declined on a non-conforming text"},
		{"fixture: a version refusal is a decline (non-conforming)", fixtureAction, `{"document": ` + future + `, "valid": false}`, Fail, "declined on a non-conforming text"},
		{"fixture: a version refusal is a decline (conforming)", fixtureAction, `{"document": ` + future + `, "valid": true}`, Shortfall, "declined on a conforming text"},
		{"fixture: no valid", fixtureAction, `{"document": ` + conforming + `}`, Fail, "no valid"},
		{"fixture: two carriages", fixtureAction, `{"document": ` + conforming + `, ` + text(conforming) + `, "valid": true}`, Fail, "carriages"},
		{"fixture: no carriage", fixtureAction, `{"valid": true}`, Fail, "carriages"},

		// validate-document: as fixtures, and a decline on a conforming
		// text under a dependsOn feature the profile declares unsupported
		// passes.
		{"validate-document: conformant", "validate-document", `{"given": {"document": ` + conforming + `}, "expected": {"outcome": "conformant"}}`, Pass, "conformant"},
		{"validate-document: non-conformant expected of a conforming text", "validate-document",
			`{"given": {"document": ` + conforming + `}, "expected": {"outcome": "non-conformant"}}`, Fail, "concluded conformant"},
		{"validate-document: conformant expected of a violating text", "validate-document",
			`{"given": {"document": ` + violating + `}, "expected": {"outcome": "conformant"}}`, Fail, "concluded non-conformant"},
		{"validate-document: violates names a rule the text keeps", "validate-document",
			`{"given": {"document": ` + violating + `}, "expected": {"outcome": "non-conformant", "violates": ` + q(kept) + `}}`, Fail, kept},
		{"validate-document: violates (its correct twin)", "validate-document",
			`{"given": {"document": ` + violating + `}, "expected": {"outcome": "non-conformant", "violates": ` + q(violated) + `}}`, Pass, "non-conformant"},
		{"validate-document: a decline under a feature declared unsupported", "validate-document",
			`{"given": {` + text(loneConforming) + `}, "expected": {"outcome": "conformant", "dependsOn": ["exact-lone-surrogate-strings"]}}`, Pass, "declined under exact-lone-surrogate-strings"},
		{"validate-document: a decline where every feature is declared supported", "validate-document",
			`{"given": {` + text(loneConforming) + `}, "expected": {"outcome": "conformant", "dependsOn": ["exact-numbers"]}}`, Shortfall, "declined on a conforming text"},
		{"validate-document: a decline with no dependsOn", "validate-document",
			`{"given": {` + text(loneConforming) + `}, "expected": {"outcome": "conformant"}}`, Shortfall, "declined on a conforming text"},
		{"validate-document: a decline on a non-conforming text, whatever it depends on", "validate-document",
			`{"given": {` + text(loneViolating) + `}, "expected": {"outcome": "non-conformant", "dependsOn": ["exact-lone-surrogate-strings"]}}`, Fail, "declined on a non-conforming text"},
		{"validate-document: an unsupported feature does not admit a wrong conclusion", "validate-document",
			`{"given": {"document": ` + conforming + `}, "expected": {"outcome": "non-conformant", "dependsOn": ["exact-lone-surrogate-strings"]}}`, Fail, "concluded conformant"},
		{"validate-document: a feature the profile does not declare", "validate-document",
			`{"given": {"document": ` + conforming + `}, "expected": {"outcome": "conformant", "dependsOn": ["no-such-feature"]}}`, Fail, "does not declare"},
		{"validate-document: a retired outcome", "validate-document", `{"given": {"document": ` + conforming + `}, "expected": {"outcome": "interpreted"}}`, Fail, "unknown outcome"},

		// resolve-operation: the same outcome; another fails.
		{"resolve-operation: resolved, with its bindings (correct twin)", "resolve-operation",
			`{"given": {"document": ` + twoBindings + `, "name": "tasks.create"}, "expected": {"outcome": "resolved", "operationKey": "createTask", "bindingKeys": ["primary"]}}`, Pass, "resolved createTask"},
		{"resolve-operation: binding keys of another operation", "resolve-operation",
			`{"given": {"document": ` + twoBindings + `, "name": "tasks.create"}, "expected": {"outcome": "resolved", "operationKey": "createTask", "bindingKeys": ["elsewhere", "primary"]}}`, Fail, "binding keys"},
		{"resolve-operation: no binding keys where there is one", "resolve-operation",
			`{"given": {"document": ` + twoBindings + `, "name": "createTask"}, "expected": {"outcome": "resolved", "operationKey": "createTask", "bindingKeys": []}}`, Fail, "binding keys"},
		{"resolve-operation: a wrong operation key", "resolve-operation",
			`{"given": {"document": ` + twoBindings + `, "name": "createTask"}, "expected": {"outcome": "resolved", "operationKey": "other", "bindingKeys": []}}`, Fail, "resolved"},
		{"resolve-operation: resolved expected of a name that identifies nothing", "resolve-operation",
			`{"given": {"document": ` + twoBindings + `, "name": "CreateTask"}, "expected": {"outcome": "resolved", "operationKey": "createTask", "bindingKeys": ["primary"]}}`, Fail, "resolved"},
		{"resolve-operation: not-found for a name that resolves", "resolve-operation",
			`{"given": {"document": ` + twoBindings + `, "name": "other"}, "expected": {"outcome": "not-found"}}`, Fail, "expected not-found"},
		{"resolve-operation: not-found (correct twin)", "resolve-operation",
			`{"given": {"document": ` + twoBindings + `, "name": "CreateTask"}, "expected": {"outcome": "not-found"}}`, Pass, "not-found"},
		{"resolve-operation: a decline is another outcome", "resolve-operation",
			`{"given": {"document": ` + future + `, "name": "x"}, "expected": {"outcome": "not-found"}}`, Fail, "declined"},
		{"resolve-operation: the retired collision outcome", "resolve-operation",
			`{"given": {"document": ` + twoBindings + `, "name": "other"}, "expected": {"outcome": "collision", "keyMatch": "other", "aliasMatch": "x"}}`, Fail, "unknown outcome"},

		// check-dependency-kind: the same outcome; another fails.
		{"check-dependency-kind: meets (correct twin)", "check-dependency-kind",
			`{"given": {"document": ` + kinds + `, "dependency": "d", "binding": "b"}, "expected": {"outcome": "meets"}}`, Pass, "meets"},
		{"check-dependency-kind: meets for a kind the list does not hold", "check-dependency-kind",
			`{"given": {"document": ` + strings.Replace(kinds, `"kinds": ["example.openapi@1"]`, `"kinds": ["example.openapi@2"]`, 1) + `, "dependency": "d", "binding": "b"}, "expected": {"outcome": "meets"}}`, Fail, "does-not-meet"},
		{"check-dependency-kind: does-not-meet for a listed kind", "check-dependency-kind",
			`{"given": {"document": ` + kinds + `, "dependency": "d", "binding": "b"}, "expected": {"outcome": "does-not-meet"}}`, Fail, "meets"},
		{"check-dependency-kind: a decline is another outcome", "check-dependency-kind",
			`{"given": {"document": ` + future + `, "dependency": "d", "binding": "b"}, "expected": {"outcome": "meets"}}`, Fail, "declined"},
		{"check-dependency-kind: a dependency the document does not hold", "check-dependency-kind",
			`{"given": {"document": ` + kinds + `, "dependency": "missing", "binding": "b"}, "expected": {"outcome": "meets"}}`, Fail, "no dependency"},

		// validate-operation-values, satisfies and fails: the same result
		// passes, or a decline under orNoVerdict or a dependsOn feature
		// declared unsupported; a wrong result fails; a decline under
		// declared support falls short.
		{"values: satisfies and fails (correct twin)", "validate-operation-values", values(stringOp, `["a", "b"]`, `{"results": ["satisfies", "fails"]}`), Pass, "[satisfies fails]"},
		{"values: a wrong result", "validate-operation-values", values(stringOp, `["a", "b"]`, `{"results": ["satisfies", "satisfies"]}`), Fail, "value 1: got fails; expected satisfies"},
		{"values: orNoVerdict admits a decline", "validate-operation-values", values(badPattern, `["a"]`, `{"results": [{"result": "satisfies", "orNoVerdict": true}]}`), Pass, "[declines]"},
		{"values: orNoVerdict does not admit the opposite result", "validate-operation-values",
			values(stringOp, `["b"]`, `{"results": [{"result": "satisfies", "orNoVerdict": true}]}`), Fail, "value 0: got fails"},
		{"values: a feature declared unsupported admits a decline", "validate-operation-values",
			values(badPattern, `["a"]`, `{"results": ["satisfies"], "dependsOn": ["draft-07-dialect"]}`), Pass, "[declines]"},
		{"values: a feature declared unsupported admits the result too", "validate-operation-values",
			values(stringOp, `["a"]`, `{"results": ["satisfies"], "dependsOn": ["draft-07-dialect"]}`), Pass, "[satisfies]"},
		{"values: a feature declared unsupported does not admit the opposite result", "validate-operation-values",
			values(stringOp, `["b"]`, `{"results": ["satisfies"], "dependsOn": ["draft-07-dialect"]}`), Fail, "value 0: got fails"},
		{"values: a decline with no dependsOn falls short", "validate-operation-values", values(badPattern, `["a"]`, `{"results": ["satisfies"]}`), Shortfall, "value 0: declined"},
		{"values: a decline where every feature is declared supported falls short", "validate-operation-values",
			values(badPattern, `["a"]`, `{"results": ["fails"], "dependsOn": ["recursive-references"]}`), Shortfall, "value 0: declined"},
		{"values: a per-value dependsOn replaces the case's (emptied)", "validate-operation-values",
			values(badPattern, `["a"]`, `{"results": [{"result": "satisfies", "dependsOn": []}], "dependsOn": ["draft-07-dialect"]}`), Shortfall, "value 0: declined"},
		{"values: a per-value dependsOn replaces the case's (unsupported)", "validate-operation-values",
			values(badPattern, `["a"]`, `{"results": [{"result": "satisfies", "dependsOn": ["draft-07-dialect"]}], "dependsOn": ["recursive-references"]}`), Pass, "[declines]"},
		{"values: a feature the profile does not declare", "validate-operation-values",
			values(stringOp, `["a"]`, `{"results": ["satisfies"], "dependsOn": ["no-such-feature"]}`), Fail, "does not declare"},
		{"values: a per-value feature the profile does not declare", "validate-operation-values",
			values(stringOp, `["a"]`, `{"results": [{"result": "satisfies", "dependsOn": ["no-such-feature"]}]}`), Fail, "does not declare"},
		// The SDK declines a value escaping a lone surrogate and judges the
		// others, so one case can hold a decline beside a result.
		{"values: each value judged on its own", "validate-operation-values",
			values(stringOp, `["\ud800", "a"]`, `{"results": [{"result": "satisfies", "orNoVerdict": true}, "satisfies"]}`), Pass, "[declines satisfies]"},
		{"values: one value's decline falls short", "validate-operation-values",
			values(stringOp, `["a", "\ud800"]`, `{"results": ["satisfies", "satisfies"]}`), Shortfall, "value 1: declined"},
		{"values: a fail outranks a shortfall", "validate-operation-values",
			values(stringOp, `["\ud800", "b"]`, `{"results": ["satisfies", "satisfies"]}`), Fail, "value 1: got fails"},
		// undefined and external: any decline passes; a result fails.
		{"values: undefined, declined", "validate-operation-values", values(badPattern, `["a"]`, `{"results": ["undefined"]}`), Pass, "[declines]"},
		{"values: undefined, given a result", "validate-operation-values", values(stringOp, `["a"]`, `{"results": ["undefined"]}`), Fail, "got satisfies; expected undefined"},
		{"values: external, declined", "validate-operation-values", values(external, `[1]`, `{"results": ["external"]}`), Pass, "[declines]"},
		{"values: external, given a result", "validate-operation-values", values(stringOp, `["b"]`, `{"results": ["external"]}`), Fail, "got fails; expected external"},
		// no-contract: no result passes; a result fails.
		{"values: no-contract, no result", "validate-operation-values", values(noInput, `[1, "x"]`, `{"results": ["no-contract", "no-contract"]}`), Pass, "[declines declines]"},
		{"values: no-contract, given a result", "validate-operation-values", values(stringOp, `["a"]`, `{"results": ["no-contract"]}`), Fail, "got satisfies; expected no-contract"},
		{"values: a result expected where no contract is stated", "validate-operation-values", values(noInput, `[1]`, `{"results": ["satisfies"]}`), Shortfall, "value 0: declined"},
		// A document the SDK declines declines every value.
		{"values: a declined document, undefined", "validate-operation-values", values(futureOp, `["a"]`, `{"results": ["undefined"]}`), Pass, "[declines]"},
		{"values: a declined document, satisfies", "validate-operation-values", values(futureOp, `["a"]`, `{"results": ["satisfies"]}`), Shortfall, "value 0: declined"},
		// The case's shape.
		{"values: fewer results than values", "validate-operation-values", values(stringOp, `["a", "b"]`, `{"results": ["satisfies"]}`), Fail, "expected results"},
		{"values: a retired result token", "validate-operation-values", values(stringOp, `["a"]`, `{"results": ["valid"]}`), Fail, "unknown result"},
		{"values: an object form that is not satisfies or fails", "validate-operation-values",
			values(badPattern, `["a"]`, `{"results": [{"result": "undefined", "orNoVerdict": true}]}`), Fail, "unknown result"},
		{"values: an operation the document does not have", "validate-operation-values",
			`{"given": {"document": ` + stringOp + `, "operation": "missing", "side": "input", "values": ["a"]}, "expected": {"results": ["satisfies"]}}`, Fail, "compiling"},

		// check-examples: true and false as satisfies and fails; undefined,
		// external, and no-claim pass a decline and fail a result; every
		// example and side has exactly one expected result.
		{"check-examples: true and false (correct twin)", "check-examples",
			checkExamples(examples, `{"good": {"input": "true", "output": "true"}, "bad": {"input": "false"}}`), Pass, "bad.input=false good.input=true good.output=true"},
		{"check-examples: true expected of a false claim", "check-examples",
			checkExamples(examples, `{"good": {"input": "true", "output": "true"}, "bad": {"input": "true"}}`), Fail, `"bad" input: got false; expected true`},
		{"check-examples: false expected of a true claim", "check-examples",
			checkExamples(examples, `{"good": {"input": "false", "output": "true"}, "bad": {"input": "false"}}`), Fail, `"good" input: got true; expected false`},
		{"check-examples: a decline of a true claim falls short", "check-examples", checkExamples(badPattern, `{"e": {"input": "true"}}`), Shortfall, `"e" input: declined`},
		{"check-examples: undefined, declined", "check-examples", checkExamples(badPattern, `{"e": {"input": "undefined"}}`), Pass, "e.input=declines"},
		{"check-examples: undefined, given a result", "check-examples",
			checkExamples(examples, `{"good": {"input": "undefined", "output": "true"}, "bad": {"input": "false"}}`), Fail, `"good" input: got true; expected undefined`},
		{"check-examples: external, declined", "check-examples", checkExamples(external, `{"e": {"input": "external"}}`), Pass, "e.input=declines"},
		{"check-examples: external, given a result", "check-examples",
			checkExamples(examples, `{"good": {"input": "true", "output": "true"}, "bad": {"input": "external"}}`), Fail, `"bad" input: got false; expected external`},
		{"check-examples: no-claim, no result", "check-examples", checkExamples(noInput, `{"e": {"input": "no-claim"}}`), Pass, "e.input=declines"},
		{"check-examples: no-claim, given a result", "check-examples",
			checkExamples(examples, `{"good": {"input": "no-claim", "output": "true"}, "bad": {"input": "false"}}`), Fail, `"good" input: got true; expected no-claim`},
		{"check-examples: an example the operation does not have", "check-examples",
			checkExamples(examples, `{"good": {"input": "true", "output": "true"}, "bad": {"input": "false"}, "missing": {"input": "true"}}`), Fail, `"missing" is expected`},
		{"check-examples: an example with no expected results", "check-examples",
			checkExamples(examples, `{"good": {"input": "true", "output": "true"}}`), Fail, `"bad" has no expected results`},
		{"check-examples: a side the example does not supply", "check-examples",
			checkExamples(examples, `{"good": {"input": "true", "output": "true"}, "bad": {"input": "false", "output": "true"}}`), Fail, "supplies no output"},
		{"check-examples: a side with no expected result", "check-examples",
			checkExamples(examples, `{"good": {"input": "true"}, "bad": {"input": "false"}}`), Fail, "output with no expected result"},
		{"check-examples: a retired result", "check-examples", checkExamples(badPattern, `{"e": {"input": "no-verdict"}}`), Fail, "unknown result"},
		{"check-examples: a declined document declines every claim", "check-examples", checkExamples(futureOp, `{"e": {"input": "true"}}`), Shortfall, `"e" input: declined`},

		// Actions the format does not define.
		{"a retired action (conclude-conformance)", "conclude-conformance", `{"given": {}, "expected": {}}`, Fail, "unknown action"},
		{"a retired action (derive-form)", "derive-form", `{"given": {}, "expected": {}}`, Fail, "unknown action"},
	}
}

func TestJudgeControls(t *testing.T) {
	violated, kept := rules(t)
	r := newRun()
	for _, c := range controls(violated, kept) {
		status, detail := r.judge(Case{ID: c.name, Action: c.action, Raw: []byte(c.raw)})
		if status != c.want || !strings.Contains(detail, c.detail) {
			t.Errorf("%s: %s %q; want %s (%q)", c.name, status, detail, c.want, c.detail)
		}
	}
}

// An action the SDK does not implement is OMITTED, with its reason.
func TestUnimplementedActionIsOmitted(t *testing.T) {
	defer func() { delete(unimplemented, "check-examples") }()
	unimplemented["check-examples"] = "this SDK checks no examples"
	status, detail := newRun().judge(Case{Action: "check-examples", Raw: []byte(`{}`)})
	if status != Omitted || detail != "this SDK checks no examples" {
		t.Errorf("an unimplemented action: %s %q; want OMITTED with its reason", status, detail)
	}
}

// load reads fixtures from document/ alone and scenarios in the @3 format
// alone, and reconcile holds the cases to the manifest's counts.
func TestLoadAndReconcile(t *testing.T) {
	dir := t.TempDir()
	write := func(rel, content string) {
		path := filepath.Join(dir, rel)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("manifest.json", `{"files": [{"path": "document/OBI-01.json", "tests": 1}], "scenarioFiles": [{"path": "scenarios/10-conformance.json", "scenarios": 1}]}`)
	write("document/OBI-01.json", `{"rule": "OBI-01", "section": "10", "tests": [{"description": "d", "document": {}, "valid": false}]}`)
	write("tool/OBI-T-03.json", `{"rule": "OBI-T-03", "tests": [{"description": "a retired layout", "document": {}, "valid": true}]}`)
	write("scenarios/10-conformance.json", `{"format": "openbindings.core-scenarios@3", "section": "10", "scenarios": [{"id": "CONFORMANCE-01", "action": "validate-document"}]}`)
	cases, counts, err := load(dir)
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, c := range cases {
		ids = append(ids, c.ID+" "+c.Action)
	}
	if want := []string{"document/OBI-01.json#/tests/0 " + fixtureAction, "CONFORMANCE-01 validate-document"}; strings.Join(ids, "|") != strings.Join(want, "|") {
		t.Errorf("loaded %q; want %q", ids, want)
	}
	results := []Result{{ID: "document/OBI-01.json#/tests/0", Status: Pass}, {ID: "CONFORMANCE-01", Status: Omitted}}
	if problems := reconcile(cases, counts, results); len(problems) != 1 || !strings.Contains(problems[0], "OMITTED with no reason") {
		t.Errorf("an omission with no reason: %q", problems)
	}
	results[1].Signature = "a reason"
	if problems := reconcile(cases, counts, results); problems == nil || len(problems) != 0 {
		t.Errorf("a reconciled run: %#v; want an empty list, which the JSON results carry", problems)
	}
	if problems := reconcile(cases, counts, results[:1]); len(problems) != 1 || !strings.Contains(problems[0], "reported 0 times") {
		t.Errorf("a case not reported: %q", problems)
	}
	counts["document/OBI-01.json"] = 2
	if problems := reconcile(cases, counts, results); len(problems) != 1 || !strings.Contains(problems[0], "the manifest counts 2 cases, the file holds 1") {
		t.Errorf("a miscounted file: %q", problems)
	}
	write("scenarios/10-conformance.json", `{"format": "openbindings.core-tool-scenarios@2", "rule": "OBI-T-08", "scenarios": []}`)
	if _, _, err := load(dir); err == nil || !strings.Contains(err.Error(), "openbindings.core-scenarios@3") {
		t.Errorf("a format @2 scenario file: %v; want a refusal", err)
	}
}
