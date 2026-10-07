// Reference Go runner for the OpenBindings core conformance corpus.
//
// It executes every case the corpus manifest counts, with the openbindings-go
// SDK and its schemaeval evaluator: the validity fixtures under document/ and
// the scenarios (format openbindings.core-scenarios@3) under scenarios/. Each
// case is reported in one run category (pass, FAIL, SHORTFALL, OMITTED;
// corpus README, "Run categories"), every omission with its reason, and the
// cases are reconciled against the manifest: each one it counts is reported
// exactly once.
//
// This is reference code for SDK authors writing harnesses in other
// languages. The pattern is the same; only the SDK invocation differs.
//
// Usage:
//
//	go run .                          # every case, human summary
//	go run . -verbose                 # every case's category
//	go run . -json -pin <SDK commit>  # results for scripts/check-runner-results.mjs
//
// Exit status: 0 when no case fails or falls short and every case is
// accounted for, 1 otherwise, 2 on a usage or IO error.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Run categories (corpus README, "Run categories").
const (
	Pass      = "pass"
	Fail      = "FAIL"
	Shortfall = "SHORTFALL"
	Omitted   = "OMITTED"
)

// scenarioFormat is the only scenario format this runner reads.
const scenarioFormat = "openbindings.core-scenarios@3"

// fixtureAction names the validity fixtures' action, as the manifest counts
// them.
const fixtureAction = "validity fixture"

// Case is one corpus case: a validity fixture test (identified by its file
// and position) or a scenario (identified by its ID).
type Case struct {
	ID, File, Action, Description string
	Raw                           json.RawMessage
}

// Result is one case's run category, with a one-line description: for a
// case that is not a pass, its signature.
type Result struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	Signature string `json:"signature"`
	action    string
}

func main() {
	var (
		corpusDir  string
		verbose    bool
		jsonOutput bool
		pin        string
	)
	flag.StringVar(&corpusDir, "corpus", findDefaultCorpus(), "path to the conformance/ directory")
	flag.BoolVar(&verbose, "verbose", false, "print every case's category")
	flag.BoolVar(&jsonOutput, "json", false, "print the results as JSON for scripts/check-runner-results.mjs")
	flag.StringVar(&pin, "pin", "", "the full commit SHA of the SDK under test, recorded in the JSON results")
	flag.Parse()
	if flag.NArg() > 0 {
		fmt.Fprintf(os.Stderr, "unexpected arguments: %v\n", flag.Args())
		os.Exit(2)
	}

	cases, counts, err := load(corpusDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "loading the corpus: %v\n", err)
		os.Exit(2)
	}
	r := newRun()
	results := make([]Result, 0, len(cases))
	for _, c := range cases {
		status, detail := r.judge(c)
		results = append(results, Result{ID: c.ID, Status: status, Signature: oneLine(detail), action: c.Action})
	}
	problems := reconcile(cases, counts, results)
	if jsonOutput {
		out, _ := json.MarshalIndent(struct {
			Pin            string   `json:"pin"`
			Reconciliation []string `json:"reconciliation"`
			Cases          []Result `json:"cases"`
		}{pin, problems, results}, "", "  ")
		fmt.Println(string(out))
	} else {
		printSummary(results, problems, verbose)
	}
	for _, p := range problems {
		fmt.Fprintln(os.Stderr, "reconciliation:", p)
	}
	for _, res := range results {
		// A SHORTFALL is a decline where the profile, the SDK's own
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

// load reads every fixture file under document/ and every scenario file under
// scenarios/, and the manifest's per-file counts. Scenario files must be in
// scenarioFormat.
func load(dir string) ([]Case, map[string]int, error) {
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
	if err := readJSON(filepath.Join(dir, "manifest.json"), &m); err != nil {
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
	names, err := jsonFiles(filepath.Join(dir, "document"))
	if err != nil {
		return nil, nil, err
	}
	for _, name := range names {
		rel := "document/" + name
		var f struct {
			Tests []json.RawMessage `json:"tests"`
		}
		if err := readJSON(filepath.Join(dir, rel), &f); err != nil {
			return nil, nil, err
		}
		for i, raw := range f.Tests {
			var h struct {
				Description string `json:"description"`
			}
			if err := json.Unmarshal(raw, &h); err != nil {
				return nil, nil, fmt.Errorf("%s test %d: %w", rel, i, err)
			}
			cases = append(cases, Case{ID: fmt.Sprintf("%s#/tests/%d", rel, i), File: rel, Action: fixtureAction, Description: h.Description, Raw: raw})
		}
	}
	names, err = jsonFiles(filepath.Join(dir, "scenarios"))
	if err != nil {
		return nil, nil, err
	}
	for _, name := range names {
		rel := "scenarios/" + name
		var f struct {
			Format    string            `json:"format"`
			Scenarios []json.RawMessage `json:"scenarios"`
		}
		if err := readJSON(filepath.Join(dir, rel), &f); err != nil {
			return nil, nil, err
		}
		if f.Format != scenarioFormat {
			return nil, nil, fmt.Errorf("%s: format %q; this runner reads %s", rel, f.Format, scenarioFormat)
		}
		for i, raw := range f.Scenarios {
			var h struct {
				ID          string `json:"id"`
				Description string `json:"description"`
				Action      string `json:"action"`
			}
			if err := json.Unmarshal(raw, &h); err != nil {
				return nil, nil, fmt.Errorf("%s scenario %d: %w", rel, i, err)
			}
			cases = append(cases, Case{ID: h.ID, File: rel, Action: h.Action, Description: h.Description, Raw: raw})
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
		if !e.IsDir() && filepath.Ext(e.Name()) == ".json" {
			out = append(out, e.Name())
		}
	}
	sort.Strings(out)
	return out, nil
}

// reconcile checks that every file the manifest lists holds the cases it
// counts, every case was reported exactly once, and every case that is not
// a pass says why. It returns an empty list, never nil, when it finds no
// problem: the JSON results always carry a reconciliation.
func reconcile(cases []Case, counts map[string]int, results []Result) []string {
	problems := []string{}
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
		if r.Status != Pass && r.Signature == "" {
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
		if verbose || r.Status != Pass {
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
		fmt.Printf("%-26s %3d cases: pass %d, FAIL %d, SHORTFALL %d, OMITTED %d\n",
			a, n["cases"], n[Pass], n[Fail], n[Shortfall], n[Omitted])
	}
	fmt.Printf("\n%d cases: pass %d, FAIL %d, SHORTFALL %d, OMITTED %d; reconciliation problems: %d\n",
		len(results), total[Pass], total[Fail], total[Shortfall], total[Omitted], len(problems))
}

func findDefaultCorpus() string {
	// Under `go run .` from runners/go, the corpus is two levels up.
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
