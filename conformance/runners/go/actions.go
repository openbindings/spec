package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"

	openbindings "github.com/openbindings/openbindings-go"
	"github.com/openbindings/openbindings-go/schemaeval"
)

// caseBound bounds one case: OBI-T-06 leaves termination strategy to the
// tool, and the corpus's recursive cases are finite.
const caseBound = 10 * time.Second

// profile is the capability profile the SDK with schemaeval declares for the
// features the corpus's cases depend on (corpus README, "Capabilities").
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
}

type run struct {
	lines, prereleases []string
	evaluator          openbindings.SchemaEvaluator
	release, revision  string // the declared applied text
	verified           bool
	unverified         string
	strict             bool
}

// newRun reads the SDK's support declaration from SupportedVersions ("0.2.x":
// the 0.2 line; "1.x": major 1), and verifies the declared applied text: the
// openbindings.md at the declared revision, read from the history of the
// specification repository holding the corpus, must hash to the sha256 the
// SDK declares for the text it applies. The text beside the corpus plays no
// part, so an unrelated specification commit cannot change the result.
func newRun(corpusDir, applied, appliedSHA256 string, strict bool) *run {
	r := &run{evaluator: schemaeval.New(schemaeval.Options{}), strict: strict}
	r.lines = []string{strings.TrimSuffix(openbindings.SupportedVersions, ".x")}
	release, revision, ok := strings.Cut(applied, "@")
	switch {
	case applied == "":
		r.unverified = "no applied text was declared (-applied release@revision)"
	case !ok:
		r.unverified = "-applied must be release@revision"
	default:
		r.release, r.revision = release, revision
		text, err := gitShow(corpusDir, revision+":openbindings.md")
		sum := sha256.Sum256(text)
		switch got := hex.EncodeToString(sum[:]); {
		case appliedSHA256 == "":
			r.unverified = "no applied-text hash was declared (-applied-sha256)"
		case err != nil:
			r.unverified = fmt.Sprintf("the specification history holding the corpus does not give the text at %s: %v", revision, err)
		case got != appliedSHA256:
			r.unverified = fmt.Sprintf("openbindings.md at %s hashes to %s, not the declared %s", revision, got, appliedSHA256)
		default:
			r.verified = true
		}
	}
	return r
}

var semverRE = regexp.MustCompile(`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$`)

// supports judges a version against the declaration, never against the
// SDK's version decision.
func (r *run) supports(v string) bool {
	m := semverRE.FindStringSubmatch(v)
	if m == nil {
		return false
	}
	if m[4] != "" {
		return slices.Contains(r.prereleases, m[1]+"."+m[2]+"."+m[3]+"-"+m[4])
	}
	return slices.Contains(r.lines, m[1]+"."+m[2]) || (m[1] != "0" && slices.Contains(r.lines, m[1]))
}

func (r *run) lowest() string {
	line := r.lines[0]
	if strings.Contains(line, ".") {
		return line + ".0"
	}
	return line + ".0.0"
}

// compareRelease orders major.minor.patch as digit strings, never machine
// integers.
func compareRelease(a, b string) int {
	pa, pb := semverRE.FindStringSubmatch(a), semverRE.FindStringSubmatch(b)
	if pa == nil || pb == nil {
		return strings.Compare(a, b)
	}
	for i := 1; i <= 3; i++ {
		if c := len(pa[i]) - len(pb[i]); c != 0 {
			return c
		}
		if c := strings.Compare(pa[i], pb[i]); c != 0 {
			return c
		}
	}
	return 0
}

func (r *run) gate(g Gates) (string, bool) {
	if v := g.RequiresSupports; v != "" && !r.supports(v) {
		return "gate: requires a tool declaring support for " + v, true
	}
	if v := g.RequiresUnsupported; v != "" && r.supports(v) {
		return "gate: requires a tool not declaring support for " + v, true
	}
	if v := g.RequiresMinSupported; v != "" && compareRelease(r.lowest(), v) < 0 {
		return "gate: requires a lowest supported version of at least " + v, true
	}
	return "", false
}

func failed(format string, a ...any) (string, string) { return Fail, fmt.Sprintf(format, a...) }

