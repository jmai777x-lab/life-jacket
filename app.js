// Life Jacket - the app shell and screens.
//
// Vanilla JavaScript, no framework, no build step. This file owns:
//   - state (documents + per-document progress), saved to
//     localStorage so a refresh keeps the shelves and calendar
//   - the three views: Inbox, Shelves, Calendar
//   - the document pipeline: read on device, cover identifiers,
//     approve the exact payload, explain, file to a shelf
//   - the calendar entries and the .ics export
//
// Shelf names never appear as literals here: they come from the one
// shelf list in data.js, and each document's shelf comes from the
// open classifier in engine.js.

(function () {
  "use strict";

  var D = window.LJ_DATA;
  var E = window.LJ_ENGINE;
  var C = window.LJ_CLOUD;
  var S = window.LJ_SCAMCHECK;
  var STORE_KEY = "lifejacket.v1";

  // ---------- state ----------

  function freshPer() {
    return {
      stage: "new",        // new -> read -> approved -> filed
      uncovered: [],       // identifier ids the user chose to leave visible
      engineLabel: "",
      engineNote: "",
      explanation: null,
      sourceLabel: ""
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.docs && parsed.per) {
          // Least destructive seed update: an inbox saved before
          // the text message channel existed gains the new seeded
          // text receipt, appended once. Nothing already there is
          // touched, moved, or re-dated.
          var hasTextSeed = parsed.docs.some(function (d) { return d.id === "doc-text-receipt"; });
          if (!hasTextSeed) {
            var fresh = D.buildSeedDocuments(new Date());
            fresh.forEach(function (d) {
              if (d.id === "doc-text-receipt") {
                parsed.docs.push(d);
                parsed.per[d.id] = freshPer();
              }
            });
          }
          return parsed;
        }
      }
    } catch (err) { /* fall through to a fresh seed */ }
    var docs = D.buildSeedDocuments(new Date());
    var st = { docs: docs, per: {} };
    docs.forEach(function (d) { st.per[d.id] = freshPer(); });
    return st;
  }

  var state = loadState();
  var view = "inbox";        // inbox | doc | shelves | calendar
  var currentDocId = null;
  var idCache = {};          // docId -> identifier spans (deterministic)

  // ---------- screen share intake: session state ----------
  // Memory only. This is never written to localStorage, and it
  // never holds a raw captured page. A captured frame exists only
  // long enough to be read and covered on this device; what the
  // session keeps, page by page, is the covered text, the count of
  // things covered, and the kinds (labels like "Email address",
  // never the values). The live preview is a mirror of the user's
  // own screen so they can line a page up; nothing is kept from
  // the preview itself.
  var screenSession = null;  // { stream, pages: [{text, coveredCount, kinds}] }

  // ---------- message checker session state ----------
  // Memory only, like the screen session. A checked message is
  // not a document: it is never written to localStorage, never
  // added to the inbox, and the check itself makes no network
  // call. What is kept, while the inbox is on screen, is the
  // pasted text and the checker's result, so a re-render does
  // not lose them.
  var scamState = null;  // { text, result }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (err) {}
  }

  function docById(id) {
    for (var i = 0; i < state.docs.length; i++) {
      if (state.docs[i].id === id) return state.docs[i];
    }
    return null;
  }

  function per(doc) { return state.per[doc.id]; }

  // The document as the classifier sees it: known kinds keep their
  // shelf, unknown kinds land on the general holding shelf.
  function effectiveDoc(doc) {
    var c = E.classifyDocument(doc);
    var copy = {};
    for (var k in doc) copy[k] = doc[k];
    copy.kind = c.kind;
    copy.shelf = c.shelf;
    return copy;
  }

  function docShelf(doc) { return effectiveDoc(doc).shelf; }

  function identifiersFor(doc) {
    if (!idCache[doc.id]) idCache[doc.id] = E.findIdentifiers(doc);
    return idCache[doc.id];
  }

  function extractedFor(doc) { return E.extractFields(doc); }

  // ---------- small helpers ----------

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // "2026-12-04" shown the way a person says it: "December 4, 2026".
  function fmtReceived(iso) {
    var d = new Date(iso + "T12:00:00");
    return isNaN(d.getTime()) ? iso : D.fmtLong(d);
  }

  function daysRemaining(iso) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var d = new Date(iso + "T00:00:00");
    return Math.round((d.getTime() - t.getTime()) / 86400000);
  }

  function remainingText(n) {
    if (n < 0) return Math.abs(n) + (Math.abs(n) === 1 ? " day" : " days") + " ago";
    if (n === 0) return "today";
    if (n === 1) return "tomorrow";
    return "in " + n + " days";
  }

  function statusChip(doc) {
    var p = per(doc);
    if (p.stage === "new") return '<span class="chip status-new">Not read yet</span>';
    if (p.stage === "read") return '<span class="chip">Read, not filed</span>';
    if (p.stage === "approved") return '<span class="chip">Explained, not filed</span>';
    return '<span class="chip status-done">On the ' + esc(docShelf(doc)) + ' shelf</span>';
  }

  // ---------- calendar ----------

  function calendarEntries() {
    var out = [];
    state.docs.forEach(function (doc) {
      if (per(doc).stage !== "filed") return;
      extractedFor(doc).keyDates.forEach(function (kd) {
        out.push({
          dateISO: kd.dateISO,
          dateText: kd.dateText,
          title: kd.calendarTitle,
          shelf: docShelf(doc),
          docId: doc.id
        });
      });
    });
    out.sort(function (a, b) { return a.dateISO < b.dateISO ? -1 : 1; });
    return out;
  }

  function buildICS(entries) {
    function escIcs(s) {
      return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;")
        .replace(/,/g, "\\,").replace(/\n/g, "\\n");
    }
    var stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    var lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0",
      "PRODID:-//Life Jacket//Keeper//EN", "CALSCALE:GREGORIAN"
    ];
    entries.forEach(function (e, i) {
      lines.push("BEGIN:VEVENT");
      lines.push("UID:lifejacket-" + e.docId + "-" + i + "@lifejacket.local");
      lines.push("DTSTAMP:" + stamp);
      lines.push("DTSTART;VALUE=DATE:" + e.dateISO.replace(/-/g, ""));
      lines.push("SUMMARY:" + escIcs(e.title));
      lines.push("DESCRIPTION:" + escIcs("Kept by Life Jacket. Filed on the " + e.shelf + " shelf."));
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  // ---------- views ----------

  var appEl = document.getElementById("app");

  function render() {
    renderNav();
    if (view === "inbox") appEl.innerHTML = viewInbox();
    else if (view === "doc") appEl.innerHTML = viewDoc(docById(currentDocId));
    else if (view === "shelves") appEl.innerHTML = viewShelves();
    else if (view === "calendar") appEl.innerHTML = viewCalendar();
    window.scrollTo(0, view === "doc" ? window.__keepScroll || 0 : 0);
    window.__keepScroll = 0;
    mountScreenPreview();
  }

  function renderNav() {
    var buttons = document.querySelectorAll("#main-nav button");
    buttons.forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === view ||
        (view === "doc" && b.getAttribute("data-view") === "inbox"));
    });
    var unfiled = state.docs.filter(function (d) { return per(d).stage !== "filed"; }).length;
    var filed = state.docs.length - unfiled;
    document.getElementById("count-inbox").textContent = unfiled ? String(unfiled) : "";
    document.getElementById("count-shelves").textContent = filed ? String(filed) : "";
    var n = calendarEntries().length;
    document.getElementById("count-calendar").textContent = n ? String(n) : "";
  }

  function viewInbox() {
    var docs = state.docs.slice().sort(function (a, b) {
      return a.receivedISO < b.receivedISO ? 1 : -1;
    });
    var html = '<h2 class="view-title">Your inbox</h2>' +
      '<p class="view-sub">Everything that arrived, waiting to be kept. Open one and Life Jacket reads it here on this device first.</p>';
    html += scamCardHtml();
    html += '<div class="card intake"><h3 style="margin-top:0;font-size:24px;">Add from a text</h3>' +
      '<p class="step-note" style="color:var(--ink-soft);margin:0 0 12px;">Not everything arrives by email. Some receipts come as a text. On your phone, open the text, press and hold to copy it, then paste the whole message here. Got a screenshot instead? Type or paste what it says. It gets read on this device first, same as everything else.</p>' +
      '<textarea id="text-intake" rows="6" placeholder="Paste the text message here"></textarea>' +
      '<p style="margin:12px 0 0;"><button class="btn" data-action="add-text">Add it to the inbox</button></p></div>';
    html += screenCardHtml();
    docs.forEach(function (doc) {
      html += '<div class="card doc-card" data-action="open-doc" data-id="' + doc.id + '">' +
        '<div class="meta"><span class="from">' + esc(doc.sender) + '</span>' +
        '<span>Received ' + esc(fmtReceived(doc.receivedISO)) + '</span>' +
        (doc.channel ? '<span class="chip">' + esc(doc.channel) + '</span>' : '') +
        '<span class="chip shelf">' + esc(docShelf(doc)) + '</span>' + statusChip(doc) + '</div>' +
        '<h3>' + esc(doc.subject) + '</h3></div>';
    });
    return html;
  }

  function fieldsTable(extracted) {
    var html = '<table class="fields">';
    extracted.fields.forEach(function (f) {
      html += '<tr><td class="k">' + esc(f.label) + '</td><td>' + esc(f.value) + '</td></tr>';
    });
    return html + '</table>';
  }

  function renderRedacted(doc) {
    var p = per(doc);
    var uncovered = {};
    p.uncovered.forEach(function (id) { uncovered[id] = true; });
    var ids = identifiersFor(doc);
    var out = "";
    var pos = 0;
    ids.forEach(function (s) {
      out += esc(doc.body.slice(pos, s.start));
      if (uncovered[s.id]) {
        out += '<mark class="exposed">' + esc(s.text) + '</mark>';
      } else {
        out += '<mark class="covered">' + esc(s.kind) + '</mark>';
      }
      pos = s.end;
    });
    out += esc(doc.body.slice(pos));
    return out;
  }

  function viewDoc(doc) {
    if (!doc) return '<p>That document is no longer here.</p>';
    var p = per(doc);
    var eff = effectiveDoc(doc);
    var html = '<p><button class="btn secondary" data-action="nav" data-view="inbox">Back to inbox</button></p>';
    html += '<div class="card"><div class="meta" style="display:flex;gap:10px;flex-wrap:wrap;color:var(--ink-soft);font-size:16px;margin-bottom:6px;">' +
      '<span><strong>' + esc(doc.sender) + '</strong></span><span>Received ' + esc(fmtReceived(doc.receivedISO)) + '</span>' +
      (doc.channel ? '<span class="chip">' + esc(doc.channel) + '</span>' : '') +
      '<span class="chip shelf">' + esc(eff.shelf) + '</span>' + statusChip(doc) + '</div>' +
      '<h2 class="view-title" style="font-size:29px;">' + esc(doc.subject) + '</h2>' +
      '<pre class="doc-text">' + esc(doc.body) + '</pre></div>';

    // Step 1: the on-device read
    html += '<div class="step' + (p.stage === "new" ? " active" : "") + '">' +
      '<h3>Step 1. Read it here, on this device</h3>';
    if (p.stage === "new") {
      html += '<p class="step-note">The first read never leaves this device. If this browser has an on-device AI model, it does the read and says so. Otherwise plain local rules do it.</p>' +
        '<button class="btn" data-action="read" data-id="' + doc.id + '">Read it on this device</button>';
    } else {
      var extracted = extractedFor(doc);
      html += '<span class="engine-label">' + esc(p.engineLabel) + '</span>' +
        '<p class="step-note">' + esc(p.engineNote) + '</p>' + fieldsTable(extracted);
      if (extracted.keyDates.length) {
        html += '<p style="margin-top:12px;"><strong>Dates this document will put on your calendar once filed:</strong><br>' +
          extracted.keyDates.map(function (kd) {
            return esc(kd.label) + ': ' + esc(kd.dateText) + ' (' + remainingText(daysRemaining(kd.dateISO)) + ')';
          }).join('<br>') + '</p>';
      }
    }
    html += '</div>';

    if (p.stage !== "new") {
      // Step 2: redaction with the human review gate
      var ids = identifiersFor(doc);
      var coveredCount = ids.length - p.uncovered.length;
      html += '<div class="step"><h3>Step 2. Cover the private parts, here, before anything else</h3>';
      if (typeof doc.capturedCovered === "number") {
        // A screen-share document arrives already covered: the
        // covering happened while the pages were being read, and
        // only the covered pages were kept. Say so plainly, so the
        // empty second look below is not mistaken for the first.
        html += '<p class="step-note">These pages came from your screen. While they were being read, Life Jacket covered ' +
          doc.capturedCovered + (doc.capturedCovered === 1 ? ' name or number' : ' names and numbers') +
          (doc.capturedKinds && doc.capturedKinds.length ? ' (' + esc(doc.capturedKinds.join(", ")) + ')' : '') +
          ', and only the covered pages were kept. The original screen was never saved. Below is a second look at the kept pages.</p>';
      }
      html += '<p class="step-note">Life Jacket found ' + ids.length + ' identifier' + (ids.length === 1 ? '' : 's') +
        ' in this document. Covered items show as black bars. Untick a box only if you are sure that item may be seen.</p>' +
        '<pre class="doc-text">' + renderRedacted(doc) + '</pre>' +
        '<ul class="cover-list">';
      ids.forEach(function (s) {
        var covered = p.uncovered.indexOf(s.id) < 0;
        html += '<li><input type="checkbox" data-cover="' + s.id + '" data-doc="' + doc.id + '"' +
          (covered ? ' checked' : '') + (p.stage !== "read" ? ' disabled' : '') + '>' +
          '<span class="what">' + esc(s.kind) + '</span>' +
          '<span class="shows">' + esc(s.text.length > 46 ? s.text.slice(0, 46) + "..." : s.text) + '</span></li>';
      });
      html += '</ul><p class="step-note">' + coveredCount + ' of ' + ids.length + ' covered.</p></div>';

      // Step 3: the payload gate
      var clean = E.buildCleanText(doc, ids, p.uncovered);
      html += '<div class="step"><div class="gate"><h3>Exactly what would leave this device</h3>' +
        '<p>This is the whole of it, word for word. Nothing else is sent, and nothing is sent at all until you approve this exact text.</p>' +
        '<pre class="doc-text">' + esc(clean) + '</pre>';
      if (p.uncovered.length) {
        html += '<p class="gate-warn">Careful: ' + p.uncovered.length + ' identifier' +
          (p.uncovered.length === 1 ? ' is' : 's are') +
          ' uncovered above and would be included exactly as written.</p>';
      } else {
        html += '<p class="gate-warn">Every identifier found is covered.</p>';
      }
      if (p.stage === "read") {
        html += '<button class="btn" data-action="approve" data-id="' + doc.id + '">Approve this text and explain it</button>';
      } else {
        html += '<p><strong>Approved.</strong> The explanation below was written from exactly this text.</p>';
      }
      html += '</div></div>';

      // Step 4: the explanation
      if (p.explanation) {
        var ex = p.explanation;
        html += '<div class="step"><div class="explain"><h3>What this means</h3>' +
          '<p class="source">' + esc(p.sourceLabel) + '</p>' +
          '<p>' + esc(ex.whatItIs) + '</p>';
        if (ex.whatMatters && ex.whatMatters.length) {
          html += '<h4>What matters</h4><ul>' +
            ex.whatMatters.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>';
        }
        if (ex.deadlineLine) html += '<p class="deadline">' + esc(ex.deadlineLine) + '</p>';
        if (ex.steps && ex.steps.length) {
          html += '<h4>What to do next</h4><ul>' +
            ex.steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>';
        }
        if (ex.scam) {
          html += '<h4>' + esc(ex.scam.title) + '</h4><ul>' +
            ex.scam.points.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>';
        }
        if (p.stage === "approved") {
          html += '<p style="margin-top:18px;"><button class="btn teal" data-action="file" data-id="' + doc.id + '">' +
            'Put it on the ' + esc(eff.shelf) + ' shelf</button></p>';
        }
        if (p.stage === "filed") {
          var kd = extractedFor(doc).keyDates;
          html += '<div class="filed-banner">Filed on the ' + esc(eff.shelf) + ' shelf.' +
            (kd.length ? ' On your calendar: ' + kd.map(function (x) { return esc(x.calendarTitle) + ', ' + esc(x.dateText); }).join('; ') + '.' : '') +
            '</div>';
        }
        html += '</div></div>';
      }
    }
    return html;
  }

  function viewShelves() {
    var html = '<h2 class="view-title">Your shelves</h2>' +
      '<p class="view-sub">Everything Life Jacket is keeping for you, in its place.</p>';
    D.SHELVES.forEach(function (shelf) {
      var items = state.docs.filter(function (d) { return per(d).stage === "filed" && docShelf(d) === shelf.name; });
      html += '<div class="shelf-head"><h3>' + esc(shelf.name) + '</h3><span>' +
        items.length + (items.length === 1 ? ' document' : ' documents') + '</span></div>';
      if (!items.length) {
        html += '<p class="shelf-empty">Nothing here yet. ' + esc(shelf.note) + '.</p>';
      }
      items.forEach(function (doc) {
        var kd = extractedFor(doc).keyDates;
        html += '<div class="card shelf-item"><h3 style="margin:0 0 4px;font-size:22px;">' + esc(doc.subject) + '</h3>' +
          '<div style="color:var(--ink-soft);font-size:16px;">From ' + esc(doc.sender) + '</div>' +
          (kd.length ? '<div class="key-date">Key date: ' + esc(kd[0].dateText) + ' (' + remainingText(daysRemaining(kd[0].dateISO)) + ')</div>' : '') +
          '</div>';
      });
    });
    return html;
  }

  function calItemHtml(e) {
    var n = daysRemaining(e.dateISO);
    return '<div class="card cal-item' + (n <= 30 ? ' soon' : '') + '">' +
      '<div class="when"><div class="d">' + esc(e.dateText) + '</div>' +
      '<div class="r">' + remainingText(n) + '</div></div>' +
      '<div class="what">' + esc(e.title) + '<br><span style="color:var(--ink-soft);font-size:16px;">' +
      esc(e.shelf) + ' shelf</span></div></div>';
  }

  function viewCalendar() {
    var entries = calendarEntries();
    var soon = entries.filter(function (e) { return daysRemaining(e.dateISO) <= 60; });
    var html = '<h2 class="view-title">Your calendar</h2>' +
      '<p class="view-sub">Every date that matters from the documents you have filed, in one place.</p>';
    html += '<h3 style="font-size:26px;">Reminders: what is coming due</h3>';
    if (!entries.length) {
      html += '<p class="shelf-empty">Nothing on the calendar yet. File a document and its dates land here.</p>';
    } else if (!soon.length) {
      html += '<p class="shelf-empty">Nothing due in the next 60 days. The full list is below.</p>';
    } else {
      soon.forEach(function (e) { html += calItemHtml(e); });
    }
    if (entries.length) {
      html += '<h3 style="font-size:26px;margin-top:30px;">All dates</h3>';
      entries.forEach(function (e) { html += calItemHtml(e); });
      html += '<p style="margin-top:20px;"><button class="btn" data-action="export-ics">Export calendar (.ics)</button></p>' +
        '<p class="view-sub">The exported file imports into Samsung and Google Calendar, Apple Calendar, and Microsoft Outlook, so these dates roll into the calendar you already use.</p>';
    }
    return html;
  }

  // ---------- message checker ("Check a message") ----------

  function scamResultHtml() {
    if (!scamState) return "";
    var res = scamState.result;
    var html = '<div class="scam-result">' +
      '<h4 class="scam-verdict' + (res.verdict === "flags" ? " flags" : "") + '">' +
      esc(res.verdictText) + '</h4>';
    res.findings.forEach(function (f) {
      html += '<div class="scam-flag"><div class="lever">' + esc(f.leverName) + '</div>' +
        '<p style="margin:6px 0;">' + esc(f.explanation) + '</p>' +
        '<p class="snippet" style="margin:6px 0;">The words that tripped it: "' +
        esc(f.snippet) + '"</p></div>';
    });
    html += '<p class="step-note" style="color:var(--ink-soft);">' + esc(res.standingLine) + '</p>' +
      '<h4 style="margin:14px 0 6px;font-size:21px;">What to do instead</h4><ul>' +
      res.whatToDo.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>';
    return html;
  }

  function scamCardHtml() {
    var html = '<div class="card intake"><h3 style="margin-top:0;font-size:24px;">Check a message</h3>' +
      '<p class="step-note" style="color:var(--ink-soft);margin:0 0 12px;">Got a text, an email, a job offer, or an ad that feels off? Paste the whole message here. Life Jacket reads it on this device, looking for the tricks scammers use: pressure, secrecy, gift cards, borrowed names, and requests for passwords and codes. Nothing is sent anywhere, and the message is not kept.</p>' +
      '<textarea id="scam-intake" rows="6" placeholder="Paste the message here">' +
      (scamState ? esc(scamState.text) : "") + '</textarea>' +
      '<p style="margin:12px 0 0;"><button class="btn" data-action="check-message">Check this message</button></p>';
    html += scamResultHtml();
    return html + '</div>';
  }

  // ---------- screen share intake ----------

  function screenSupported() {
    return !!(navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === "function");
  }

  function setScreenStatus(msg) {
    var el = document.getElementById("screen-status");
    if (el) el.textContent = msg;
  }

  // render() rebuilds the inbox HTML, which replaces the preview
  // element, so after every render the stream has to be handed to
  // the new element. The stream itself is untouched by rendering.
  function mountScreenPreview() {
    var video = document.getElementById("screen-preview");
    if (video && screenSession && screenSession.stream) {
      if (video.srcObject !== screenSession.stream) {
        video.srcObject = screenSession.stream;
        var p = video.play();
        if (p && typeof p.catch === "function") p.catch(function () {});
      }
    }
  }

  function screenPagesHtml() {
    if (!screenSession || !screenSession.pages.length) return "";
    var html = '<h4 style="margin:14px 0 6px;">Pages captured so far: ' +
      screenSession.pages.length + '</h4>';
    screenSession.pages.forEach(function (pg, i) {
      html += '<div class="screen-page"><p class="step-note" style="margin:0 0 6px;">Page ' + (i + 1) +
        ': ' + pg.coveredCount + (pg.coveredCount === 1 ? ' name or number' : ' names and numbers') +
        ' covered before this page was kept.</p>' +
        '<pre class="doc-text">' + esc(pg.text) + '</pre></div>';
    });
    html += '<p style="margin:12px 0 0;"><button class="btn teal" data-action="screen-finish">Add these pages to my inbox</button> ' +
      '<button class="btn secondary" data-action="screen-discard">Throw these pages away</button></p>';
    return html;
  }

  function screenCardHtml() {
    var html = '<div class="card intake"><h3 style="margin-top:0;font-size:24px;">Read my screen</h3>';
    if (!screenSupported()) {
      html += '<p class="step-note" style="color:var(--ink-soft);margin:0;">This browser cannot share a screen with Life Jacket. Screen sharing needs a recent Chrome, opened from a secure address (https), the way Life Jacket is normally opened.</p>';
      return html + '</div>';
    }
    html += '<p class="step-note" style="color:var(--ink-soft);margin:0 0 12px;">Reading something in your email, or on a website? Show it to Life Jacket instead of copying it out. You pick what to share: one browser tab, one window, or the whole screen. Life Jacket never sees anything you did not pick.</p>' +
      '<p class="step-note" style="color:var(--ink-soft);margin:0 0 12px;">When you capture a page, Life Jacket reads the words here on this device and covers names, numbers, and addresses BEFORE the page is shown here, kept, or sent anywhere. Only the covered page is ever kept; the original screen is never saved. The scam check reads everything on the pages you capture, ads and pop-ups included, the same as it reads everything else.</p>';
    if (!screenSession) {
      html += '<p style="margin:0;"><button class="btn" data-action="screen-start">Share my screen</button></p>';
    } else if (screenSession.stream) {
      html += '<video id="screen-preview" class="screen-preview" autoplay muted playsinline></video>' +
        '<p class="step-note" style="margin:10px 0;">This preview only mirrors your own screen back at you, so you can line the page up. Nothing is kept from the preview. Line up the page, then capture it. For a long email or page, scroll and capture again; the captures become the pages of one document.</p>' +
        '<p style="margin:0;"><button class="btn" data-action="screen-capture">Capture this page</button> ' +
        '<button class="btn secondary" data-action="screen-stop">Stop sharing</button></p>';
    } else {
      html += '<p class="step-note" style="margin:0 0 10px;">Sharing has stopped. The pages you captured are still here, below.</p>' +
        '<p style="margin:0;"><button class="btn" data-action="screen-start">Share my screen again</button></p>';
    }
    html += '<p class="screen-status" id="screen-status"></p>';
    html += '<div id="screen-pages">' + screenPagesHtml() + '</div>';
    return html + '</div>';
  }

  // Update only the captured-pages part of the card, so capturing
  // a page never disturbs the live preview by rebuilding the view.
  function refreshScreenCard() {
    var holder = document.getElementById("screen-pages");
    if (holder) holder.innerHTML = screenPagesHtml();
  }

  // Read the words off one captured frame, here on the device.
  // Two built-in readers are tried, in order: the browser's own
  // text detector (the Shape Detection API), then Chrome's
  // on-device model (Gemini Nano) shown the picture itself.
  // Returns { text, reader } or null when neither reader answers.
  async function ocrFrame(canvas) {
    if (typeof window.TextDetector === "function") {
      try {
        var detector = new window.TextDetector();
        var blocks = await detector.detect(canvas);
        var lines = (blocks || []).map(function (b) {
          return String(b.rawValue || b.text || "").trim();
        }).filter(Boolean);
        if (lines.length) {
          return { text: lines.join("\n"), reader: "this browser's built-in text reader" };
        }
      } catch (err) { /* fall through to the on-device model */ }
    }
    var LM = window.LanguageModel ||
      (window.ai && window.ai.languageModel) || null;
    if (LM) {
      var attempt = (async function () {
        try {
          if (typeof LM.availability === "function") {
            var avail = await LM.availability();
            if (avail === "unavailable" || avail === "no") return null;
          }
          var session = await LM.create();
          var reply = await session.prompt([{
            role: "user",
            content: [
              { type: "text", value: "Copy out every word you can read in this picture, top to bottom, one line at a time. Add nothing, explain nothing, leave no words out." },
              { type: "image", value: canvas }
            ]
          }]);
          if (session && typeof session.destroy === "function") session.destroy();
          return typeof reply === "string" && reply.trim()
            ? { text: reply.trim(), reader: "Gemini Nano on this device" } : null;
        } catch (err) {
          return null;
        }
      })();
      var timeout = new Promise(function (resolve) {
        setTimeout(function () { resolve(null); }, 20000);
      });
      var viaNano = await Promise.race([attempt, timeout]);
      if (viaNano) return viaNano;
    }
    return null;
  }

  async function doScreenStart(btn) {
    btn.disabled = true;
    var stream = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch (err) {
      // The picker was closed, or the browser refused. Nothing
      // was seen and nothing was kept.
      btn.disabled = false;
      setScreenStatus("Sharing did not start. Nothing was seen and nothing was kept. If you want to try again, tap the share button and pick what to show.");
      return;
    }
    if (!screenSession) screenSession = { stream: null, pages: [] };
    screenSession.stream = stream;
    var track = stream.getVideoTracks()[0];
    if (track) track.addEventListener("ended", onScreenStreamEnded);
    render();
  }

  function onScreenStreamEnded() {
    // The user stopped the share from the browser's own controls.
    // The stream is gone; the captured pages stay.
    if (!screenSession || !screenSession.stream) return;
    screenSession.stream = null;
    if (view === "inbox") render();
  }

  function stopScreenStream() {
    if (screenSession && screenSession.stream) {
      screenSession.stream.getTracks().forEach(function (t) { t.stop(); });
      screenSession.stream = null;
    }
  }

  async function doScreenCapture(btn) {
    var video = document.getElementById("screen-preview");
    if (!screenSession || !screenSession.stream || !video || !video.videoWidth) {
      setScreenStatus("The preview is not ready yet. Give it a second, then capture again.");
      return;
    }
    btn.disabled = true;
    setScreenStatus("Reading this page here on this device...");
    // The frame is drawn to a canvas that lives only for this
    // capture. It is never shown, never saved, and never sent:
    // the words are read off it, the covering happens, and the
    // canvas is thrown away. What is kept is the covered text.
    var canvas = document.createElement("canvas");
    var scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    var read = await ocrFrame(canvas);
    canvas.width = 0;
    canvas.height = 0;   // release the frame
    if (!read) {
      setScreenStatus("No words could be read off that page here on this device, so nothing was captured and nothing was kept. If the words are small, make them bigger on the screen and capture again. Anything you can copy can also go in the paste box above.");
      btn.disabled = false;
      return;
    }
    // Cover BEFORE anything else happens to this page: the same
    // redaction engine and the same detectors as every other
    // intake, with everything covered. The raw words end here.
    var tempDoc = { body: read.text, nameVariants: [] };
    var found = E.findIdentifiers(tempDoc);
    var coveredText = E.buildCleanText(tempDoc, found, []);
    var kinds = [];
    found.forEach(function (s) {
      if (kinds.indexOf(s.kind) < 0) kinds.push(s.kind);
    });
    screenSession.pages.push({
      text: coveredText,
      coveredCount: found.length,
      kinds: kinds
    });
    refreshScreenCard();
    setScreenStatus("Page " + screenSession.pages.length + " captured, read by " + read.reader + ". " +
      found.length + (found.length === 1 ? " name or number was" : " names and numbers were") +
      " covered before this page was kept. Scroll for the next part, or add these pages to your inbox.");
    btn.disabled = false;
  }

  function doScreenFinish() {
    if (!screenSession || !screenSession.pages.length) return;
    var pages = screenSession.pages;
    var body = pages.map(function (p) { return p.text; }).join("\n\n");
    var totalCovered = 0;
    var allKinds = [];
    pages.forEach(function (p) {
      totalCovered += p.coveredCount;
      p.kinds.forEach(function (k) {
        if (allKinds.indexOf(k) < 0) allKinds.push(k);
      });
    });
    var firstLine = body.split("\n").filter(function (l) { return l.trim(); })[0] ||
      "Something read from your screen";
    var newDoc = {
      id: "doc-screen-" + Date.now(),
      kind: "",
      channel: "Screen share",
      sender: "Your screen",
      subject: firstLine.length > 72 ? firstLine.slice(0, 72) + "..." : firstLine,
      receivedISO: D.isoDay(new Date()),
      nameVariants: [],
      capturedCovered: totalCovered,
      capturedKinds: allKinds,
      body: body
    };
    stopScreenStream();
    screenSession = null;
    state.docs.push(newDoc);
    state.per[newDoc.id] = freshPer();
    save();
    currentDocId = newDoc.id;
    view = "doc";
    render();
  }

  // ---------- actions ----------

  async function doRead(doc, btn) {
    btn.disabled = true;
    btn.textContent = "Reading...";
    var res = await E.readDocument(doc);
    var p = per(doc);
    p.stage = "read";
    p.engineLabel = res.engineLabel;
    p.engineNote = res.engineNote;
    save();
    render();
  }

  async function doApprove(doc, btn) {
    btn.disabled = true;
    btn.textContent = "Explaining...";
    var eff = effectiveDoc(doc);
    var ids = identifiersFor(doc);
    var clean = E.buildCleanText(doc, ids, per(doc).uncovered);
    var res = await C.cloudExplain(clean, eff, extractedFor(doc));
    var p = per(doc);
    p.explanation = res.explanation;
    p.sourceLabel = res.sourceLabel;
    p.stage = "approved";
    save();
    render();
  }

  function doExport() {
    var entries = calendarEntries();
    if (!entries.length) return;
    var blob = new Blob([buildICS(entries)], { type: "text/calendar" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "life-jacket-calendar.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-action]");
    if (!t) return;
    var action = t.getAttribute("data-action");
    if (action === "nav") {
      view = t.getAttribute("data-view");
      render();
    } else if (action === "open-doc") {
      currentDocId = t.getAttribute("data-id");
      view = "doc";
      render();
    } else if (action === "read") {
      doRead(docById(t.getAttribute("data-id")), t);
    } else if (action === "approve") {
      doApprove(docById(t.getAttribute("data-id")), t);
    } else if (action === "file") {
      var doc = docById(t.getAttribute("data-id"));
      per(doc).stage = "filed";
      save();
      render();
    } else if (action === "add-text") {
      var box = document.getElementById("text-intake");
      var pasted = box ? box.value.trim() : "";
      if (!pasted) { if (box) box.focus(); return; }
      var firstLine = pasted.split("\n").filter(function (l) { return l.trim(); })[0] || "Text message";
      var newDoc = {
        id: "doc-text-" + Date.now(),
        kind: "",
        channel: "Text message",
        sender: "Text message",
        subject: firstLine.length > 72 ? firstLine.slice(0, 72) + "..." : firstLine,
        receivedISO: D.isoDay(new Date()),
        nameVariants: [],
        body: pasted
      };
      state.docs.push(newDoc);
      state.per[newDoc.id] = freshPer();
      save();
      currentDocId = newDoc.id;
      view = "doc";
      render();
    } else if (action === "check-message") {
      var sbox = document.getElementById("scam-intake");
      var stext = sbox ? sbox.value.trim() : "";
      if (!stext) { if (sbox) sbox.focus(); return; }
      scamState = { text: stext, result: S.checkMessage(stext) };
      render();
    } else if (action === "screen-start") {
      doScreenStart(t);
    } else if (action === "screen-capture") {
      doScreenCapture(t);
    } else if (action === "screen-stop") {
      stopScreenStream();
      render();
    } else if (action === "screen-finish") {
      doScreenFinish();
    } else if (action === "screen-discard") {
      stopScreenStream();
      screenSession = null;
      render();
    } else if (action === "export-ics") {
      doExport();
    } else if (action === "reset-demo") {
      stopScreenStream();
      screenSession = null;
      scamState = null;
      try { localStorage.removeItem(STORE_KEY); } catch (err) {}
      state = loadState();
      idCache = {};
      view = "inbox";
      currentDocId = null;
      render();
    }
  });

  // The review gate: ticking a box covers or uncovers one identifier,
  // and the payload gate below re-renders to match, exactly.
  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (!t.hasAttribute || !t.hasAttribute("data-cover")) return;
    var doc = docById(t.getAttribute("data-doc"));
    if (!doc) return;
    var p = per(doc);
    var id = t.getAttribute("data-cover");
    var idx = p.uncovered.indexOf(id);
    if (t.checked && idx >= 0) p.uncovered.splice(idx, 1);       // cover it
    if (!t.checked && idx < 0) p.uncovered.push(id);              // uncover it
    save();
    window.__keepScroll = window.scrollY;
    render();
  });

  save();
  render();
})();
