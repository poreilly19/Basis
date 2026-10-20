# PDF and image reading — 0.7.8

The production PDF loader tries the existing approved 4.x pairs in order:
4.10.38, then 4.4.168. It does not upgrade PDF.js or restore the removed 3.11.174
classic-script fallback. [The integrity transport](../src/pdf_integrity.js)
fetches both artifacts as CORS response streams, with credentials omitted,
redirects rejected and the HTTP cache bypassed. Each stream must have its pinned
byte length and SHA-256 digest. Reads stop on excess bytes or chunk count;
short, malformed or hash-mismatched responses fail. Production pins are recorded
in that source and repeated in the [test-cache manifest](../tests/fixtures/runtime_dependencies.json); a regression test compares all four pins.

Neither artifact becomes a Blob module until both have verified. The transport
imports only the verified reader into the main window, validates its exact version
and API, and configures the matching verified worker Blob URL. It never imports
the worker module into the main window. PDF.js exports GlobalWorkerOptions as a
class; the validator supports that API shape as well as ordinary objects.

Concurrent documents share one in-flight load, with a ten-second deadline per
candidate pair covering fetch, verification and reader import. A failed pair
advances only to the other approved verified pair; there is no direct CDN import
or unverified URL fallback. Later requests can retry after failure. Loader
invalidation aborts pending verification and prevents late results from publishing.
Fetch and stream readers receive cancellation; dynamic imports and digest work
already started may finish, but cannot publish after cancellation or timeout.

Successful reader/worker Blob URLs remain valid for the transport's lifetime,
with at most two cached versions (four URLs). Loader invalidation and individual
document cleanup do not revoke URLs that another document may still need.
Failed or cancelled attempts revoke their uncommitted URLs. An owner that shares
an explicit transport must stop its PDF jobs before calling `transport.dispose()`;
disposal aborts pending verification and revokes all retained URLs. The default
app transport remains page-owned; this is not automatic per-document disposal.

## Deployment requirements

Verification requires native Web Crypto SHA-256 in a secure context: use HTTPS or
localhost. Fetch, readable response streams, AbortController and Blob module URLs
must also be available. If a Content Security Policy is deployed, it must permit
the cdnjs fetch origin through `connect-src`, Blob reader imports through
`script-src` and Blob workers through `worker-src`. The CDN must allow CORS.
If verification, fetching or reader import cannot run, loading fails recoverably
without switching to an unverified direct URL. Worker startup policy can trigger
the upstream local fallback described below. These are requirements to test on the
deployed policy, not a complete CSP configuration.

## Document lifecycle

Document reads own AbortControllers. Removing or clearing a document aborts its
pending PDF operation and cancels a render task when present. The defaults are:

| Operation | Deadline |
| --- | --- |
| Candidate fetch, verification and reader import | 10 seconds per pair |
| Waiting for the reader from a document | 25 seconds |
| Opening a PDF / starting its worker | 30 seconds |
| Getting a page or its text | 15 seconds |
| Rendering and encoding a preview | 20 seconds per stage |
| Best-effort PDF cleanup | 2 seconds |
| Overall queued document read | 120 seconds |

All waits observe late rejections without publishing stale results. Loading tasks
and PDF documents are destroyed on failure, timeout or abort. Late documents and
pages receive cleanup too. Page cleanup runs after text/render use, and canvas
backing dimensions are released after success or failure. A hanging destroy or
encoding callback cannot keep the caller waiting indefinitely. These deadlines
bound asynchronous waits; they cannot interrupt a browser operation that blocks
its event loop synchronously.

The existing 32 MiB PDF file and 300-page limits remain. Text extraction accepts
at most 200,000 items per page, 4 MiB of UTF-8 text per page and 32 MiB
per document. Independent cumulative counters check raw decoded strings before
sorting/concatenation and final formatted output, including discarded whitespace
and added separators. Invalid text positioning data fails recoverably. Preview canvases accept
at most four million pixels, and PDF.js receives a 40-megapixel image-size hint.
These guards do not certify every parser or renderer allocation.

## Image preflight

`src/image_safety.js` checks PNG IHDR, JPEG SOF, GIF logical-screen and WebP
VP8X/VP8/VP8L dimensions from at most the first 512 KiB. Images exceeding
40 megapixels or a 16,384-pixel edge fail before browser decoding or the existing
pass-through path. Actual content determines MIME type. Conversion rechecks
browser-decoded dimensions and closes its ImageBitmap afterward. JPEG files whose
dimensions occur beyond the bounded metadata window need a copy with less metadata.

Logical canvas dimensions do not bound every animation frame, codec allocation or
compressed-format behavior. Broader animation/resource testing remains work for a
release corpus.

## Validation scope

Unit tests use mocked modules, streams, PDF tasks, pages, renderers and timers.
Chromium checks serve synthetic modules on intercepted CDN fetches, exercising
actual SHA-256 verification, Blob imports and class APIs without fetching
third-party code. Same-size reader and worker tampering must prevent both modules
from executing; tests also exercise verified fallback, retry after a stalled fetch,
and URL lifetime through explicit disposal. PNG/JPEG/WebP conversion
uses the browser's real encoders/decoders; generated PNG/JPEG/WebP/GIF bytes also
exercise the header parser. No browser out-of-memory attempt was made.

The 0.7.6 pass fetched hash-recorded runtime artifacts and tagged license texts
for local smoke tests; those cache checks did not authenticate production imports.
The 0.7.8 transport now verifies each production artifact before execution.
Actual parser/render checks cover both existing 4.x versions with an original PDF,
including a dedicated Worker started from the verified Blob and reuse by a second
document. The app clears any stale host `pdfjsWorker` handler before opening.
PDF.js may still use its own local fallback if dedicated Worker startup fails;
that fallback can import the verified worker Blob into the main window. The app
does not enforce dedicated-only parsing, and deadlines cannot interrupt synchronous
work in a local fallback. A runtime worker error does not transparently retry a
document with another library version. No library code is bundled or upgraded by
this PDF change. Broad parser coverage and a complete dependency audit remain
open; see [runtime dependency evidence](RUNTIME_DEPENDENCY_TESTS.md) and
[the dependency inventory](DEPENDENCIES.md).
