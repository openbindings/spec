package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"sort"
	"strings"
	"time"

	openbindings "github.com/openbindings/openbindings-go"
	"github.com/openbindings/openbindings-go/schemaeval"
)

// caseBound bounds one case. The corpus's recursive cases are finite, so a
// case that runs past it has not answered.
const caseBound = 10 * time.Second

// profile is what the SDK with schemaeval declares for each feature the
// corpus's cases depend on (corpus README, "Features"): supported or
// unsupported. A case whose dependsOn names a feature the profile does not
// declare fails, so the profile follows the corpus's feature list.
var profile = map[string]bool{
	"recursive-references":            true,
	"document-resource-dynamic-scope": true,
	"supplied-resources":              true,
	// schemaeval gives no verdict on a Unicode property escape: Go's tables
	// are not ECMA-262's.
	"ecma262-unicode-property-escapes": false,
	"repeated-member-detection":        true,
	"draft-07-dialect":                 false,
	"exact-numbers":                    true,
	// The Go core does not carry a string escaping a lone UTF-16 surrogate,
	// so it concludes nothing about a text holding one.
	"exact-lone-surrogate-strings": false,
}

// unimplemented maps each action this SDK does not implement to the reason,
// which the runner reports as OMITTED. The Go core implements every action
// the scenario format defines.
var unimplemented = map[string]string{}

type run struct {
	evaluator openbindings.SchemaEvaluator
}

func newRun() *run {
	return &run{evaluator: schemaeval.New(schemaeval.Options{})}
}

func failed(format string, a ...any) (string, string) { return Fail, fmt.Sprintf(format, a...) }

// judge runs one case under a time bound and returns its category and
// detail.
func (r *run) judge(c Case) (status, detail string) {
	if reason, omitted := unimplemented[c.Action]; omitted {
		return Omitted, reason
	}
	type answer struct{ status, detail string }
	done := make(chan answer, 1)
	go func() {
		defer func() {
			if p := recover(); p != nil {
				done <- answer{Fail, fmt.Sprintf("panic: %v", p)}
			}
		}()
		var a answer
		switch c.Action {
		case fixtureAction:
			a.status, a.detail = judgeFixture(c)
		case "validate-document":
			a.status, a.detail = judgeDocument(c)
		case "resolve-operation":
			a.status, a.detail = judgeResolve(c)
		case "check-dependency-kind":
			a.status, a.detail = judgeKind(c)
		case "validate-operation-values":
			a.status, a.detail = r.judgeValues(c)
		case "check-examples":
			a.status, a.detail = r.judgeExamples(c)
		default:
			a.status, a.detail = failed("unknown action %q", c.Action)
		}
		done <- a
	}()
	select {
	case a := <-done:
		return a.status, a.detail
	case <-time.After(caseBound + 2*time.Second):
		return failed("did not finish within %s", caseBound)
	}
}

// declines reports whether err is one of the SDK's answers that give no
// verdict or conclusion: a no-verdict, an inconclusive call, or a version
// refusal. Why the SDK declined is its own reporting, which the corpus does
// not test, so every decline is judged alike.
func declines(err error) bool {
	return errors.Is(err, openbindings.ErrNoVerdict) ||
		errors.Is(err, openbindings.ErrInconclusive) ||
		errors.As(err, new(*openbindings.VersionRefusalError))
}

// unsupported returns a feature in features that the profile declares
// unsupported, or "" when it declares every one supported, and an error for
// a feature the profile does not declare.
func unsupported(features []string) (string, error) {
	lacking := ""
	for _, f := range features {
		supported, declared := profile[f]
		if !declared {
			return "", fmt.Errorf("the profile does not declare %s", f)
		}
		if !supported && lacking == "" {
			lacking = f
		}
	}
	return lacking, nil
}

type carriage struct {
	Document       json.RawMessage `json:"document"`
	DocumentText   *string         `json:"documentText"`
	DocumentBase64 *string         `json:"documentBase64"`
}

