# Life Jacket - Build Log

Build started Fri Nov 13, 2026, on Jimmy's word ("Start building," 08:12 EST).
This log covers Round 1 (app shell, seeded inbox, document pipeline, shelves)
and Round 2 (records-to-calendar, .ics export, reminders), per
~/workspace/buildhybridai/BUILD-STATE.md.

## Design ruling applied during this build (Jimmy, Nov 13, 2026)

The document kinds and shelves named in the concept brief (letters, bills,
receipts, vet summaries, service invoices, notices; shelves Letters &
Deadlines, Money, Pets, Vehicles, Home) were Jimmy's first-thought EXAMPLES IN
GENERAL, not an exhaustive researched taxonomy. Consequences in the code:

1. The classifier is OPEN, not a closed five-type switch. A document that
   matches no known kind is still read (general rule extraction: every amount,
   every date, and any line pairing a date with a due-style word), still
   redacted, still explained (general explainer), still filed, under the
   general holding shelf "Everything Else", and its dates still reach the
   calendar. See classifyDocument and the general path in engine.js, and the
   general explainer in cloud.js.
2. Shelf definitions live in ONE data-driven list at the top of data.js
   (LJ_DATA.SHELVES). The app renders whatever the list holds; a new shelf is
   a one-line addition. The seeded five are just the starting entries, with
   "Everything Else" as the sixth, general entry.
3. The five sample documents and the five seeded shelves stay as the demo
   set, unchanged.

## Files created (all in this folder)

- index.html - the page shell: header ("Life Jacket" plus the line
  "Everything important in your life already arrives in your email. Life
  Jacket keeps it."), nav (Inbox, Shelves, Calendar with live counts), the
  view container, and a footer with a Reset demo data button.
- styles.css - calm, large-print design (19px base, Georgia serif, high
  contrast, life jacket orange as the action color). Covered identifiers
  render as black bars labeled with their kind; items the user uncovers show
  highlighted. Shelf items animate in when a document lands.
- firebase-config.js - empty Firebase config holder (null). Ships empty on
  purpose; see "What is simulated" below.
- data.js - date helpers; the shelf list; the five seeded FAKE documents.
  Dates are computed relative to first open (deadlines land 9 to 25 days
  out) and then frozen in localStorage so they stay stable.
- engine.js - the on-device engine: the first read (Gemini Nano attempt via
  window.LanguageModel / window.ai.languageModel with a 10 second timeout,
  honest engine label either way), the redaction engine (SSN, Medicare
  Beneficiary Identifier, 13 to 19 digit card/account numbers, phone,
  email, labeled date of birth, street address with city/state/ZIP, and the
  person's full name in all its written forms; priority ordered,
  overlap-safe), the payload builder, the open classifier, and the
  rule-based extractor with per-kind rules plus the general path.
- cloud.js - cloudExplain(redactedText, doc, extracted). With a filled
  firebase-config.js it dynamically imports firebase/app and firebase/ai
  from the Firebase CDN and asks Gemini (gemini-2.5-flash via Firebase AI
  Logic) for the five explanation sections. Without a config it returns
  the labeled local simulation, assembled from the extracted facts.
- app.js - state and persistence (localStorage key lifejacket.v1), the
  three views, the four-step document pipeline with the human review gate
  and the payload gate, filing, the calendar (entries, days remaining,
  reminders = anything due within 60 days, soonest first, with items due
  within 30 days highlighted), and the .ics export.

## The seeded inbox (all fictional)

- Medicare Summary Notice for Margaret Ellison: coverage change (home
  health aide visits 20 to 12 per year), premium $184.60, response
  deadline. Identifiers: Medicare number, date of birth, address, phone,
  email, reference number, full name (10 found).
- IRS Notice CP2000 for Daniel Okafor: proposed amount due $1,284.00 over
  $1,912 of unreported interest, respond-by date. Identifiers: SSN,
  address, phone, email, 16-digit confirmation number, full name (9 found).
- Riverside Animal Clinic invoice for Susan Park's dog Biscuit: wellness
  exam and nail trim, paid $72.50 by card; rabies vaccination (3-year) date
  given on file, from which the next due date is computed (7 found).
- Precision Auto Care receipt for Tom Delgado: oil change on a 2018 Toyota
  RAV4 at 62,418 miles, $94.18, recommended interval every 6 months or
  5,000 miles, from which the next service date is computed (6 found).
- Chattanooga Electric Cooperative bill for Grace Nguyen: $142.37, due
  date, 1,084 kWh (7 found, including the phone numbers in the body).

## What works (verified by automated checks, Nov 13)

- All five files pass node --check; a headless harness ran the real
  engine against all five documents: 60+ assertions passed.
- Every document yields its identifiers (6 to 10 each), a clean text with
  no name, email, or SSN left in it, and exactly one key date.
- Date math verified exact: rabies next due = date given + 3 years (lands
  25 days out at seed time); oil next service = service date + 6 months
  (lands 10 days out).
- The open classifier sends a made-up sixth document (county tax letter,
  unknown kind) to Everything Else, still extracts its respond-by date to
  the calendar, and still gets a general explanation.
- The read falls back to "Read on this device (local rules)" when no
  on-device model answers, and labels itself that way.
- A DOM smoke test confirms app.js loads, renders the inbox with all five
  documents and shelf chips, and persists state.
- No em dashes anywhere in the app files (checked programmatically).

## What is simulated (and labeled as such on screen)

- The cloud explanation. Firebase is not configured yet, so cloud.js
  returns explanations written locally from the extracted facts, under the
  on-screen label "Simulated explanation (demo mode: Firebase is not
  connected yet...)". The real Firebase AI Logic path is written and
  activates the moment firebase-config.js is filled in (Round 3, needs
  Jimmy to create the Firebase project).
