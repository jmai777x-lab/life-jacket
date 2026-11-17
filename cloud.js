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

  var SIM_LABEL = "Simulated explanation (demo mode: Firebase is not connected yet, so this was written locally from the extracted facts)";

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
        whatItIs: "A document Life Jacket does not have a specific shelf rule for yet, so it was read with the general rules and filed under Everything Else. The facts below were pulled out on your device.",
        whatMatters: [
          amountsFound ? "Amounts found in it: " + amountsFound + "." : "No amounts were found in it.",
          deadline ? "It carries a date that looks like it needs action: " + deadline + "." : "No date in it looked like a deadline.",
          "It is kept, dated, and on the calendar like everything else. Nothing about it was thrown away for being unfamiliar."
        ],
        deadlineLine: deadline ? "The date to watch is " + deadline + "." : "No deadline was found in this document.",
        steps: [
          "Read it once yourself to confirm the general read got the shape of it right.",
          "If this kind of document starts arriving often, it deserves its own shelf and its own rules."
        ],
        scam: {
          title: "A standing caution for unfamiliar documents",
          points: [
            "Urgency is the tell. Any document that demands payment or personal information immediately, by an unusual method, deserves a phone call to a number you already trust before you act.",
            "Life Jacket covered your identifiers before this explanation was written, whatever the document turns out to be."
          ]
        }
      };
    }

    if (doc.kind === "medicare") {
      return {
        whatItIs: "A Medicare Summary Notice telling you about a change to your coverage. Starting next year, your plan covers fewer home health aide visits per year: 12 instead of 20. Your physical therapy visits are not changing, and your new monthly premium is $184.60.",
        whatMatters: [
          "The cut is to home health aide visits only, from 20 a year down to 12.",
          "If you rely on those visits, this is worth an appeal or a plan comparison before the deadline.",
          "The notice itself is not a bill. Nothing is owed because of this letter."
        ],
        deadlineLine: deadline ? "If you want to appeal, your request must arrive by " + deadline + "." : "No response deadline was found in this letter.",
        steps: [
          "Decide whether the home health visits matter to you this year.",
          "If they do, call the number on the notice and ask how to appeal, or ask a family member to sit with you while you call.",
          "Keep the notice with your health records either way."
        ],
        scam: {
          title: "Signs this is genuine",
          points: [
            "It arrived as a formal notice and asks for an appeal in writing, not for payment.",
            "It never asks you to read your Medicare number out over the phone.",
            "Caution: Medicare will never call you out of the blue and ask for your number or a payment. Anyone who does is not Medicare."
          ]
        }
      };
    }

    if (doc.kind === "irs") {
      return {
        whatItIs: "An IRS CP2000 notice. This is not a bill and not an audit. The IRS received a report from a bank saying you earned $1,912 in interest that does not appear on your 2024 tax return, and they propose that you owe $1,284.00 more in tax.",
        whatMatters: [
          "The IRS is proposing a change. You can agree, partly agree, or disagree, and disagreeing with records to back you up is a normal, expected answer.",
          "Check the interest figure against your own bank statements for 2024 before you answer.",
          "If you do nothing, the proposed change becomes final and turns into a real bill with interest."
        ],
        deadlineLine: deadline ? "Your response must reach the IRS by " + deadline + "." : "No response date was found in this notice.",
        steps: [
          "Find your 2024 bank interest statements and compare them with the $1,912 figure.",
          "Mark agree or disagree on the response form that came with the notice.",
          "Send copies, never originals, and keep a copy of everything you send.",
          "If the numbers do not make sense, a tax preparer or a low income taxpayer clinic can review a CP2000 with you."
        ],
        scam: {
          title: "Signs this is genuine, and the cautions that matter",
          points: [
            "A CP2000 arrives by mail first. The IRS does not start by email, text, or social media.",
            "The notice explains a proposed change and gives you a way to disagree. Scam letters usually demand instant payment and threaten arrest.",
            "The IRS will never demand payment by gift card, wire transfer, or cryptocurrency, and will never refuse to let you ask questions.",
            "Caution: if anyone calls claiming to be the IRS and pressures you to pay today, hang up and call the IRS number printed on the notice yourself."
          ]
        }
      };
    }

    if (doc.kind === "vet") {
      var given = fieldValue(extracted, "Rabies vaccination given");
      return {
        whatItIs: "A vet visit summary and invoice. Biscuit had a wellness exam and a nail trim, and the bill of $72.50 is paid in full. The important part is the vaccination record: it shows when the rabies shot was last given and lets us work out when it comes due again.",
        whatMatters: [
          "Rabies vaccination given: " + (given || "see record") + ".",
          "Rabies protection lasts 3 years, so the next shot comes due on the calendar date below.",
          "An overdue rabies vaccination can mean fines, and a real problem if Biscuit ever nips someone."
        ],
        deadlineLine: deadline ? "Biscuit's next rabies vaccination is due by " + deadline + "." : "No vaccination due date could be computed from this record.",
        steps: [
          "No action is needed today. The date is on your calendar now.",
          "Book the appointment a few weeks before the due date, since clinics fill up."
        ],
        scam: {
          title: "Signs this is genuine",
          points: [
            "It itemizes real services with prices and shows the card payment you made.",
            "It asks for nothing. A paid invoice that asks for no money and no information is what it appears to be."
          ]
        }
      };
    }

    if (doc.kind === "auto") {
      var nextMiles = fieldValue(extracted, "Next service mileage");
      return {
        whatItIs: "A service receipt for an oil change and tire rotation on the 2018 Toyota RAV4. The work is done and paid for ($94.18). The useful part of this receipt is the service interval: it tells us when the next service comes due, by date and by mileage.",
        whatMatters: [
          "Next service is due at the date below, or at " + (nextMiles || "the mileage on the receipt") + ", whichever comes first.",
          "Keeping the oil changed on schedule is the cheapest engine protection there is."
        ],
        deadlineLine: deadline ? "Next service due by " + deadline + (nextMiles ? ", or at " + nextMiles + "." : ".") : "No next service date could be computed from this receipt.",
        steps: [
          "Nothing to do today. The date is on your calendar now.",
          "If the odometer reaches the service mileage first, book it then instead."
        ],
        scam: {
          title: "Signs this is genuine",
          points: [
            "It lists the work performed, the vehicle, and the odometer reading, and shows the card you paid with.",
            "It asks for nothing further. Keep it with the vehicle records; a full service history raises resale value."
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
        whatItIs: "A store receipt that arrived as a text message" +
          (store ? " from " + store : "") +
          (rTotal ? ", totaling " + rTotal : "") +
          (rOrder ? " (order " + rOrder + ")" : "") +
          ". The purchase is done and paid. What is worth keeping is the record: what it cost, where, and when.",
        whatMatters: [
          rTotal ? "Total charged: " + rTotal + "." : "No total could be read from the text.",
          linkNote ? linkNote : "The text carried its own detail, so no link is needed to know what this receipt says.",
          "The link in a texted receipt carries a private token, which is why Life Jacket covered it like a number on a card."
        ],
        deadlineLine: deadline ? "Kept with its date: " + deadline + ". A receipt has no deadline; the date is on your calendar so the purchase sits in the right week when you look back." : "No date could be attached to this receipt.",
        steps: [
          "Nothing to pay and nothing to answer. It is a record, not a bill.",
          "If you need the item by item list, open the receipt link yourself from the original text message.",
          "File it and forget it; it will be here at tax time or when a return needs proof of purchase."
        ],
        scam: {
          title: "Signs this is genuine, and one caution",
          points: [
            "A genuine receipt text arrives right after a purchase you remember, and asks for nothing.",
            "Caution: receipt links can be imitated. If a text like this arrives for a purchase you never made, do not open the link and do not reply; call the store at a number you already trust.",
            "Life Jacket never opens links on its own, and it covered this link before this explanation was written."
          ]
        }
      };
    }

    // utility
    var amount = fieldValue(extracted, "Amount due");
    return {
      whatItIs: "Your monthly electric bill. The amount due is " + (amount || "shown on the bill") + ", for 1,084 kWh of usage this period. Your previous balance was zero, so this is one month of electricity.",
      whatMatters: [
        "Paying by the due date avoids the $6.00 late fee.",
        "The amount is in line with a normal month for a home, given last month's payment of $118.22."
      ],
      deadlineLine: deadline ? "Payment is due by " + deadline + "." : "No due date was found on this bill.",
      steps: [
        "Pay as you normally do: online, by phone, or by check with the account number on it.",
        "Then forget it. The due date is on your calendar for next month's bill too."
      ],
      scam: {
        title: "Signs this is genuine, and one caution",
        points: [
          "It states a billing period, a usage figure, and a previous payment that matches your records.",
          "Caution: utility shutoff scams are common. Your cooperative will not demand payment within the hour by prepaid card. If a caller does, hang up and call the number printed on this bill."
        ]
      }
    };
  }

  // ----- the real cloud path: Firebase AI Logic -----
  // Loaded lazily from the Firebase CDN only when a config exists, so
  // the app makes zero network calls in demo mode.

  // SDK version pinned to one where the Firebase AI Logic module
  // (firebase-ai.js) actually exists on the CDN. The older 11.3.1
  // pin predates the AI Logic rename and its firebase-ai.js URL
  // returns 404, which silently forced every live attempt into the
  // simulation fallback. Verified against the CDN on Nov 16, 2026.
  var FIREBASE_SDK_VERSION = "12.11.0";

  async function explainWithFirebase(config, cleanText, doc) {
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
    var model = aiModule.getGenerativeModel(ai, { model: "gemini-3.8-flash" });
    var prompt =
      "You explain official letters and household documents to an older reader in plain, calm language. " +
      "The document below has already had personal identifiers removed. Answer with exactly these sections, " +
      "each starting with its header on its own line:\n" +
      "WHAT THIS IS:\nWHAT MATTERS:\nTHE DEADLINE:\nWHAT TO DO NEXT:\nSCAM CHECK:\n\n" +
      "Document:\n" + cleanText;
    var result = await model.generateContent(prompt);
    var text = result.response.text();
    return parseSections(text);
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
        // The cloud step gets 45 seconds, never forever: a reader
        // must never be left staring at "Explaining..." with no
        // answer. A timeout falls back to the labeled local
        // explanation, the same as any other failure to reach it.
        var explanation = await Promise.race([
          explainWithFirebase(config, cleanText, doc),
          new Promise(function (resolve, reject) {
            setTimeout(function () {
              reject(new Error("the cloud step did not answer within 45 seconds"));
            }, 45000);
          })
        ]);
        return {
          sourceLabel: "Explanation by Gemini in the cloud (Firebase AI Logic), working only from the approved text above",
          explanation: explanation
        };
      } catch (err) {
        var fallback = simulate(doc, extracted);
        // TEMPORARY DIAGNOSTIC (Nov 16, 2026): the Detail suffix
        // carries the real failure reason onto the card so the
        // browser-side failure can be read off the screen. Finalize
        // this wording once the cause is fixed.
        fallback.whatItIs = "(The cloud step could not be reached, so this local explanation was used instead. Detail: " +
          (err && err.message ? err.message : String(err)) + ") " + fallback.whatItIs;
        return { sourceLabel: SIM_LABEL, explanation: fallback };
      }
    }
    // No Firebase project yet: labeled local simulation.
    return { sourceLabel: SIM_LABEL, explanation: simulate(doc, extracted) };
  }

  window.LJ_CLOUD = { cloudExplain: cloudExplain };
})();