// bytes returns the input the carriage holds, unnormalized: a document given
// as a JSON value stands for its serialization as UTF-8 JSON text, which the
// corpus file's own bytes for it are.
func (g carriage) bytes() ([]byte, error) {
	n := 0
	for _, present := range []bool{g.Document != nil, g.DocumentText != nil, g.DocumentBase64 != nil} {
		if present {
			n++
		}
	}
	switch {
	case n != 1:
		return nil, fmt.Errorf("%d document carriages; a case has exactly one", n)
	case g.Document != nil:
		return g.Document, nil
	case g.DocumentText != nil:
		return []byte(*g.DocumentText), nil
	}
	return base64.StdEncoding.DecodeString(*g.DocumentBase64)
}

// textAnswer is what ValidateDocument concluded about a text: conformant,
// non-conformant, or no conclusion (a decline).
type textAnswer struct {
	conclusion openbindings.ConformanceConclusion // "" for a decline
	report     openbindings.ValidationReport
}

// validateText asks ValidateDocument whether a text conforms. A conclusion of
// conformance undetermined and a version refusal are declines; an error
// that is neither, or that disagrees with the report, is no answer.
func validateText(data []byte) (textAnswer, error) {
	_, report, err := openbindings.ValidateDocument(data)
	if declines(err) {
		return textAnswer{}, nil
	}
	var violation *openbindings.ValidationError
	if err != nil && !errors.As(err, &violation) {
		return textAnswer{}, fmt.Errorf("ValidateDocument: unexpected error %v", err)
	}
	if (violation != nil) != (report.Conclusion == openbindings.ConclusionNonConformant) {
		return textAnswer{}, fmt.Errorf("the error %v disagrees with the conclusion %s", err, report.Conclusion)
	}
	switch report.Conclusion {
	case openbindings.ConclusionConformant, openbindings.ConclusionNonConformant:
		return textAnswer{conclusion: report.Conclusion, report: report}, nil
	case openbindings.ConclusionConformanceUndetermined:
		return textAnswer{report: report}, nil
	}
	return textAnswer{}, fmt.Errorf("ValidateDocument: an unknown conclusion %q", report.Conclusion)
}

// judgeConclusion holds a text's answer to the case (corpus README,
// "Judging"). A conforming text passes when concluded conformant, or when
// declined under a dependsOn feature the profile declares unsupported; a
// decline under declared support is a SHORTFALL. A non-conforming text
// passes only when concluded non-conformant with every rule in violates
// (a minimum set) violated and none in notViolated; a decline on it fails.
func judgeConclusion(data []byte, conforms bool, violates, notViolated, dependsOn []string) (string, string) {
	lacking, err := unsupported(dependsOn)
	if err != nil {
		return failed("%v", err)
	}
	a, err := validateText(data)
	if err != nil {
		return failed("%v", err)
	}
	switch {
	case conforms && a.conclusion == openbindings.ConclusionConformant:
		return Pass, "conformant"
	case conforms && a.conclusion == openbindings.ConclusionNonConformant:
		return failed("concluded non-conformant (violated: %v) for a conforming text", a.report.Violated)
	case conforms && lacking != "":
		return Pass, "declined under " + lacking + ", which the profile declares unsupported"
	case conforms:
		return Shortfall, "declined on a conforming text where the profile supports every feature the case depends on"
	case a.conclusion == openbindings.ConclusionConformant:
		return failed("concluded conformant for a non-conforming text")
	case a.conclusion == "":
		return failed("declined on a non-conforming text")
	}
	for _, rule := range violates {
		if a.report.Evidence[rule] != openbindings.EvidenceViolated {
			return failed("%s is %q, not violated (violated: %v)", rule, a.report.Evidence[rule], a.report.Violated)
		}
	}
	for _, rule := range notViolated {
		if a.report.Evidence[rule] == openbindings.EvidenceViolated {
			return failed("%s reported violated; the case lists it notViolated (violated: %v)", rule, a.report.Violated)
		}
	}
	return Pass, "non-conformant"
}

