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

## Use

Type `ghostreach` and your browser opens the Ghostreach page: the reviews, the queue and the lead finder. If the browser
cannot be opened, the terminal says the address to open (it stays `http://127.0.0.1:4747/` unless another program holds that
port, so a bookmark keeps working). If the page is already running, `ghostreach` opens it again instead of starting a second
one. Keep that terminal window open while you work; Ctrl+C in it stops the page. `ghostreach shortcut` puts Ghostreach, with
its icon, on the desktop and in the Start menu (Windows) or the applications menu (Linux); it is made only when you ask.

    ghostreach                 Open the Ghostreach page in your browser (starts it if needed)
    ghostreach <site>          Review one website and write its PDF, for example: ghostreach www.example.com
    ghostreach doctor          Check this computer: Node.js, the browser, how many reviews at once
    ghostreach shortcut        Put Ghostreach, with its icon, on your desktop and in your menu
    ghostreach serve           Same as ghostreach
    ghostreach --help          This list (ghostreach help too)

Reviews are kept in the `Ghostreach` folder of your home folder.

## From a copy of this folder

In a copy of Ghostreach's own folder (not the installed package), the folder holds two small launchers that build
Ghostreach the first time (they say so; it takes a minute) and then run it. After a `git pull` that changed the program,
the next launch rebuilds it once, saying "Ghostreach was updated; rebuilding it once", and installs the packages again
first when the lockfile changed; `ghostreach --help` names the version and the commit the build came from:

- Windows, in Command Prompt: go to the folder and type `ghostreach` (in PowerShell, `.\ghostreach`).
- Linux: go to the folder and type `./ghostreach`. The shell does not look in the current folder, so the bare word
  `ghostreach` works there only once it is linked.

To make the bare word `ghostreach` work in any folder, run `npm link` once in this folder (or `npm install -g .`).

