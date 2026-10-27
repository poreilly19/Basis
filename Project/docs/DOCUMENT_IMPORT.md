# Document intake and preview safety — 0.7.14

File previews own a request generation: choosing another template/workbook/file,
dismissing a preview or opening it invalidates earlier asynchronous reads. A late
success or error cannot replace the newer filename/model. Clearing document intake
invalidates in-flight reads and queued files from that batch.

## Finding document import

Open **Portfolio → Document Import**, or **Inputs → Data Workspace → Document Import**.
Choose **Configure AI** in the upload step, configure your OpenAI/Anthropic API key
under **Portfolio → Settings**, or use an
available host integration. Keys stay in memory for the current tab. See
[settings and AI setup](WORKSPACE_SETTINGS.md). Uploading reads locally; only the
explicit Extract action sends selected text/images and limited model context.

The progress indicator shows **Upload → Review → Apply**. After extraction,
uploaded documents collapse into a section you can reopen. **Selected Changes**
compares the property snapshot at extraction with a validated candidate produced
by the same mapper as Apply. Source quotes appear for the selected item, rather
than an unsupported claim that a quote proves every mapped field. Percentages
are displayed as percentages; the mapper and storage keep their existing units.
Property/market/valuation choices select individual fields; tenant, expense,
profile and other item choices include all mapped fields for that item. Review
the complete changes and uncheck any item you do not want to apply.

Copy mode previews removed rows and explains that the original stays in the
library. Empty selections cannot apply. A failed candidate validation is shown
before Apply; existing Apply validation and target checks still enforce atomicity.
The preview can generate temporary IDs but does not modify the model or source log.
The formerly ignored selected `goingInCap` input is now mapped and logged.

In-place AI setup retains uploaded documents and pasted text. Cancel discards
its draft. Saving a provider change invalidates an existing extraction review,
as before; the dialog explains this and retains documents for another extraction.

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

## Expiry and free-rent review (0.7.19)

An accepted explicit expiry selects date-entry mode, preventing an older term
length from overriding the source date. Keep Current retains the old date and
mode together. The inactive term-year/month values are preserved.

Free Rent Terms groups the entered month count, start lease month and source of
the grant (entered months or market). An accepted whole-month grant on a lease-
month anniversary uses its actual offset; explicit zero removes the primary
grant. A retained or corrected commencement is applied before deriving these
dates and fixed-dollar annual rent steps, so review and Apply agree.

The current grant model cannot directly represent arbitrary off-anniversary dates
or fractional free months. Those proposals remain unapplied with a review note;
existing free-rent fields are retained. Additional existing free windows are
also retained and flagged for review. The source schema does not specify partial
or gross/base-only abatement, so those existing settings are not inferred or
silently replaced. Confirm them in the lease editor against the source document.

## Extraction evidence, matches and units (0.7.20)

**Apply To** resolves fuzzy/ambiguous matches explicitly. Choosing another target
clears that proposal's field decisions; duplicate selected targets are blocked.
Known suites are grouped before missing suites, so an unspecified entry cannot
join two distinct leases solely through a shared name.

Each reviewed tenant field retains its supplying source. **Source Evidence**
shows whether its quote occurs in the uploaded page text; **View Source** uses the
local upload ID even when filenames repeat. Image, missing, short, excluded-page
and unmatched citations need manual checking. A text match does not verify the
meaning of a clause. Older item-level citations are labelled as tenant-level.

Rent units are required. A malformed or partly unsupported schedule is withheld
as a whole and the tenant is unchecked initially. Per-SF rates stay per-SF when
area changes. Partial abatements keep their actual duration, percentage and
base/gross scope; no equivalent-full-month conversion is used. New expense lines
with unknown recoverability are unchecked initially and, if included manually,
use non-recoverable status with a note. Existing flags are retained when unknown.

See [the extraction guide and remaining limits](AI_EXTRACTION_0_7_20.md).

## Amendment review (0.7.21)

Explicit rent-change scope distinguishes complete schedules, replacement from an
effective date, and changes to listed steps. Supported historical rent comes from
an uploaded base lease or the selected existing tenant. Recovery patches preserve
unmodified base terms; future-effective recovery changes are blocked because the
current per-lease structure cannot date them. Multiple distinct amendments need
stated execution dates for ordering.

Unresolved amendments block Apply without hiding review controls. Keep Current
or a complete manual correction resolves the affected group; merely opening
Correct does not. Native source-log metadata retains combined citations. See
[amendment handling and limits](AI_EXTRACTION_0_7_21.md).

## Statement and rent-roll reconciliation (0.7.22)

Document Totals compares each upload using its own source date and statement
period. It distinguishes matching arithmetic, a mismatch, and insufficient
information. Zero totals are checked. Original-period expense amounts reconcile
before supported model inputs are annualized; partial-year per-SF inputs retain
their stated periods. Invalid financial amounts or periods are withheld from
proposals, with instructions to enter corrected values manually. See
[reconciliation and limits](AI_EXTRACTION_0_7_22.md).
