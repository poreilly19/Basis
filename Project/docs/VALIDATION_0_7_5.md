# Validation snapshot — 0.7.5

Verified on 2026-10-19 20:00 UTC.

| Command | Result |
| --- | --- |
| `npm run build` | Eleven canonical application modules and four-module embedded worker synchronized. |
| `npm test` | 476 cases pass, plus exact module/bundle and JavaScript syntax checks. |
| `npm run test:browser` | 58 Chromium workflows pass in 53.370 seconds. External HTTPS blocked. |

The Node run retains the previous 335 cases and adds 16 PDF loader, 13 PDF
lifecycle/text-budget, seven image-header, 99 saved-workspace validation and six
initialization/recovery cases. The browser run retains 48 workflows and adds
seven PDF/image workflows and three initialization/recovery workflows.

Saved-workspace cases cover malformed indexes, memberships, IDs, owned model keys,
headers, chunks, invalid models, bounded expansion and an in-memory read racing a
replacement, ambiguous namespaces and deletion in both alias directions. Startup cases check independent writable memory recovery, original
source preservation, healthy-property retry, rejected reloads and deliberately
empty libraries. PDF cases exercise paired modules, class-style APIs, deadlines,
retry, abort/late results, render cancellation, bounded cleanup, canvas limits,
and independent raw/formatted UTF-8 page and cumulative document budgets. Image
cases check actual header dimensions before decoding or pass-through.

Chromium executes actual dynamic imports against intercepted synthetic PDF
modules and uses real PNG/JPEG/WebP canvas encoders/decoders. These checks do not
run the third-party PDF.js parser or establish CDN artifact integrity. Extraction
tests continue to use a local fake service; no documents or model context were
sent to an external extraction service. Office tests exercise bounded ZIP/XML
parsing and internal tables, rather than the live SheetJS library.

## Source identities

| File/reference | SHA-256 |
| --- | --- |
| Current `app/index.html` | `cc13c5ce752879a79e477928b7d3bf37a706f964c8ba000bbfff9c7ff0a4058c` |
| Current `src/financial_engine.js` | `ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936` |
| Immutable reviewed 0.7.4 archive | `1c618d40f11d8d55b754230b731db30ed85d1122a20311de69ef6f2795ca8a74` |

The financial engine is byte-identical to the 0.7.4 archive. Existing independent
financial/portfolio fixtures and exact pre-extraction fingerprints pass. No
underwriting formula changes are intended in this pass. See
[financial validation](FINANCIAL_VALIDATION.md) for historical original-upload
comparisons and their limits.

The original source for the cumulative patch is reconstructed by reversing the
delivered 0.7.4 patch against its reviewed archive. Its HTML matches the recorded
original identity `40c16952d92395ac15c8b0a40059fed35a9fc2c4a41e7d974c65b7fe3750b95c`.
This does not reconstruct the original ZIP container bytes or claim a fresh read
of the original upload. Earlier reviewed archives remain unchanged.

Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and Chromium
154.0.8037.57 on Linux. Browser tests use temporary loopback HTTP and isolated
storage. Node 20, other browser engines, live optional host APIs, direct-file
navigation and actual third-party Office/PDF parsing remain unverified.

Host cross-device publication still needs atomic server-side conditional writes.
Some calculation paths remain synchronous. PDF deadlines bound asynchronous waits;
they cannot preempt synchronous parser work or abort native dynamic imports.
Image dimension checks do not bound every animated-frame allocation. See
[the review and next steps](CODE_REVIEW.md), [PDF/image reading](PDF_LOADING.md),
[initialization recovery](INITIALIZATION_RECOVERY.md), [storage](STORAGE.md) and
[dependencies](DEPENDENCIES.md) for scope and remaining work.
