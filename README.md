# Life Jacket

Everything important in your life already arrives in your email and
your texts. Life Jacket keeps it.

Life Jacket is a keeper for the documents of an ordinary life:
official letters, bills, vet records, service receipts, and the
receipts that only ever arrive as a text message. It reads each
document, pulls out what matters (the amounts, and the one date that
counts), explains it in plain language with a scam check, files it
on a shelf, and puts its date on a calendar you can export to the
calendar you already use.

All sample documents in this demo are fictional. No real person's
information appears anywhere in this repository.

## How to run it

No build step, no install, no server.

1. Download or clone this repository.
2. Open `index.html` in Chrome (double-click the file, or serve the
   folder with any static file server).
3. Walk one document through: open it, read it on this device,
   review the covered items, approve the payload, read the
   explanation, then put it on its shelf. Its date appears under
   Calendar, and "Export calendar (.ics)" downloads a file that
   imports into Google Calendar, Apple Calendar, Microsoft Outlook,
   and Samsung Calendar.
4. The footer "Reset demo data" button restores the untouched
   sample inbox.

The live cloud explanation is connected: `firebase-config.js`
carries the Life Jacket Firebase project's web app config (project
identifiers, not secrets), AI Logic is enabled on the free Gemini
Developer API plan, and the explanation step runs live against
Gemini 3.8 Flash. If the config is removed, or the cloud cannot be
reached, the app runs its cloud step as a clearly labeled local
simulation instead, and the on-screen label says so. To run your
own copy against your own project instead, create a Firebase
project, enable AI Logic in it, register a web app, and paste its
config values into `firebase-config.js`.

## The hybrid design

Life Jacket is built hybrid on purpose, in three layers:

1. On device first. The first read of every document happens in the
   browser. If Chrome's built-in on-device model (Gemini Nano, via
   the Prompt API) answers, it does the read and the screen labels
   it with its name. Either way, a plain local rule engine extracts
   the facts, so the app works the same with no network and no
   special browser.
2. Local rules for keeping. Classification, field extraction, and
   due-date math (a rabies vaccination due again in 3 years, an oil
   change due again in 6 months) are deterministic local rules.
   The classifier is open: a document kind with no specific rule is
   still read, extracted, filed on the Everything Else shelf, and
   its dates still reach the calendar.
3. Cloud last, and only with permission. The deep explanation is
   written by Gemini through Firebase AI Logic, and it only ever
   receives the cleaned text the user approved in the payload gate
   (see the privacy design below). If the cloud cannot be
   reached, that step falls back to a labeled local simulation
   built from the extracted facts, and the screen says so.

## The privacy design

- Identifiers never go to the cloud. Before any explanation step,
  the on-device redaction engine finds names, numbers, addresses,
  and links with private tokens, and covers them.
- The human is the gate. Covered items are listed one by one for
  review. The default is covered; the user may uncover an item,
  and the payload preview then shows it exactly as it would go.
- The payload gate shows the exact text that would leave the
  device, word for word. Nothing is sent until the user approves
  that exact text, and the explanation is written from that text
  only.
- Honest labels. The screen always says which engine read the
  document and whether the explanation came from the cloud or from
  the labeled local simulation. If the cloud cannot be reached,
  the app says so and falls back to the simulation label.
- Everything stays on the device. Documents and state live in the
  browser's local storage. There is no account, no server copy,
  and no live mailbox connection in this build.

## Files

- `index.html` - the page shell.
- `styles.css` - calm, large-print design.
- `data.js` - the seeded fictional inbox, the shelf list, and the
  date helpers.
- `engine.js` - the on-device engine: first read, redaction,
  classification, and extraction.
- `cloud.js` - the one network step: Firebase AI Logic when a
  project is configured, the labeled local simulation otherwise.
- `app.js` - the app shell, the three views (Inbox, Shelves,
  Calendar), the document pipeline, and the calendar export.
- `firebase-config.js` - the Firebase web app config for the
  Life Jacket project (public project identifiers, not secrets).
- `BUILD-LOG.md` - the build log, including design rulings and
  what is simulated and why.
- `TEXT-CHANNEL-REPORT.md` - the text message intake channel:
  design and verification.
- `VERIFICATION-REPORT-2026-11-16.md` - the wiring audit and the
  automated verification results from the Nov 16, 2026 prep.

## Credit

Founder and author: Jimmy Murel Murphy Jr.

Built for the BuildHybridAI 2026 contest.
