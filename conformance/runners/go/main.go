// Reference Go runner for the OpenBindings conformance corpus.
//
// Walks fixture files under spec/conformance/{document,tool}/, validates each
// embedded `document` with the openbindings-go SDK's ValidateDocument, and
// holds its report to the fixture: a conforming case establishes no violation,
// and a violating case is refused (OBI-T-04) or non-conformant with every rule
// the fixture names violated. Also runs the core tool scenarios under
// spec/conformance/scenarios/. Reports per-rule and overall pass/fail counts.
//
// This is reference code for SDK authors writing harnesses in other
// languages. The pattern is the same; only the SDK invocation differs.
//
// Usage:
//   go run ./conformance/runners/go             # all fixtures
//   go run ./conformance/runners/go -rule=OBI-D-03   # single rule
//   go run ./conformance/runners/go -verbose    # per-test output
//   go run ./conformance/runners/go -json       # machine-readable summary

package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	openbindings "github.com/openbindings/openbindings-go"
)

type Fixture struct {
	Rule        string `json:"rule"`
	Section     string `json:"section"`
	Description string `json:"description"`
	Notes       string `json:"notes,omitempty"`
	Tests       []Test `json:"tests"`
}

type Test struct {
	Description          string          `json:"description"`
	Document             json.RawMessage `json:"document"`
	DocumentText         *string         `json:"documentText,omitempty"`
	DocumentBase64       string          `json:"documentBase64,omitempty"`
	Valid                bool            `json:"valid"`
	Violates             []string        `json:"violates,omitempty"`
	RequiresMinSupported string          `json:"requiresMinSupported,omitempty"`
	RequiresSupports     string          `json:"requiresSupports,omitempty"`
}

type Result struct {
	Rule     string
	Test     string
	Passed   bool
	Skipped  bool
	Expected bool   // what the fixture expected (test.Valid)
	Actual   bool   // what the SDK produced: no refusal and no violation established
	Reason   string // populated when !Passed
}

type Summary struct {
	Total      int                 `json:"total"`
	Passed     int                 `json:"passed"`
	Failed     int                 `json:"failed"`
	Skipped    int                 `json:"skipped"`
	ByRule     map[string]RuleStat `json:"byRule"`
	Mismatches []Mismatch          `json:"mismatches,omitempty"`
}

type RuleStat struct {
	Total   int `json:"total"`
	Passed  int `json:"passed"`
	Skipped int `json:"skipped,omitempty"`
}

type Mismatch struct {
	Rule     string `json:"rule"`
	Test     string `json:"test"`
	Expected bool   `json:"expected"`
	Actual   bool   `json:"actual"`
	Reason   string `json:"reason,omitempty"`
}

func main() {
	var (
		corpusDir  string
		ruleFilter string
		verbose    bool
		jsonOutput bool
	)
	flag.StringVar(&corpusDir, "corpus", findDefaultCorpus(), "path to the conformance/ directory")
	flag.StringVar(&ruleFilter, "rule", "", "limit to fixtures for this rule (e.g. OBI-D-03)")
	flag.BoolVar(&verbose, "verbose", false, "print per-test results")
	flag.BoolVar(&jsonOutput, "json", false, "emit JSON summary instead of human-readable output")
	flag.Parse()

	files, err := listFixtures(corpusDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "list fixtures: %v\n", err)
		os.Exit(2)
	}
	if ruleFilter != "" {
		files = filterByRule(files, ruleFilter)
	}
	scenarioFiles, err := listScenarioFiles(corpusDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "list tool scenarios: %v\n", err)
		os.Exit(2)
	}
	if ruleFilter != "" {
		scenarioFiles = filterByRule(scenarioFiles, ruleFilter)
	}

	results := append(runAll(files), runAllToolScenarios(scenarioFiles)...)
	summary := summarize(results)

	if jsonOutput {
		out, _ := json.MarshalIndent(summary, "", "  ")
		fmt.Println(string(out))
		if summary.Failed > 0 {
			os.Exit(1)
		}
		return
	}

	printHumanSummary(summary, verbose, results)
	if summary.Failed > 0 {
		os.Exit(1)
	}
}

func listScenarioFiles(root string) ([]string, error) {
	dir := filepath.Join(root, "scenarios")
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read %s: %w", dir, err)
	}
	var out []string
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".json" {
			out = append(out, filepath.Join(dir, e.Name()))
		}
	}
	sort.Strings(out)
	return out, nil
}