- Gemini Nano: the code genuinely attempts Chrome's on-device model API
  first and labels the read "Read by Gemini Nano on this device" only when
  it answers. In most browsers today it will fall back to local rules,
  which the label states plainly.
- The inbox is seeded sample data, not a live mailbox. Live inbox
  connection is phase 2, per the brief.

## How to run it

Open index.html in Chrome (double-click the file, or serve the folder with
any static server). No build step, no install. Walk one document through:
open it, Read it on this device, review the covered items, approve the
payload, read the explanation, then Put it on the shelf. Its date appears
under Calendar, and Export calendar (.ics) downloads a file that imports
into Samsung/Google, Apple, and Microsoft calendars. The footer Reset demo
data button restores the untouched inbox.

## Decisions made during the build

- Seed dates are relative to first open, so the demo never shows stale
  deadlines; after seeding they persist unchanged in localStorage.
- The payload gate locks the cover toggles once the text is approved, so
  the approved text and the explained text can never drift apart.
- Only filed documents put dates on the calendar: a date counts when the
  keeper has actually kept the document.
- Explanations end with a scam check on every document, fullest on the IRS
  notice (never gift cards, mail-first contact, the right to disagree),
  per the wedge in the concept brief.

## Independent verification by Kaitlyn Omega (Nov 13, 2026, after builder handoff)
- All JS files pass node --check; zero em dashes in app files (programmatic scan).
- Independent harness (separate from the builder's) ran the real engine over all five seed documents: 6-10 identifiers found per document; with all items covered, the cleaned payload text contains NONE of the raw identifier values (checked value by value); exactly one key date per document; rabies next-due and oil next-service computed dates exact.
- DEFECT FOUND AND FIXED by Omega: an unknown-kind document whose only date sat in a "Pick up your ribbon by December 20, 2026" line got NO calendar date from the general path (the cue-word list missed it), violating the Nov 13 open-classifier ruling that unknown documents still get their dates captured. Fix in engine.js genericKeyDates: cue list extended (pick up, return by, valid until, must) plus a fallback: if no cue-paired date exists, the earliest upcoming full date in the document becomes a "Date mentioned" calendar entry. Re-verified: the same document now lands on Everything Else WITH its Dec 20, 2026 date. All checks pass.

## Round 3 - the text message intake channel (Nov 13, 2026)

Jimmy (2026-11-13 11:43 and 11:51 EST): the program must also check
texts for receipts, because not all receipts go to email; some go to
text. Approved and built the same day. Full detail:
TEXT-CHANNEL-REPORT.md in this folder.

- New intake: an "Add from a text" card on the inbox. The user pastes
  a whole text message (helper text covers copying on a phone and
  bringing a screenshot's words in by typing or pasting). Submitting
  adds an inbox item labeled with source "Text message" (a channel
  chip in the list and the document view), and it flows through the
  existing pipeline unchanged: on-device read, cover gate, payload
  gate, explanation with scam check, shelve, calendar.
- Engine: URLs are now identifiers. A new first-priority detector,
  "Link with a private token", puts any http/https URL in the
  review/cover list, so a token-bearing receipt link is covered
  before the payload gate and never appears in the cleaned payload
  while covered. A new known kind, "receipt", extracts store, order
  number, total, and the link, and states honestly that the itemized
  detail lives behind the link and Life Jacket never opens links on
  its own. Dates: a date written in the text wins; a text with no
  date uses the date the item arrived, labeled as exactly that.
  The open classifier maps receipt cues to the Money shelf after the
  more specific kinds (a service receipt still lands on Vehicles);
  no vendor name is special-cased.
- Sixth seed (fictional): a texted receipt from the invented Harbor
  Lane Market, short code Text 88213, Order #7392, $63.47, with a
  fake link on receipts.example.com. It flows end to end: read,
  redacted (link token and phone covered), shelved to Money, one
  calendar date (its received date).
- Persistence: no key change and no seed version bump. On load, a
  saved inbox that lacks the new seed gains it appended once;
  everything already saved is untouched. User-added text items
  persist like any other document.
- Header tagline updated: "...arrives in your email and your texts."
- Verified: node --check clean on all JS; zero em dashes; a 39-check
  harness over the new seed (identifiers include the link token,
  cleaned payload free of every raw identifier value, Money shelf,
  exactly one key date) plus full regression over the five original
  seeds and a made-up pasted text from a different store; a DOM smoke
  test confirmed the saved-state migration and the rendered inbox.
- Future work: a Web Share Target (manifest share_target) was NOT
  added. It needs a served origin and a service worker to receive
  the share and cannot work when index.html is opened from disk;
  adding the manifest alone would advertise a door the app cannot
  answer. Revisit in the hosted round. The paste box covers the
  need in every browser today.

## Tonight prep (Nov 16, 2026, by Kaitlyn, before the Firebase session)

Goal: shrink tonight to the owner's Firebase sign-in clicks plus the
finishing steps that depend on them. Full detail:
VERIFICATION-REPORT-2026-11-16.md in this folder.

- Firebase AI Logic wiring audit of cloud.js found and fixed two
  defects in the live path: (1) the SDK pin 11.3.1 predates the AI
  Logic rename and its firebase-ai.js CDN URL returns 404; the pin
  is now 12.11.0, whose firebase-ai.js module was fetched and
  confirmed live on the CDN today. (2) The backend used an AIBackend
  enum the SDK does not export; it now constructs GoogleAIBackend as
  documented, with a getAI default-backend fallback. Same pass: the
  live path now requires apiKey, projectId, and appId before
  attempting (the SDK throws without appId), and the default
  Firebase app is reused across explanations instead of being
  initialized twice. Honest labels verified unchanged: null config
  means the Simulated label; a failed live attempt falls back to the
  Simulated label and never claims the live one.
- Verification: node --check passes on all five JS files. No
  runnable harness file ships in this folder, so an equivalent
  harness ran against the real app files: 94 checks passed, 0
  failed. Identifiers per seeded document: 10, 9, 7, 6, 7, and 2
  for the text receipt (41 total); every cleaned payload contains
  none of the raw identifier values; exactly one key date per
  document; rabies next due equals given plus 3 years and oil next
  service equals service plus 6 months, both exact; text channel
  and open classifier checks pass; cloud label checks pass.
- Public repo copy staged at ~/workspace/buildhybridai/repo-public/
  (app files, README, this build log, and the verification reports
  only), scrubbed by grep for the private program names and the old
  shop name: zero hits, and zero em dashes.
- firebase-config.js still ships null. No config values were
  invented. Tonight still needs: the owner's Firebase project
  creation and sign-in clicks, then the config paste, live-path
  verification, GitHub repo creation from the staged copy, the
  Devpost paste, and the demo recording.

## Round 3 - live wiring (Nov 16, 2026, evening session with the founder)

- Firebase project created by the founder: "Life Jacket",
  project ID life-jacket-f6c3e, on the free Spark plan, Google
  Analytics off. Web app "Life Jacket Web" registered; its config
  was pasted into firebase-config.js in both the working copy and
  the public repo copy.
- AI Logic enabled on the Gemini Developer API (the free path).
  The billing-required Agent Platform path was not taken.
- App Check: the setup wizard enforced App Check for AI Logic
  while the web app was unregistered, which blocked the app's own
  calls. On the founder's decision, AI Logic enforcement was set
  to monitoring (unenforced) and the project's API key was locked
  to the app's own web addresses (HTTP referrers: the GitHub Pages
  site, the Firebase app domain, and a local test address).
  Google states App Check will auto-enforce AI Logic requests
  starting January 21, 2027; registering App Check with reCAPTCHA
  is the recorded production step before that date.
- Public repo created: github.com/jmai777x-lab/life-jacket, with
  GitHub Pages serving the app at
  https://jmai777x-lab.github.io/life-jacket/
- MODEL DEFECT FOUND AND FIXED the same night: the live call
  failed silently into the labeled fallback. Reproduced outside
  the browser with the real SDK (firebase 12.11.0, Node): the API
  answered 404, "This model models/gemini-2.5-flash is no longer
  available to new users." gemini-2.5-flash is closed to new
  projects, and this project was created that day. cloud.js now
  names gemini-3.8-flash; the same SDK reproduction with the new
  model answered successfully against the live project, and the
  fix was committed to the repo and redeployed by Pages.
- Polish in the same pass: received dates in the inbox and the
  document view now render in long form ("December 4, 2026")
  instead of raw ISO dates.
- Still open after this session: the Devpost paste and the demo
  video recording.

## Protocol pass addendum (Nov 16, 2026, late evening)

- The founder ordered the full product protocol pass (errors,
  excellence, common sense, no AI tells) over every Life Jacket
  file, read personally end to end. Findings fixed the same
  night: the README and this log updated to the live state (see
  above), the Devpost draft's model name corrected to Gemini 3.8
  Flash with its links filled and its status section rewritten
  to the verified truth, and the received-date polish above.
  Em dash scan over every shipped file: zero.
- BROWSER-SIDE FAILURE TRACED: repeated verification walks in an
  automated browser fell back to the labeled simulation, once
  hanging indefinitely on "Explaining...". A temporary
  diagnostic build surfaced the swallowed error on the card
  itself: the request reaches the correct endpoint with the
  correct model, and Google answers 500, "This model is
  currently experiencing high demand" (the free Gemini 3.8 Flash
  tier under a demand spike), with one run instead hanging past
  200 seconds. The same SDK call succeeded against the live
  project from Node earlier the same evening; capacity is
  intermittent, not a wiring fault.
- FIXES SHIPPED for that failure class: the cloud step now
  retries up to three times (waits of 4 and 10 seconds) inside a
  75-second envelope, so "Explaining..." can never hang forever;
  on final failure the card carries the plain labeled fallback
  and the real error goes to the browser console only. Asset
  URLs in index.html are version-queried (?v=4), after stale
  browser caches were caught masking three consecutive deploys
  during verification. Verified after the fix: a walk on fresh
  assets produced the card inside the envelope with the clean
  fallback wording.
- REMAINING: the live Gemini label observed in a browser
  session, which waits on the demand spike passing; the SDK
  path itself is verified live against the project.
