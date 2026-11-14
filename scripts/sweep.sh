#!/usr/bin/env bash
# The sweep (GR-010): the slow overnight run, after Suite Builder's nightly mutation sweep (G-364, G-371). Not a gate:
# nothing lands or ships on it, and what it finds is a fix-forward item, never a reason to undo a landing (C-040). It
# runs the cold full gate (GHOST_COLD=1 scripts/gate.sh: every cache off, so every mutant of every file is tried and the
# metrics are not written) with its output under build/sweep/<date>.log, then prints one line, `sweep: <verdict>; log
# <file>`, and exits as the gate did. A survivor the gate names is fixed in the sweep's own session (a test that kills it,
# or its line in docs/MUTATION.md) and landed through the ordinary gate; the sweep's own log is never committed.
# Run it by hand in a session, or by a scheduled task that opens a fresh session on this repository; never a GitHub
# scheduled trigger (C-032: CI minutes are spent by hand).
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/sweep
log="build/sweep/$(date -u +%Y-%m-%dT%H%M%SZ).log"
GHOST_COLD=1 scripts/gate.sh > "$log" 2>&1
status=$?
verdict=$(tail -n 1 "$log")
echo "sweep: ${verdict#gate (cold): }; log $log"
exit "$status"
