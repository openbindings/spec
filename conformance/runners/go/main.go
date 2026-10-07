// Reference Go runner for the OpenBindings core conformance corpus.
//
// It executes every case the corpus manifest counts, with the openbindings-go
// SDK and its schemaeval evaluator: the validity fixtures under document/ and
// tool/, and the tool scenarios (format @2) under scenarios/. Each case is
// reported in one run category (pass, FAIL, SHORTFALL, OMITTED, ADVISORY,
// UNVERIFIED; corpus README, "Run categories"), every omission with its
// reason, and the cases are reconciled against the manifest: each one it
// counts is reported exactly once.
//
// This is reference code for SDK authors writing harnesses in other
// languages. The pattern is the same; only the SDK invocation differs.
//
// Usage:
//
//	go run .                                   # every case, human summary
//	go run . -rule OBI-T-07                    # one rule's cases
//	go run . -verbose                          # every case's category
//	go run . -json -pin <SDK commit SHA>       # results for scripts/check-runner-results.mjs,
//	                                           # with the declared applied text
//	go run . -applied 0.2.0@<revision> -applied-sha256 <hex> -strict
//	                                           # verify the text conclusions name
//
// Exit status: 0 when no case fails or falls short and every case is
// accounted for, 1 otherwise, 2 on a usage or IO error.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

// Run categories.
const (
	Pass       = "pass"
	Fail       = "FAIL"
	Shortfall  = "SHORTFALL"
	Omitted    = "OMITTED"
	Advisory   = "ADVISORY"
	Unverified = "UNVERIFIED"
)

// Case is one corpus case: a validity fixture test (identified by its file
// and position) or a scenario (identified by its ID).
type Case struct {
	ID, File, Rule, Action, Description string
	Raw                                 json.RawMessage
	Gates                               Gates
}

// Gates are a case's version gates (corpus README, "Version gates").
type Gates struct {
	RequiresSupports string `json:"requiresSupports"`
}

// Result is one case's run category, with a one-line description: for a
// failure, its signature.
type Result struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	Signature string `json:"signature"`
	action    string
	file      string
}

func main() {
	var (
		corpusDir  string
		ruleFilter string
		verbose    bool
		jsonOutput bool
		pin        string
		applied    string
		appliedSum string
		strict     bool
	)
	flag.StringVar(&corpusDir, "corpus", findDefaultCorpus(), "path to the conformance/ directory")
	flag.StringVar(&ruleFilter, "rule", "", "run only this rule's cases (e.g. OBI-T-07); disables reconciliation")
	flag.BoolVar(&verbose, "verbose", false, "print every case's category")
	flag.BoolVar(&jsonOutput, "json", false, "print the results as JSON for scripts/check-runner-results.mjs")
	flag.StringVar(&pin, "pin", "", "the full commit SHA of the SDK under test, recorded in the JSON results")
	flag.StringVar(&applied, "applied", "", "the applied text the SDK declares: release@revision (a full 40-hex commit), or a release alone; naming cases are UNVERIFIED without it")
	flag.StringVar(&appliedSum, "applied-sha256", "", "the sha256 of the openbindings.md the SDK declares it applies, verified against the revision -applied names")
	flag.BoolVar(&strict, "strict", false, "report an applied text that cannot be verified as FAIL, not UNVERIFIED")
	flag.Parse()

	cases, counts, err := load(corpusDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "loading the corpus: %v\n", err)
		os.Exit(2)
	}
	declared, err := parseApplied(applied, appliedSum)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	r := newRun(corpusDir, declared, strict)
	var results []Result
	for _, c := range cases {
		if ruleFilter != "" && c.Rule != ruleFilter {
			continue
		}
		status, detail := r.judge(c)
		results = append(results, Result{ID: c.ID, Status: status, Signature: oneLine(detail), action: c.Action, file: c.File})
	}
	problems := []string{}
	if ruleFilter == "" {
		problems = append(problems, reconcile(cases, counts, results)...)
	}
	if jsonOutput {
		out, _ := json.MarshalIndent(struct {
			Pin            string   `json:"pin"`
			Applied        string   `json:"applied"`
			AppliedSHA256  string   `json:"appliedSHA256"`
			Reconciliation []string `json:"reconciliation"`
			Cases          []Result `json:"cases"`
		}{pin, applied, appliedSum, problems, results}, "", "  ")
		fmt.Println(string(out))
	} else {
		printSummary(results, problems, verbose)
	}
	for _, p := range problems {
		fmt.Fprintln(os.Stderr, "reconciliation:", p)
	}
	for _, res := range results {
		// A SHORTFALL is no verdict where the profile, the SDK's own
		// declaration, supports every feature the case depends on.
		if res.Status == Fail || res.Status == Shortfall {
			os.Exit(1)
		}
	}
	if len(problems) > 0 {
		os.Exit(1)
	}
}

func oneLine(s string) string { return strings.Join(strings.Fields(s), " ") }

