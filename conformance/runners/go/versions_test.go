package main

import "testing"

// Judge support from declarations alone: a post-1.0 major does not imply
// support for its other minor lines, and prereleases remain explicit.
func TestMajorMinorVersionGates(t *testing.T) {
	r := &run{lines: []string{"1.10"}, prereleases: []string{"1.11.0-rc.1"}}
	for version, want := range map[string]bool{
		"1.10.0": true, "1.10.999999999999999999999": true, "1.10.3+build": true,
		"1.9.99": false, "1.11.0": false, "2.0.0": false, "1.10.0-rc.1": false,
		"1.11.0-rc.1+build": true, "1.11.0-rc.2": false, "1.10": false,
	} {
		if got := r.supports(version); got != want {
			t.Errorf("supports(%q) = %v, want %v", version, got, want)
		}
		if _, skipped := r.gate(Gates{RequiresSupports: version}); skipped == want {
			t.Errorf("support gate for %q skipped %v, want %v", version, skipped, !want)
		}
		if _, skipped := r.gate(Gates{RequiresUnsupported: version}); skipped != want {
			t.Errorf("unsupported gate for %q skipped %v, want %v", version, skipped, want)
		}
	}
	if got := r.lowest(); got != "1.10.0" {
		t.Errorf("lowest() = %q, want 1.10.0", got)
	}
	for minimum, skip := range map[string]bool{"1.9.0": false, "1.10.0": false, "1.10.1": true, "1.11.0": true, "2.0.0": true} {
		if _, got := r.gate(Gates{RequiresMinSupported: minimum}); got != skip {
			t.Errorf("minimum %q skipped %v, want %v", minimum, got, skip)
		}
	}
	if (&run{lines: []string{"1"}}).supports("1.7.3") {
		t.Error("a major alone does not declare a release line")
	}
}
