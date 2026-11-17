// Life Jacket - seeded sample inbox ("the flood").
//
// Every document here is FAKE sample data. The people are fictional,
// the numbers are invented, and no real person's information appears
// anywhere. The dates are computed relative to the day the app is
// first opened, so deadlines always land in the near future and the
// demo feels alive. Once seeded, the documents are stored in the
// browser (localStorage) so the dates stay stable across refreshes.

(function () {
  "use strict";

  // ----- small date helpers (also used by engine.js and app.js) -----

  function addDays(date, n) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + n);
    return d;
  }
  function addMonths(date, n) {
    var d = new Date(date.getTime());
    d.setMonth(d.getMonth() + n);
    return d;
  }
  function addYears(date, n) {
    var d = new Date(date.getTime());
    d.setFullYear(d.getFullYear() + n);
    return d;
  }
  var MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  // "December 4, 2026"
  function fmtLong(date) {
    return MONTHS[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
  }
  // "2026-12-04"
  function isoDay(date) {
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + m + "-" + d;
  }

  // ----- the six sample documents -----

  function buildSeedDocuments(today) {
    var medicareDeadline = addDays(today, 21);
    var irsDeadline = addDays(today, 16);
    var rabiesGiven = addDays(addYears(today, -3), 25); // due again in 25 days
    var oilServiceDate = addDays(addMonths(today, -6), 10); // due again in about 10 days
    var utilityDue = addDays(today, 9);
    var coverageStart = new Date(today.getFullYear() + 1, 0, 1);

    var docs = [
      {
        id: "doc-medicare",
        kind: "medicare",
        shelf: "Letters & Deadlines",
        sender: "Medicare Plan Notices",
        subject: "Medicare Summary Notice: a change to your home health coverage",
        receivedISO: isoDay(addDays(today, -2)),
        personName: "Margaret Ellison",
        nameVariants: ["Margaret Ellison", "MARGARET ELLISON"],
        body: [
          "MEDICARE SUMMARY NOTICE (sample document for demonstration)",
          "",
          "For: Margaret Ellison",
          "Medicare Number: 1EG4-TE5-MK72",
          "Date of birth: April 12, 1948",
          "Mailing address: 4821 Willow Creek Lane, Springfield, IL 62704",
          "Phone on file: (555) 014-2288",
          "Email on file: margaret.ellison48@examplemail.com",
          "",
          "Dear Margaret Ellison,",
          "",
          "This notice explains a change to your Medicare coverage. Starting " +
            fmtLong(coverageStart) + ", your plan will cover 12 home health aide visits " +
            "per year instead of the 20 visits per year it covers now. Your physical " +
            "therapy visits are not changing. Your new monthly premium will be $184.60.",
          "",
          "If you disagree with this change, you may ask for an appeal. Your request " +
            "must reach us by the response deadline below.",
          "",
          "Response deadline: " + fmtLong(medicareDeadline),
          "Reference number: 0093 4471 8820 5516",
          "",
          "Questions? Call us at 1-800-555-0143, Monday to Friday, 8 a.m. to 8 p.m.",
          "MARGARET ELLISON, please keep this notice with your health records."
        ].join("\n")
      },
      {
        id: "doc-irs",
        kind: "irs",
        shelf: "Letters & Deadlines",
        sender: "Internal Revenue Service (sample)",
        subject: "Notice CP2000: we propose a change to your 2024 tax return",
        receivedISO: isoDay(addDays(today, -4)),
        personName: "Daniel Okafor",
        nameVariants: ["Daniel Okafor", "DANIEL OKAFOR"],
        body: [
          "INTERNAL REVENUE SERVICE (sample notice for demonstration)",
          "Notice CP2000 - Proposed changes to your tax return",
          "",
          "Taxpayer: Daniel Okafor",
          "Social Security number: 305-44-7812",
          "Address on file: 7714 Cedar Hollow Drive, Austin, TX 78749",
          "Phone on file: (512) 555-0164",
          "Email on file: d.okafor.household@examplemail.com",
          "",
          "Dear Daniel Okafor,",
          "",
          "We received information from a payer that does not match the income " +
            "reported on your 2024 Form 1040. A bank reported interest income of " +
            "$1,912 that does not appear on your return. Based on this information, " +
            "we propose the following change:",
          "",
          "Proposed amount due: $1,284.00",
          "",
          "If you agree with this change, sign the response form and return it with " +
            "payment. If you do not agree, send an explanation with copies of any " +
            "records that support your position. This is not a bill. Do not send " +
            "payment until you have reviewed the notice.",
          "",
          "Respond by: " + fmtLong(irsDeadline),
          "Payment confirmation number: 6671209844552211",
          "",
          "Questions? Call 1-800-555-0199 or write to the address at the top of " +
            "this notice. DANIEL OKAFOR, keep this notice with your tax records."
        ].join("\n")
      },
      {
        id: "doc-vet",
        kind: "vet",
        shelf: "Pets",
        sender: "Riverside Animal Clinic",
        subject: "Visit summary and invoice for Biscuit",
        receivedISO: isoDay(addDays(today, -3)),
        personName: "Susan Park",
        nameVariants: ["Susan Park", "SUSAN PARK"],
        body: [
          "RIVERSIDE ANIMAL CLINIC",
          "1180 Meadowbrook Avenue, Springfield, IL 62704",
          "Invoice number: 00441782",
          "Visit date: " + fmtLong(addDays(today, -3)),
          "",
          "Client: Susan Park",
          "Client address: 29 Birchwood Court, Springfield, IL 62703",
          "Phone: (555) 902-3371",
          "Email: susan.park.pets@examplemail.com",
          "",
          "Patient: Biscuit, Canine, Beagle mix, 6 years, 24 lb",
          "",
          "Services at this visit:",
          "Wellness exam - $54.00",
          "Nail trim - $18.50",
          "",
          "Vaccination record on file:",
          "Rabies vaccination (3-year). Date given: " + fmtLong(rabiesGiven) + ". Lot RB-4471-B.",
          "No vaccine was due at this visit. Rabies protection lasts 3 years from " +
            "the date given.",
          "",
          "Total due: $72.50",
          "Amount paid: $72.50 (card 5412 7500 1234 8841)",
          "",
          "Thank you, Susan Park. Biscuit did great today."
        ].join("\n")
      },
      {
        id: "doc-auto",
        kind: "auto",
        shelf: "Vehicles",
        sender: "Precision Auto Care",
        subject: "Your service receipt: oil change and tire rotation",
        receivedISO: isoDay(addDays(oilServiceDate, 1)),
        personName: "Tom Delgado",
        nameVariants: ["Tom Delgado", "TOM DELGADO"],
        body: [
          "PRECISION AUTO CARE",
          "Service receipt 77120",
          "",
          "Date of service: " + fmtLong(oilServiceDate),
          "Customer: Tom Delgado",
          "Customer address: 905 Sandalwood Drive, Chattanooga, TN 37421",
          "Phone: (555) 733-9042",
          "Email: tom.delgado.auto@examplemail.com",
          "",
          "Vehicle: 2018 Toyota RAV4",
          "Odometer: 62,418 miles",
          "",
          "Work done:",
          "Full synthetic oil change, 5W-30, filter replaced",
          "Tire rotation",
          "Fluid top-off and 21-point check",
          "",
          "Total: $94.18",
          "Paid by card: 4021 7710 5564 9023",
          "",
          "Recommended service interval: every 6 months or 5,000 miles.",
          "Next service due at 67,418 miles.",
          "",
          "Thank you for your business, Tom Delgado."
        ].join("\n")
      },
      {
        id: "doc-utility",
        kind: "utility",
        shelf: "Money",
        sender: "Chattanooga Electric Cooperative (sample)",
        subject: "Your electric bill is ready: $142.37 due " + fmtLong(utilityDue),
        receivedISO: isoDay(addDays(today, -1)),
        personName: "Grace Nguyen",
        nameVariants: ["Grace Nguyen", "GRACE NGUYEN"],
        body: [
          "CHATTANOOGA ELECTRIC COOPERATIVE (sample bill for demonstration)",
          "",
          "Account number: 8812 0045 9917",
          "Customer: Grace Nguyen",
          "Service address: 1604 Fern Valley Road, Chattanooga, TN 37421",
          "Phone on file: (555) 628-4410",
          "Email on file: grace.nguyen.home@examplemail.com",
          "",
          "Dear Grace Nguyen,",
          "",
          "Here is your electric bill for this month.",
          "",
          "Amount due: $142.37",
          "Due date: " + fmtLong(utilityDue),
          "",
          "Usage this period: 1,084 kWh. If payment is not received by the due " +
            "date, a late fee of $6.00 will be added to your next bill. Your " +
            "previous balance was $0.00 and your last payment of $118.22 was " +
            "received with thanks.",
          "",
          "To pay, sign in to your account, call 1-800-555-0117, or mail a check " +
            "with your account number written on it. GRACE NGUYEN, please keep " +
            "this bill with your home records."
        ].join("\n")
      },
      {
        // A receipt that arrived by TEXT message, not email (Jimmy,
        // Nov 13, 2026: not all receipts go to email, some go to
        // text). The whole receipt is a short message plus a link;
        // the itemized detail lives behind the link. Store, short
        // code, and link are all invented for this demo.
        id: "doc-text-receipt",
        kind: "receipt",
        channel: "Text message",
        shelf: "Money",
        sender: "Text 88213 (sample short code)",
        subject: "Text receipt: Harbor Lane Market, $63.47",
        receivedISO: isoDay(addDays(today, -1)),
        nameVariants: [],
        body: [
          "HARBOR LANE MARKET (sample text receipt for demonstration)",
          "Thanks for shopping with us today.",
          "Your receipt for Order #7392 is ready here:",
          "https://receipts.example.com/r/xK9fT2qL7mZp4821",
          "Total charged: $63.47",
          "Groceries and household goods, paid today.",
          "Questions about this receipt? Call the store at (555) 210-8847."
        ].join("\n")
      }
    ];

    return docs;
  }

  // ----- the shelves -----
  // Shelf definitions live in this one list, and only here. Adding a
  // shelf to the product is a one-line addition to this list; the app
  // renders whatever it finds. The first five are the starting set
  // from the original design. "Everything Else" is the general
  // holding shelf: any document the classifier does not recognize
  // still gets read, extracted, filed here, and its dates still
  // reach the calendar. (Jimmy design ruling, Nov 13, 2026: the
  // document kinds and shelves in the brief were examples in
  // general, not a closed taxonomy.)
  var GENERAL_SHELF = "Everything Else";
  var SHELVES = [
    { name: "Letters & Deadlines", note: "Official letters and anything with a date you must answer by" },
    { name: "Money", note: "Bills, statements, and receipts about money" },
    { name: "Pets", note: "Vet records, vaccinations, and pet paperwork" },
    { name: "Vehicles", note: "Service receipts, registrations, and inspections" },
    { name: "Home", note: "House documents, warranties, and home services" },
    { name: GENERAL_SHELF, note: "Everything the keeper does not have a shelf for yet" }
  ];

  window.LJ_DATA = {
    SHELVES: SHELVES,
    GENERAL_SHELF: GENERAL_SHELF,
    buildSeedDocuments: buildSeedDocuments,
    addDays: addDays,
    addMonths: addMonths,
    addYears: addYears,
    fmtLong: fmtLong,
    isoDay: isoDay
  };
})();
