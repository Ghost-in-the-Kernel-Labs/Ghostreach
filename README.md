# Ghostreach

Ghostreach is the tool for the people who reach out to find Suite Builder's clients: Suite Builder's crawl and site audit cut out as one flag-free program. Give it a site, it crawls, writes the review and hands back a Suite Builder-branded PDF carrying Ghost's GitHub; the prospect sees Suite Builder's name, never Ghostreach's.

## Status

No feature exists yet. The project is stamped from Ghost-Core 9a29945; it begins at TODO 0.1, and
`docs/HANDOFF.md` says what the human fills in first.

## Running the fast loop

    bash scripts/fast.sh

Every document check and unit test, with nothing installed; `scripts/save.sh` saves a session's work on its own
branch, `scripts/gate.sh --fast` is the check before a landing (`scripts/commit.sh`), `scripts/ship.sh` the only push
to `main`, and the full `scripts/gate.sh` runs at each tune-up (C-040).
