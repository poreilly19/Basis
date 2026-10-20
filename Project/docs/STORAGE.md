# Storage integrity and conflict behavior — 0.7.9

The saved library index has an opaque revision. Queued writes compare the revision
loaded by the page before publishing changes. An older index without a revision
is compared by its full serialized contents and gains a revision on a successful
commit. Property snapshots, scenario metadata and unsaved local drafts have
distinct ownership and persistence rules.

| State | Location and purpose |
| --- | --- |
| Saved property models and library index | Browser IndexedDB or the optional host document adapter. The library is the committed source of truth. |
| Scenario valuation policy | Versioned `sc.settings` in the library index; shared by properties in that scenario. |
| Tab/workspace selection | `sessionStorage`, with an in-memory fallback when unavailable. |
| Unsaved recovery drafts | Independent origin-local `localStorage` keys per document writer; in-memory copy if a write fails. |
| Host index/model snapshots | Immutable host documents retained around remote publication; separate from local draft recovery. |
| Worker inputs/results | Transient calculation snapshots and derived outputs; they do not commit a model or acknowledge a recovery draft. |

## Saved-data validation

Library reads and commits validate index records, IDs, names, scenario membership,
optional settings and model-key ownership before accepting or changing saved data.
Portfolio and property IDs are unique within their collections; scenario IDs are
unique within a portfolio. Unknown JSON metadata is retained. A model key must
belong to its property and cannot alias another property's ordinary header key.
Property IDs cannot overlap another property's possible header/chunk namespace
(for example, `p` with `p_q` or `p_q_1`). Such ambiguous legacy data is rejected
without renaming IDs or overwriting source records. Ordinary generated IDs do not
use those separators. Cleanup also rejects chunks that alias a different property's
header. Validation does not repair malformed source data.

Stored model headers and chunks are checked before decoding. Legacy omitted
version, chunk count and encoding fields retain their defaults of version 1, one
chunk and JSON. Invalid present values, missing chunks, unsafe generations and
oversized text fail with a recoverable error. Encoded text is limited to 32 MiB;
decoded JSON is limited to 24 MiB, including streamed DEFLATE expansion and UTF-8
byte length. Decoded models validate before entering caches, the active model or
rollup objects, so a failed open preserves the previous active property.

## Browser IndexedDB

One read/write transaction checks the expected index revision and writes model
headers, chunks, the new index, and deletions. A mismatch aborts before publication.
Concurrent tabs therefore cannot silently replace a newer library or model with
an older page's snapshot. Interrupted or quota-failed transactions leave the
previous committed state intact. Header/chunk reads also use one transaction so a
concurrent replacement cannot remove parts during an in-progress read.

The in-memory library fallback follows the same revision check-and-publish
contract. It is not persistent and does not share data between browser pages.

On conflict, the current model remains editable in memory. Native property and
fully loaded portfolio exports remain available when autosave fails. **Reload library** asks
before discarding unsaved/conflicting edits, validates the fetched model, clears
obsolete caches and verifies the active model did not change during the fetch.
It does not merge edits. Reload treats the edit marker as dirty independently of
wall-clock ordering. A successful model commit clears that marker only when its
property and JSON snapshot match the current model; older, failed and unrelated
commits cannot acknowledge newer edits. Equal timestamps, a clock rollback and
a clock value of zero therefore do not skip the discard confirmation.
Recovery drafts remain separate candidates that can be
restored as new properties; export important edits before discarding them.

Native and legacy portfolio backups freeze scenario/property metadata, the active
model JSON and cached model JSON before collecting any remaining saved models.
Uncached models require the saved index revision to match the loaded library,
with another revision check after collection. A changed or unverifiable revision
fails the backup visibly instead of exporting mixed generations. Fully local or
cached backups remain possible after an existing save conflict; when uncached
models cannot be reconstructed safely, export the current property before
reloading the library. Property backup filenames use the captured model name.

