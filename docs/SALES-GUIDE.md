# Ghostreach: the salesperson's guide

Ghostreach looks over a company's website the way a first-time visitor's browser does and writes what it finds as a PDF
you can send them. The PDF carries Suite Builder's name and Ghost's GitHub address; it never says "Ghostreach", so in
your emails call it a Suite Builder site review.

## 1. Install it (once)

You need the file Ghost sent you, `ghostreach-0.1.0.tgz` (the number may differ), saved in your Downloads folder.

Ghostreach runs on Windows and Linux. (It may run on a Mac, but nobody looks after that.)

1. Open a terminal. **Windows:** press the Windows key, type `cmd` and open Command Prompt. **Linux:** open your
   terminal app.
2. Install Node.js, the program Ghostreach runs on. **Windows:** type `winget install OpenJS.NodeJS.LTS` and press
   Enter. **Linux:** install Node.js 24 LTS from your distribution or from https://nodejs.org/en/download. Then close the
   terminal and open a new one.
3. Go to the folder with the file: `cd Downloads`
4. Install Ghostreach: `npm install -g ghostreach-0.1.0.tgz` (type the file's name as it is).
5. Install the browser the review drives: `npx playwright@1.63.0 install chromium` (answer `y` if it asks to install a
   package). **Linux:** use `npx playwright@1.63.0 install --with-deps chromium` instead; it asks for your password to
   add the libraries Chromium needs.
6. Check: `ghostreach doctor`. Its first two lines should say Node.js is "new enough" and Chromium is "installed". If a
   line says something is missing or too old, it says how to fix it: do that, then run `ghostreach doctor` again. Its last line says how many sites are reviewed at once, the number recommended for this computer.

If a step prints an error you do not understand, copy the whole message to Ghost.

## 2. Open the page

Each time you work, open a terminal and type `ghostreach`. Your browser opens a page, "Review a website", that only
your computer can see; if it does not, the terminal says the address to open, the same each time, so you can bookmark it.
Keep the terminal open while you work: closing it, or pressing Ctrl+C in it, stops the page ("Stopped.").
To start Ghostreach from an icon instead, type `ghostreach shortcut` once: it puts Ghostreach on your desktop and in the
Start menu (Windows) or the applications menu (Linux); the icon opens the same terminal window.
A review that was running when it stopped starts again from the beginning the next time. If the page is already
running, typing `ghostreach` again just shows it in your browser. `ghostreach --help` lists every command.

The page has three parts, top to bottom: the box to name sites (the queue), **Done** (the finished reviews), and
**Find companies to review**, folded: click it to open **Is this company hiring QA?** and **Who is hiring QA?** (the two
ways to find leads).

## 3. Find leads

**A company you already have in mind.** Under "Is this company hiring QA?", type its name or its website and press
Look up. Ghostreach asks the public job boards companies use for their careers pages (Greenhouse, Lever, Ashby,
SmartRecruiters, Recruitee, Personio). For each board it finds, you see how many roles are open and which are QA,
test or SDET roles. "No public board found" means none of those boards knows the company; that is not a no.
A board marked "maybe" was found by guessing its name from what you typed, and nothing on it names the company:
it may belong to another company with a similar name, so check its roles before you write.

**Companies hiring QA right now.** Under "Who is hiring QA?", the search lists job titles (QA engineer, test
automation, SDET, QA analyst) and a location. Change them if you like and press Search. You get one row per company, with its newest QA posting and where it was posted. Two boards, Jooble and
USAJOBS, need a key Ghost sets up: the "Lead sources" part at the bottom of the page says "needs a key from Ghost" for
each one not set up yet, and the search skips it.

**On every company row** you can:

- **Type its website.** No job board gives a company's website, so look it up yourself, type it in the Website box
  (for example `acme.com`) and press Keep the site. A **Queue this site** button then appears on that row.
- **Keep a posting you saw on LinkedIn, Indeed, Glassdoor or ZipRecruiter.** Paste the posting's address into the box
  under the row and press Keep the posting. Ghostreach keeps it as a note on that company, as a link you can open;
  it never opens or reads those sites itself, so it does not find the website for you.

## 4. Queue sites

Press **Queue this site** on a company row, or type websites into the box under "Review a website", one per line
(`www.example.com` is enough), and press Review these sites. Each site shows its state: waiting, running (with how
far it has got, such as "reading page 8 of up to 300"), done or failed. The page
refreshes itself while anything is waiting or running. A review usually takes a few minutes; the page says how many
run at once.

When a site is done, its row says **Open PDF** with how many findings it has, and **Download PDF** saves it; its row on
the lead finder says "reviewed" with the date and a PDF link, and it appears under Done.

## 5. Read the review

Under Done, click **Open PDF** beside the site: the PDF opens in your browser (**Download PDF** saves it instead). It has:

- a cover page with the site and the date;
- what was read: how many pages, logged out, as a first-time visitor sees them (nothing is sent, bought or signed in
  to);
- **Links that need a look**: links that answered an error or did not answer;
- the number of **major** findings (a visitor or a search engine is let down now) and **minor** ones (worth fixing);
- each finding with **Why it matters** and **Likely fix**, written for the site's owner;
- **What this review checked**: every check, and which ones could not run on this site. Those lines are not findings
  against the site.

A good opening for your email is the first major finding, in the PDF's own words.

**"Not timed."** When several sites are reviewed at once, the review cannot fairly time how fast pages load. The PDF
then says, near the top: "This review ran alongside others, so it did not time the pages: it has no finding on slow
pages." Every other check ran as usual. If page speed matters for this prospect, queue the site again when nothing
else is in the queue: a review that runs alone is timed.

## 6. Send the PDF

The PDF is the one file you send. It is kept in the **Ghostreach** folder in your home folder (on Windows,
`C:\Users\<your name>\Ghostreach`; on Linux, `~/Ghostreach`), in a folder named after the site and
the day, for example `Ghostreach/www.example.com-2026-11-14/www.example.com site review.pdf`.
Attach that file to your email. Do not send anything else from that folder.

## 7. When a site fails

A failed site shows a red line saying "No review was written" and why, and a **Retry** button.

- "is not a web address" or "could not be reached": check the spelling. Open the site in your own browser; if it
  does not open for you either, the address is wrong or the site is down.
- "the start page answered 403" (or another number), or "the crawl failed": the site turned the review away or did
  not answer in time. Many sites block automated visitors.

Press Retry later, or the next day. **What to say to the prospect: nothing about the failure.** A failed review is not
a finding: the cause can be the network or the site's own protection as easily as a fault. Do not tell a company its
site is broken because the review failed; move on to the next lead, or try again another day.