// load reads every fixture and scenario file, and the manifest's per-file
// counts. Scenario files must be format @2.
func load(dir string) ([]Case, map[string]int, error) {
	data, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if err != nil {
		return nil, nil, err
	}
	var m struct {
		Files []struct {
			Path  string `json:"path"`
			Tests int    `json:"tests"`
		} `json:"files"`
		ScenarioFiles []struct {
			Path      string `json:"path"`
			Scenarios int    `json:"scenarios"`
		} `json:"scenarioFiles"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, nil, fmt.Errorf("manifest: %w", err)
	}
	counts := map[string]int{}
	for _, f := range m.Files {
		counts[f.Path] = f.Tests
	}
	for _, f := range m.ScenarioFiles {
		counts[f.Path] = f.Scenarios
	}
	var cases []Case
	for _, sub := range []string{"document", "tool"} {
		names, err := jsonFiles(filepath.Join(dir, sub))
		if err != nil {
			return nil, nil, err
		}
		for _, name := range names {
			rel := sub + "/" + name
			var f struct {
				Rule  string            `json:"rule"`
				Tests []json.RawMessage `json:"tests"`
			}
			if err := readJSON(filepath.Join(dir, rel), &f); err != nil {
				return nil, nil, err
			}
			for i, raw := range f.Tests {
				var h struct {
					Description string `json:"description"`
					Gates
				}
				if err := json.Unmarshal(raw, &h); err != nil {
					return nil, nil, fmt.Errorf("%s test %d: %w", rel, i, err)
				}
				cases = append(cases, Case{ID: fmt.Sprintf("%s#/tests/%d", rel, i), File: rel, Rule: f.Rule, Action: "validity", Description: h.Description, Raw: raw, Gates: h.Gates})
			}
		}
	}
	names, err := jsonFiles(filepath.Join(dir, "scenarios"))
	if err != nil {
		return nil, nil, err
	}
	for _, name := range names {
		rel := "scenarios/" + name
		var f struct {
			Format    string            `json:"format"`
			Rule      string            `json:"rule"`
			Scenarios []json.RawMessage `json:"scenarios"`
		}
		if err := readJSON(filepath.Join(dir, rel), &f); err != nil {
			return nil, nil, err
		}
		if f.Format != "openbindings.core-tool-scenarios@2" {
			return nil, nil, fmt.Errorf("%s: format %q; this runner reads format @2", rel, f.Format)
		}
		for i, raw := range f.Scenarios {
			var h struct {
				ID          string `json:"id"`
				Description string `json:"description"`
				Action      string `json:"action"`
				Gates
			}
			if err := json.Unmarshal(raw, &h); err != nil {
				return nil, nil, fmt.Errorf("%s scenario %d: %w", rel, i, err)
			}
			cases = append(cases, Case{ID: h.ID, File: rel, Rule: f.Rule, Action: h.Action, Description: h.Description, Raw: raw, Gates: h.Gates})
		}
	}
	return cases, counts, nil
}

func readJSON(path string, v any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, v); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	return nil
}

func jsonFiles(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var out []string
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".json" {
			out = append(out, e.Name())
		}
	}
	sort.Strings(out)
	return out, nil
}

// reconcile checks that every file the manifest lists holds the cases it
// counts, every case was reported exactly once, and every omission says
// why.
func reconcile(cases []Case, counts map[string]int, results []Result) []string {
	var problems []string
	perFile := map[string]int{}
	for _, c := range cases {
		perFile[c.File]++
	}
	for path, n := range counts {
		if perFile[path] != n {
			problems = append(problems, fmt.Sprintf("%s: the manifest counts %d cases, the file holds %d", path, n, perFile[path]))
		}
	}
	for path, n := range perFile {
		if _, ok := counts[path]; !ok {
			problems = append(problems, fmt.Sprintf("%s: %d cases the manifest does not list", path, n))
		}
	}
	seen := map[string]int{}
	for _, r := range results {
		seen[r.ID]++
		if r.Status != Pass && r.Status != Fail && r.Signature == "" {
			problems = append(problems, r.ID+": "+r.Status+" with no reason")
		}
	}
	for _, c := range cases {
		if seen[c.ID] != 1 {
			problems = append(problems, fmt.Sprintf("%s: reported %d times", c.ID, seen[c.ID]))
		}
	}
	sort.Strings(problems)
	return problems
}

func printSummary(results []Result, problems []string, verbose bool) {
	byAction := map[string]map[string]int{}
	total := map[string]int{}
	for _, r := range results {
		if byAction[r.action] == nil {
			byAction[r.action] = map[string]int{}
		}
		byAction[r.action][r.Status]++
		byAction[r.action]["cases"]++
		total[r.Status]++
		if verbose || r.Status == Fail {
			fmt.Printf("%-10s %-40s %s\n", r.Status, r.ID, r.Signature)
		}
	}
	actions := make([]string, 0, len(byAction))
	for a := range byAction {
		actions = append(actions, a)
	}
	sort.Strings(actions)
	fmt.Println()
	for _, a := range actions {
		n := byAction[a]
		fmt.Printf("%-26s %3d cases: pass %d, FAIL %d, OMITTED %d, SHORTFALL %d, ADVISORY %d, UNVERIFIED %d\n",
			a, n["cases"], n[Pass], n[Fail], n[Omitted], n[Shortfall], n[Advisory], n[Unverified])
	}
	fmt.Printf("\n%d cases: pass %d, FAIL %d, OMITTED %d, SHORTFALL %d, ADVISORY %d, UNVERIFIED %d; reconciliation problems: %d\n",
		len(results), total[Pass], total[Fail], total[Omitted], total[Shortfall], total[Advisory], total[Unverified], len(problems))
}

func findDefaultCorpus() string {
	// Under `go run .` from runners/go, the corpus is three levels up.
	cwd, _ := os.Getwd()
	for d := cwd; d != filepath.Dir(d); d = filepath.Dir(d) {
		for _, guess := range []string{filepath.Join(d, "conformance"), filepath.Join(d, "spec", "conformance")} {
			if _, err := os.Stat(filepath.Join(guess, "manifest.json")); err == nil {
				return guess
			}
		}
	}
	return "./conformance"
}

// git runs a git command in the repository holding dir.
func git(dir string, args ...string) ([]byte, error) {
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	var stderr strings.Builder
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git %s: %v %s", strings.Join(args, " "), err, strings.TrimSpace(stderr.String()))
	}
	return out, nil
}
