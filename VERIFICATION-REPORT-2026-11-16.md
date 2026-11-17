# Life Jacket - Verification Report - Nov 16, 2026 (tonight prep)

Prep run by Kaitlyn before the evening Firebase session, so the only
steps left for tonight are the project owner's sign-in steps and the
finishing steps that depend on them.

## Firebase AI Logic wiring audit (cloud.js)

Two defects were found in the live cloud path and fixed:

1. The pinned SDK version (11.3.1) predates the Firebase AI Logic
   rename, and its firebase-ai.js URL returns 404 on the CDN, so any
   live attempt would have failed at the import and silently fallen
   back to the simulation. The pin is now 12.11.0, and the
   firebase-ai.js module at that version was fetched and confirmed
   to exist on the CDN on Nov 16, 2026.
2. The backend was constructed through an AIBackend enum the SDK
   does not export. The code now constructs GoogleAIBackend the way
   the SDK documents, with a plain getAI fallback (the SDK default
   backend is the same Google AI backend) if a future SDK renames
   the class again.
3. Hardening in the same pass: the live path is only attempted when
   the config carries apiKey, projectId, and appId, because the SDK
   itself throws without appId; and the default Firebase app is
   reused across explanations instead of being initialized twice,
   which the SDK rejects.

Honest labeling, unchanged and re-verified: with no config, the
explanation carries the "Simulated explanation" label and is built
locally. With a complete config, the live label reads "Explanation
by Gemini in the cloud (Firebase AI Logic), working only from the
approved text above". If the live call cannot be reached, the code
falls back to the simulated label and says so in the text. The cloud
step only ever receives the cleaned payload the user approved in
the payload gate; identifiers never go.

## Automated verification (equivalent harness)

No runnable harness file ships in this folder (the build log and
the text channel report describe the builders' harnesses), so an
equivalent harness was written for this prep and run against the
real app files with Node.

- node --check: data.js, engine.js, cloud.js, app.js, and
  firebase-config.js all pass (5 of 5).
- Equivalent harness: 94 checks passed, 0 failed.
  - Six seeded documents: identifiers found per document were
    Medicare 10, IRS 9, vet 7, auto 6, utility 7, text receipt 2
    (41 total).
  - For every document, the cleaned payload contains none of the
    raw identifier values, value by value.
  - Every document yields exactly one key date.
  - Computed dates exact: rabies next due equals date given plus
    3 years; oil next service equals service date plus 6 months
    (both the ISO date and the long text form checked).
  - Text channel: the receipt link is an identifier and is covered,
    neither its token nor its domain appears in the cleaned
    payload, the seed classifies as receipt on the Money shelf,
    its one key date is its received date, and the itemized-detail
    honesty field is present. A novel pasted text from a different
    store also classifies, covers its link, and keeps its dates.
  - Open classifier: an unknown document files on Everything Else
    and still gets a calendar date.
  - Cloud labels: null config returns the Simulated label; a config
    missing appId stays Simulated; a complete config in an
    environment that cannot reach the CDN falls back to the
    Simulated label and never claims the live label.

## What is still missing tonight (by design)

- The Firebase project itself, and the config values that come
  from it. No config values were invented or guessed in this prep;
  firebase-config.js still ships null.
- Live-path confirmation against the real project, which can only
  happen after the config is pasted in tonight.
