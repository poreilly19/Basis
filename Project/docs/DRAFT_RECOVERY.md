# Local draft recovery

Open **Portfolio → File → Recover drafts** to view, export or restore local drafts.

The library remains the saved source of truth. Recovery drafts are separate local
copies of edits that may not have reached that library. Restoring a draft creates
a new property with a unique “(recovered)” name; it never replaces an existing
property or silently changes the active model. The original recovery copy remains
available until the user removes it. Each readable candidate can also be exported directly
as a native `.basiscre` file, even when the library cannot accept a restored copy.

`src/recovery_store.js` supplies the recovery store. Each browser session keeps a
tab identifier and its workspace selection in `sessionStorage` (`basis.tab.v1`
and `basis.workspace.v1`). Each document also gets a fresh writer identifier.
Drafts use independent `localStorage` keys, `basis.draft.v1.<writer identifier>`.
Duplicating a tab can copy its session storage, but the new document still gets a
different writer and cannot replace the first document's draft. Reloading retains
the tab selection and leaves the previous document's recovery copy available.

The list scans only this origin's recovery-key prefix. It requires no host
database listing or account enumeration, and these drafts do not follow a user to
another browser or device. Stored model data is validated before restoration.
Malformed records remain visible as unreadable candidates so they can be removed
explicitly.

Successful library saves acknowledge only the matching JSON snapshot and property
from the current writer. A later draft typed while a save is pending remains in
recovery. Saving or closing one tab does not acknowledge another writer's draft.

Default write limits are 24 recovery records, 8 MiB of recovery keys and values,
and 2 MiB per record, measured as two bytes per JavaScript string character.
These are conservative preflight limits; the browser's actual storage quota may
be lower, and simultaneous tabs can both pass a capacity check. No unsaved draft
is automatically evicted. If capacity or browser storage prevents a write, the
last durable draft remains intact and the latest copy stays available in the
current page's memory. The recovery panel reports the problem so the user can
export before closing or explicitly remove an older candidate. Memory copies do
not survive a closed or crashed page.

## Migration

The previous shared `basis.model` and `basis.pw` keys are preserved unchanged.
Legacy workspace selection is a read-only fallback until a tab saves its own
session state. A valid legacy model is copied once to a named recovery candidate;
`basis.recovery.legacy.v1` records that copy so a deliberately removed candidate
is not recreated from the preserved old key. A later change to the legacy model
can produce another candidate. When quota prevents the copy, the old model is
still offered as a recovery candidate from its existing data.

Startup opens the saved library. Legacy or crashed drafts are offered explicitly
instead of being applied to an existing property's identifier. Keeping the legacy
keys does not make older application versions safe to run concurrently; those
versions still share their own original snapshot keys.

The Node suite `tests/recovery_store.test.cjs` covers tab isolation, duplicated
sessions, quota and capacity failures, exact save acknowledgement, safe legacy
migration, invalid records, and restoring a new property while preserving the
existing and active models.