// judgeFixture holds a validity fixture to ValidateDocument. Fixtures carry
// no dependsOn, so a decline on a conforming text is always a SHORTFALL.
func judgeFixture(c Case) (string, string) {
	var t struct {
		carriage
		Valid       *bool    `json:"valid"`
		Violates    []string `json:"violates"`
		NotViolated []string `json:"notViolated"`
	}
	if err := json.Unmarshal(c.Raw, &t); err != nil {
		return failed("unreadable fixture: %v", err)
	}
	if t.Valid == nil {
		return failed("the fixture states no valid")
	}
	data, err := t.bytes()
	if err != nil {
		return failed("%v", err)
	}
	return judgeConclusion(data, *t.Valid, t.Violates, t.NotViolated, nil)
}

func judgeDocument(c Case) (string, string) {
	var s struct {
		Given    carriage `json:"given"`
		Expected struct {
			Outcome   string   `json:"outcome"`
			Violates  []string `json:"violates"`
			DependsOn []string `json:"dependsOn"`
		} `json:"expected"`
	}
	if err := json.Unmarshal(c.Raw, &s); err != nil {
		return failed("unreadable scenario: %v", err)
	}
	if o := s.Expected.Outcome; o != "conformant" && o != "non-conformant" {
		return failed("unknown outcome %q", o)
	}
	data, err := s.Given.bytes()
	if err != nil {
		return failed("%v", err)
	}
	return judgeConclusion(data, s.Expected.Outcome == "conformant", s.Expected.Violates, nil, s.Expected.DependsOn)
}

// model asks ValidateDocument for the document's model; nil when the SDK
// declines to carry it.
func model(document json.RawMessage) *openbindings.Document {
	doc, _, _ := openbindings.ValidateDocument(document)
	return doc
}

func judgeResolve(c Case) (string, string) {
	var s struct {
		Given struct {
			Document json.RawMessage `json:"document"`
			Name     string          `json:"name"`
		} `json:"given"`
		Expected struct {
			Outcome      string   `json:"outcome"`
			OperationKey string   `json:"operationKey"`
			BindingKeys  []string `json:"bindingKeys"`
		} `json:"expected"`
	}
	if err := json.Unmarshal(c.Raw, &s); err != nil {
		return failed("unreadable scenario: %v", err)
	}
	if o := s.Expected.Outcome; o != "resolved" && o != "not-found" {
		return failed("unknown outcome %q", o)
	}
	doc := model(s.Given.Document)
	if doc == nil {
		return failed("declined to carry the document; expected %s", s.Expected.Outcome)
	}
	key, _, found := doc.ResolveOperation(s.Given.Name)
	if s.Expected.Outcome == "not-found" {
		if found {
			return failed("resolved to %q; expected not-found", key)
		}
		return Pass, "not-found"
	}
	if !found || key != s.Expected.OperationKey {
		return failed("resolved (%q, %v); expected %q", key, found, s.Expected.OperationKey)
	}
	got := slices.Clone(doc.OperationBindings(key))
	want := slices.Clone(s.Expected.BindingKeys)
	sort.Strings(got)
	sort.Strings(want)
	if !slices.Equal(got, want) {
		return failed("binding keys %v; expected %v", got, want)
	}
	return Pass, "resolved " + key
}

func judgeKind(c Case) (string, string) {
	var s struct {
		Given struct {
			Document   json.RawMessage `json:"document"`
			Dependency string          `json:"dependency"`
			Binding    string          `json:"binding"`
		} `json:"given"`
		Expected struct {
			Outcome string `json:"outcome"`
		} `json:"expected"`
	}
	if err := json.Unmarshal(c.Raw, &s); err != nil {
		return failed("unreadable scenario: %v", err)
	}
	if o := s.Expected.Outcome; o != "meets" && o != "does-not-meet" {
		return failed("unknown outcome %q", o)
	}
	doc := model(s.Given.Document)
	if doc == nil {
		return failed("declined to carry the document; expected %s", s.Expected.Outcome)
	}
	dependency, found := doc.Dependencies[s.Given.Dependency]
	if !found {
		return failed("the model holds no dependency %q", s.Given.Dependency)
	}
	binding, found := doc.Bindings[s.Given.Binding]
	if !found {
		return failed("the model holds no binding %q", s.Given.Binding)
	}
	source, found := doc.Sources[binding.Source]
	if !found {
		return failed("the model holds no source %q for binding %q", binding.Source, s.Given.Binding)
	}
	got := "does-not-meet"
	if dependency.AcceptsKind(source.Kind) {
		got = "meets"
	}
	if got != s.Expected.Outcome {
		return failed("%s; expected %s", got, s.Expected.Outcome)
	}
	return Pass, got
}

