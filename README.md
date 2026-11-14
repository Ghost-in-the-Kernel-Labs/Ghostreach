# Ghostreach

Ghostreach reviews a website and hands back its review as a PDF, ready to send to the site's owner.

## Install (for the salesperson)

You need Node.js 24 LTS (or 22.18 or later) and the file `ghostreach-<version>.tgz` you were sent.

Ghostreach runs on Windows and Linux; a Mac is not supported (it may work).

1. Node.js. Windows: in a terminal, `winget install OpenJS.NodeJS.LTS`. Linux: Node.js 24 LTS from your distribution
   or https://nodejs.org/en/download. Open a new terminal afterwards.
2. Ghostreach, one command, from the folder holding the file:

       npm install -g ghostreach-0.1.0.tgz

3. The browser the review drives:

       npx playwright@1.63.0 install chromium

   (On Linux, `npx playwright@1.63.0 install --with-deps chromium`, which adds the system libraries Chromium needs.)

   (Playwright's own version, the one Ghostreach carries; `ghostreach doctor` prints the exact command if the browser
   is still missing, and a first review downloads it too.)
4. Check: `ghostreach doctor` says whether Node.js and the browser are ready, each with the command that fixes it.

Then `ghostreach www.example.com` reviews a site and prints where its PDF is; `ghostreach serve` opens the reviews,
the queue and the lead finder in your browser. Reviews are kept in the `Ghostreach` folder of your home folder.

