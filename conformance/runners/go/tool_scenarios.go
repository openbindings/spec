package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"

	openbindings "github.com/openbindings/openbindings-go"
)

type toolScenarioFile struct {
	Rule      string            `json:"rule"`
	Scenarios []json.RawMessage `json:"scenarios"`
}

type toolScenarioHeader struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Action      string `json:"action"`
}

type resolveOperationScenario struct {
	Description string `json:"description"`
	Given       struct {
		Document json.RawMessage `json:"document"`
		Name     string          `json:"name"`
	} `json:"given"`
	Expected struct {
		Outcome      string   `json:"outcome"`
		OperationKey string   `json:"operationKey"`
		BindingKeys  []string `json:"bindingKeys"`
	} `json:"expected"`
}

type schemaCycleScenario struct {
	Description string `json:"description"`
	Given       struct {
		Document  json.RawMessage `json:"document"`
		Operation string          `json:"operation"`
		Side      string          `json:"side"`
		Value     any             `json:"value"`
	} `json:"given"`
	Expected struct {
		AllowedOutcomes []string `json:"allowedOutcomes"`
	} `json:"expected"`
}

type validateValuesScenario struct {
	Description string `json:"description"`
	Given       struct {
		Document  json.RawMessage `json:"document"`
		Operation string          `json:"operation"`
		Side      string          `json:"side"`
		Values    []any           `json:"values"`
	} `json:"given"`
	Expected struct {
		Results []string `json:"results"`
	} `json:"expected"`
}

type concludeConformanceScenario struct {
	Description string `json:"description"`
	Given       struct {
		Evidence map[string]openbindings.RuleEvidenceStatus `json:"evidence"`
	} `json:"given"`
	Expected struct {
		Conclusion   string   `json:"conclusion"`
		Violated     []string `json:"violated"`
		Inconclusive []string `json:"inconclusive"`
	} `json:"expected"`
}

func runAllToolScenarios(files []string) []Result {
	var results []Result
	for _, path := range files {
		data, err := os.ReadFile(path)
		if err != nil {
			results = append(results, failedScenario("unknown", path, err))
			continue
		}
		var file toolScenarioFile
		if err := json.Unmarshal(data, &file); err != nil {
			results = append(results, failedScenario("unknown", path, err))
			continue
		}
		for _, raw := range file.Scenarios {
			var header toolScenarioHeader
			if err := json.Unmarshal(raw, &header); err != nil {
				results = append(results, failedScenario(file.Rule, "unparseable scenario", err))
				continue
			}
			var result Result
			switch header.Action {
			case "resolve-operation":
				result = runResolveOperationScenario(file.Rule, raw)
			case "resolve-schema-cycle":
				result = runSchemaCycleScenario(file.Rule, raw)
			case "validate-operation-values":
				result = runValidateValuesScenario(file.Rule, raw)
			case "conclude-conformance":
				result = runConcludeConformanceScenario(file.Rule, raw)
			default:
				result = failedScenario(file.Rule, header.Description, fmt.Errorf("unsupported action %q", header.Action))
			}
			results = append(results, result)
		}
	}
	return results
}

func runValidateValuesScenario(rule string, raw json.RawMessage) Result {
	var scenario validateValuesScenario
	if err := json.Unmarshal(raw, &scenario); err != nil {
		return failedScenario(rule, "unparseable validate-values scenario", err)
	}
	iface, _, err := openbindings.ValidateDocument(scenario.Given.Document, openbindings.ValidateOptions{})
	if err != nil {
		return failedScenario(rule, scenario.Description, fmt.Errorf("scenario document: %w", err))
	}
	opKey, op, found := openbindings.ResolveOperation(iface, scenario.Given.Operation)
	if !found {
		return failedScenario(rule, scenario.Description, fmt.Errorf("operation %q not found", scenario.Given.Operation))
	}
	schema := op.Input
	if scenario.Given.Side == "output" {
		schema = op.Output
	}
	if schema == nil {
		return failedScenario(rule, scenario.Description, fmt.Errorf("operation side has no schema"))
	}
	actual := make([]string, 0, len(scenario.Given.Values))
	for _, value := range scenario.Given.Values {
		var err error
		if scenario.Given.Side == "output" {
			err = openbindings.ValidateOperationOutput(value, iface, opKey)
		} else {
			err = openbindings.ValidateOperationInput(value, iface, opKey)
		}
		actual = append(actual, contractOutcome(err, "graph-unavailable"))
	}
	if !equalStrings(actual, scenario.Expected.Results) {
		return failedScenario(rule, scenario.Description, fmt.Errorf("results %v; expected %v", actual, scenario.Expected.Results))
	}
	return passedScenario(rule, scenario.Description)
}

