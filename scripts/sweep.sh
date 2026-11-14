#!/usr/bin/env bash
# The sweep (GR-010): the slow overnight run, after Suite Builder's nightly sweep (G-364, G-371). Not a gate: nothing
# lands or ships on it, and what it finds is a fix-forward item, never a reason to undo a landing (C-040). It runs the
# cold full gate (GHOST_COLD=1 scripts/gate.sh: the medium checks, the integration tests and the crawl specs among them,
# the metrics checked and never written; no mutation, GR-013) with its output under
# build/sweep/<date>.log, then prints one line, `sweep: <verdict>; log <file>`, and exits as the gate did. A red step is
# fixed in the sweep's own session by the step that failed and landed through the ordinary gate; the sweep's own log is
# never committed. Run it by hand in a session, or by a scheduled task that opens a fresh session on this repository;
# never a GitHub scheduled trigger (C-032: CI minutes are spent by hand).
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/sweep
log="build/sweep/$(date -u +%Y-%m-%dT%H%M%SZ).log"
GHOST_COLD=1 scripts/gate.sh > "$log" 2>&1
status=$?
verdict=$(tail -n 1 "$log")
echo "sweep: ${verdict#gate (cold): }; log $log"
exit "$status"
