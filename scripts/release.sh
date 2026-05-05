#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  scripts/release.sh <version>

Example:
  scripts/release.sh 0.1.1

What it does:
  - Copies the working spec (openbindings.md) into versions/<version>/openbindings.md
  - Copies the working JSON Schema (openbindings.schema.json) into versions/<version>/openbindings.schema.json
  - Copies EDITORS.md into versions/<version>/editors.md
  - Copies the core conformance corpus into versions/<version>/conformance/
  - Appends the version to versions/README.md (if not already present)

What it does NOT snapshot:
  - interfaces/ — independently versioned, location-is-identity
  - formats/ — independently versioned via format token
  - conventions/ — independently versioned tooling conventions
  - conformance/comparison/ — convention-owned comparison fixtures
  - scripts/ — repo-wide tooling, not part of any specific release

What it does NOT do:
  - It does not commit, tag, or push anything.
  - It does not regenerate conformance/manifest.json or run verify-corpus.mjs.
    Run those manually before invoking this script.
EOF
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

version="$1"

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: version must look like X.Y.Z (got: $version)" >&2
  exit 2
fi

working_spec="$repo_root/openbindings.md"
working_editors="$repo_root/EDITORS.md"
working_schema="$repo_root/openbindings.schema.json"
working_conformance="$repo_root/conformance"

if [[ ! -f "$working_spec" ]]; then
  echo "error: missing working spec at $working_spec" >&2
  exit 2
fi
if [[ ! -f "$working_schema" ]]; then
  echo "error: missing working schema at $working_schema" >&2
  exit 2
fi
if [[ ! -f "$working_editors" ]]; then
  echo "error: missing working editors at $working_editors" >&2
  exit 2
fi
if [[ ! -d "$working_conformance" ]]; then
  echo "error: missing working conformance directory at $working_conformance" >&2
  exit 2
fi

dest_dir="$repo_root/versions/$version"
dest_spec="$dest_dir/openbindings.md"
dest_editors="$dest_dir/editors.md"
dest_schema="$dest_dir/openbindings.schema.json"
dest_conformance="$dest_dir/conformance"

if [[ -e "$dest_dir" ]]; then
  echo "error: destination already exists: $dest_dir" >&2
  exit 2
fi

mkdir -p "$dest_dir"
cp "$working_spec" "$dest_spec"
cp "$working_schema" "$dest_schema"
cp "$working_editors" "$dest_editors"
mkdir -p "$dest_conformance"
cp "$working_conformance/README.md" "$dest_conformance/README.md"
cp "$working_conformance/manifest.json" "$dest_conformance/manifest.json"
cp "$working_conformance/fixture.schema.json" "$dest_conformance/fixture.schema.json"
cp -R "$working_conformance/document" "$dest_conformance/document"
cp -R "$working_conformance/tool" "$dest_conformance/tool"
cp -R "$working_conformance/runners" "$dest_conformance/runners"

versions_readme="$repo_root/versions/README.md"
if [[ -f "$versions_readme" ]]; then
  if ! grep -q "\`$version/\`" "$versions_readme"; then
    {
      echo ""
      echo "- \`$version/\`"
      echo "  - Spec: \`$version/openbindings.md\`"
      echo "  - Schema: \`$version/openbindings.schema.json\`"
      echo "  - Editors: \`$version/editors.md\`"
      echo "  - Conformance: \`$version/conformance/\`"
    } >>"$versions_readme"
  fi
fi

cat <<EOF
Created snapshot:
  - $dest_spec
  - $dest_schema
  - $dest_editors
  - $dest_conformance/

Next steps:
  - Review the diff
  - Commit and tag: v$version
EOF