func findDefaultCorpus() string {
	// Two-strategy lookup. First try a path relative to the binary's
	// directory: this matches the case where the runner has been built
	// (`go build`) and lives at runners/go/, three directory levels above
	// conformance/. Under `go run .` the binary is in a temp build dir, so
	// this strategy fails and we fall through to the cwd walker below.
	exe, err := os.Executable()
	if err == nil {
		dir := filepath.Dir(exe)
		guess := filepath.Join(dir, "..", "..", "..", "conformance")
		if _, err := os.Stat(guess); err == nil {
			return guess
		}
	}
	// Walk up from cwd looking for spec/conformance/ or conformance/.
	cwd, _ := os.Getwd()
	for d := cwd; d != "/"; d = filepath.Dir(d) {
		guess := filepath.Join(d, "spec", "conformance")
		if _, err := os.Stat(guess); err == nil {
			return guess
		}
		guess = filepath.Join(d, "conformance")
		if _, err := os.Stat(guess); err == nil {
			return guess
		}
	}
	return "./conformance"
}

func listFixtures(root string) ([]string, error) {
	var out []string
	for _, sub := range []string{"document", "tool"} {
		dir := filepath.Join(root, sub)
		entries, err := os.ReadDir(dir)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, fmt.Errorf("read %s: %w", dir, err)
		}
		for _, e := range entries {
			if filepath.Ext(e.Name()) != ".json" {
				continue
			}
			out = append(out, filepath.Join(dir, e.Name()))
		}
	}
	sort.Strings(out)
	return out, nil
}

func filterByRule(files []string, rule string) []string {
	var out []string
	for _, f := range files {
		base := strings.TrimSuffix(filepath.Base(f), ".json")
		if base == rule {
			out = append(out, f)
		}
	}
	return out
}

func runAll(files []string) []Result {
	var all []Result
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			fmt.Fprintf(os.Stderr, "read %s: %v\n", f, err)
			continue
		}
		var fix Fixture
		if err := json.Unmarshal(data, &fix); err != nil {
			fmt.Fprintf(os.Stderr, "parse %s: %v\n", f, err)
			continue
		}
		for _, t := range fix.Tests {
			res := runOne(fix.Rule, t)
			all = append(all, res)
		}
	}
	return all
}

func runOne(rule string, t Test) Result {
	if reason, skip := versionGate(t); skip {
		return Result{Rule: rule, Test: t.Description, Skipped: true, Reason: reason}
	}
	r := Result{Rule: rule, Test: t.Description, Expected: t.Valid}
	documentBytes, err := testDocumentBytes(t)
	if err != nil {
		r.Reason = "fixture: " + err.Error()
		return r
	}
	_, report, err := openbindings.ValidateDocument(documentBytes, openbindings.ValidateOptions{})
	var refusal *openbindings.VersionRefusalError
	refused := errors.As(err, &refusal)
	var violation *openbindings.ValidationError
	if err != nil && !refused && !errors.As(err, &violation) {
		r.Reason = "validate: " + err.Error()
		return r
	}
	r.Actual = !refused && report.Conclusion != openbindings.ConclusionNonConformant
	r.Reason = disagreement(t, report, refused)
	r.Passed = r.Reason == ""
	return r
}

// disagreement states how the SDK's report differs from what the fixture
// expects, or returns "". A conforming case establishes no violation, though
// the SDK may leave it undetermined (inconclusive is not non-conformant). A
// violating case is refused (OBI-T-04) or non-conformant, with every
// document rule the fixture names violated: the fixture's violates list is a
// minimum set.
func disagreement(t Test, report openbindings.ValidationReport, refused bool) string {
	if t.Valid {
		switch {
		case refused:
			return "the SDK refused a conforming case (OBI-T-04)"
		case report.Conclusion == openbindings.ConclusionNonConformant:
			return fmt.Sprintf("the SDK established violations of %v for a conforming case", report.Violated)
		}
		return ""
	}
	if !refused && report.Conclusion != openbindings.ConclusionNonConformant {
		return fmt.Sprintf("the SDK concluded %s for a violating case", report.Conclusion)
	}
	for _, rule := range t.Violates {
		switch {
		case rule == "OBI-T-04":
			if !refused {
				return "expected an OBI-T-04 version refusal"
			}
		case refused:
		case strings.HasPrefix(rule, "OBI-D-"):
			if report.Evidence[rule] != openbindings.EvidenceViolated {
				return fmt.Sprintf("expected %s violated; its evidence is %s", rule, report.Evidence[rule])
			}
		}
	}
	return ""
}

// versionGate applies a test's version annotations to the SDK's support
// declaration, SupportedVersions. Skips are reported separately, never as
// failures.
func versionGate(t Test) (string, bool) {
	if t.RequiresMinSupported != "" && compareRelease(lowestSupported(), t.RequiresMinSupported) < 0 {
		// A downward-refusal test applies only when the lowest version the
		// SDK supports is at or above the annotation's value.
		return fmt.Sprintf("requires the lowest supported version to be at least %s; this SDK supports %s", t.RequiresMinSupported, openbindings.SupportedVersions), true
	}
	if t.RequiresSupports != "" {
		// Administer the test only to tools whose OBI-T-04 version-acceptance
		// predicate accepts the annotation's version; for this SDK that
		// predicate is IsSupportedVersion.
		if accepts, err := openbindings.IsSupportedVersion(t.RequiresSupports); err == nil && !accepts {
			return fmt.Sprintf("requires an SDK whose OBI-T-04 acceptance predicate accepts %s; this SDK refuses it", t.RequiresSupports), true
		}
	}
	return "", false
}

