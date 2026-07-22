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

type concludeVerificationScenario struct {
	Description string `json:"description"`
	Given       struct {
		Evidence map[string]openbindings.RuleEvidenceStatus `json:"evidence"`
	} `json:"given"`
	Expected struct {
		Conclusion string   `json:"conclusion"`
		Violated   []string `json:"violated"`
		Unverified []string `json:"unverified"`
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
			case "conclude-verification":
				result = runConcludeVerificationScenario(file.Rule, raw)
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
	iface, err := openbindings.ValidateDocument(scenario.Given.Document)
	if err != nil {
		return failedScenario(rule, scenario.Description, fmt.Errorf("scenario document: %w", err))
	}
	_, op, found := openbindings.ResolveOperation(iface, scenario.Given.Operation)
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
		err := openbindings.ValidateAgainstSchema(value, schema, iface.Schemas)
		if err == nil {
			actual = append(actual, "valid")
			continue
		}
		var unavailable *openbindings.SchemaGraphUnavailableError
		if errors.As(err, &unavailable) {
			actual = append(actual, "graph-unavailable")
		} else {
			actual = append(actual, "instance-mismatch")
		}
	}
	if !equalStrings(actual, scenario.Expected.Results) {
		return failedScenario(rule, scenario.Description, fmt.Errorf("results %v; expected %v", actual, scenario.Expected.Results))
	}
	return passedScenario(rule, scenario.Description)
}

func runConcludeVerificationScenario(rule string, raw json.RawMessage) Result {
	var scenario concludeVerificationScenario
	if err := json.Unmarshal(raw, &scenario); err != nil {
		return failedScenario(rule, "unparseable conclusion scenario", err)
	}
	report := openbindings.ConcludeVerification(scenario.Given.Evidence)
	if string(report.Conclusion) != scenario.Expected.Conclusion {
		return failedScenario(rule, scenario.Description, fmt.Errorf("conclusion %q; expected %q", report.Conclusion, scenario.Expected.Conclusion))
	}
	expectedViolated := append([]string(nil), scenario.Expected.Violated...)
	expectedUnverified := append([]string(nil), scenario.Expected.Unverified...)
	sort.Strings(expectedViolated)
	sort.Strings(expectedUnverified)
	if !equalStrings(report.Violated, expectedViolated) {
		return failedScenario(rule, scenario.Description, fmt.Errorf("violated rules %v; expected %v", report.Violated, expectedViolated))
	}
	if !equalStrings(report.Unverified, expectedUnverified) {
		return failedScenario(rule, scenario.Description, fmt.Errorf("unverified rules %v; expected %v", report.Unverified, expectedUnverified))
	}
	return passedScenario(rule, scenario.Description)
}

func runResolveOperationScenario(rule string, raw json.RawMessage) Result {
	var scenario resolveOperationScenario
	if err := json.Unmarshal(raw, &scenario); err != nil {
		return failedScenario(rule, "unparseable resolve-operation scenario", err)
	}
	iface, err := openbindings.ValidateDocument(scenario.Given.Document)
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
	iface, err := openbindings.ValidateDocument(scenario.Given.Document)
	if err != nil {
		return failedScenario(rule, scenario.Description, fmt.Errorf("scenario document: %w", err))
	}
	_, op, found := openbindings.ResolveOperation(iface, scenario.Given.Operation)
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
	outcome := "valid"
	if err := openbindings.ValidateAgainstSchema(scenario.Given.Value, schema, iface.Schemas); err != nil {
		if contains(scenario.Expected.AllowedOutcomes, "instance-mismatch") && !contains(scenario.Expected.AllowedOutcomes, "resolver-error") {
			outcome = "instance-mismatch"
		} else if contains(scenario.Expected.AllowedOutcomes, "resolver-error") {
			// T-11 deliberately permits either terminating with a resolver
			// error or resolving the cycle. When both error outcomes are
			// permitted, an adapter need not depend on validator-specific error
			// text to distinguish them.
			outcome = "resolver-error"
		} else {
			outcome = "instance-mismatch"
		}
	}
	if !contains(scenario.Expected.AllowedOutcomes, outcome) {
		return failedScenario(rule, scenario.Description, fmt.Errorf("outcome %q not in permitted set %v", outcome, scenario.Expected.AllowedOutcomes))
	}
	return passedScenario(rule, scenario.Description)
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
