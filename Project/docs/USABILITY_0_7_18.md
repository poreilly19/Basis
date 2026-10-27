# Guided underwriting workflows — 0.7.18

The seven changes from the October 24 review are implemented in the local project.
The main path is Create Property → Enter or Import Inputs → Model Checks → Results
→ Export. Existing navigation remains available for experienced users.

1. **Property setup.** New Property asks for name/address, type, rentable SF, analysis
   start and a 1–40-year hold, then offers manual leases or documents. The existing
   property page has editable basics, a correct months display, Continue to Rent
   Roll and Advanced Property Settings for the remaining inputs.
2. **Lease editing.** Lease Basics opens first with name, suite, SF, dates, rent unit,
   rent and recovery structure. Lease Details holds classifications and alternate
   term entry; options and other specialist fields remain in their sections.
   Previous/Next uses the visible filtered tenants, commits valid edits, blocks an
   invalid amount and preserves section/scroll context.
3. **Document review.** Upload Lease / Rent Roll and Upload Operating Statement open
   the same intake workflow in the current property/scenario and preselect relevant
   extracted item types. Conflicts and automated checks appear before proposed
   values. Review Tenant Fields allows Accept, Keep Current or Correct; dependent
   rent amount/unit/escalation/schedule values share one acceptance decision.
   The preview uses the same prepared model as Apply, explains annual-to-per-SF
   normalization and displays units. View Source shows uploaded page text or
   validated scan images beside the review on desktop. Missing evidence is explicit.
   Contextual Apply returns to highlighted tenant/expense rows. AI setup is
   session-only and extraction still requires an explicit request and reviewed Apply.
4. **Model Checks.** Summary and Insights → Audit Reports expose separate Errors,
   Warnings and Items to Confirm. Structured record IDs route individual findings
   to the appropriate input, including duplicate tenant names. Aggregate findings
   open the relevant input page. Return to Model Checks shows recalculated findings.
   Passing checks does not establish that all math, assumptions or source data are
   independently verified.
5. **Less scrolling.** Essentials fits the tested 1280 × 720 rent-roll viewport;
   tenant identity remains sticky in wider views. All Columns and column settings
   remain available. Property bulk actions appear only after selection; scenario
   actions sit beside the selector. Reports have local pinned/recent shortcuts,
   with the complete report navigation retained. Longer noncritical help is folded.
6. **Save and share.** Saved status identifies browser or host storage and saved
   time; pending, unsaved, conflict and failure states remain visible. Export / Backup
   distinguishes editable native backup, Excel workbook, legacy JSON and current
   report CSV. Full models contain editable assumptions; results-only exports contain
   calculated outputs. A declined/failed download does not produce export success.
7. **Startup.** Start Basis.cmd finds the app relative to itself, checks Python 3.10+,
   uses IPv4 loopback port 8765, opens the browser and reuses only a running instance
   with the same app fingerprint. It explains missing files/Python and occupied
   ports. The portable server is tested on Linux; native Windows verification is
   pending and has a dedicated CI test.

Browser storage belongs to the **exact browser origin**. If the previous workspace
used `http://localhost:8765/`, export its models there before moving to
`http://127.0.0.1:8765/`. Different ports, browsers and private windows also have
separate storage. A project ZIP contains application files, not your browser's
saved properties.

The expanded code review also fixes import precision and missing-area rent units;
see [findings and remaining priorities](CODE_REVIEW_0_7_18.md) and
[verification evidence](VALIDATION_0_7_18.md). Visual checks covered 1280 × 720 and
390 × 844 screens. This is implementation and heuristic review, not a measured
usability study; representative-user task timing remains a useful next step.
