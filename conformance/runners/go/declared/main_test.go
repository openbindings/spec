package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

const (
	rev = "98127021a7e2fa08a8c7b2e6bead1c847c9b6e1f"
	sum = "e70cbc8b3b6d4096fd83f694dc093d3ce6d6c87319aeb97b8ae9ec12ebe63a4f"
)

func sdk(t *testing.T, version, adapter string) string {
	t.Helper()
	dir := t.TempDir()
	for name, body := range map[string]string{"version.go": version, "conformance_test.go": adapter} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("package openbindings\n\n"+body+"\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

const adapter = "const appliedTextRevision = \"" + rev + "\"\n\nconst appliedTextSHA256 = \"" + sum + "\"\n"

// Each declaration either prints exactly the flags it declares or is
// refused; a respelled but equal declaration prints the same flags.
func TestDeclared(t *testing.T) {
	want := []string{"-applied", "0.2.0@" + rev, "-applied-sha256", sum}
	for _, c := range []struct {
		name, version, adapter string
		want                   []string
		refused                string
	}{
		{"the SDK's own spelling", "const appliedRelease = \"0.2.0\"\n\nconst appliedRevision = \"" + rev + "\"", adapter, want, ""},
		{"a typed constant", "const appliedRelease string = \"0.2.0\"\n\nconst appliedRevision = \"" + rev + "\"", adapter, want, ""},
		{"a constant group", "const (\n\tappliedRelease, appliedRevision = \"0.2.0\", \"" + rev + "\"\n)", adapter, want, ""},
		{"a release named alone", "const appliedRelease = \"0.2.0\"\n\nconst appliedRevision = \"\"", adapter, []string{"-applied", "0.2.0"}, ""},
		{"an empty release", "const appliedRelease = \"\"\n\nconst appliedRevision = \"" + rev + "\"", adapter, nil, "not a SemVer"},
		{"a symbolic revision", "const appliedRelease = \"0.2.0\"\n\nconst appliedRevision = \"HEAD\"", adapter, nil, "not a full 40-hex commit"},
		{"an abbreviated revision", "const appliedRelease = \"0.2.0\"\n\nconst appliedRevision = \"9812702\"", adapter, nil, "not a full 40-hex commit"},
		{"a non-literal release", "const appliedRelease = AuthoringVersion\n\nconst AuthoringVersion = \"0.2.0\"\n\nconst appliedRevision = \"" + rev + "\"", adapter, nil, "not declared with a string literal"},
		{"a missing revision", "const appliedRelease = \"0.2.0\"", adapter, nil, "declares no appliedRevision"},
		{"a hash pinned for another revision", "const appliedRelease = \"0.2.0\"\n\nconst appliedRevision = \"" + strings.Repeat("a", 40) + "\"", adapter, nil, "pinned for"},
		{"a malformed hash", "const appliedRelease = \"0.2.0\"\n\nconst appliedRevision = \"" + rev + "\"", "const appliedTextRevision = \"" + rev + "\"\n\nconst appliedTextSHA256 = \"e70c\"", nil, "not a 64-hex"},
	} {
		got, err := declared(sdk(t, c.version, c.adapter), "")
		switch {
		case c.refused != "" && (err == nil || !strings.Contains(err.Error(), c.refused)):
			t.Errorf("%s: got %v, %v; want refused (%s)", c.name, got, err, c.refused)
		case c.refused == "" && (err != nil || !slices.Equal(got, c.want)):
			t.Errorf("%s: got %v, %v; want %v", c.name, got, err, c.want)
		}
	}
}

// With -spec, the revision must be a commit of that repository.
func TestDeclaredRevisionIsACommit(t *testing.T) {
	repo := t.TempDir()
	run := func(args ...string) string {
		out, err := exec.Command("git", append([]string{"-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.test"}, args...)...).Output()
		if err != nil {
			t.Fatal(args, err)
		}
		return strings.TrimSpace(string(out))
	}
	run("init", "-q")
	if err := os.WriteFile(filepath.Join(repo, "openbindings.md"), []byte("text"), 0o644); err != nil {
		t.Fatal(err)
	}
	run("add", ".")
	run("commit", "-q", "-m", "text")
	commit := run("rev-parse", "HEAD")
	blob := run("rev-parse", "HEAD:openbindings.md")
	pin := func(r string) string {
		return "const appliedTextRevision = \"" + r + "\"\n\nconst appliedTextSHA256 = \"" + sum + "\"\n"
	}
	version := func(r string) string {
		return "const appliedRelease = \"0.2.0\"\n\nconst appliedRevision = \"" + r + "\""
	}
	if _, err := declared(sdk(t, version(commit), pin(commit)), repo); err != nil {
		t.Errorf("a commit of the repository: %v", err)
	}
	for name, r := range map[string]string{"a blob": blob, "an unknown object": strings.Repeat("b", 40)} {
		if _, err := declared(sdk(t, version(r), pin(r)), repo); err == nil || !strings.Contains(err.Error(), "not a commit") {
			t.Errorf("%s as the revision: %v", name, err)
		}
	}
}
