# Opening and recovering a saved library

Startup validates the complete saved index before making it the live library.
Saved model headers, chunks and decoded inputs are validated before activation.
An invalid index or an unreadable selected property does not replace the original
saved data with a blank or demonstration model.

When startup cannot finish safely, the app creates a separate **Recovery
Workspace** in memory. It has fresh portfolio/scenario identifiers, no current
property, an empty model store and an independent initial revision. Recovery
draft restoration and new property imports can therefore work after startup
settles. These recovery properties are memory-only; export them before closing.
The original backend reference is retained separately for a later retry.

**Reload library** retries that original backend without directing temporary
recovery writes to it. It validates the index, model inputs and stored revision
before changing the active library. If the previously selected property is
unreadable, it can open another healthy saved property and reports the unavailable
records. Those records and their source data remain untouched. If no property can
be opened safely, the recovery workspace stays active. A malformed reload leaves
the existing live index, selection, caches and model unchanged.

Reloading from a recovery workspace containing new properties asks the user to
export before leaving it. Current edits or library changes made while a reload
is in progress stop that reload rather than being discarded. Startup likewise
keeps edits made while storage was loading as detached recovery input instead of
applying them to an existing saved property's identifier.

A starter property is created only when no saved index exists. An existing valid
library with no properties stays empty across reloads, including after its last
property was deliberately deleted. An empty saved index can receive a temporary
default portfolio for the controls without an automatic model write.

`tests/init_lifecycle.test.cjs` covers invalid-index isolation, writable recovery,
healthy-property retry, rejected refreshes, empty libraries and recovery requests
made before readiness. `tests/init_lifecycle_browser_test.py` verifies the empty
reload and source-preserving recovery flows in Chromium.