func runConcludeConformanceScenario(rule string, raw json.RawMessage) Result {
	var scenario concludeConformanceScenario
	if err := json.Unmarshal(raw, &scenario); err != nil {
		return failedScenario(rule, "unparseable conclusion scenario", err)
	}
	report := openbindings.ConcludeConformance(scenario.Given.Evidence)
	if string(report.Conclusion) != scenario.Expected.Conclusion {
		return failedScenario(rule, scenario.Description, fmt.Errorf("conclusion %q; expected %q", report.Conclusion, scenario.Expected.Conclusion))
	}
	expectedViolated := append([]string(nil), scenario.Expected.Violated...)
	expectedInconclusive := append([]string(nil), scenario.Expected.Inconclusive...)
	sort.Strings(expectedViolated)
	sort.Strings(expectedInconclusive)
	if !equalStrings(report.Violated, expectedViolated) {
		return failedScenario(rule, scenario.Description, fmt.Errorf("violated rules %v; expected %v", report.Violated, expectedViolated))
	}
	if !equalStrings(report.Inconclusive, expectedInconclusive) {
		return failedScenario(rule, scenario.Description, fmt.Errorf("inconclusive rules %v; expected %v", report.Inconclusive, expectedInconclusive))
	}
	return passedScenario(rule, scenario.Description)
}

func runResolveOperationScenario(rule string, raw json.RawMessage) Result {
	var scenario resolveOperationScenario
	if err := json.Unmarshal(raw, &scenario); err != nil {
		return failedScenario(rule, "unparseable resolve-operation scenario", err)
	}
	iface, _, err := openbindings.ValidateDocument(scenario.Given.Document, openbindings.ValidateOptions{})
	if err != nil {
		return failedScenario(rule, scenario.Description, fmt.Errorf("scenario document: %w", err))
	}
	key, _, found := openbindings.ResolveOperation(iface, scenario.Given.Name)
	if scenario.Expected.Outcome == "not-found" {
		if found {
			return failedScenario(rule, scenario.Description, fmt.Errorf("resolved to %q; expected not-found", key))
		}
		return passedScenario(rule, scenario.Description)
	}
	if !found {
		return failedScenario(rule, scenario.Description, fmt.Errorf("not found; expected %q", scenario.Expected.OperationKey))
	}
	if key != scenario.Expected.OperationKey {
		return failedScenario(rule, scenario.Description, fmt.Errorf("resolved key %q; expected %q", key, scenario.Expected.OperationKey))
	}
	var bindingKeys []string
	for bindingKey, binding := range iface.Bindings {
		if binding.Operation == key {
			bindingKeys = append(bindingKeys, bindingKey)
		}
	}
	sort.Strings(bindingKeys)
	expectedBindings := append([]string(nil), scenario.Expected.BindingKeys...)
	sort.Strings(expectedBindings)
	if !equalStrings(bindingKeys, expectedBindings) {
		return failedScenario(rule, scenario.Description, fmt.Errorf("binding keys %v; expected %v", bindingKeys, expectedBindings))
	}
	return passedScenario(rule, scenario.Description)
}

func runSchemaCycleScenario(rule string, raw json.RawMessage) Result {
	var scenario schemaCycleScenario
	if err := json.Unmarshal(raw, &scenario); err != nil {
		return failedScenario(rule, "unparseable schema-cycle scenario", err)
	}
	iface, _, err := openbindings.ValidateDocument(scenario.Given.Document, openbindings.ValidateOptions{})
	if err != nil {
		return failedScenario(rule, scenario.Description, fmt.Errorf("scenario document: %w", err))
	}
	opKey, op, found := openbindings.ResolveOperation(iface, scenario.Given.Operation)
	if !found {
		return failedScenario(rule, scenario.Description, fmt.Errorf("operation %q not found", scenario.Given.Operation))
	}
	schema := op.Input
	if scenario.Given.Side == "output" {
		schema = op.Output
	}
	if schema == nil {
		return failedScenario(rule, scenario.Description, fmt.Errorf("operation side has no schema"))
	}
	var validationErr error
	if scenario.Given.Side == "output" {
		validationErr = openbindings.ValidateOperationOutput(scenario.Given.Value, iface, opKey)
	} else {
		validationErr = openbindings.ValidateOperationInput(scenario.Given.Value, iface, opKey)
	}
	outcome := contractOutcome(validationErr, "resolver-error")
	if !contains(scenario.Expected.AllowedOutcomes, outcome) {
		return failedScenario(rule, scenario.Description, fmt.Errorf("outcome %q not in permitted set %v", outcome, scenario.Expected.AllowedOutcomes))
	}
	return passedScenario(rule, scenario.Description)
}

// contractOutcome names the outcome of validating a value against an
// operation's contract in the corpus's terms, read from the error's type
// alone: OBI-T-16 keeps an instance mismatch and an unavailable graph
// distinct, so what a scenario allows never decides which one an error is.
// unavailable is the scenario's name for an unavailable graph.
func contractOutcome(err error, unavailable string) string {
	var mismatch *openbindings.SchemaValidationError
	var graph *openbindings.SchemaGraphUnavailableError
	switch {
	case err == nil:
		return "valid"
	case errors.As(err, &mismatch):
		return "instance-mismatch"
	case errors.As(err, &graph):
		return unavailable
	}
	return fmt.Sprintf("an unexpected error: %v", err)
}

func passedScenario(rule, test string) Result {
	return Result{Rule: rule, Test: test, Passed: true, Expected: true, Actual: true}
}

func failedScenario(rule, test string, err error) Result {
	return Result{Rule: rule, Test: test, Passed: false, Expected: true, Actual: false, Reason: err.Error()}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func contains(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}