// The SDK's answer about one value.
const (
	satisfies = "satisfies"
	fails     = "fails"
	declined  = "declines"
)

// classify reads ValueContract.ValidateJSON's answer: nil satisfies, a
// mismatch fails, and a no-verdict declines. Any other error is no answer:
// the corpus's values are JSON values, which the SDK must judge or decline.
func classify(err error) (string, error) {
	mismatch := errors.Is(err, openbindings.ErrMismatch)
	switch {
	case err == nil:
		return satisfies, nil
	case mismatch && declines(err):
		return "", fmt.Errorf("an answer that both fails and declines: %v", err)
	case mismatch:
		return fails, nil
	case declines(err):
		return declined, nil
	}
	return "", fmt.Errorf("an answer that neither judges nor declines: %v", err)
}

// valueContracts decodes the document into the model and resolves its value
// contracts. It returns nil contracts and no error when the SDK declines the
// document, so every value it would have judged is declined.
func (r *run) valueContracts(document json.RawMessage, resources []openbindings.Resource) (*openbindings.ValueContracts, *openbindings.Document, error) {
	var doc openbindings.Document
	if err := json.Unmarshal(document, &doc); err != nil {
		if declines(err) {
			return nil, nil, nil
		}
		return nil, nil, fmt.Errorf("the model does not carry the document: %v", err)
	}
	compiler, err := openbindings.NewValueContractCompiler(r.evaluator, resources...)
	if err != nil {
		return nil, &doc, fmt.Errorf("the supplied resources: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), caseBound)
	defer cancel()
	contracts, err := compiler.Resolve(ctx, &doc)
	switch {
	case declines(err):
		return nil, &doc, nil
	case err != nil:
		return nil, &doc, fmt.Errorf("the document's value contracts: %v", err)
	}
	return contracts, &doc, nil
}

// answer compiles one side's contract and gives the SDK's answer for each
// value. Nil contracts decline every value.
func answer(ctx context.Context, contracts *openbindings.ValueContracts, operation, side string, values []json.RawMessage) ([]string, error) {
	got := make([]string, len(values))
	if contracts == nil {
		for i := range got {
			got[i] = declined
		}
		return got, nil
	}
	compile := contracts.CompileInput
	if side == "output" {
		compile = contracts.CompileOutput
	}
	contract, err := compile(ctx, operation)
	if err != nil {
		return nil, fmt.Errorf("compiling %s's %s contract: %v", operation, side, err)
	}
	for i, v := range values {
		if got[i], err = classify(contract.ValidateJSON(ctx, v)); err != nil {
			return nil, fmt.Errorf("value %d: %v", i, err)
		}
	}
	return got, nil
}

// expectation is one value's expected result: satisfies, fails, undefined,
// external, or no-contract; orNoVerdict and dependsOn admit a decline of
// satisfies or fails.
type expectation struct {
	result      string
	orNoVerdict bool
	dependsOn   []string
}

// readExpectation reads one entry of expected.results: a token, or the
// object forms carrying orNoVerdict or a per-value dependsOn that replaces
// the case's.
func readExpectation(raw json.RawMessage, caseDependsOn []string) (expectation, error) {
	var token string
	if json.Unmarshal(raw, &token) == nil {
		switch token {
		case satisfies, fails, "undefined", "external", "no-contract":
			return expectation{result: token, dependsOn: caseDependsOn}, nil
		}
		return expectation{}, fmt.Errorf("unknown result %q", token)
	}
	var form struct {
		Result      string    `json:"result"`
		OrNoVerdict bool      `json:"orNoVerdict"`
		DependsOn   *[]string `json:"dependsOn"`
	}
	if err := json.Unmarshal(raw, &form); err != nil {
		return expectation{}, fmt.Errorf("unreadable result %s: %v", raw, err)
	}
	if form.Result != satisfies && form.Result != fails {
		return expectation{}, fmt.Errorf("unknown result %q in %s", form.Result, raw)
	}
	e := expectation{result: form.Result, orNoVerdict: form.OrNoVerdict, dependsOn: caseDependsOn}
	if form.DependsOn != nil {
		e.dependsOn = *form.DependsOn
	}
	return e, nil
}

// judgeAnswer holds one answer to its expectation (corpus README, "Judging")
// and returns its category. satisfies and fails pass the same result, or a
// decline where the value carries orNoVerdict or depends on a feature the
// profile declares unsupported; another result fails, and a decline under
// declared support is a SHORTFALL. undefined, external, and no-contract pass
// any decline, and fail any result. The error names a dependsOn feature the
// profile does not declare.
func judgeAnswer(want expectation, got string) (string, error) {
	lacking, err := unsupported(want.dependsOn)
	if err != nil {
		return Fail, err
	}
	switch {
	case got == declined && (want.result == satisfies || want.result == fails):
		if want.orNoVerdict || lacking != "" {
			return Pass, nil
		}
		return Shortfall, nil
	case got == declined, got == want.result:
		return Pass, nil
	}
	return Fail, nil
}

const shortfallReason = "declined where the profile supports every feature it depends on"

func (r *run) judgeValues(c Case) (string, string) {
	var s struct {
		Given struct {
			Document  json.RawMessage   `json:"document"`
			Operation string            `json:"operation"`
			Side      string            `json:"side"`
			Values    []json.RawMessage `json:"values"`
			Resources []struct {
				URI      string          `json:"uri"`
				Document json.RawMessage `json:"document"`
			} `json:"resources"`
		} `json:"given"`
		Expected struct {
			Results   []json.RawMessage `json:"results"`
			DependsOn []string          `json:"dependsOn"`
		} `json:"expected"`
	}
	if err := json.Unmarshal(c.Raw, &s); err != nil {
		return failed("unreadable scenario: %v", err)
	}
	if s.Given.Side != "input" && s.Given.Side != "output" {
		return failed("unknown side %q", s.Given.Side)
	}
	if len(s.Expected.Results) != len(s.Given.Values) {
		return failed("%d expected results for %d values", len(s.Expected.Results), len(s.Given.Values))
	}
	wants := make([]expectation, len(s.Expected.Results))
	for i, raw := range s.Expected.Results {
		var err error
		if wants[i], err = readExpectation(raw, s.Expected.DependsOn); err != nil {
			return failed("value %d: %v", i, err)
		}
	}
	var resources []openbindings.Resource
	for _, res := range s.Given.Resources {
		resources = append(resources, openbindings.Resource{URI: res.URI, Document: res.Document})
	}
	contracts, _, err := r.valueContracts(s.Given.Document, resources)
	if err != nil {
		return failed("%v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), caseBound)
	defer cancel()
	got, err := answer(ctx, contracts, s.Given.Operation, s.Given.Side, s.Given.Values)
	if err != nil {
		return failed("%v", err)
	}
	shortfall := ""
	for i, want := range wants {
		status, err := judgeAnswer(want, got[i])
		switch {
		case err != nil:
			return failed("value %d: %v", i, err)
		case status == Fail:
			return failed("value %d: got %s; expected %s %v", i, got[i], want.result, got)
		case status == Shortfall && shortfall == "":
			shortfall = fmt.Sprintf("value %d: %s %v", i, shortfallReason, got)
		}
	}
	if shortfall != "" {
		return Shortfall, shortfall
	}
	return Pass, fmt.Sprint(got)
}

// claims maps an example result to the value result it follows (corpus
// README, "Example results"): a true claim is a value that satisfies its
// contract, a false one a value that fails it, and no-claim is a value where
// no contract is stated.
var claims = map[string]string{"true": satisfies, "false": fails, "undefined": "undefined", "external": "external", "no-claim": "no-contract"}

// claimOf names an answer in the example vocabulary.
var claimOf = map[string]string{satisfies: "true", fails: "false", declined: "declines"}

// exampleValue is one value an example supplies, with its expected result.
type exampleValue struct {
	example, side string
	value         json.RawMessage
	want          string
}

// judgeExamples checks an operation's examples by composing value
// validation: the Go core has no example checker. Every example of the
// operation, and every side it supplies, has exactly one expected result.
func (r *run) judgeExamples(c Case) (string, string) {
	var s struct {
		Given struct {
			Document  json.RawMessage `json:"document"`
			Operation string          `json:"operation"`
		} `json:"given"`
		Expected struct {
			Examples map[string]map[string]string `json:"examples"`
		} `json:"expected"`
	}
	if err := json.Unmarshal(c.Raw, &s); err != nil {
		return failed("unreadable scenario: %v", err)
	}
	for _, name := range sortedKeys(s.Expected.Examples) {
		for side, want := range s.Expected.Examples[name] {
			if side != "input" && side != "output" {
				return failed("example %q: unknown side %q", name, side)
			}
			if _, known := claims[want]; !known {
				return failed("example %q %s: unknown result %q", name, side, want)
			}
		}
	}
	contracts, doc, err := r.valueContracts(s.Given.Document, nil)
	if err != nil {
		return failed("%v", err)
	}
	var values []exampleValue
	key := s.Given.Operation
	if doc == nil {
		// The SDK declined to carry the document, so it declines every
		// value the corpus expects a result for.
		for _, name := range sortedKeys(s.Expected.Examples) {
			for _, side := range sortedKeys(s.Expected.Examples[name]) {
				values = append(values, exampleValue{example: name, side: side, want: s.Expected.Examples[name][side]})
			}
		}
	} else {
		var operation openbindings.Operation
		var found bool
		if key, operation, found = doc.ResolveOperation(s.Given.Operation); !found {
			return failed("operation %q not found", s.Given.Operation)
		}
		for _, name := range sortedKeys(s.Expected.Examples) {
			if _, has := operation.Examples[name]; !has {
				return failed("example %q is expected; the operation has none by that name", name)
			}
		}
		for _, name := range sortedKeys(operation.Examples) {
			expected, has := s.Expected.Examples[name]
			if !has {
				return failed("example %q has no expected results", name)
			}
			example := operation.Examples[name]
			for _, side := range []struct {
				name  string
				value json.RawMessage
			}{{"input", example.Input}, {"output", example.Output}} {
				want, expectedSide := expected[side.name]
				switch supplied := len(side.value) > 0; {
				case supplied && expectedSide:
					values = append(values, exampleValue{example: name, side: side.name, value: side.value, want: want})
				case supplied:
					return failed("example %q supplies an %s with no expected result", name, side.name)
				case expectedSide:
					return failed("example %q supplies no %s; a result is expected for it", name, side.name)
				}
			}
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), caseBound)
	defer cancel()
	var answers []string
	shortfall := ""
	for _, v := range values {
		got := []string{declined}
		if doc != nil {
			if got, err = answer(ctx, contracts, key, v.side, []json.RawMessage{v.value}); err != nil {
				return failed("example %q %s: %v", v.example, v.side, err)
			}
		}
		answers = append(answers, fmt.Sprintf("%s.%s=%s", v.example, v.side, claimOf[got[0]]))
		status, err := judgeAnswer(expectation{result: claims[v.want]}, got[0])
		switch {
		case err != nil:
			return failed("example %q %s: %v", v.example, v.side, err)
		case status == Fail:
			return failed("example %q %s: got %s; expected %s", v.example, v.side, claimOf[got[0]], v.want)
		case status == Shortfall && shortfall == "":
			shortfall = fmt.Sprintf("example %q %s: %s", v.example, v.side, shortfallReason)
		}
	}
	if shortfall != "" {
		return Shortfall, shortfall
	}
	return Pass, strings.Join(answers, " ")
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
