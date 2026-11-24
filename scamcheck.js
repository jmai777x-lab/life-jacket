// Life Jacket - the message checker ("Check a message").
//
// A deterministic, fully on-device reader for a pasted message: a
// text, an email, a job offer, an ad. It looks for the levers
// scammers pull (pressure, secrecy, payment rails no real sender
// demands, impersonation, requests for passwords and codes, ways
// back that do not match the claimed sender, job offers on a
// scammer's terms, prizes that cost money to claim) and reports
// the exact words that tripped each lever.
//
// Everything in this file is plain local rules. Nothing here sends
// data anywhere, and there is no model call: the same message
// always gets the same answer, with no network at all.
//
// THE VERDICT WORDING LAW (standing, non-negotiable): the result
// is "flags found" or "No flags found in this text". This checker
// never calls a message safe, legit, legitimate, or okay, and
// never certifies a message as fine. A message with no flags is a
// message whose words did not trip these rules, nothing more, and
// every result says so in plain words.

(function () {
  "use strict";

  // Shown on every result, flags or none.
  var STANDING_LINE =
    "Finding no flags is not a guarantee. Scammers change their words " +
    "all the time, and a message can be a trick without using any of " +
    "the words this checker watches for. If a message asks for money " +
    "or for private information, the careful move is always the same: " +
    "stop, and reach the person or the company the way you already " +
    "know how, not the way the message tells you to.";

  function cleanSnippet(raw) {
    var s = String(raw).replace(/\s+/g, " ").trim();
    if (s.length > 130) s = s.slice(0, 127) + "...";
    return s;
  }

  // A rule is either a RegExp (the match is the snippet) or a
  // function(text) that returns a snippet string or null. Rules run
  // in order; the first hit in a lever is the finding for that
  // lever, so each lever appears at most once in the results.

  var LEVERS = [
    {
      id: "urgency",
      name: "Pressure to act right now",
      explanation:
        "Scammers rush you so there is no time to think, or to ask " +
        "someone you trust. A real bank, agency, or company almost " +
        "never demands action within hours, and never threatens you " +
        "into moving fast.",
      rules: [
        /\bact (now|immediately|fast|quickly)\b/i,
        /\burgent\b(?!\s+care)/i,
        /\bwithin (the next )?\d+\s*(hours?|hrs?|minutes?|mins?)\b/i,
        /\b(today only|expires? (today|tonight|soon)|final (notice|warning|chance)|last chance|before it'?s too late|time is running out)\b/i,
        /\b(right now|immediately|as soon as possible)\b/i,
        /\b(your )?(account|card|service|coverage|benefits?|mailbox|number|computer|access)\b[^.!?\n]{0,25}\b(will be|is being|is about to be) (closed|suspended|locked|frozen|terminated|shut off|disconnected|deactivated|deleted)\b/i,
        /\b(arrest warrant|warrant for your arrest|warrant (has been|was) issued|legal action|lawsuit will be filed|officers? will (come|arrive)|police will)\b/i,
        /\brespond (now|immediately|today)\b/i
      ]
    },
    {
      id: "secrecy",
      name: "Told to keep it secret",
      explanation:
        "Scammers ask for secrecy so the people who would warn you " +
        "never hear about it. Real banks, real agencies, and real " +
        "family do not ask you to hide a money problem from everyone " +
        "you trust.",
      rules: [
        /\b(?:don'?t|do not) tell (anyone|anybody|your|them|him|her|mom|dad|mother|father|family|the bank)\b/i,
        /\bkeep (this|it|our conversation) (between us|a secret|secret|to yourself|confidential|private)\b/i,
        /\b(this is|keep this) confidential\b/i,
        /\btell no one\b/i,
        /\bno one (else )?(can|must|should) know\b/i,
        /\bstay on the (line|phone)\b/i,
        /\b(?:don'?t|do not) (hang up|talk to anyone)\b/i,
        /\b(?:don'?t|do not) mention (this|it)\b/i,
        /\bnot a word to anyone\b/i
      ]
    },
    {
      id: "payment-rail",
      name: "Asked to pay in a way real senders never demand",
      explanation:
        "Gift cards, wire transfers, and cryptocurrency are how " +
        "scammers get paid, because that money cannot be traced or " +
        "taken back. No real bank, agency, utility, or employer " +
        "collects a bill, a fine, a fee, or a tax that way.",
      rules: [
        /\bgift cards?\b[^.!?\n]{0,80}\b(pay|payment|fine|fees?|tax|taxes|debt|settle|owed?|scratch|read|numbers?|send|cover|resolve|provide|claim)\b/i,
        /\b(pay|payment|fine|fees?|tax|taxes|settle|scratch|read)\b[^.!?\n]{0,60}\bgift cards?\b/i,
        /\b(read|tell|give|send)( me)? the (numbers|digits|codes) (on|from|off) the (back of the )?cards?\b/i,
        /\b(wire transfer|wire the (money|funds|payment|amount)|western union|money ?gram)\b/i,
        /\b(bitcoin|btc|cryptocurrency|crypto)\b[^.!?\n]{0,60}\b(pay|payment|send|transfer|wallet|address|deposit)\b/i,
        /\b(pay|send|transfer|deposit)\b[^.!?\n]{0,50}\b(bitcoin|btc|cryptocurrency|crypto)\b/i,
        /\b(zelle|cash ?app|venmo)\b[^.!?\n]{0,70}\b(fine|fees?|tax|taxes|debt|bail|arrest|overdue|settle|owed?|release|avoid)\b/i,
        /\b(fine|fees?|tax|taxes|debt|bail|overdue|settle)\b[^.!?\n]{0,70}\b(zelle|cash ?app|venmo)\b/i
      ]
    },
    {
      id: "impersonation",
      name: "Claims to be someone you trust",
      explanation:
        "This message claims to come from an institution or a person " +
        "who would not reach you this way, or would not ask for what " +
        "this message asks. Scammers borrow the names of banks, " +
        "agencies, support desks, and grandchildren because borrowed " +
        "names are trusted.",
      rules: [
        /\bthis is (the )?(irs|internal revenue service|social security administration|ssa|medicare|fbi|federal trade commission)\b/i,
        /\b(irs|internal revenue service)\b[^.!?\n]{0,80}\b(owe|owed|arrest|warrant|lawsuit|legal|pay|audit|seized|suspend|debt)\b/i,
        /\b(owe|owed|arrest|warrant|pay|debt)\b[^.!?\n]{0,80}\b(irs|internal revenue service)\b/i,
        /\byour social security (number )?(will be|is being|has been) (suspended|cancelled|canceled|frozen|blocked)\b/i,
        /\b(microsoft|windows|apple|amazon|norton|mcafee|geek squad)\b[^.!?\n]{0,60}\b(support|security|technician|virus|infected|hacked|compromised)\b/i,
        /\b(tech support|technical support|computer support)\b/i,
        /\bvirus (detected|found|alert)\b/i,
        /\b(geek squad|norton|mcafee)\b[^.!?\n]{0,40}\b(subscription|renewed|renewal|charge|billing)\b/i,
        /\b(sheriff'?s office|police department|county sheriff|warrants division)\b/i,
        /\b(it'?s me|this is (your|me,? your)) (grandson|granddaughter|son|daughter|nephew|niece)\b/i,
        /\b(grandma|grandpa|grandmother|grandfather),? it'?s me\b/i,
        /\b(this is my new number|i (lost|broke|dropped) my phone|(?:don'?t|do not) call my (old|other) number|text (me|back) (at|on) this number)\b/i,
        function (text) {
          // A "fraud department" claim that also tells you to call
          // a number it supplies. A real fraud alert tells you to
          // call the number on the back of your card instead.
          if (!/\bfraud (department|dept|team|division)\b/i.test(text)) return null;
          var m = /\b(call|dial|contact|phone)\b[^.!?\n]{0,40}\b(this number|the number below|us now|us at|now at)\b/i.exec(text) ||
            /\bcall (us )?(now|immediately|right away)\b/i.exec(text);
          return m ? m[0] : null;
        },
        /\byour (boss|manager|ceo)\b[^.!?\n]{0,60}\b(gift cards?|urgent|secret|favor|quick task)\b/i
      ]
    },
    {
      id: "credential",
      name: "Asks for a password, a PIN, or a code",
      explanation:
        "A real bank, agency, or company never asks you to hand " +
        "over a password, a PIN, or a one-time code, not by text, " +
        "not by email, not on the phone. Anyone asking for one is " +
        "trying to get into your account.",
      rules: [
        /\b(verify|confirm|validate|update|re-?enter|unlock)\b[^.!?\n]{0,30}\byour (account|password|pin|credentials|identity|information|details|payment)\b/i,
        /\b(enter|type|input|provide|send|share|tell|give)\b[^.!?\n]{0,30}\b(your|the) (password|pin|one-time code|verification code|security code|access code)\b/i,
        /\b(read|send|text|tell|give|share)\b[^.!?\n]{0,25}\b(me )?(the|your) (code|pin|password)\b/i,
        /\b(reply|respond) (with|using) (the|your) (code|pin|password)\b/i,
        /\bwe (just )?sent you a code\b[^.!?\n]{0,60}\b(send|reply|enter|share|tell|read)\b/i,
        /\b(confirm|verify|provide|send|enter)\b[^.!?\n]{0,30}\b(social security|ssn)\b/i,
        /\bsign in (again )?to (verify|confirm|unlock|restore)\b/i,
        /\byour (account|password) (has been|was) (compromised|locked|suspended)\b[^.!?\n]{0,50}\b(verify|sign in|log in|enter)\b/i
      ]
    },
    {
      id: "contact-mismatch",
      name: "The way back to them does not match who they claim to be",
      explanation:
        "The message wants you to call a number it supplies, or tap " +
        "a shortened or look-alike link. The real phone number for " +
        "a bank is on the back of your card and on your statements, " +
        "and the real web address is printed there too, never inside " +
        "a surprise message.",
      rules: [
        /\b(bit\.ly|tinyurl\.com|t\.co\/|rb\.gy|goo\.gl|ow\.ly|is\.gd|cutt\.ly|shorturl\.at|tiny\.cc)\S*/i,
        /\b[a-z0-9-]*(chase|paypal|amazon|apple|irs|medicare|wells ?fargo|bank ?of ?america|netflix|venmo|zelle|microsoft)[a-z0-9-]*-[a-z0-9-]+\.(com|net|org|info|xyz|top|click|site|online)\b/i,
        /\b[a-z0-9-]*(secure|verify|login|account|update|alert)[a-z0-9-]*\.(xyz|top|click|info|site|online)\b/i,
        /\b[a-z0-9][a-z0-9-]*\.(xyz|top|click|info|site|online)\b/i,
        function (text) {
          // Claims an institution, then supplies its own number as
          // the way back. The number on the back of the card is
          // the honest version of this sentence and does not trip.
          if (!/\b(bank|irs|social security|medicare|amazon|microsoft|fraud|account|utility|irs)\b/i.test(text)) return null;
          var m = /\b(call|dial|contact)\b[^.!?\n]{0,35}\b(this number|the number below|us now at|us immediately)\b/i.exec(text);
          return m ? m[0] : null;
        },
        /\bclick (the |this )?link below\b/i,
        /\b(tap|click) (here|the link|this link)\b[^.!?\n]{0,40}\b(verify|confirm|unlock|restore|reactivate)\b/i
      ]
    },
    {
      id: "job-offer",
      name: "A job offer on a scammer's terms",
      explanation:
        "Real employers do not pay high wages for simple tasks, do " +
        "not send you a check to buy equipment, do not hire only " +
        "through a messaging app, and never charge you a fee to " +
        "start work.",
      rules: [
        function (text) {
          var jobCtx = /\b(job|position|role|hiring|hire|work from home|employment|tasks?|data entry|mystery shopper|onboarding|application|recruiting|equipment|home office)\b/i;
          if (!jobCtx.test(text)) return null;
          var pats = [
            /\bequipment\b[^.!?\n]{0,60}\bcheck\b/i,
            /\bcheck\b[^.!?\n]{0,60}\b(equipment|supplies|laptop|materials)\b/i,
            /\b(cash|deposit|mobile deposit)\b[^.!?\n]{0,30}\b(this|the|a) check\b/i,
            /\b(telegram|whatsapp)\b/i,
            /\b(starter kit|training|onboarding|equipment|start-up|startup|registration|application) fee\b/i,
            /\bpay (a |the )?(fee|deposit|charge)\b[^.!?\n]{0,50}\b(start|begin|training|onboarding)\b/i,
            /\bno (experience|interview) (needed|required|necessary)\b/i,
            /\bmystery shopper\b/i,
            /\breship/i
          ];
          for (var i = 0; i < pats.length; i++) {
            var m = pats[i].exec(text);
            if (m) return m[0];
          }
          // Pay that is too good for the work described: an hourly
          // rate of $30 or more, or daily earnings of $200 or more,
          // offered for simple tasks.
          var hourly = /\$\s?(\d{2,3})\s*(per|\/)\s*(hour|hr)\b/i.exec(text);
          if (hourly && parseInt(hourly[1], 10) >= 30) return hourly[0];
          var daily = /\$\s?([\d,]{3,})\s*(per|\/)\s*(day|week)\b/i.exec(text);
          if (daily) return daily[0];
          var monthly = /\$\s?([\d,]{4,})\s*(per|\/)\s*month\b/i.exec(text);
          if (monthly) return monthly[0];
          var earn = /\bearn\b[^.!?\n]{0,30}\$\s?([\d,]{3,})/i.exec(text);
          if (earn) return earn[0];
          return null;
        }
      ]
    },
    {
      id: "prize-fee",
      name: "A prize that costs money to claim",
      explanation:
        "A real prize never costs money to receive. If you must pay " +
        "a fee, a tax, or a shipping charge before a prize is " +
        "released, there is no prize.",
      rules: [
        function (text) {
          var prize = /\b(you (have )?won|winner|lottery|sweepstakes|jackpot|grand prize|your prize|prize money)\b/i.exec(text);
          if (!prize) return null;
          // The pay branch tolerates a decimal point inside an
          // amount ("pay the $4.95 shipping charge"): a period
          // between two digits is part of the amount, not the
          // end of a sentence.
          var cost = /\b(processing fee|claim fee|handling fee|release fee|booking fee|pay\w*\b(?:[^.!?\n]|\.(?=\d)){0,40}\b(fees?|tax|taxes|shipping|charges?|up front)|fees?\b[^.!?\n]{0,30}\b(claim|release|receive)|gift cards?|wire|taxes? (first|up front|before)|paid up front)\b/i.exec(text);
          if (!cost) return null;
          return prize[0] + " ... " + cost[0];
        }
      ]
    }
  ];

  function whatToDoFor(findings) {
    var ids = {};
    findings.forEach(function (f) { ids[f.lever] = true; });
    var steps = [];
    steps.push("Do not reply to the message, and do not tap any link or call any number in it.");
    if (ids["impersonation"] || ids["credential"] || ids["contact-mismatch"]) {
      steps.push("If it claims to be your bank, a company, or an agency, call the number on the back of your card or on your statement, or go to the office in person. That number is the real one.");
    }
    if (ids["impersonation"] || ids["secrecy"]) {
      steps.push("If it claims to be a family member in trouble, call that person on the number you already have saved, or call another family member who would know. Do not use a new number the message gives you.");
    }
    if (ids["payment-rail"]) {
      steps.push("Never pay a bill, a fine, a fee, or a tax with gift cards, a wire transfer, or cryptocurrency. Real organizations do not take payment that way, and that money cannot be gotten back.");
    }
    if (ids["job-offer"]) {
      steps.push("A real employer will not send you a check to buy equipment, will not charge you a fee to start, and will talk with you in person or on a real call, not only inside a messaging app.");
    }
    if (ids["prize-fee"]) {
      steps.push("A prize you must pay to receive is not a prize. Do not send money, gift cards, or card numbers to claim one.");
    }
    steps.push("When in doubt, show the message to a family member, or call your bank, before you do anything. Nothing real is lost by waiting an hour for a second pair of eyes.");
    return steps;
  }

  // The checker. Takes the pasted message text, returns:
  //   { findings: [{lever, leverName, explanation, snippet}],
  //     flagCount, verdict: "flags" | "none", verdictText,
  //     standingLine, whatToDo: [strings] }
  function checkMessage(text) {
    var body = String(text || "");
    var findings = [];
    LEVERS.forEach(function (lever) {
      for (var i = 0; i < lever.rules.length; i++) {
        var rule = lever.rules[i];
        var snippet = null;
        if (typeof rule === "function") {
          snippet = rule(body);
        } else {
          var m = rule.exec(body);
          if (m) snippet = m[0];
        }
        if (snippet) {
          findings.push({
            lever: lever.id,
            leverName: lever.name,
            explanation: lever.explanation,
            snippet: cleanSnippet(snippet)
          });
          break;
        }
      }
    });
    var flags = findings.length > 0;
    return {
      findings: findings,
      flagCount: findings.length,
      verdict: flags ? "flags" : "none",
      verdictText: flags
        ? "Life Jacket found " + findings.length + (findings.length === 1 ? " warning flag" : " warning flags") + " in this message."
        : "No flags found in this text.",
      standingLine: STANDING_LINE,
      whatToDo: whatToDoFor(findings)
    };
  }

  window.LJ_SCAMCHECK = {
    checkMessage: checkMessage,
    LEVERS: LEVERS.map(function (l) { return { id: l.id, name: l.name }; })
  };
})();
