# Basis release-readiness checklist (not legal clearance)

## Native `.basiscre` serialization
- [x] Browser-facing property export and import
- [x] Browser-facing active portfolio export and import across scenarios
- [x] ZIP/JSON draft specification and sample fixtures
- [x] CRC and optional SHA-256 entries
- [x] Basic path traversal, size, duplicate and prototype-pollution checks
- [x] Unsupported future-schema rejection, limited prototype-v0 migration
- [x] 47 Node codec tests passing, including incomplete manifests, overlaps, header/descriptor mismatch and bounded DEFLATE
- [x] Browser in-memory Chromium initialization and native codec smoke check
- [x] Chromium HTTP property/portfolio download/upload automation with complete live model records
- [x] Targeted hostile-archive, size, overlap and wrong-header regressions
- [ ] Broader parser fuzzing and malicious corpus across supported browsers
- [x] Conservative record/date/ID validation and bounds on confirmed work-driving terms
- [x] Canonical engine parity, cancellable edit/sensitivity workers and scenario settings migration
- [ ] Complete financial reference constraints, complexity budgets and remaining synchronous calculations
- [ ] Test archive read compatibility in Safari, Firefox, Chrome and Edge
- [ ] Register/clear extension and associated marks for public launch

## CRE financial integrity
- [x] 21 independently defined targeted financial tests; sample baseline comparison in all three PV modes
- [x] Flat rent, unit equivalence, anniversary step, free rent, proration and simple NNN recovery
- [x] DCF, IRR, zero-rate/interest-only/amortizing debt, payoff limits, sensitivity parity
- [ ] Tenant rent step/abatement, expense recovery, turnover/vacancy golden cases
- [ ] IRR/NPV, terminal value, debt service, loan fees/regression parity
- [ ] Cross-version v6/v7 model-level output diff
- [x] Targeted portfolio roll-up, stable scenario settings and atomic migration/edit tests
- [ ] Broader multi-scenario stress and financial corpus
- [x] Aligned annual portfolio fixture; scenario membership, empty scenarios and exclusions preserved through native round trips
- [x] Exact monthly portfolio alignment, separate/joint exits and documented forward/trailing terminal NOI policy
- [x] Year-only calendar/fiscal recovery-stop golden cases and legacy round trips

## Product and IP
- [ ] Detailed competitor visual-expression audit; replace any distinctive copied patterns
- [ ] Verify independently developed math, UI and content provenance
- [x] Source-based dependency inventory with versions and audit leads
- [x] Official SheetJS 0.20.3 artifact, integrity pin, advisory-range check and notices
- [x] Production PDF reader/worker exact-size and SHA-256 verification before Blob execution
- [ ] Completed transitive license, vulnerability and provenance audit
- [ ] Security/privacy review for optional AI/document extraction features
- [ ] Choose public license only after owner approval and legal review
- [ ] Intellectual-property counsel review before public distribution

## Delivery and usability
- [x] Injected failed model/index writes, staged import cleanup and interrupted chunk preservation
- [x] Missing snapshot, malformed index and failed outgoing-save recovery cases
- [x] Async UI failure reporting; declined save and cancelled new-portfolio workflows
- [x] Atomic IndexedDB revision checks, concurrent-tab rejection and export/reload recovery
- [x] Per-document recovery drafts, quota preservation, explicit restoration and legacy snapshot migration
- [x] Atomic library actions, confirmed-membership guards and coherent native/legacy backup snapshots
- [x] Extraction ownership/cancellation, staged Apply and document/PDF read budgets
- [x] Validate saved indexes, owned model keys, headers/chunks and decoded models before publication
- [x] Independent writable memory recovery, retained-source reload and empty-library preservation
- [x] Paired PDF modules with deadlines, cancellation and late-resource cleanup
- [x] PDF UTF-8 text budgets and image-header dimension checks before decoding
- [x] Lazy spreadsheet loading with integrity, shared deadline/retry and retained export state
- [x] Real PDF dedicated workers and hash-verified PDF/XLSX integration fixtures
- [x] Legacy/native import destination guards and pre-read portfolio JSON size limits
- [x] Office 1904 date epochs, strict XML, nested Word tables and PowerPoint namespaces
- [x] Reject missing formula caches/input Excel errors; preserve cached zero/false/text
- [x] Custom workbook cache/error and shared-string reference validation with sheet/cell errors
- [x] Bound legacy inflation-index expansion before allocation, including aggregate sparse gaps
- [x] Equivalent template date-style XML preserves parsed dates and imported analysis starts
- [x] Reload discard confirmation survives equal/backwards clocks and exact-snapshot save races
- [x] Expanded date columns and previous-writer/current-reader workbook compatibility
- [ ] Atomic host cross-device conflict protection, snapshot restore/pruning and broader crash-point coverage
- [x] Prototype-path, rendered-name and spreadsheet-formula regressions
- [x] Bounded Office ZIP validation and workbook sparse-reference/cell-budget regressions
- [x] Mobile-sized Chromium mode navigation and keyboard command search
- [ ] Mobile Safari (hosted URL), keyboard, screen-reader testing
- [ ] Downloads/extension fallback in native app and hosted browsers
- [x] Pinned CI workflow and portable runners; local runner/launcher unit checks
- [ ] GitHub-hosted CI execution, Windows/Node 20 validation and release/versioning policy

Current validation: 599 Node cases, 13 Python runner cases, 76 ordinary Chromium workflows and 17 optional real-runtime workflows, plus source/syntax
checks. See [the validation snapshot](VALIDATION_0_7_9.md) for source identities,
[the review](CODE_REVIEW.md) and [financial validation](FINANCIAL_VALIDATION.md) for scope and
limits. Unchecked broad categories above remain incomplete even where a targeted
subset is checked. The native-module build synchronization is available via
`npm run build`; the engine and supporting modules are canonical, while most UI
remains embedded in the HTML. Some calculation paths still run synchronously.
