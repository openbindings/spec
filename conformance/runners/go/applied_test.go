package main

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	openbindings "github.com/openbindings/openbindings-go"
)

const (
	rev = "98127021a7e2fa08a8c7b2e6bead1c847c9b6e1f"
	sum = "e70cbc8b3b6d4096fd83f694dc093d3ce6d6c87319aeb97b8ae9ec12ebe63a4f"
)

// A malformed -applied is refused (the runner exits 2), never read as a
// declaration that weakens the naming check or verifies against the index.
func TestParseApplied(t *testing.T) {
	for _, c := range []struct {
		applied, sum, refused string
		want                  appliedText
	}{
		{"0.2.0@" + rev, sum, "", appliedText{"0.2.0", rev, sum}},
		{"0.2.0", "", "", appliedText{release: "0.2.0"}},
		{"", "", "", appliedText{}},
		{"@" + rev, sum, "release", appliedText{}},
		{"0.2.0@", sum, "revision", appliedText{}},
		{"0.2.0@HEAD", sum, "revision", appliedText{}},
		{"0.2.0@release/0.2", sum, "revision", appliedText{}},
		{"0.2.0@9812702", sum, "revision", appliedText{}},
		{"0.2@" + rev, sum, "release", appliedText{}},
		{"0.2.0@" + rev, "e70c", "sha256", appliedText{}},
	} {
		got, err := parseApplied(c.applied, c.sum)
		switch {
		case c.refused != "" && (err == nil || !strings.Contains(err.Error(), c.refused)):
			t.Errorf("-applied %q -applied-sha256 %q: %+v, %v; want refused (%s)", c.applied, c.sum, got, err, c.refused)
		case c.refused == "" && (err != nil || got != c.want):
			t.Errorf("-applied %q -applied-sha256 %q: %+v, %v; want %+v", c.applied, c.sum, got, err, c.want)
		}
	}
}

// The text is verified against a commit of the repository's history, by
// the declared hash; the index and the working tree play no part.
func TestVerifyApplied(t *testing.T) {
	repo := t.TempDir()
	run := func(args ...string) string {
		out, err := exec.Command("git", append([]string{"-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.test"}, args...)...).Output()
		if err != nil {
			t.Fatal(args, err)
		}
		return strings.TrimSpace(string(out))
	}
	write := func(text string) {
		if err := os.WriteFile(filepath.Join(repo, "openbindings.md"), []byte(text), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	run("init", "-q")
	write("the applied text")
	run("add", ".")
	run("commit", "-q", "-m", "applied")
	commit := run("rev-parse", "HEAD")
	digest := sha256.Sum256([]byte("the applied text"))
	pinned := hex.EncodeToString(digest[:])
	// A later text, committed, staged, and in the working tree.
	write("a later text")
	run("commit", "-q", "-am", "later")
	write("staged text")
	run("add", ".")
	write("working text")
	corpus := filepath.Join(repo, "conformance")
	if err := os.Mkdir(corpus, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct {
		name     string
		a        appliedText
		verified bool
		why      string
	}{
		{"the pinned commit", appliedText{"0.2.0", commit, pinned}, true, ""},
		{"another hash", appliedText{"0.2.0", commit, strings.Repeat("0", 64)}, false, "hashes to"},
		{"a revision outside the history", appliedText{"0.2.0", strings.Repeat("c", 40), pinned}, false, "not a commit"},
		{"a blob as the revision", appliedText{"0.2.0", run("rev-parse", commit+":openbindings.md"), pinned}, false, "not a commit"},
		{"a release named alone", appliedText{release: "0.2.0"}, false, "release snapshot"},
		{"no declaration", appliedText{}, false, "no applied text"},
		{"no hash", appliedText{"0.2.0", commit, ""}, false, "no applied-text hash"},
	} {
		verified, why := verifyApplied(corpus, c.a)
		if verified != c.verified || !strings.Contains(why, c.why) {
			t.Errorf("%s: %v, %q", c.name, verified, why)
		}
	}
}

// The name a conclusion gives is compared always, before verification: a
// wrong name fails even when the pinned bytes match.
func TestJudgeNaming(t *testing.T) {
	report := func(version, revision string) openbindings.ValidationReport {
		return openbindings.ValidationReport{Conclusion: openbindings.ConclusionConformant, Version: version, Revision: revision}
	}
	verified := &run{release: "0.2.0", revision: rev, verified: true, strict: true}
	for _, c := range []struct {
		name   string
		r      *run
		report openbindings.ValidationReport
		status string
		detail string
	}{
		{"the declared name, verified", verified, report("0.2.0", rev), Pass, ""},
		{"a wrong revision despite matching bytes", verified, report("0.2.0", ""), Fail, "names"},
		{"a wrong release despite matching bytes", verified, report("0.2.1", rev), Fail, "names"},
		{"the declared name, unverified, strict", &run{release: "0.2.0", revision: rev, unverified: "x", strict: true}, report("0.2.0", rev), Fail, "UNVERIFIED"},
		{"the declared name, unverified", &run{release: "0.2.0", revision: rev, unverified: "x"}, report("0.2.0", rev), Unverified, "x"},
		{"a wrong name, unverified", &run{release: "0.2.0", revision: rev, unverified: "x"}, report("0.2.0", ""), Fail, "names"},
		{"a release named alone", &run{release: "0.2.0", unverified: "release snapshot", strict: true}, report("0.2.0", ""), Fail, "release snapshot"},
		{"no declaration", &run{unverified: "no applied text", strict: true}, report("0.2.0", rev), Fail, "no applied text"},
	} {
		status, detail := c.r.judgeNaming(c.report)
		if status != c.status || !strings.Contains(detail, c.detail) {
			t.Errorf("%s: %s %q", c.name, status, detail)
		}
	}
}
