# Transactional library actions

Use the **Portfolio → Home** ribbon for new/copy/move/delete and scenario actions.
Select properties in the grid first. **Portfolio → File** contains Reload Library,
Recover Drafts and Export / Backup.

Property adoption, copying, scenario creation, portfolio creation, renaming,
moving, inclusion changes, recalculation and deletion prepare a separate index
before saving. New model records and all required model payloads are submitted
through one queued `pwCommit` operation. The visible index, model caches, open
tabs and selections are updated only after that commit succeeds.

This removes two failure modes: another pending operation can no longer publish
a temporary property whose model has not been written, and a copied scenario
cannot retain only the first few properties after a later model write fails.
Portfolio and scenario deletion remove their parent records, confirmed child
records and model data in the same commit. Deletion does not create a replacement
blank property.

On IndexedDB, the revision check and index/model mutations share one transaction.
The in-memory backend publishes a staged map synchronously. The host document
backend retains the existing optimistic checks and immutable payload snapshots;
its API still does not provide a distributed transaction across simultaneous
remote writers.

## Captured intent and current edits

An action captures its target portfolio/scenario identifiers, selected source
records and current model JSON before awaiting a dialog or storage. Changing the
workspace while an action is pending does not redirect the action to a different
scenario. A parent deletion checks the exact confirmed child-ID set when its
queued action executes. If a background import, move or other action changed that
set, deletion stops and asks the user to review it again.

Actions that switch away from the current property can save its captured outgoing
snapshot in the same transaction. If a newer library revision already committed,
the old outgoing snapshot is omitted instead of overwriting that newer save.
Newer edits typed while the transaction is pending stay active. Automatic
activation is conditional on the original model and workspace context still
matching the captured intent.

Model cache writes carry a monotonically increasing local version. Publishing an
older library action cannot replace a newer cache snapshot already queued by an
autosave or property switch. A successful source save therefore remains the
version reopened later.

Embedded portfolio-member transfers also stage the source update and every new
member in one transaction. If the active model changes while the transfer is
pending, those active edits remain available instead of being replaced by the
captured source snapshot.

## Failure behavior and validation

A failed or stale library commit leaves the live index, caches, source models and
selection intact. The operation reports an error. Creation and copy dialogs reject
duplicate submissions while an asynchronous validator is pending; validator errors
remain visible in the dialog. Confirmation never applies to new child records
that arrived after the user was asked to approve a parent deletion.

`tests/library_actions.test.cjs` injects actual IndexedDB request failures and
interleaves queued actions. It covers temporary-record leaks, all-or-nothing
scenario copies, parent deletion rollback, changed confirmation membership,
captured targets, name allocation and preserving newer saved source inputs.
`tests/library_actions_browser_test.py` exercises the corresponding controls in
Chromium against the served application.
