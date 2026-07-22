// Reference Go runner for the OpenBindings conformance corpus.
//
// Walks fixture files under spec/conformance/{document,tool}/, parses each
// embedded `document` with the openbindings-go SDK, calls Validate(), and
// compares the SDK's verdict against the fixture's `valid` field. Reports
// per-rule and overall pass/fail counts.
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
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
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
	RequiresMaxTested    string          `json:"requiresMaxTested,omitempty"`
	RequiresMinSupported string          `json:"requiresMinSupported,omitempty"`
	RequiresSupports     string          `json:"requiresSupports,omitempty"`
}

type Result struct {
	Rule     string
	Test     string
	Passed   bool
	Skipped  bool
	Expected bool   // what the fixture expected (test.Valid)
	Actual   bool   // what the SDK produced (no parse/validate error)
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
	if t.RequiresMaxTested != "" {
		// Skip when the test depends on a future SDK MaxTestedVersion.
		higher, err := openbindings.IsHigherMajorOrPre1MinorThanMaxTested(t.RequiresMaxTested)
		if err == nil && higher {
			return Result{
				Rule:    rule,
				Test:    t.Description,
				Skipped: true,
				Reason:  fmt.Sprintf("requires SDK MaxTested >= %s; current is %s", t.RequiresMaxTested, openbindings.MaxTestedVersion),
			}
		}
	}
	if t.RequiresMinSupported != "" {
		// Skip when the SDK's supported range extends below the version the
		// downward-refusal test needs it to refuse (MinSupported < required).
		// A required version below or equal to MinSupported means the test
		// applies. Exact string equality suffices for the release-form
		// versions the corpus uses.
		lower, err := openbindings.IsLowerThanMinSupported(t.RequiresMinSupported)
		if err == nil && !lower && t.RequiresMinSupported != openbindings.MinSupportedVersion {
			return Result{
				Rule:    rule,
				Test:    t.Description,
				Skipped: true,
				Reason:  fmt.Sprintf("requires SDK MinSupported >= %s; current is %s", t.RequiresMinSupported, openbindings.MinSupportedVersion),
			}
		}
	}
	if t.RequiresSupports != "" {
		// Acceptance gate: administer the test only to tools whose OBI-T-04
		// version-acceptance predicate accepts the annotation's version.
		// IsSupportedVersion is that predicate for this SDK — the acceptance
		// set, not the tested range (a 0.2.0-tested SDK accepts 0.2.1 via its
		// own release-line declaration). Skips are reported separately, never
		// as failures.
		accepts, err := openbindings.IsSupportedVersion(t.RequiresSupports)
		if err == nil && !accepts {
			return Result{
				Rule:    rule,
				Test:    t.Description,
				Skipped: true,
				Reason:  fmt.Sprintf("requires an SDK whose OBI-T-04 acceptance predicate accepts %s; this SDK refuses it", t.RequiresSupports),
			}
		}
	}
	documentBytes, inputErr := testDocumentBytes(t)
	var parseErr, validateErr error
	if inputErr == nil {
		_, validateErr = openbindings.ValidateDocument(documentBytes)
	} else {
		parseErr = inputErr
	}
	actualValid := parseErr == nil && validateErr == nil
	r := Result{
		Rule:     rule,
		Test:     t.Description,
		Passed:   actualValid == t.Valid,
		Expected: t.Valid,
		Actual:   actualValid,
	}
	if !r.Passed {
		if parseErr != nil {
			r.Reason = "parse: " + parseErr.Error()
		} else if validateErr != nil {
			r.Reason = "validate: " + validateErr.Error()
		} else {
			r.Reason = "SDK accepted; fixture expected reject"
		}
	}
	return r
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
