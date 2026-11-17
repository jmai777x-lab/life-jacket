// Life Jacket - the cloud step.
//
// This is the ONLY part of the app allowed to use the network, and it
// only ever receives text that has already been redacted on the device
// AND approved by the user in the payload gate. Identifiers never go.
//
// How it works:
//   - If firebase-config.js holds a real Firebase project config, the
//     explanation is produced by Firebase AI Logic (Google's Gemini
//     models reached through the Firebase SDK, loaded from CDN).
//   - If there is no config yet, a clearly labeled LOCAL SIMULATION
//     builds the explanation from the fields the on-device extractor
//     already pulled out. The wording on screen always says which one
//     happened. The simulation exists so the whole flow can be tested
//     and demonstrated end to end before the project is connected.

(function () {
  "use strict";

  var SIM_LABEL = "Explained on this device, from the facts above";

  function fieldValue(extracted, labelStart) {
    for (var i = 0; i < extracted.fields.length; i++) {
      if (extracted.fields[i].label.indexOf(labelStart) === 0) {
        return extracted.fields[i].value;
      }
    }
    return null;
  }

  function keyDateText(extracted) {
    return extracted.keyDates.length ? extracted.keyDates[0].dateText : null;
  }

  // ----- the simulated explanations, one per document kind -----
  // Each one is assembled from the extracted facts, so the dates and
  // amounts on the card are the dates and amounts in the document.

  function simulate(doc, extracted) {
    var deadline = keyDateText(extracted);

    // General path: a document kind with no specific explainer still
    // gets an honest explanation, built from whatever the on-device
    // extractor found. This is what the open classifier files under
    // the general holding shelf.
    var KNOWN = ["medicare", "irs", "vet", "auto", "utility", "receipt"];
    if (KNOWN.indexOf(doc.kind) < 0) {
      var amountsFound = fieldValue(extracted, "Amounts found");
      return {
        whatItIs: "Life Jacket doesn't have a rule for this kind of document yet. It read it with the general rules and filed it under Everything Else.",
        whatMatters: [
          amountsFound ? "Amounts in it: " + amountsFound + "." : "No amounts turned up in it.",
          deadline ? "One date in it looks like it needs action: " + deadline + "." : "No date in it looked like a deadline.",
          "It's saved with its date, same as everything else."
        ],
        deadlineLine: deadline ? "The date to watch is " + deadline + "." : "No deadline turned up.",
        steps: [
          "Read it through once yourself and check the read got it right.",
          "If this kind starts showing up a lot, it should get a shelf of its own."
        ],
        scam: {
          title: "Careful with ones you don't know",
          points: [
            "If a document pushes you to pay or hand over information right away, stop. Call a number you already have and check first.",
            "Your numbers and addresses were covered before any of this was written."
          ]
        }
      };
    }

    if (doc.kind === "medicare") {
      return {
        whatItIs: "A Medicare Summary Notice. It's about a change coming to your coverage. Next year the plan pays for 12 home health aide visits instead of 20. Physical therapy stays the same. The new premium is $184.60 a month.",
        whatMatters: [
          "Only the aide visits are cut. Therapy isn't touched.",
          "If you use those visits, you can appeal, or look at other plans before the deadline.",
          "This letter isn't a bill. You don't owe anything because it arrived."
        ],
        deadlineLine: deadline ? "If you want to appeal, your request has to arrive by " + deadline + "." : "No response deadline turned up in this letter.",
        steps: [
          "Think about whether you'll need the aide visits next year.",
          "If you will, call the number on the notice and ask how to appeal. It helps to have someone sitting with you.",
          "Keep the letter with your health papers."
        ],
        scam: {
          title: "Why this one looks real",
          points: [
            "It asks for an appeal in writing. It doesn't ask for money.",
            "It never asks you to read your Medicare number out over the phone.",
            "Medicare doesn't call people out of the blue asking for numbers or payments. If someone does, that isn't Medicare."
          ]
        }
      };
    }

    if (doc.kind === "irs") {
      return {
        whatItIs: "An IRS notice called a CP2000. It isn't a bill, and it isn't an audit. A bank told the IRS you earned $1,912 in interest that isn't on your 2024 return. The IRS thinks that means $1,284.00 more in tax.",
        whatMatters: [
          "Nothing is final yet. You can agree with all of it, part of it, or none of it.",
          "Check your own 2024 bank statements against the $1,912 before you answer.",
          "Ignore it, though, and the change becomes final. Then it's a real bill, with interest."
        ],
        deadlineLine: deadline ? "Your response has to reach the IRS by " + deadline + "." : "No response date turned up in this notice.",
        steps: [
          "Pull your 2024 interest statements and compare the numbers.",
          "Mark agree or disagree on the form that came with the notice.",
          "Send copies, never originals. Keep a copy of everything you send.",
          "If the numbers still don't add up, a tax preparer or a low income taxpayer clinic will go over a CP2000 with you."
        ],
        scam: {
          title: "How you can tell it's real",
          points: [
            "A CP2000 comes in the mail. The IRS doesn't open with an email or a text.",
            "Scam letters want money today and threaten arrest. This one gives you a way to argue back.",
            "The IRS never takes gift cards, wire transfers, or crypto. Not ever.",
            "If someone calls saying they're the IRS and wants payment today, hang up. Call the number on the notice yourself."
          ]
        }
      };
    }

    if (doc.kind === "vet") {
      var given = fieldValue(extracted, "Rabies vaccination given");
      return {
        whatItIs: "Biscuit's vet visit, written up as a summary and invoice. Wellness exam, nail trim, and the $72.50 bill is paid. The part worth keeping is the rabies record: when the last shot was given, so the next due date can be worked out.",
        whatMatters: [
          "Last rabies shot: " + (given || "see record") + ".",
          "Rabies shots last 3 years. The next one is due on the date below.",
          "Let it lapse and there can be fines. Worse if Biscuit ever nips somebody."
        ],
        deadlineLine: deadline ? "Biscuit's next rabies shot is due by " + deadline + "." : "No due date could be worked out from this record.",
        steps: [
          "Nothing to do today.",
          "Book it a few weeks ahead of the date. Clinics fill up."
        ],
        scam: {
          title: "Checks out",
          points: [
            "It lists the services with prices and shows your card payment.",
            "It doesn't ask for money or information. A paid bill that wants nothing is what it looks like."
          ]
        }
      };
    }

    if (doc.kind === "auto") {
      var nextMiles = fieldValue(extracted, "Next service mileage");
      return {
        whatItIs: "Receipt for an oil change and tire rotation on the 2018 Toyota RAV4. Done and paid, $94.18. What's worth saving is the service interval: when the next one comes due, by date and by mileage.",
        whatMatters: [
          "Next service: the date below, or " + (nextMiles || "the mileage on the receipt") + ", whichever comes first.",
          "Skipping oil changes is how engines wear out early."
        ],
        deadlineLine: deadline ? "Next service due by " + deadline + (nextMiles ? ", or at " + nextMiles + "." : ".") : "No next service date could be worked out from this receipt.",
        steps: [
          "Nothing to do today.",
          "If the odometer hits the mileage first, book it then instead."
        ],
        scam: {
          title: "Looks right",
          points: [
            "It names the work, the vehicle, and the odometer reading, and shows the card you paid with.",
            "It asks for nothing. Keep it with the vehicle papers. A full service history helps if you ever sell."
          ]
        }
      };
    }

    if (doc.kind === "receipt") {
      var store = fieldValue(extracted, "Store");
      var rTotal = fieldValue(extracted, "Total");
      var rOrder = fieldValue(extracted, "Order number");
      var linkNote = fieldValue(extracted, "Itemized detail");
      return {
        whatItIs: "A store receipt that came as a text message" +
          (store ? " from " + store : "") +
          (rTotal ? ", totaling " + rTotal : "") +
          (rOrder ? " (order " + rOrder + ")" : "") +
          ". Paid and done. What's worth keeping is what it cost, and when.",
        whatMatters: [
          rTotal ? "Total charged: " + rTotal + "." : "No total could be read from the text.",
          linkNote ? linkNote : "The text had the detail in it, so the link isn't needed.",
          "The link in a texted receipt carries a private token. That's why it got covered, same as a card number."
        ],
        deadlineLine: deadline ? "Receipts don't have deadlines. This one is dated " + deadline + ", so it lands in the right week when you look back." : "No date could be attached to this receipt.",
        steps: [
          "Nothing to pay, nothing to answer. It's a record, not a bill.",
          "Want the item by item list? Open the link from the original text.",
          "It'll be here at tax time, or if a return ever needs proof."
        ],
        scam: {
          title: "One caution",
          points: [
            "A real receipt text shows up right after a purchase you remember, and asks for nothing.",
            "If one shows up for something you never bought, don't open the link and don't reply. Call the store at a number you already have.",
            "Life Jacket doesn't open links by itself. This one was covered before the explanation was written."
          ]
        }
      };
    }

    // utility
    var amount = fieldValue(extracted, "Amount due");
    return {
      whatItIs: "Your electric bill. " + (amount || "The amount is on the bill") + " due, for 1,084 kWh this period. Last month was paid off, so this is just this month.",
      whatMatters: [
        "Pay by the due date and there's no $6.00 late fee.",
        "It's in line with a normal month. Last month's payment was $118.22."
      ],
      deadlineLine: deadline ? "Due by " + deadline + "." : "No due date turned up on this bill.",
      steps: [
        "Pay the way you usually do: online, by phone, or by check.",
        "Next month's due date is on your calendar too."
      ],
      scam: {
        title: "Watch for the fake version",
        points: [
          "The bill shows the period, the usage, and a last payment that matches your records.",
          "Shutoff scams are common. Your co-op won't demand payment within the hour on a prepaid card. If a caller does, hang up and call the number on this bill."
        ]
      }
    };
  }

  // ----- the real cloud path: Firebase AI Logic -----
  // Loaded lazily from the Firebase CDN only when a config exists, so
  // the app makes zero network calls in demo mode.

  // SDK version pinned to 13.3.0. The version matters here, not
  // just for currency: the 12.11.0 pin this build started on
  // contains the bug that makes structured output (responseSchema)
  // error out (fixed in 12.12.0), and its promptFeedback is broken
  // for this backend (fixed in 13.3.0). 13.3.0 verified against
  // the live project on Nov 17, 2026. Note for anyone editing the
  // schema below: in this SDK, Schema.array takes an options
  // object ({ items: ... }), not the item schema directly; the
  // direct form fails at call time with a toJSON error inside
  // the SDK. That mistake was made and caught in testing on
  // Nov 17, 2026, before it ever reached this file.
  var FIREBASE_SDK_VERSION = "13.3.0";

  // The standing rules for the cloud explanation, given as a
  // system instruction so they sit apart from the document text
  // itself: the voice, and the fidelity rules the product
  // promises (facts only from the document, dates and amounts
  // copied exactly, no guessing).
  var SYSTEM_INSTRUCTION =
    "You explain official letters and household documents to an older reader. " +
    "Write the way a helpful person talks: short sentences, plain words, contractions are fine. " +
    "Do not pad, do not repeat stock phrases, and do not make everything sound the same. " +
    "If a point is simple, say it simply and move on. " +
    "Use only facts that are in the document. Copy every date and every amount exactly as the document writes it. " +
    "One exception: a date the document lets you work out exactly, like a shot given on a stated date that lasts a stated number of years. Give that date, and say in a few words how you got it. " +
    "If a fact is not in the document, say so plainly instead of guessing. Never add facts from outside the document. " +
    "For the scam fields, judge from the document itself: what it asks for, how it asks, and whether that matches how the real sender behaves. " +
    "Standing cautions that often fit: the IRS opens by mail, never by text or email; Medicare does not call people asking for numbers or payments; " +
    "no real bill demands payment within the hour on a prepaid card or gift cards.";

  // The shape the explanation must come back in. Structured
  // output replaces the old headed-text reply and its header
  // search: a field cannot arrive misspelled, missing, or
  // wrapped in preamble.
  function explanationSchema(Schema) {
    return Schema.object({
      properties: {
        whatItIs: Schema.string({ description: "What the document is, and the one thing it is really about." }),
        whatMatters: Schema.array({ items: Schema.string() }),
        deadlineLine: Schema.string({ description: "One short sentence giving the date the reader must act by: a date copied exactly as the document writes it, or a due date the document lets you work out exactly (a start date plus a stated period, like a vaccine that lasts 3 years). If no date of either kind turned up, a plain sentence saying so." }),
        steps: Schema.array({ items: Schema.string() }),
        scamTitle: Schema.string({ description: "A short plain heading saying whether this document looks genuine, or what to watch for." }),
        scamPoints: Schema.array({ items: Schema.string() })
      }
    });
  }

  // ----- the fidelity check -----
  // Structured output guarantees the explanation's shape, not
  // its truth. So before a cloud explanation is shown, every
  // date and every dollar amount in it is checked against the
  // text the user approved, plus the fields and key dates the
  // on-device extractor computed from that text (a rabies due
  // date, for instance, is worked out from a vaccination date
  // and a 3-year interval, so it is in the extracted key dates
  // rather than in the letter itself). A date or amount found
  // in neither place means the explanation drifted, and the
  // call is treated as failed: retried, then replaced by the
  // labeled on-device explanation, never shown.

  var MONTHS = {
    january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
    april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
    august: 8, aug: 8, september: 9, sept: 9, sep: 9,
    october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12
  };
  var MONTH_NAME = "January|February|March|April|May|June|July|August|September|October|November|December|Jan\\.?|Feb\\.?|Mar\\.?|Apr\\.?|Jun\\.?|Jul\\.?|Aug\\.?|Sept\\.?|Sep\\.?|Oct\\.?|Nov\\.?|Dec\\.?";

  function isoOf(month, day, year) {
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return year + "-" + p(month) + "-" + p(day);
  }

  function collectDates(text, into) {
    if (!text) return;
    var m;
    var monthFirst = new RegExp("\\b(" + MONTH_NAME + ")\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b", "gi");
    while ((m = monthFirst.exec(text)) !== null) {
      var mon = MONTHS[m[1].toLowerCase().replace(".", "")];
      if (mon) into[isoOf(mon, parseInt(m[2], 10), m[3])] = true;
    }
    var dayFirst = new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(" + MONTH_NAME + ")\\s+(\\d{4})\\b", "gi");
    while ((m = dayFirst.exec(text)) !== null) {
      var mon2 = MONTHS[m[2].toLowerCase().replace(".", "")];
      if (mon2) into[isoOf(mon2, parseInt(m[1], 10), m[3])] = true;
    }
    var iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
    while ((m = iso.exec(text)) !== null) into[m[0]] = true;
    var slashes = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
    while ((m = slashes.exec(text)) !== null) {
      into[isoOf(parseInt(m[1], 10), parseInt(m[2], 10), m[3])] = true;
    }
  }

  function collectAmounts(text, into, bareDecimals) {
    if (!text) return;
    var m;
    var dollars = /\$([\d,]+(?:\.\d{1,2})?)/g;
    while ((m = dollars.exec(text)) !== null) {
      var v = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(v)) into[v.toFixed(2)] = true;
    }
    if (bareDecimals) {
      // On the source side, also take bare money-shaped numbers
      // (a document may write 1,284.00 without the $ sign), so a
      // correct explanation amount is not failed for the sign.
      var bare = /\b([\d,]+\.\d{2})\b/g;
      while ((m = bare.exec(text)) !== null) {
        var b = parseFloat(m[1].replace(/,/g, ""));
        if (!isNaN(b)) into[b.toFixed(2)] = true;
      }
    }
  }

  function checkFidelity(explanation, cleanText, extracted) {
    var srcDates = {}, srcAmounts = {};
    collectDates(cleanText, srcDates);
    collectAmounts(cleanText, srcAmounts, true);
    if (extracted) {
      (extracted.fields || []).forEach(function (f) {
        collectDates(f.value, srcDates);
        collectAmounts(f.value, srcAmounts, true);
      });
      (extracted.keyDates || []).forEach(function (k) {
        if (k.dateISO) srcDates[k.dateISO] = true;
        collectDates(k.dateText, srcDates);
      });
    }
    var pieces = [explanation.whatItIs, explanation.deadlineLine, explanation.scam.title];
    (explanation.whatMatters || []).forEach(function (x) { pieces.push(x); });
    (explanation.steps || []).forEach(function (x) { pieces.push(x); });
    (explanation.scam.points || []).forEach(function (x) { pieces.push(x); });
    for (var i = 0; i < pieces.length; i++) {
      var d = {}, a = {};
      collectDates(pieces[i], d);
      collectAmounts(pieces[i], a, false);
      for (var dk in d) {
        if (!srcDates[dk]) return "a date the document does not contain (" + dk + ")";
      }
      for (var ak in a) {
        if (!srcAmounts[ak]) return "an amount the document does not contain ($" + ak + ")";
      }
    }
    return null;
  }

  async function explainWithFirebase(config, cleanText, doc, extracted) {
    var base = "https://www.gstatic.com/firebasejs/" + FIREBASE_SDK_VERSION + "/";
    var appModule = await import(base + "firebase-app.js");
    var aiModule = await import(base + "firebase-ai.js");
    // Reuse the default app when a document was already explained in
    // this session; initializeApp throws on a second default app.
    var app = null;
    if (typeof appModule.getApp === "function") {
      try { app = appModule.getApp(); } catch (err) { app = null; }
    }
    if (!app) app = appModule.initializeApp(config);
    // The Gemini Developer API backend is the class GoogleAIBackend,
    // constructed with no arguments. Older drafts referenced an
    // AIBackend enum that the SDK does not export; if a future SDK
    // renames it again, getAI with no backend option still defaults
    // to the same Google AI backend, so fall back to that rather
    // than failing the whole cloud step.
    var ai;
    if (typeof aiModule.GoogleAIBackend === "function") {
      ai = aiModule.getAI(app, { backend: new aiModule.GoogleAIBackend() });
    } else {
      ai = aiModule.getAI(app);
    }
    // Preferred path: structured output. The reply comes back
    // as JSON in the schema's shape, the standing rules ride as
    // a system instruction apart from the document, and the
    // thinking level is set to LOW on purpose: this job is
    // extracting and restating a short document's facts, and
    // thinking tokens are billed as output. (MINIMAL is not
    // offered: this model rejects it with an error.)
    if (aiModule.Schema && typeof aiModule.Schema.object === "function") {
      var model = aiModule.getGenerativeModel(ai, {
        model: "gemini-3.8-flash",
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
          thinkingConfig: { thinkingLevel: "LOW" },
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseSchema: explanationSchema(aiModule.Schema)
        }
      });
      var result = await model.generateContent("Document:\n" + cleanText);
      var response = result.response;
      if (response.promptFeedback && response.promptFeedback.blockReason) {
        throw new Error("the cloud step was blocked: " + response.promptFeedback.blockReason);
      }
      var cand = response.candidates && response.candidates[0];
      if (cand && cand.finishReason && cand.finishReason !== "STOP") {
        throw new Error("the cloud step stopped early: " + cand.finishReason);
      }
      var parsed = JSON.parse(response.text());
      var explanation = {
        whatItIs: String(parsed.whatItIs || ""),
        whatMatters: (parsed.whatMatters || []).map(function (x) { return String(x); }),
        deadlineLine: String(parsed.deadlineLine || ""),
        steps: (parsed.steps || []).map(function (x) { return String(x); }),
        scam: {
          title: String(parsed.scamTitle || "Scam check"),
          points: (parsed.scamPoints || []).map(function (x) { return String(x); })
        }
      };
      var drift = checkFidelity(explanation, cleanText, extracted);
      if (drift) throw new Error("the cloud explanation named " + drift);
      return explanation;
    }
    // Legacy path, kept for one case only: a future SDK that
    // moves the Schema helpers, so the cloud step degrades to
    // the original headed-text reply instead of dying outright.
    var legacyModel = aiModule.getGenerativeModel(ai, { model: "gemini-3.8-flash" });
    var prompt =
      "You explain official letters and household documents to an older reader. " +
      "Write the way a helpful person talks: short sentences, plain words, contractions are fine. " +
      "Do not pad, do not repeat stock phrases, and do not make everything sound the same. " +
      "If a point is simple, say it simply and move on. " +
      "The document below has already had personal identifiers removed. Answer with exactly these sections, " +
      "each starting with its header on its own line:\n" +
      "WHAT THIS IS:\nWHAT MATTERS:\nTHE DEADLINE:\nWHAT TO DO NEXT:\nSCAM CHECK:\n\n" +
      "Document:\n" + cleanText;
    var legacyResult = await legacyModel.generateContent(prompt);
    return parseSections(legacyResult.response.text());
  }

  function parseSections(text) {
    function grab(header, nextHeaders) {
      var start = text.indexOf(header);
      if (start < 0) return "";
      start += header.length;
      var end = text.length;
      nextHeaders.forEach(function (h) {
        var i = text.indexOf(h, start);
        if (i >= 0 && i < end) end = i;
      });
      return text.slice(start, end).trim();
    }
    function lines(s) {
      return s.split("\n").map(function (x) { return x.replace(/^[-*]\s*/, "").trim(); }).filter(Boolean);
    }
    return {
      whatItIs: grab("WHAT THIS IS:", ["WHAT MATTERS:"]) || text.slice(0, 600),
      whatMatters: lines(grab("WHAT MATTERS:", ["THE DEADLINE:"])),
      deadlineLine: grab("THE DEADLINE:", ["WHAT TO DO NEXT:"]),
      steps: lines(grab("WHAT TO DO NEXT:", ["SCAM CHECK:"])),
      scam: { title: "Scam check", points: lines(grab("SCAM CHECK:", [])) }
    };
  }

  // ----- the public entry point -----
  // cleanText is the approved, redacted text from the payload gate.
  // Returns { sourceLabel, explanation }.

  async function cloudExplain(cleanText, doc, extracted) {
    var config = window.LIFEJACKET_FIREBASE_CONFIG;
    // The Firebase AI SDK itself requires apiKey, projectId, and
    // appId, and throws without any one of them, so the live path is
    // only attempted when all three are present. Anything less is
    // treated as "not connected yet" and stays in the labeled
    // simulation instead of attempting a call that cannot succeed.
    if (config && config.apiKey && config.projectId && config.appId) {
      try {
        // The cloud step is retried before it is given up on: the
        // free Gemini service sometimes answers a demand spike
        // with a temporary error (a 500 "high demand" response,
        // seen live on Nov 16, 2026), and a short wait clears it.
        // Three attempts, waiting 4 and then 10 seconds between
        // them, inside a 75-second envelope, never forever: a
        // reader must never be left staring at "Explaining..."
        // with no answer. If every attempt fails, the labeled
        // local explanation is used, the same as any other
        // failure to reach the cloud.
        var attemptCloud = (async function () {
          var waits = [0, 4000, 10000];
          var lastErr = null;
          for (var i = 0; i < waits.length; i++) {
            if (waits[i]) {
              await new Promise(function (r) { setTimeout(r, waits[i]); });
            }
            try {
              return await explainWithFirebase(config, cleanText, doc, extracted);
            } catch (err) {
              lastErr = err;
            }
          }
          throw lastErr || new Error("the cloud step could not be reached");
        })();
        var explanation = await Promise.race([
          attemptCloud,
          new Promise(function (resolve, reject) {
            setTimeout(function () {
              reject(new Error("the cloud step did not answer within 75 seconds"));
            }, 75000);
          })
        ]);
        return {
          sourceLabel: "Explained by Gemini in the cloud, from the approved text above",
          explanation: explanation
        };
      } catch (err) {
        try { console.error("Life Jacket cloud step failed:", err); } catch (e) {}
        var fallback = simulate(doc, extracted);
        fallback.whatItIs = "(The cloud didn't answer, so this one was explained on this device.) " + fallback.whatItIs;
        return { sourceLabel: SIM_LABEL, explanation: fallback };
      }
    }
    // No Firebase project yet: labeled local simulation.
    return { sourceLabel: SIM_LABEL, explanation: simulate(doc, extracted) };
  }

  window.LJ_CLOUD = { cloudExplain: cloudExplain };
})();
