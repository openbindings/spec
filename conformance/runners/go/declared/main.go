// Command declared prints the applied text the Go SDK declares, as the
// runner's -applied and -applied-sha256 flags, one per line, read from the
// SDK's source by parsing it, never by matching text:
//
//   - appliedRelease and appliedRevision (version.go): the release whose text
//     the SDK applies, and the commit of that text while the release is a
//     working draft;
//   - appliedTextRevision and appliedTextSHA256 (its corpus adapter): the
//     revision whose openbindings.md it pins, and that text's sha256.
//
// Each must be a constant declared once with a string literal, however it is
// spelled (typed or not, alone or in a group). It refuses, with exit status
// 1, a missing or non-literal constant, a release that is not SemVer 2.0.0, a
// revision that is not a full 40-hex commit, a pinned revision other than
// appliedRevision, a hash that is not 64-hex, and, with -spec, a revision that
// is not a commit of that repository (git rev-parse --verify REV^{commit} must
// give REV back). A release declared alone (appliedRevision "") prints only
// -applied RELEASE: the runner reports its naming cases unverified.
//
// Usage:
//
//	go run ./declared -sdk ../../../../openbindings-go -spec ../..
package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

var (
	semver       = regexp.MustCompile(`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$`)
	fullRevision = regexp.MustCompile(`^[0-9a-f]{40}$`)
	fullSHA256   = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

func main() {
	sdk := flag.String("sdk", "", "the SDK checkout (the openbindings-go module root)")
	spec := flag.String("spec", "", "the specification checkout whose history must hold the revision")
	flag.Parse()
	if *sdk == "" {
		fmt.Fprintln(os.Stderr, "usage: declared -sdk DIR [-spec DIR]")
		os.Exit(2)
	}
	flags, err := declared(*sdk, *spec)
	if err != nil {
		fmt.Fprintln(os.Stderr, "declared:", err)
		os.Exit(1)
	}
	for _, f := range flags {
		fmt.Println(f)
	}
}

// declared returns the runner flags for the applied text the SDK in sdkDir
// declares, verified as the package comment says.
func declared(sdkDir, specDir string) ([]string, error) {
	consts, err := stringConstants(sdkDir, "appliedRelease", "appliedRevision", "appliedTextRevision", "appliedTextSHA256")
	if err != nil {
		return nil, err
	}
	release, revision := consts["appliedRelease"], consts["appliedRevision"]
	switch {
	case !semver.MatchString(release):
		return nil, fmt.Errorf("appliedRelease %q is not a SemVer 2.0.0 version", release)
	case revision == "":
		return []string{"-applied", release}, nil
	case !fullRevision.MatchString(revision):
		return nil, fmt.Errorf("appliedRevision %q is not a full 40-hex commit", revision)
	case consts["appliedTextRevision"] != revision:
		return nil, fmt.Errorf("appliedTextSHA256 is pinned for %q, but appliedRevision is %q", consts["appliedTextRevision"], revision)
	case !fullSHA256.MatchString(consts["appliedTextSHA256"]):
		return nil, fmt.Errorf("appliedTextSHA256 %q is not a 64-hex sha256", consts["appliedTextSHA256"])
	}
	if specDir != "" {
		out, err := exec.Command("git", "-C", specDir, "rev-parse", "--verify", "--quiet", revision+"^{commit}").Output()
		if got := string(bytes.TrimSpace(out)); err != nil || got != revision {
			return nil, fmt.Errorf("appliedRevision %s is not a commit of the specification history at %s", revision, specDir)
		}
	}
	return []string{"-applied", release + "@" + revision, "-applied-sha256", consts["appliedTextSHA256"]}, nil
}

// stringConstants returns the values of the named package-level constants
// the Go files in dir declare, each with a string literal.
func stringConstants(dir string, names ...string) (map[string]string, error) {
	files, err := filepath.Glob(filepath.Join(dir, "*.go"))
	if err != nil {
		return nil, err
	}
	wanted := map[string]bool{}
	for _, n := range names {
		wanted[n] = true
	}
	found := map[string]string{}
	fset := token.NewFileSet()
	for _, path := range files {
		file, err := parser.ParseFile(fset, path, nil, parser.SkipObjectResolution)
		if err != nil {
			return nil, err
		}
		for _, decl := range file.Decls {
			gen, ok := decl.(*ast.GenDecl)
			if !ok || gen.Tok != token.CONST {
				continue
			}
			for _, spec := range gen.Specs {
				vs := spec.(*ast.ValueSpec)
				for i, name := range vs.Names {
					if !wanted[name.Name] {
						continue
					}
					if _, twice := found[name.Name]; twice {
						return nil, fmt.Errorf("%s is declared twice", name.Name)
					}
					var lit *ast.BasicLit
					if i < len(vs.Values) {
						lit, _ = vs.Values[i].(*ast.BasicLit)
					}
					if lit == nil || lit.Kind != token.STRING {
						return nil, fmt.Errorf("%s (%s) is not declared with a string literal", name.Name, fset.Position(name.Pos()))
					}
					value, err := strconv.Unquote(lit.Value)
					if err != nil {
						return nil, err
					}
					found[name.Name] = value
				}
			}
		}
	}
	var missing []string
	for _, n := range names {
		if _, ok := found[n]; !ok {
			missing = append(missing, n)
		}
	}
	if len(missing) > 0 {
		return nil, errors.New("the SDK declares no " + strings.Join(missing, ", "))
	}
	return found, nil
}
