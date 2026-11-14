# Ghostreach

Ghostreach is the tool for the people who reach out to find Suite Builder's clients: Suite Builder's crawl and site audit cut out as one flag-free program. Give it a site, it crawls, writes the review and hands back a Suite Builder-branded PDF carrying Ghost's GitHub; the prospect sees Suite Builder's name, never Ghostreach's.

## Install (for the salesperson)

You need Node.js 24 LTS (or 22.18 or later) and the file `ghostreach-<version>.tgz` you were sent.

1. Node.js. Windows: in a terminal, `winget install OpenJS.NodeJS.LTS`. Mac: the LTS installer from
   https://nodejs.org/en/download. Open a new terminal afterwards.
2. Ghostreach, one command, from the folder holding the file:

       npm install -g ghostreach-0.1.0.tgz

3. The browser the review drives:

       npx playwright@1.63.0 install chromium

   (Playwright's own version, the one Ghostreach carries; `ghostreach doctor` prints the exact command if the browser
   is still missing, and a first review downloads it too.)
4. Check: `ghostreach doctor` says whether Node.js and the browser are ready, each with the command that fixes it.

Then `ghostreach www.example.com` reviews a site and prints where its PDF is; `ghostreach serve` opens the reviews,
the queue and the lead finder in your browser. Reviews are kept in the `Ghostreach` folder of your home folder.

## Status

`ghostreach <site>` crawls a site and writes its review as a PDF (Phases 1 and 2). The project is
stamped from Ghost-Core 9a29945; `docs/HANDOFF.md` says where it stands and what waits on Ghost.

## Running the fast loop

    bash scripts/fast.sh

Every document check and unit test, with nothing installed; `scripts/save.sh` saves a session's work on its own
branch, `scripts/gate.sh --fast` is the check before a landing (`scripts/commit.sh`), `scripts/ship.sh` the only push
to `main`, and the full `scripts/gate.sh` runs at each tune-up (C-040).
