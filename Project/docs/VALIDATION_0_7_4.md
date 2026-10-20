# Validation snapshot — 0.7.4

Verified on 2026-10-19 12:59 UTC.

| Command | Result |
| --- | --- |
| `npm run build` | Eight canonical application modules and four-module embedded worker synchronized. |
| `npm test` | 335 cases pass, plus exact module/bundle and JavaScript syntax checks. |
| `npm run test:browser` | 48 Chromium workflows pass; no uncaught page errors. External HTTPS blocked. |

The Node run retains all 274 previous cases and adds 24 transactional library
actions, 11 portfolio snapshot exports, 11 document-reader and 15 extraction/apply
lifecycle checks. The browser run retains 36 previous workflows and adds six
library-action and six document-lifecycle workflows.

New failure injection covers overlapping property creation, incomplete scenario
copies, parent/child deletion rollback, changed confirmation membership, failed
rename/move/include/recalculation/member transfer, captured targets and cache
ownership around newer queued saves. Export checks reproduce a real mixed-index
cohort and reject it, while preserving fully loaded backups after quota/conflict
failures. Document tests cover stale file previews, read budgets, PDF/image cleanup,
pasted text, duplicate starts/apply clicks, Stop and late replies, target/page
changes, retry cancellation, invalid staged inputs and saving final Replace copies.

The extraction tests use a local fake service; no documents or model context were
sent to an external extraction service. They validate application orchestration,
not the live provider, PDF.js/SheetJS libraries or actual document interpretation.

## Source identities

| File/reference | SHA-256 |
| --- | --- |
| Current `app/index.html` | `4a67be3942e8e7e2b48e17c9ba6a664ce942cd2729af29460605d78b25e8f0f1` |
| Current `src/financial_engine.js` | `ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936` |
| Immutable reviewed 0.7.3 archive | `984d7402a237e133f9f570ea9f5a337ee53809560c8fe2cd9a0885e0bce2e4bc` |

The financial engine is byte-identical to the 0.7.3 archive. Existing independent
financial/portfolio/recovery fixtures and exact pre-extraction fingerprints still
pass. See [financial validation](FINANCIAL_VALIDATION.md) for historical sample
comparisons and limits; this update does not claim a fresh original-upload test.
The original source used for the cumulative patch was reconstructed by reversing
the delivered 0.7.3 patch against its reviewed archive. Its HTML hash matches the
recorded original source identity
`40c16952d92395ac15c8b0a40059fed35a9fc2c4a41e7d974c65b7fe3750b95c`.
This does not reproduce the original ZIP container bytes. Earlier archives remain
unchanged.

Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and Chromium
154.0.8037.57 on Linux. Browser tests use temporary loopback HTTP and isolated
storage. Other browser engines, live optional host APIs, direct-file navigation,
CDN library integrity/advisories and real binary Office/PDF workflows remain
unverified. Direct file navigation was blocked by managed policy in the prior
review; no policy bypass was attempted.

Host cross-device publication still lacks atomic server-side conditional writes.
Some model/metadata/export/portfolio calculations remain synchronous. Read/page
limits do not bound every decoded-image pixel or model complexity combination.
These limitations and prioritized next steps are documented in
[the review](CODE_REVIEW.md), [library actions](LIBRARY_ACTIONS.md),
[storage](STORAGE.md), [document intake](DOCUMENT_IMPORT.md) and
[dependencies](DEPENDENCIES.md).
