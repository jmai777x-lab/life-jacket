// Life Jacket - the on-device engine.
//
// Everything in this file runs locally in the browser. Nothing here
// sends data anywhere. It does three jobs:
//
//   1. readDocument: the first read of a document. If Chrome's built-in
//      on-device model (Gemini Nano) is present, it is tried first and
//      the read is labeled with its name. Either way, a plain local
//      rule-based extractor pulls out the facts, so the app works the
//      same with no network and no special browser.
//   2. findIdentifiers: the redaction engine. It finds names, numbers,
//      and addresses in the text so they can be covered before any
//      cloud step is even considered.
//   3. extractFields: per-document-type rules that pull out what the
//      document is, the amounts, and every consequential date,
//      including dates that have to be computed (a rabies shot due
//      again in 3 years, an oil change due again in 6 months).

(function () {
  "use strict";

  var D = window.LJ_DATA;
  var DATE_RE = /[A-Z][a-z]+ \d{1,2}, \d{4}/g;

  var MONTH_INDEX = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };

  // Parse "December 4, 2026" strictly: the components must survive
  // the round trip, so an impossible date a document happens to
  // print ("February 30, 2026") is read as no date at all instead
  // of silently becoming a different day on the calendar.
  // (Strictness added 2026-11-24; the loose parse rolled invalid
  // dates over into the next month.)
  function parseLongDate(text) {
    var m = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(text);
    if (!m) return null;
    var mon = MONTH_INDEX[m[1].toLowerCase()];
    if (mon === undefined) return null;
    var day = parseInt(m[2], 10), year = parseInt(m[3], 10);
    var d = new Date(year, mon, day, 12, 0, 0);
    if (d.getFullYear() !== year || d.getMonth() !== mon || d.getDate() !== day) return null;
    return d;
  }

  // Parse "12/27/2026" (month/day/year, four-digit year only), with
  // the same strictness. Returns null for anything else.
  function parseSlashDate(text) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (!m) return null;
    var mon = parseInt(m[1], 10) - 1, day = parseInt(m[2], 10), year = parseInt(m[3], 10);
    if (mon < 0 || mon > 11) return null;
    var d = new Date(year, mon, day, 12, 0, 0);
    if (d.getFullYear() !== year || d.getMonth() !== mon || d.getDate() !== day) return null;
    return d;
  }

  function parseAnyDate(text) {
    return text.indexOf("/") >= 0 ? parseSlashDate(text) : parseLongDate(text);
  }

  function labeledDate(text, label) {
    var re = new RegExp(label + "\\s*[:]?\\s*([A-Z][a-z]+ \\d{1,2}, \\d{4}|\\d{1,2}/\\d{1,2}/\\d{4})", "i");
    var m = text.match(re);
    return m ? parseAnyDate(m[1]) : null;
  }

  function labeledAmount(text, label) {
    // Cents are optional: a bill that writes "Amount due: $200"
    // still has an amount due. A "will be" between the label and
    // the amount is allowed too: the seeded Medicare notice writes
    // "Your new monthly premium will be $184.60", and its own
    // premium went unextracted without it. (Loosened 2026-11-24.)
    var re = new RegExp(label + "\\s*[:]?\\s*(?:will be\\s*)?(\\$[\\d,]+(?:\\.\\d{2})?)", "i");
    var m = text.match(re);
    return m ? m[1] : null;
  }

  function allDatesIn(text) {
    var found = text.match(DATE_RE) || [];
    var seen = {};
    var out = [];
    found.forEach(function (s) {
      if (!seen[s]) {
        seen[s] = true;
        out.push(s);
      }
    });
    return out;
  }

  // ---------- 1. the first read ----------

  // Try Chrome's on-device model. Returns a short summary string, or
  // null when the model is not there or does not answer in time.
  // Both API shapes are tried: the newer window.LanguageModel and the
  // older window.ai.languageModel.
  function tryNano(doc) {
    var LM = window.LanguageModel ||
      (window.ai && window.ai.languageModel) || null;
    if (!LM) return Promise.resolve(null);

    var attempt = (async function () {
      try {
        if (typeof LM.availability === "function") {
          var avail = await LM.availability();
          if (avail === "unavailable" || avail === "no") return null;
        }
        var session = await LM.create();
        var reply = await session.prompt(
          "In one short sentence, say what kind of document this is and " +
          "the single most important date or amount in it. Document:\n\n" +
          doc.body.slice(0, 1500)
        );
        if (session && typeof session.destroy === "function") session.destroy();
        return typeof reply === "string" && reply.trim() ? reply.trim() : null;
      } catch (err) {
        return null;
      }
    })();

    var timeout = new Promise(function (resolve) {
      setTimeout(function () { resolve(null); }, 10000);
    });
    return Promise.race([attempt, timeout]);
  }

  // The first read. Always succeeds: Gemini Nano when it answers,
  // local rules otherwise. The label tells the user which engine read
  // the document, honestly.
  async function readDocument(doc) {
    var nanoNote = await tryNano(doc);
    var extracted = extractFields(doc);
    if (nanoNote) {
      return {
        engineLabel: "Read by Gemini Nano on this device",
        engineNote: nanoNote,
        extracted: extracted
      };
    }
    return {
      engineLabel: "Read on this device (local rules)",
      engineNote: "No on-device AI model answered, so plain local rules did the read. Nothing left this device.",
      extracted: extracted
    };
  }

  // ---------- 2. the redaction engine ----------

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Each detector returns spans: {start, end, kind, text}.
  // Detectors run in priority order; overlapping spans are resolved
  // in favor of the earlier detector, so a Medicare number is never
  // also claimed as a plain account number.
  function findIdentifiers(doc) {
    var text = doc.body;
    var spans = [];

    function collect(kind, regex) {
      var m;
      regex.lastIndex = 0;
      while ((m = regex.exec(text)) !== null) {
        spans.push({ start: m.index, end: m.index + m[0].length, kind: kind, text: m[0] });
        if (m[0].length === 0) regex.lastIndex++;
      }
    }

    // Links first: a receipt link carries a private token in the
    // URL itself, so the whole URL is an identifier and must be
    // coverable before anything else can claim part of it.
    collect("Link with a private token", /https?:\/\/[^\s]+/g);
    collect("Email address", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g);
    collect("Medicare number", /\b[1-9][A-Z][A-Z0-9][0-9]-[A-Z][A-Z0-9][0-9]-[A-Z][A-Z0-9][0-9][0-9]\b/g);
    // Dashes, spaces, or a line break between the groups: letters
    // write the number all three ways. (Widened 2026-11-24; the
    // dashed-only rule let the spaced form through.)
    collect("Social Security number", /\b\d{3}[-\s]\d{2}[-\s]?\s?\d{4}\b/g);
    // 12 or more digits, no upper bound: account numbers on bills
    // run shorter than card numbers, and the seeded utility bill's
    // own 12-digit account number must be covered. (Lower bound
    // widened 2026-11-22; the old upper bound of 19 let a 20-digit
    // run through whole or left its tail uncovered, and the
    // separator now includes a line break, for numbers a letter
    // wraps across two lines. Both fixed 2026-11-24.)
    collect("Card or account number", /\b(?:\d[ \n-]?){11,}\d\b/g);

    // Labeled numbers: a digit run of 7 or more that follows an
    // account-style label is an identifier even when it is too
    // short for the free-standing rule above. Utility and policy
    // account numbers run 8-11 digits, and a 9-digit Social
    // Security number is often written with no dashes at all.
    // The label is the anchor, so order and tracking numbers in
    // running text stay uncovered. Only the number is spanned,
    // never the label. (Added 2026-11-24.)
    (function () {
      var digitRun = "(\\d(?:[ \\n-]?\\d){6,23})";
      var rules = [
        { kind: "Social Security number",
          re: new RegExp("(?:social\\s+security)\\s*(?:number)?\\s*(?:on\\s+file)?\\s*(?:is)?\\s*[:#]?\\s*" + digitRun, "gi") },
        { kind: "Card or account number",
          re: new RegExp("(?:account|acct|member|policy|confirmation|reference)\\s*(?:number|no\\.?|id|#)?\\s*(?:on\\s+file)?\\s*(?:is)?\\s*[:#]?\\s*" + digitRun, "gi") },
        { kind: "Member or policy ID",
          re: /(?:member|policy)\s*(?:id|number|no\.?)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9-]{5,})/gi }
      ];
      rules.forEach(function (rule) {
        var m;
        while ((m = rule.re.exec(text)) !== null) {
          var start = m.index + m[0].length - m[1].length;
          spans.push({ start: start, end: start + m[1].length, kind: rule.kind, text: m[1] });
          if (m[1].length === 0) rule.re.lastIndex++;
        }
      });
    })();

    // Separators are optional and may be a line break, so the
    // unbroken 10-digit form and "(555)014-2288" are covered too.
    // (Widened 2026-11-24; both forms leaked before.)
    collect("Phone number", /(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\s?\d{3}[-. ]?\s?\d{4}/g);

    // Date of birth: cover the date itself when it follows the
    // label, in long form or numeric form, under any of the
    // labels real letters use. (Widened 2026-11-24; only the
    // exact label "date of birth:" with a long-form date was
    // covered before, so "DOB: 04/12/1948" leaked.)
    (function () {
      var re = /((?:date of birth|dob|born)\s*:\s*)((?:[A-Z][a-z]+ \d{1,2}, \d{4})|(?:\d{1,2}\/\d{1,2}\/\d{4}))/gi;
      var m;
      while ((m = re.exec(text)) !== null) {
        var start = m.index + m[1].length;
        spans.push({ start: start, end: start + m[2].length, kind: "Date of birth", text: m[2] });
      }
    })();

    // A PO Box is an address with no street suffix, so the street
    // rule below never sees it. (Added 2026-11-24.)
    collect("Street address",
      /\bP\.?O\.?\s+Box\s+\d+(?:,\s*[A-Z][a-zA-Z]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)?/gi);

    collect("Street address",
      /\b\d{1,5}\s+(?:[A-Z][A-Za-z']+\s+){0,3}(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Boulevard|Blvd|Way|Trail)\.?(?:,\s*(?:Apt\.?|Apartment|Suite|Ste\.?|Unit)\s+[A-Za-z0-9-]+)?(?:,\s*[A-Z][a-zA-Z]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)?/g);

    // The person's full name, in every written form the document
    // uses. A multi-word name is matched without regard to case,
    // so a letter that writes it in lowercase is still covered.
    // (Case loosened 2026-11-24.)
    (doc.nameVariants || []).forEach(function (variant) {
      collect("Full name", new RegExp(escapeRegExp(variant), variant.indexOf(" ") >= 0 ? "gi" : "g"));
    });

    // Resolve overlaps: sort by start, then by longer span first,
    // and keep a span only if it does not overlap one already kept.
    spans.sort(function (a, b) {
      if (a.start !== b.start) return a.start - b.start;
      return (b.end - b.start) - (a.end - a.start);
    });
    var kept = [];
    var coveredUntil = -1;
    spans.forEach(function (s) {
      if (s.start >= coveredUntil) {
        kept.push(s);
        coveredUntil = s.end;
      }
    });
    kept.forEach(function (s, i) { s.id = "idn-" + i; });
    return kept;
  }

  // Build the cleaned text that would leave the device: covered items
  // replaced with a plain marker, uncovered items left exactly as-is.
  function buildCleanText(doc, identifiers, uncoveredIds) {
    var uncovered = {};
    (uncoveredIds || []).forEach(function (id) { uncovered[id] = true; });
    var out = "";
    var pos = 0;
    identifiers.forEach(function (s) {
      out += doc.body.slice(pos, s.start);
      if (uncovered[s.id]) {
        out += s.text;
      } else {
        out += "[covered: " + s.kind + "]";
      }
      pos = s.end;
    });
    out += doc.body.slice(pos);
    return out;
  }

  // ---------- the open classifier ----------
  // The known kinds have deep, specific rules below. But the
  // classifier is OPEN, not a closed switch (Jimmy design ruling,
  // Nov 13, 2026: the kinds in the brief were examples in general).
  // A document with a known kind keeps it. A document without one is
  // matched against plain keyword hints, and if nothing matches it
  // is classified "general" and filed on the general holding shelf.
  // Nothing is ever refused a read.
  var KNOWN_KINDS = ["medicare", "irs", "vet", "auto", "utility", "receipt"];

  function classifyDocument(doc) {
    if (KNOWN_KINDS.indexOf(doc.kind) >= 0) {
      return { kind: doc.kind, shelf: doc.shelf || D.GENERAL_SHELF };
    }
    var text = ((doc.subject || "") + "\n" + (doc.body || "")).toLowerCase();
    var hints = [
      { kind: "medicare", shelf: "Letters & Deadlines", words: ["medicare", "summary notice"] },
      { kind: "irs", shelf: "Letters & Deadlines", words: ["internal revenue", "cp2000", "form 1040", "tax return"] },
      { kind: "vet", shelf: "Pets", words: ["vaccination", "veterinary", "animal clinic", "rabies"] },
      { kind: "auto", shelf: "Vehicles", words: ["oil change", "odometer", "service receipt", "tire rotation"] },
      { kind: "utility", shelf: "Money", words: ["utility", "kwh", "electric bill"] },
      { kind: "receipt", shelf: "Money", words: ["receipt", "total charged", "order #"] }
    ];
    for (var i = 0; i < hints.length; i++) {
      for (var j = 0; j < hints[i].words.length; j++) {
        if (text.indexOf(hints[i].words[j]) >= 0) {
          return { kind: hints[i].kind, shelf: doc.shelf || hints[i].shelf };
        }
      }
    }
    return { kind: "general", shelf: D.GENERAL_SHELF };
  }

  // ---------- 3. the rule-based extractor ----------

  // Returns { typeLabel, fields: [{label, value}], keyDates:
  // [{label, dateISO, dateText, calendarTitle}] }.
  // Key dates are the ones that belong on the calendar.
  function extractFields(doc) {
    var text = doc.body;
    var kind = classifyDocument(doc).kind;
    var knownKind = KNOWN_KINDS.indexOf(kind) >= 0;
    var fields = [];
    var keyDates = [];

    function field(label, value) {
      if (value) fields.push({ label: label, value: value });
    }
    function keyDate(label, date, calendarTitle) {
      if (date) {
        keyDates.push({
          label: label,
          dateISO: D.isoDay(date),
          dateText: D.fmtLong(date),
          calendarTitle: calendarTitle
        });
      }
    }

    if (kind === "medicare") {
      field("Document type", "Medicare Summary Notice");
      var change = text.match(/will cover (\d+) home health aide visits per year instead of the (\d+)/i);
      if (change) field("Coverage change", "Home health aide visits: " + change[2] + " per year now, " + change[1] + " per year starting next year");
      field("New monthly premium", labeledAmount(text, "New monthly premium"));
      var deadline = labeledDate(text, "Response deadline");
      field("Response deadline", deadline ? D.fmtLong(deadline) : null);
      keyDate("Appeal response deadline", deadline, "Medicare appeal response deadline");
    }

    if (kind === "irs") {
      field("Document type", "IRS Notice CP2000 (proposed tax change)");
      var year = text.match(/your (\d{4}) Form 1040/i);
      field("Tax year", year ? year[1] : null);
      var income = text.match(/interest income of (\$[\d,]+)/i);
      field("Income reported by a payer", income ? income[1] : null);
      var proposedDue = labeledAmount(text, "Proposed amount due");
      field("Proposed amount due", proposedDue);
      var respBy = labeledDate(text, "Respond by");
      field("Respond by", respBy ? D.fmtLong(respBy) : null);
      keyDate("Response deadline", respBy,
        "IRS CP2000 response due" + (proposedDue ? " (proposed change, " + proposedDue + ")" : ""));
    }

    if (kind === "vet") {
      field("Document type", "Veterinary invoice and vaccination record");
      var pet = text.match(/Patient:\s*([A-Za-z]+)/);
      field("Pet", pet ? pet[1] : null);
      field("Total paid", labeledAmount(text, "Amount paid"));
      var given = labeledDate(text, "Date given");
      field("Rabies vaccination given", given ? D.fmtLong(given) : null);
      var yearsMatch = text.match(/Rabies vaccination \((\d+)-year\)/i);
      var years = yearsMatch ? parseInt(yearsMatch[1], 10) : 3;
      var nextDue = given ? D.addYears(given, years) : null;
      field("Rabies next due (computed: given + " + years + " years)", nextDue ? D.fmtLong(nextDue) : null);
      keyDate("Rabies vaccination next due", nextDue,
        pet ? pet[1] + ": rabies vaccination due" : "Rabies vaccination due");
    }

    if (kind === "auto") {
      field("Document type", "Auto service receipt");
      var vehicle = text.match(/Vehicle:\s*(.+)/);
      field("Vehicle", vehicle ? vehicle[1].trim() : null);
      field("Total", labeledAmount(text, "Total"));
      var serviceDate = labeledDate(text, "Date of service");
      field("Date of service", serviceDate ? D.fmtLong(serviceDate) : null);
      var odo = text.match(/Odometer:\s*([\d,]+) miles/i);
      field("Odometer at service", odo ? odo[1] + " miles" : null);
      var monthsMatch = text.match(/every (\d+) months/i);
      var months = monthsMatch ? parseInt(monthsMatch[1], 10) : 6;
      var nextDueDate = serviceDate ? D.addMonths(serviceDate, months) : null;
      field("Next service due (computed: service + " + months + " months)", nextDueDate ? D.fmtLong(nextDueDate) : null);
      var nextMiles = text.match(/Next service due at ([\d,]+) miles/i);
      field("Next service mileage", nextMiles ? nextMiles[1] + " miles" : null);
      keyDate("Next service due", nextDueDate,
        (vehicle ? vehicle[1].trim() : "Vehicle") + ": oil service due" +
        (nextMiles ? " (or at " + nextMiles[1] + " miles)" : ""));
    }

    if (kind === "utility") {
      field("Document type", "Utility bill (electric)");
      var amountDue = labeledAmount(text, "Amount due");
      field("Amount due", amountDue);
      var due = labeledDate(text, "Due date") || labeledDate(text, "Due");
      field("Due date", due ? D.fmtLong(due) : null);
      var usage = text.match(/Usage this period:\s*([\d,]+ kWh)/i);
      field("Usage", usage ? usage[1] : null);
      keyDate("Bill due date", due,
        "Electric bill due" + (amountDue ? " (" + amountDue + ")" : ""));
    }

    if (kind === "receipt") {
      field("Document type", "Receipt (arrived by text message)");
      // Vendor: the store name usually leads the message, in caps,
      // or follows the words "receipt from".
      var vendor = null;
      var fromMatch = text.match(/receipt from\s+([A-Z][A-Za-z0-9 &'.-]+)/i);
      var firstLine = text.split("\n")[0] || "";
      var leadMatch = firstLine.match(/^([A-Z][A-Za-z0-9 &'.-]{2,40}?)(?:\s*\(|\s*-|:|$)/);
      if (fromMatch) vendor = fromMatch[1].trim();
      else if (leadMatch) vendor = leadMatch[1].trim();
      field("Store", vendor);
      var order = text.match(/order\s*(?:number|no\.?)?\s*:?\s*#?\s*(\d{3,})/i);
      field("Order number", order ? order[1] : null);
      var total = labeledAmount(text, "Total charged") || labeledAmount(text, "Total") ||
        labeledAmount(text, "Amount charged") || labeledAmount(text, "Amount");
      field("Total", total);
      // Link receipts: the text often carries nothing but a link.
      // Say so honestly. The link is never opened by Life Jacket.
      var urls = text.match(/https?:\/\/[^\s]+/g) || [];
      if (urls.length) {
        field("Receipt link", urls[0]);
        field("Itemized detail", "The itemized detail lives behind that link. Life Jacket never opens links on its own; open it yourself if you want the item by item list.");
      }
      // Date: a date written in the text wins. If the text carries
      // no date, the date the item arrived is used, and labeled as
      // exactly that, never dressed up as a date from the receipt.
      var ownDates = allDatesIn(text);
      if (ownDates.length) {
        var receiptDate = parseLongDate(ownDates[0]);
        field("Date on the receipt", receiptDate ? D.fmtLong(receiptDate) : null);
        keyDate("Receipt date", receiptDate,
          (vendor || "Store") + " receipt" + (total ? " (" + total + ")" : ""));
      } else if (doc.receivedISO) {
        var arrived = new Date(doc.receivedISO + "T12:00:00");
        if (!isNaN(arrived.getTime())) {
          field("Date used", D.fmtLong(arrived) + " (the date this text arrived; the text itself carried no date)");
          keyDate("Date received", arrived,
            (vendor || "Store") + " receipt" + (total ? " (" + total + ")" : ""));
        }
      }
    }

    // The open path: a document with no specific rules still gets a
    // real extraction. Every amount is listed, and any line that
    // pairs a date with a due-style word still earns a calendar
    // entry, so an unknown document is kept, not dropped.
    if (!knownKind) {
      field("Document type", "General document (no specific rule matched; read with the general rules)");
      var amounts = text.match(/\$[\d,]+\.\d{2}/g) || [];
      if (amounts.length) field("Amounts found", amounts.join("  |  "));
      genericKeyDates(text, doc, keyDate);
    }

    var dates = allDatesIn(text);
    if (dates.length) field("Every date in the document", dates.join("  |  "));

    return {
      typeLabel: fields.length && fields[0].label === "Document type" ? fields[0].value : doc.kind,
      fields: fields,
      keyDates: keyDates
    };
  }

  // Helper for the general path: scan line by line for a date that
  // shares its line with a word like due, deadline, or expires.
  // If no line pairs a date with a cue word, fall back to the
  // earliest upcoming full date in the document, so a dated
  // document is never dropped from the calendar entirely.
  // (Fix added Nov 13, 2026 after independent verification caught
  // a general document whose only date sat in a "pick up by" line.)
  function genericKeyDates(text, doc, keyDate) {
    var cues = /(due|deadline|respond|reply by|expires|expiration|renew|appointment|pay by|pick up|return by|valid until|must)/i;
    var seenDates = {};
    var added = 0;
    text.split("\n").forEach(function (line) {
      var m = line.match(/[A-Z][a-z]+ \d{1,2}, \d{4}/) || line.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
      if (m && cues.test(line)) {
        var date = parseAnyDate(m[0]);
        if (date && !seenDates[D.isoDay(date)]) {
          seenDates[D.isoDay(date)] = true;
          added++;
          keyDate("Date to act by", date, doc.subject);
        }
      }
    });
    if (added === 0) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var best = null;
      allDatesIn(text).forEach(function (s) {
        var d = parseLongDate(s);
        if (d && d >= today && (!best || d < best)) best = d;
      });
      if (best) keyDate("Date mentioned", best, doc.subject);
    }
  }

  window.LJ_ENGINE = {
    readDocument: readDocument,
    findIdentifiers: findIdentifiers,
    buildCleanText: buildCleanText,
    extractFields: extractFields,
    classifyDocument: classifyDocument,
    KNOWN_KINDS: KNOWN_KINDS
  };
})();
