# Background calculations — 0.7.3

Normal model edits and the three on-demand sensitivity panels calculate in
browser workers. Each run uses an input snapshot. New edits invalidate the
previous generation immediately, terminate pending workers and prevent late
responses from publishing results. Opening a legacy pane can initialize optional
inputs without an edit event; an otherwise current model run detects this change
and starts again with the normalized snapshot.

Results clear while a changed model calculates. A successful run refreshes derived
pane content, deferring replacement of focused input controls until focus leaves
so uncommitted text and caret positions survive. The status control offers Cancel
and retry. Cancellation terminates the worker because a synchronous calculation
cannot process a cancellation message while running. Errors remain visible and
model inputs remain available for editing/export. There is no automatic fallback
to a blocking calculation when a worker fails.

The original 25-case value sensitivity, 15 market-leasing cases and six-run
value/IRR grids each have their own worker channel. They start explicitly, retain
the original ranges and formulas, publish complete results and provide Cancel.
Model changes invalidate their cached output. Rendering these panels runs no
financial calculations.

## Source and transport

`src/financial_engine.js` is canonical. `npm run build` synchronizes eight marked
application modules and an inert script with ID `basis-calculation-worker`.
That script contains the engine, scenario metadata helpers, native validator and
`src/calculation_worker.js`. The app creates a Blob worker from its text; no
external worker file, package or CDN is required. Build checks verify the exact
bundle, escaping of closing script tags, dependency order and script syntax.

Requests contain `{id, kind, model}`, where the ID is a positive safe integer and
kind is `property` or `portfolio`. Inputs are validated as model data; the protocol
does not execute supplied code. Responses contain `{id, result, elapsedMs}` or
`{id, error: {name, message, issues?}}`, with bounded error fields.

Structured cloning preserves typed arrays, shared array references and infinite
loan maturities. The worker removes only the root `payoff` function; the client
restores it using `debtPayoffAt(result.loans, index)`, which applies the original
payoff reduction without new rounding or approximation. JSON serialization of
results would lose these types and values and must not replace structured clone.

`src/calculation_client.js` handles one active request per client, defaults to a
30-second deadline, supports AbortSignal, ignores stale IDs/callbacks and
terminates a worker on supersession, cancellation, timeout or transport failure.
Successful workers can be reused. `src/calculation_ui.js` owns edit debounce,
current-generation publication, status and deferred pane refresh.

## Remaining synchronous work

Startup, property switching, undo and established Re-run integrations retain the
synchronous `recalc()` entry point. Library metadata generation, some exports and
portfolio panes/trends also still invoke the engine synchronously. Supporting a
portfolio worker request does not mean every portfolio UI path uses it. Move
these paths incrementally behind output fixtures and explicit loading states.

Autosave can commit model inputs while their worker is pending. In that case
summary metrics may be saved as null rather than paired with an old model's
results. The in-memory summary updates on completion; the next save persists it.
Inputs and subsequent recalculation remain intact.

A full browser with Blob workers is required for the background paths. Restricted
HTML previews or worker-blocking Content Security Policy can produce a visible
unavailable/error status. Serve the app over local HTTP as described in README.
The reviewed environment's Chromium policy blocked `file://` navigation, so direct
file opening was not verified. No policy bypass was attempted.

## Validation

Engine extraction fingerprints and independent financial fixtures establish
unchanged behavior on their defined cases. Worker protocol/client tests cover
cloning, payoff hydration, validation, deadlines, cancellation and stale replies.
Sensitivity integration tests compare all retained cases/formulas to direct
engine calculations. Chromium tests run the real embedded worker with external
HTTPS blocked, including cancel/retry, current-snapshot publication, pane
normalization, input preservation and sensitivity workflows. These checks do not
certify every underwriting combination or eliminate all main-thread blocking.