The conflict check is intentionally at library scope: changes to different
properties can still require a reload after another page commits a newer index.
More granular merges need an explicit conflict policy. Close tabs running older
application versions when upgrading: their adapters do not enforce this protocol.

Library create/copy/rename/move/include/delete actions stage complete changes
before publication. Parent deletion commits its confirmed children in the same
transaction and rejects changed membership. See [LIBRARY_ACTIONS.md](LIBRARY_ACTIONS.md).

## Scenario metadata commits

Scenario settings reads never write the index or active property. Initialization
explicitly seeds each missing settings object from the first saved property in
that scenario's existing index order, or defaults for an empty scenario. It commits
only additive index metadata through the same revision check; property payloads
and their legacy portfolio fields are not rewritten.

Settings edits capture the intended portfolio/scenario, merge into the latest
queued index copy and publish live settings only after commit succeeds. A scenario
switch while a save is pending does not redirect the edit. Invalid values,
quota failures and stale revisions retain the prior policy. Native imports and
legacy portfolio JSON preserve explicit settings; older imports without metadata
seed from their first incoming model. See [SCENARIO_SETTINGS.md](SCENARIO_SETTINGS.md).

## Local unsaved draft recovery

Current workspace selection uses session keys `basis.tab.v1` and
`basis.workspace.v1`. A fresh writer identifier for every document owns its
`basis.draft.v1.<writer>` recovery key, so duplicated tabs and separate documents
cannot overwrite each other's drafts. The former shared `basis.model`/`basis.pw`
keys are preserved as read-only migration/fallback data in the normal new-store
path; they are not the current recovery ownership scheme.

Drafts are acknowledged only by a successful save of the exact JSON snapshot and
property from that writer. Later edits and other writers' drafts remain available.
Startup opens saved models rather than applying an old draft over a property ID.
Explicit restore validates the model and creates a separately named new property.

The recovery panel lists only this origin's draft-key prefix. It does not list host
account documents, and drafts do not follow the user across browsers/devices.
Default capacity checks allow 24 records, 8 MiB total and 2 MiB per record, measured
as two bytes per JavaScript string character. No unsaved draft is automatically
evicted. Quota/capacity failures retain the last durable copy and the newest copy
in the current page's memory; memory-only edits do not survive a closed/crashed
page. See [DRAFT_RECOVERY.md](DRAFT_RECOVERY.md) for migration and recovery limits.

## Host-provided document database

The existing host adapter exposes document get/set/delete without a documented
atomic transaction or compare-and-swap operation. It rejects revisions observed
to be stale before publication. New payloads use immutable generated `storageKey`
values, and `pwi_<revision>` index snapshots retain recovery material instead of
overwriting prior payloads while staging a save.

**Simultaneous remote index publications can still race.** Sequential checks do
not provide cross-device atomicity. The local recovery panel neither restores
these host snapshots nor makes remote publication atomic. There is no automatic
host snapshot-pruning or host snapshot-restore UI; authenticated recovery tools,
an explicit retention policy and server-side conditional publication remain next
steps. Use independent native exports as backups.

## Verification and remaining work

`tests/concurrency.test.cjs` covers independent contexts sharing transactional
IndexedDB behavior, simultaneous first writes, failed commits, older-index
migration, atomic chunk reads, refresh and backup. Workspace and scenario suites
exercise import preflight, metadata-only migration, failed/stale settings saves
and settings preservation across switches and exports. Recovery-store tests cover
writer isolation, duplicated sessions, exact save acknowledgement, migration,
quota/capacity failures and safe restore.

Browser suites exercise selected real-tab conflicts, recovery UI and scenario
ownership. Worker/client tests and the browser worker suite verify transient
calculation requests separately from saved data; see
[CALCULATION_WORKER.md](CALCULATION_WORKER.md) and [ENGINE.md](ENGINE.md).

Remaining storage work includes atomic host-side revision checks, authenticated
remote snapshot recovery, retention/pruning and additional browser/process-crash
tests. Local draft isolation and scenario settings migration are implemented;
their bounded recovery and compatibility limits are documented above.
