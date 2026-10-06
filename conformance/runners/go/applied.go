package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"

	openbindings "github.com/openbindings/openbindings-go"
)

// appliedText is the applied-text identity the SDK declares (-applied) and
// the sha256 of the openbindings.md it declares it applies (-applied-sha256).
type appliedText struct {
	release, revision, sha256 string
}

var (
	fullRevision = regexp.MustCompile(`^[0-9a-f]{40}$`)
	fullSHA256   = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

// parseApplied reads -applied and -applied-sha256. -applied is either
// release@revision, a working draft and the full 40-hex commit of its text,
// or a release alone (OBI-T-09/c3a). An empty or malformed part is an error,
// never a declaration: a symbolic revision (HEAD, a branch) names moving text,
// and an empty one would read the index. An absent -applied declares nothing.
func parseApplied(applied, sum string) (appliedText, error) {
	if sum != "" && !fullSHA256.MatchString(sum) {
		return appliedText{}, fmt.Errorf("-applied-sha256 %q is not a 64-hex sha256", sum)
	}
	if applied == "" {
		return appliedText{sha256: sum}, nil
	}
	release, revision, named := strings.Cut(applied, "@")
	switch {
	case !semverRE.MatchString(release):
		return appliedText{}, fmt.Errorf("-applied %q: the release %q is not a SemVer 2.0.0 version", applied, release)
	case named && !fullRevision.MatchString(revision):
		return appliedText{}, fmt.Errorf("-applied %q: the revision %q is not a full 40-hex commit", applied, revision)
	}
	return appliedText{release: release, revision: revision, sha256: sum}, nil
}

// verifyApplied verifies the declared applied text: the revision must be a
// commit of the specification repository holding the corpus (git rev-parse
// --verify REV^{commit} gives REV back), and its openbindings.md, read from
// that history, must hash to the declared sha256. The text checked out beside
// the corpus plays no part, so an unrelated specification commit cannot
// change the result. A release named alone is not verified: no verification
// against a release snapshot exists.
func verifyApplied(corpusDir string, a appliedText) (bool, string) {
	switch {
	case a.release == "":
		return false, "no applied text was declared (-applied release@revision)"
	case a.revision == "":
		return false, fmt.Sprintf("a release named alone (%s, OBI-T-09/c3a) is not verified: no verification against a release snapshot exists", a.release)
	case a.sha256 == "":
		return false, "no applied-text hash was declared (-applied-sha256)"
	}
	commit, err := git(corpusDir, "rev-parse", "--verify", "--quiet", a.revision+"^{commit}")
	if got := string(bytes.TrimSpace(commit)); err != nil || got != a.revision {
		return false, fmt.Sprintf("%s is not a commit of the specification history holding the corpus", a.revision)
	}
	text, err := git(corpusDir, "show", a.revision+":openbindings.md")
	if err != nil {
		return false, fmt.Sprintf("the specification history holding the corpus does not give the text at %s: %v", a.revision, err)
	}
	sum := sha256.Sum256(text)
	if got := hex.EncodeToString(sum[:]); got != a.sha256 {
		return false, fmt.Sprintf("openbindings.md at %s hashes to %s, not the declared %s", a.revision, got, a.sha256)
	}
	return true, ""
}

// judgeNaming holds a conclusion to the declared applied text: the name it
// gives is compared first, always, then the text it names must be verified.
func (r *run) judgeNaming(report openbindings.ValidationReport) (string, string) {
	if r.release == "" {
		if r.strict {
			return failed("UNVERIFIED applied text: %s", r.unverified)
		}
		return Unverified, r.unverified
	}
	if report.Release != r.release || report.Revision != r.revision {
		return failed("names %q@%q; the declared applied text is %q@%q", report.Release, report.Revision, r.release, r.revision)
	}
	if !r.verified {
		if r.strict {
			return failed("UNVERIFIED applied text: %s", r.unverified)
		}
		return Unverified, r.unverified
	}
	return Pass, string(report.Conclusion)
}
