# Document intake and preview safety — 0.7.9

File previews own a request generation: choosing another template/workbook/file,
dismissing a preview or opening it invalidates earlier asynchronous reads. A late
success or error cannot replace the newer filename/model. Clearing document intake
invalidates in-flight reads and queued files from that batch.

## Local limits

Before reading a file, intake permits at most 32 MiB for non-Office documents and
the existing 64 MiB Office ZIP allowance. It reserves a maximum of 128 MiB and
50 documents across concurrent batches. PDF processing accepts at most 300 pages
before asking for a page. Pasted text uses UTF-8 bytes and the same count/aggregate
limits; rejected pasted text stays in its editor. PDF and temporary image-bitmap
resources are released after processing, including failures.

These are read/allocation budgets, not proof that every compressed image or
cross-product of model inputs is cheap. Office archive expansion and sparse
worksheet budgets remain documented separately. Image headers now receive a bounded dimension/pixel check before decoding; PDF
text has per-page/document byte budgets and scoped deadlines. See
[PDF and image reading](PDF_LOADING.md). Animation cumulative allocations, other
transformed formats and complete model complexity budgeting need further work.
Production PDF readers/workers now receive exact-size and SHA-256 checks before
Blob execution; actual-runtime tests retain dedicated-worker coverage. See [runtime dependency evidence](RUNTIME_DEPENDENCY_TESTS.md).

## Office and legacy file behavior

Custom Office readers reject missing/malformed required XML and malformed present
optional parts. They reject DTD/entity declarations, honor workbook date1904, avoid
repeating nested Word-table paragraphs and resolve PowerPoint relationship IDs by
namespace. The template reader now parses number-format/style metadata through
the validated DOM, preserving date styles across equivalent prefixes, quote
styles and attribute order. XL4ADW export retains the template epoch when writing
date serials.

Workspace imports capture the original portfolio/scenario before readiness/file
reads; later switches do not redirect a property. Removed targets reject imports.
Portfolio JSON receives the 64 MiB pre-read and actual UTF-8 checks before parsing.
Member-file additions stage against unchanged property inputs/selection, and stale
reads retain the active edits. Shared-property Open failures reach the action error
handler. Uncached formula results and input Excel errors reject before conversion, with a
sheet/cell message; valid cached values are used without recalculation. The custom
XML readers also reject invalid shared-string references. Document intake consumes
every worksheet, so these checks cover every sheet there; the direct XL4ADW
template reader checks cells on sheets identified by their COL input row.
Legacy inflation tables also validate indices before expanding sparse schedules:
100,000 values per series and 200,000 values across a workbook, counting gaps;
duplicate or malformed indices reject. See [the input policy](SPREADSHEET_UPGRADE.md). Additional
date-column mappings include loan starts and valuation/cutoff dates. See
[spreadsheet policy](SPREADSHEET_UPGRADE.md). Spreadsheet loading and real-runtime scope are described in
[runtime dependency checks](RUNTIME_DEPENDENCY_TESTS.md).

## Extraction ownership

The existing optional extraction service is invoked only through the product's
explicit Extract action. It receives selected document content and model context
as described in the dependency inventory. This review's automated tests use a
local fake service and send no documents to an external model.

One extraction owns its controller and claims busy state before its first await.
The job captures the property, portfolio, scenario and model JSON, plus selected
documents/pages. Each asynchronous boundary verifies that ownership and selection.
Changing the model, switching context, removing a document or changing selected
pages prevents stale publication and further requests. Stop clears the busy state
immediately and aborts its controller; late replies cannot affect a subsequent job.
A sent request cannot be unsent if its provider ignores cancellation.

A rate-limited request has one abortable 30-second wait and one retry. Errors and
malformed or unsafe returned JSON are recoverable. Successful results remain a
review step; extraction never writes a property itself.

## Applying reviewed inputs

Apply captures the reviewed data, selected fields, mode and target. After any
confirmation it verifies those still match. The application builds a candidate
model on a clone and validates it before replacing live inputs. A failed conversion
or validation retains the original model and review. Capital-year array creation
is bounded to a 100-year input range.

Update mode publishes valid inputs and their provenance log together. Replace
mode builds the final model first and saves it as one new property, preserving the
original. Only a successful save with unchanged active context/review can open
that copy automatically. Edits or review changes made while the save is pending
stay active; the completed copy remains available separately. A failed save leaves
no partial copy. Duplicate apply clicks share a synchronous ownership guard.

Known field warnings still need underwriting judgment. Structural validation does
not independently verify every extracted financial assumption or replace review of
the selected source, dates, units and amounts.
