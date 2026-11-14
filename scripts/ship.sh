#!/usr/bin/env bash
# The ship (C-037, C-031): the only push, and the only one any document names. It fetches main, refuses uncommitted
# changes, refuses a HEAD whose tree is not the tree scripts/gate.sh passed on (.git/ghost/tree), refuses a push that is
# not a fast-forward of origin/main, refuses a fast record when code changed since origin/main (GR-010: the medium
# checks or the full gate ship code; a fast record ships documents), pushes HEAD to main (never forced, never another branch) and prints one line,
# `ship: <short> → origin/main`, or `ship: refused at <step> (<why>)`. A remote with no main yet takes the first ship.
# Usage: scripts/ship.sh
set -uo pipefail
cd "$(dirname "$0")/.."
refuse() { echo "ship: refused at $1"; exit 1; }

head=$(git rev-parse --verify -q 'HEAD^{commit}') || refuse "HEAD (no commit to ship)"
git ls-remote --exit-code --heads origin main >/dev/null 2>&1
case $? in
  0) git fetch -q origin +refs/heads/main:refs/remotes/origin/main || refuse "the fetch (git fetch origin main failed)"; first="";;
  2) first=1;;
  *) refuse "the fetch (origin did not answer)";;
esac
[ -z "$(git status --porcelain)" ] || refuse "the working tree (uncommitted changes: commit them through scripts/commit.sh, or put them away)"
record_file="$(git rev-parse --git-dir)/ghost/tree"
recorded=$( [ -f "$record_file" ] && tr -d '[:space:]' < "$record_file" )
[ -n "$recorded" ] || refuse "the record (gate first: no tree recorded; run scripts/gate.sh)"
tree=$(git rev-parse "$head^{tree}")
[ "$tree" = "$recorded" ] || refuse "the record (gate first: HEAD's tree ${tree:0:10} is not the tree the gate passed on, ${recorded:0:10})"
# The kind (GR-010): a fast record ships a change to documents alone; code (src/, test/, scripts/, stacks/, the package
# files) needs the medium checks or the full gate behind it. The first ship, with no origin/main to diff against, needs medium.
kind=$( [ -f "${record_file%tree}kind" ] && tr -d '[:space:]' < "${record_file%tree}kind" )
if [ "$kind" = fast ]; then
  if [ -n "$first" ]; then code=yes
  else code=$(git diff --name-only refs/remotes/origin/main "$head" | grep -E '^(src/|test/|scripts/|stacks/|package\.json$|package-lock\.json$|tsconfig|vitest|stryker|knip)' | head -1); fi
  [ -z "$code" ] || refuse "the kind of gate (a fast record, but $code changed since origin/main: run scripts/gate.sh --medium, then ship (commit first only if the tree changed))"
fi
[ -n "$first" ] || git merge-base --is-ancestor refs/remotes/origin/main "$head" \
  || refuse "the fast-forward (fetch and rebuild: main moved; rebase onto origin/main, run scripts/gate.sh and commit again)"
git push -q origin "$head:refs/heads/main" || refuse "the push (git refused it; nothing forced)"
echo "ship: $(git rev-parse --short "$head") → origin/main"