// lowestSupported is the lowest version SupportedVersions declares: the first
// release of the supported line ("0.2.x" is 0.2.0, "1.x" is 1.0.0).
func lowestSupported() string {
	line := strings.TrimSuffix(openbindings.SupportedVersions, ".x")
	if !strings.Contains(line, ".") {
		return line + ".0.0"
	}
	return line + ".0"
}

// compareRelease orders two SemVer versions by major, minor, and patch.
func compareRelease(a, b string) int {
	numbers := func(v string) [3]int {
		v, _, _ = strings.Cut(v, "+")
		v, _, _ = strings.Cut(v, "-")
		var out [3]int
		for i, part := range strings.SplitN(v, ".", 3) {
			out[i], _ = strconv.Atoi(part)
		}
		return out
	}
	x, y := numbers(a), numbers(b)
	for i := range x {
		if x[i] != y[i] {
			if x[i] < y[i] {
				return -1
			}
			return 1
		}
	}
	return 0
}

func testDocumentBytes(t Test) ([]byte, error) {
	switch {
	case t.Document != nil:
		return []byte(t.Document), nil
	case t.DocumentText != nil:
		return []byte(*t.DocumentText), nil
	case t.DocumentBase64 != "":
		data, err := base64.StdEncoding.DecodeString(t.DocumentBase64)
		if err != nil {
			return nil, fmt.Errorf("decode documentBase64: %w", err)
		}
		return data, nil
	default:
		return nil, fmt.Errorf("fixture supplies no document carriage")
	}
}

func summarize(results []Result) Summary {
	s := Summary{ByRule: map[string]RuleStat{}}
	for _, r := range results {
		s.Total++
		stat := s.ByRule[r.Rule]
		stat.Total++
		switch {
		case r.Skipped:
			s.Skipped++
			stat.Skipped++
		case r.Passed:
			s.Passed++
			stat.Passed++
		default:
			s.Failed++
			s.Mismatches = append(s.Mismatches, Mismatch{
				Rule:     r.Rule,
				Test:     r.Test,
				Expected: r.Expected,
				Actual:   r.Actual,
				Reason:   r.Reason,
			})
		}
		s.ByRule[r.Rule] = stat
	}
	return s
}

func printHumanSummary(s Summary, verbose bool, results []Result) {
	if s.Skipped > 0 {
		fmt.Printf("Conformance: %d/%d passed (%d skipped)\n\n", s.Passed, s.Total-s.Skipped, s.Skipped)
	} else {
		fmt.Printf("Conformance: %d/%d passed\n\n", s.Passed, s.Total)
	}
	if verbose {
		for _, r := range results {
			status := "PASS"
			switch {
			case r.Skipped:
				status = "SKIP"
			case !r.Passed:
				status = "FAIL"
			}
			fmt.Printf("  [%s] %s :: %s\n", status, r.Rule, r.Test)
			if (r.Skipped || !r.Passed) && r.Reason != "" {
				fmt.Printf("        %s\n", truncate(r.Reason, 200))
			}
		}
		fmt.Println()
	}
	fmt.Println("By rule:")
	rules := make([]string, 0, len(s.ByRule))
	for k := range s.ByRule {
		rules = append(rules, k)
	}
	sort.Strings(rules)
	for _, k := range rules {
		stat := s.ByRule[k]
		if stat.Skipped > 0 {
			fmt.Printf("  %s: %d/%d (%d skipped)\n", k, stat.Passed, stat.Total-stat.Skipped, stat.Skipped)
		} else {
			fmt.Printf("  %s: %d/%d\n", k, stat.Passed, stat.Total)
		}
	}
	if s.Failed > 0 {
		fmt.Printf("\nMismatches (%d):\n", s.Failed)
		byRule := map[string][]Mismatch{}
		for _, m := range s.Mismatches {
			byRule[m.Rule] = append(byRule[m.Rule], m)
		}
		for _, k := range rules {
			ms := byRule[k]
			if len(ms) == 0 {
				continue
			}
			fmt.Printf("  == %s ==\n", k)
			for _, m := range ms {
				fmt.Printf("    - %s\n", m.Test)
				if m.Reason != "" {
					fmt.Printf("      %s\n", truncate(m.Reason, 200))
				}
			}
		}
	}
}

func truncate(s string, n int) string {
	s = strings.ReplaceAll(s, "\n", " ")
	if len(s) > n {
		return s[:n] + "..."
	}
	return s
}