// judge runs one case under a time bound and returns its category and
// detail.
func (r *run) judge(c Case) (status, detail string) {
	if reason, skip := r.gate(c.Gates); skip {
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
		case "validity":
			a.status, a.detail = judgeFixture(c)
		case "validate-document":
			a.status, a.detail = r.judgeDocument(c)
		case "resolve-operation":
			a.status, a.detail = judgeResolve(c)
		case "conclude-conformance":
			a.status, a.detail = judgeConclude(c)
		case "check-dependency-kind":
			a.status, a.detail = judgeKind(c)
		case "validate-operation-values":
			a.status, a.detail = r.judgeValues(c)
		case "check-examples":
			a.status, a.detail = r.judgeExamples(c)
		case "derive-form":
			a.status, a.detail = Omitted, "this SDK derives no forms from a schema (OBI-T-05 has no executor here)"
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

type carriage struct {
	Document       json.RawMessage `json:"document"`
	DocumentText   *string         `json:"documentText"`
	DocumentBase64 string          `json:"documentBase64"`
}

func (g carriage) bytes() ([]byte, error) {
	switch {
	case g.Document != nil:
		return g.Document, nil
	case g.DocumentText != nil:
		return []byte(*g.DocumentText), nil
	case g.DocumentBase64 != "":
		return base64.StdEncoding.DecodeString(g.DocumentBase64)
	}
	return nil, errors.New("no document carriage")
}

func isRefusal(err error) bool { return errors.As(err, new(*openbindings.VersionRefusalError)) }

// refusalResidue lists what a version refusal came with; it is exclusive of
// a document, a report, and an established violation.
func refusalResidue(doc *openbindings.Document, report openbindings.ValidationReport, err error) []string {
	var out []string
	if doc != nil {
		out = append(out, "a document")
	}
	if !reflect.DeepEqual(report, openbindings.ValidationReport{}) {
		out = append(out, "a report")
	}
	if errors.As(err, new(*openbindings.ValidationError)) {
		out = append(out, "a *ValidationError in its error chain")
	}
	return out
}

// judgeFixture holds a validity fixture to ValidateDocument: a conforming
// case is not refused and establishes no violation (it may be undetermined);
// a violating case is non-conformant, with every rule violates names
// violated and none notViolated names.
func judgeFixture(c Case) (string, string) {
	var t struct {
		carriage
		Valid       bool     `json:"valid"`
		Violates    []string `json:"violates"`
		NotViolated []string `json:"notViolated"`
	}
	if err := json.Unmarshal(c.Raw, &t); err != nil {
		return failed("unreadable fixture: %v", err)
	}
	data, err := t.bytes()
	if err != nil {
		return failed("%v", err)
	}
	doc, report, err := openbindings.ValidateDocument(data)
	refused := isRefusal(err)
	var violation *openbindings.ValidationError
	if err != nil && !refused && !errors.As(err, &violation) {
		return failed("ValidateDocument: unexpected error %v", err)
	}
	if refused {
		if residue := refusalResidue(doc, report, err); len(residue) > 0 {
			return failed("the version refusal came with %s", strings.Join(residue, ", "))
		}
		return failed("version-refusal; expected a conclusion")
	}
	if (violation != nil) != (report.Conclusion == openbindings.ConclusionNonConformant) {
		return failed("the error %v disagrees with the conclusion %s", err, report.Conclusion)
	}
	if t.Valid {
		if report.Conclusion == openbindings.ConclusionNonConformant {
			return failed("established violations %v for a conforming case", report.Violated)
		}
		return Pass, string(report.Conclusion)
	}
	if report.Conclusion != openbindings.ConclusionNonConformant {
		return failed("concluded %s for a violating case", report.Conclusion)
	}
	for _, rule := range t.Violates {
		if report.Evidence[rule] != openbindings.EvidenceViolated {
			return failed("%s is %q, not violated (violated: %v)", rule, report.Evidence[rule], report.Violated)
		}
	}
	for _, rule := range t.NotViolated {
		if report.Evidence[rule] == openbindings.EvidenceViolated {
			return failed("%s reported violated; the fixture lists it notViolated (violated: %v)", rule, report.Violated)
		}
	}
	return Pass, "non-conformant"
}

func (r *run) judgeDocument(c Case) (string, string) {
	var s struct {
		Given    carriage `json:"given"`
		Expected struct {
			Outcome          string   `json:"outcome"`
			Violates         []string `json:"violates"`
			NamesAppliedText bool     `json:"namesAppliedText"`
		} `json:"expected"`
	}
	if err := json.Unmarshal(c.Raw, &s); err != nil {
		return failed("unreadable scenario: %v", err)
	}
	data, err := s.Given.bytes()
	if err != nil {
		return failed("%v", err)
	}
	// The SDK detects repeated member names, so duplicateBlind does not
	// apply to it.
	doc, report, err := openbindings.ValidateDocument(data)
	if isRefusal(err) {
		if residue := refusalResidue(doc, report, err); len(residue) > 0 {
			return failed("the version refusal came with %s", strings.Join(residue, ", "))
		}
		if s.Expected.Outcome != "version-refusal" {
			return failed("version-refusal; expected %s", s.Expected.Outcome)
		}
		if parsed, perr := openbindings.ParseDocument(data); !isRefusal(perr) || parsed != nil || errors.As(perr, new(*openbindings.ValidationError)) {
			return failed("ParseDocument does not refuse exclusively")
		}
		return Pass, "version-refusal"
	}
	if s.Expected.Outcome == "version-refusal" {
		return failed("concluded %s; expected version-refusal", report.Conclusion)
	}
	var violation *openbindings.ValidationError
	if err != nil && !errors.As(err, &violation) {
		return failed("ValidateDocument: unexpected error %v", err)
	}
	if (violation != nil) != (report.Conclusion == openbindings.ConclusionNonConformant) {
		return failed("the error %v disagrees with the conclusion %s", err, report.Conclusion)
	}
	switch want := s.Expected.Outcome; {
	case want == "interpreted":
		if report.Conclusion == "" {
			return failed("no conclusion")
		}
	case want == "conformant" && report.Conclusion == openbindings.ConclusionConformanceUndetermined:
	case string(report.Conclusion) != want:
		return failed("concluded %s; expected %s", report.Conclusion, want)
	}
	for _, rule := range s.Expected.Violates {
		if report.Evidence[rule] != openbindings.EvidenceViolated {
			return failed("%s is %q, not violated (violated: %v)", rule, report.Evidence[rule], report.Violated)
		}
	}
	if s.Expected.NamesAppliedText {
		// The named identity first, then the bytes it names: a naming defect
		// is a failure whether or not the text can be verified.
		if r.release != "" && (report.Version != r.release || report.Revision != r.revision) {
			return failed("names %q@%q; the declared applied text is %q@%q", report.Version, report.Revision, r.release, r.revision)
		}
		if !r.verified {
			if r.strict {
				return failed("UNVERIFIED applied text: %s", r.unverified)
			}
			return Unverified, r.unverified
		}
	}
	return Pass, string(report.Conclusion)
}

func judgeResolve(c Case) (string, string) {
	var s struct {
		Given struct {
			Document      json.RawMessage `json:"document"`
			NonConformant []string        `json:"nonConformant"`
			Name          string          `json:"name"`
		} `json:"given"`
		Expected struct {
			Outcome      string   `json:"outcome"`
			OperationKey string   `json:"operationKey"`
			BindingKeys  []string `json:"bindingKeys"`
			KeyMatch     string   `json:"keyMatch"`
			AliasMatch   string   `json:"aliasMatch"`
		} `json:"expected"`
	}
	if err := json.Unmarshal(c.Raw, &s); err != nil {
		return failed("unreadable scenario: %v", err)
	}
	doc, report, err := openbindings.ValidateDocument(s.Given.Document)
	if isRefusal(err) {
		if residue := refusalResidue(doc, report, err); len(residue) > 0 {
			return failed("the version refusal came with %s", strings.Join(residue, ", "))
		}
		if s.Expected.Outcome == "version-refusal" {
			return Pass, "version-refusal"
		}
		return failed("version-refusal; expected %s", s.Expected.Outcome)
	}
	if s.Expected.Outcome == "version-refusal" {
		return failed("interpreted; expected version-refusal")
	}
	if doc == nil {
		if len(s.Given.NonConformant) == 0 {
			return failed("the model does not carry a conformant document (%v)", err)
		}
		return Omitted, "the model cannot carry this non-conformant document, so the SDK does not continue with it"
	}
	key, _, found := doc.ResolveOperation(s.Given.Name)
	switch s.Expected.Outcome {
	case "collision":
		switch {
		case !found:
			return Advisory, "no single resolution"
		case key == s.Expected.KeyMatch:
			return Advisory, "key match " + key
		case key == s.Expected.AliasMatch:
			return Advisory, "alias match " + key
		}
		return failed("resolved to %q, neither candidate", key)
	case "not-found":
		if found {
			return failed("resolved to %q; expected not-found", key)
		}
		return Pass, "not-found"
	}
	if !found || key != s.Expected.OperationKey {
		return failed("resolved (%q, %v); expected %q", key, found, s.Expected.OperationKey)
	}
	bindings := doc.OperationBindings(key)
	want := slices.Clone(s.Expected.BindingKeys)
	sort.Strings(want)
	if !slices.Equal(bindings, want) && !(len(bindings) == 0 && len(want) == 0) {
		return failed("binding keys %v; expected %v", bindings, want)
	}
	return Pass, "resolved " + key
}

func judgeConclude(c Case) (string, string) {
	var s struct {
		Given struct {
			Evidence map[string]openbindings.RuleEvidenceStatus `json:"evidence"`
		} `json:"given"`
		Expected struct {
			Conclusion string `json:"conclusion"`
		} `json:"expected"`
	}
	if err := json.Unmarshal(c.Raw, &s); err != nil {
		return failed("unreadable scenario: %v", err)
	}
	got := openbindings.ConcludeConformance(s.Given.Evidence).Conclusion
	// conformant admits conformance-undetermined, as in validate-document:
	// OBI-T-09 only prohibits.
	if string(got) != s.Expected.Conclusion && !(s.Expected.Conclusion == "conformant" && got == openbindings.ConclusionConformanceUndetermined) {
		return failed("concluded %s; expected %s", got, s.Expected.Conclusion)
	}
	return Pass, string(got)
}

func judgeKind(c Case) (string, string) {
	var s struct {
		Given struct {
			Document      json.RawMessage `json:"document"`
			NonConformant []string        `json:"nonConformant"`
			Dependency    string          `json:"dependency"`
			Binding       string          `json:"binding"`
			Sentinels     []string        `json:"retrievalSentinels"`
		} `json:"given"`
		Expected struct {
			Outcome string `json:"outcome"`
		} `json:"expected"`
	}
	if err := json.Unmarshal(c.Raw, &s); err != nil {
		return failed("unreadable scenario: %v", err)
	}
	data := []byte(s.Given.Document)
	var observe *sentinels
	if len(s.Given.Sentinels) > 0 {
		var err error
		if observe, err = startSentinels(s.Given.Sentinels); err != nil {
			return Omitted, err.Error()
		}
		data = observe.substitute(data)
	}
	doc, _, err := openbindings.ValidateDocument(data)
	meets := false
	if doc != nil {
		binding := doc.Bindings[s.Given.Binding]
		meets = doc.Dependencies[s.Given.Dependency].AcceptsKind(doc.Sources[binding.Source].Kind)
	}
	if observe != nil {
		if seen := observe.stop(); seen != "" {
			return failed("%s", seen)
		}
	}
	switch {
	case isRefusal(err):
		return failed("version-refusal; expected %s", s.Expected.Outcome)
	case doc == nil && len(s.Given.NonConformant) == 0:
		return failed("the model does not carry a conformant document (%v)", err)
	case doc == nil:
		return Omitted, "the model cannot carry this non-conformant document, so the SDK does not continue with it"
	}
	got := map[bool]string{true: "meets", false: "does-not-meet"}[meets]
	if got != s.Expected.Outcome {
		return failed("%s; expected %s", got, s.Expected.Outcome)
	}
	return Pass, got
}

// contracts decodes the document into the model and resolves its value
// contracts, so Resolve's own version decision is the one exercised.
func (r *run) contracts(document json.RawMessage, resources []openbindings.Resource) (*openbindings.ValueContracts, *openbindings.Document, bool, error) {
	var doc openbindings.Document
	if err := json.Unmarshal(document, &doc); err != nil {
		return nil, nil, false, err
	}
	compiler, err := openbindings.NewValueContractCompiler(r.evaluator, resources...)
	if err != nil {
		return nil, &doc, true, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), caseBound)
	defer cancel()
	contracts, err := compiler.Resolve(ctx, &doc)
	return contracts, &doc, true, err
}

type observed struct{ verdict, reason string }

func observe(err error) (observed, error) {
	mismatch, noVerdict := errors.Is(err, openbindings.ErrMismatch), errors.Is(err, openbindings.ErrNoVerdict)
	switch {
	case err == nil:
		return observed{verdict: "valid"}, nil
	case mismatch && noVerdict:
		return observed{}, fmt.Errorf("an answer matches both ErrMismatch and ErrNoVerdict: %v", err)
	case mismatch:
		return observed{verdict: "instance-mismatch"}, nil
	case noVerdict:
		reason := ""
		switch {
		case errors.Is(err, openbindings.ErrNoValueContract):
			reason = "no-contract"
		case errors.Is(err, openbindings.ErrUndefined):
			reason = "undefined-result"
		}
		return observed{verdict: "no-verdict", reason: reason}, nil
	}
	return observed{}, fmt.Errorf("an answer that is neither outcome: %v", err)
}

func (r *run) judgeValues(c Case) (string, string) {
	var s struct {
		Given struct {
			Document      json.RawMessage   `json:"document"`
			NonConformant []string          `json:"nonConformant"`
			Operation     string            `json:"operation"`
			Side          string            `json:"side"`
			Values        []json.RawMessage `json:"values"`
			Resources     []struct {
				URI      string          `json:"uri"`
				Document json.RawMessage `json:"document"`
			} `json:"resources"`
		} `json:"given"`
		Expected struct {
			Outcome       string            `json:"outcome"`
			Results       []json.RawMessage `json:"results"`
			DependsOn     []string          `json:"dependsOn"`
			ForbidReasons []string          `json:"forbidReasons"`
		} `json:"expected"`
	}
	if err := json.Unmarshal(c.Raw, &s); err != nil {
		return failed("unreadable scenario: %v", err)
	}
	var resources []openbindings.Resource
	for _, res := range s.Given.Resources {
		resources = append(resources, openbindings.Resource{URI: res.URI, Document: res.Document})
	}
	contracts, _, carried, err := r.contracts(s.Given.Document, resources)
	switch {
	case !carried && len(s.Given.NonConformant) == 0:
		return failed("the model does not carry a conformant document: %v", err)
	case !carried:
		return Omitted, "the model cannot carry this non-conformant document, so the SDK does not continue with it"
	case isRefusal(err):
		if contracts != nil || errors.As(err, new(*openbindings.ValidationError)) {
			return failed("the version refusal came with a result")
		}
		if s.Expected.Outcome == "version-refusal" {
			return Pass, "version-refusal"
		}
		return failed("version-refusal; expected value results")
	case err != nil:
		return failed("Resolve: %v", err)
	case s.Expected.Outcome != "":
		return failed("the document was interpreted; expected %s", s.Expected.Outcome)
	}
	compile := contracts.CompileInput
	if s.Given.Side == "output" {
		compile = contracts.CompileOutput
	}
	ctx, cancel := context.WithTimeout(context.Background(), caseBound)
	defer cancel()
	contract, err := compile(ctx, s.Given.Operation)
	if err != nil {
		return failed("compiling %s's %s contract: %v", s.Given.Operation, s.Given.Side, err)
	}
	if len(s.Expected.Results) != len(s.Given.Values) {
		return failed("%d expected results for %d values", len(s.Expected.Results), len(s.Given.Values))
	}
	var got []string
	shortfall, omission := "", ""
	for i, v := range s.Given.Values {
		o, err := observe(contract.ValidateJSON(ctx, v))
		if err != nil {
			return failed("value %d: %v", i, err)
		}
		got = append(got, o.verdict)
		if o.reason != "" && slices.Contains(s.Expected.ForbidReasons, o.reason) {
			return failed("value %d: reason %s is forbidden here", i, o.reason)
		}
		var form struct {
			Verdict     string   `json:"verdict"`
			OrNoVerdict bool     `json:"orNoVerdict"`
			DependsOn   []string `json:"dependsOn"`
		}
		var token string
		if json.Unmarshal(s.Expected.Results[i], &token) == nil {
			form.Verdict = token
		} else if err := json.Unmarshal(s.Expected.Results[i], &form); err != nil {
			return failed("unreadable expected result: %v", err)
		}
		depends := s.Expected.DependsOn
		if form.DependsOn != nil {
			depends = form.DependsOn
		}
		lacking := ""
		for _, f := range depends {
			supported, declared := profile[f]
			if !declared {
				return failed("the profile does not declare %s", f)
			}
			if !supported {
				lacking = f
			}
		}
		switch {
		case form.Verdict == "no-verdict" || (lacking != "" && !form.OrNoVerdict):
			if o.verdict != "no-verdict" {
				return failed("value %d: no verdict is required (%s); got %s", i, map[bool]string{true: "the profile declares " + lacking + " unsupported", false: "an undefined result or no contract"}[lacking != ""], o.verdict)
			}
		case o.verdict == form.Verdict:
		case o.verdict == "no-verdict" && form.OrNoVerdict:
		case o.verdict == "no-verdict" && o.reason == "resource-limit":
			omission = fmt.Sprintf("value %d: no verdict at a reported resource limit", i)
		case o.verdict == "no-verdict":
			shortfall = fmt.Sprintf("value %d: no verdict where the profile supports every feature the case depends on", i)
		default:
			return failed("value %d: got %s; expected %s", i, o.verdict, string(s.Expected.Results[i]))
		}
	}
	switch {
	case shortfall != "":
		return Shortfall, fmt.Sprintf("%s %v", shortfall, got)
	case omission != "":
		return Omitted, fmt.Sprintf("%s %v", omission, got)
	}
	return Pass, fmt.Sprint(got)
}

// judgeExamples checks an operation's examples by composing value
// validation: the SDK has no example checker.
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
	contracts, doc, carried, err := r.contracts(s.Given.Document, nil)
	if !carried || err != nil {
		return failed("the document's value contracts: %v", err)
	}
	key, operation, found := doc.ResolveOperation(s.Given.Operation)
	if !found {
		return failed("operation %q not found", s.Given.Operation)
	}
	ctx, cancel := context.WithTimeout(context.Background(), caseBound)
	defer cancel()
	got := map[string]map[string]string{}
	for name, example := range operation.Examples {
		got[name] = map[string]string{}
		for _, side := range []struct {
			name    string
			value   json.RawMessage
			schema  openbindings.JSONSchema
			compile func(context.Context, string) (*openbindings.ValueContract, error)
		}{{"input", example.Input, operation.Input, contracts.CompileInput}, {"output", example.Output, operation.Output, contracts.CompileOutput}} {
			if side.value == nil {
				continue
			}
			if side.schema == nil {
				got[name][side.name] = "no-claim"
				continue
			}
			contract, err := side.compile(ctx, key)
			if err != nil {
				return failed("compiling %s's %s contract: %v", key, side.name, err)
			}
			o, err := observe(contract.ValidateJSON(ctx, side.value))
			if err != nil {
				return failed("example %s %s: %v", name, side.name, err)
			}
			got[name][side.name] = map[string]string{"valid": "holds", "instance-mismatch": "false-claim", "no-verdict": "no-verdict"}[o.verdict]
		}
	}
	a, _ := json.Marshal(got)
	b, _ := json.Marshal(s.Expected.Examples)
	if !bytes.Equal(a, b) {
		return failed("got %s; expected %s", a, b)
	}
	return Pass, "composition"
}
