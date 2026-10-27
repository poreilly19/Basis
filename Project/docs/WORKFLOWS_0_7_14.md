# Requested workflows — 0.7.14

This update implements UI suggestions 3, 5 and 6 in the chat workspace.

## 3. Lease editor drawer

Open **Model → Lease Book → Rent Roll**, then **Edit** beside a tenant. The selected
row stays visible on desktop while a drawer opens on the right. On a phone the
drawer fills the screen. Close or Escape returns to the rent roll and restores
focus and table scroll position.

**Term and Status** starts open. Other sections contain rent and recoveries, free
rent, expiration/termination options when applicable, improvements/commissions,
percentage rent, vacancy/credit, the rent schedule and a projected lease timeline.
Changing a selector reveals its applicable fields. Existing detailed lease terms
and the underlying financial engine remain available.

Edits enter the current model on field change/blur and use the Workspace autosave
preference. Close does not discard committed edits. Use existing Undo after closing
to reverse edits, or Save Changes when autosave is off. Opening the editor alone
does not initialize optional arrays or mark the model edited. Background calculation
preserves unfinished typing. Switching the active property/scenario or leaving the
rent roll closes the drawer; its controls cannot write to the next property.

## 5. Upload → Review → Apply

Open **Workspace → Document Import** (also under Model → Data Workspace). Choose
files or paste text. **Configure AI** opens provider/model/key setup in place.
Configuring sends no documents; **Extract** is the explicit send action. API keys
remain in tab memory and are not saved with models or browser storage.

After extraction, review selected items, checks and source quotes. **Selected
Changes** shows Current and Proposed values using the same mapping as Apply.
Current means the captured property snapshot, and stale-model checks prevent its
application after edits or a context switch. Changes to item selections refresh
the comparison. Source quotes belong to the selected item; they are evidence to
review, not an accuracy guarantee for every generated field.

Choose **Update the model** or **Create a new property**. Copy mode explains
removed rows and preserves the original. **Apply selected** completes the workflow
and records source information. Applying no selected items is blocked. Existing
read limits, provider budgets, target checks and clone/validate/commit protections
remain in effect. Saved AI changes invalidate an existing review but retain the
uploaded documents so you can extract again.

Property/market/valuation selections are field-based. Tenants and other structured
items are selected as a whole, including the mapped fields shown in the comparison.
Per-field editing within an extracted tenant, a document-page viewer and independent
extraction accuracy benchmarks remain future work. Live provider accounts were not
used for this update's tests.

## 6. Group chips, filters and bulk assignment

Named chips show each tenant's memberships in **Tenant Groups → Tenant Assignments**,
the rent roll classification view and the lease drawer. Click a chip to open the
existing searchable group picker.

Search tenant names/suites or filter by a group, including **Ungrouped**. The rent
roll also has these filters. Whole-property totals and calculations remain unchanged.
Changing a filter clears selected rows. Select All includes only visible tenants.

Select assignment rows to reveal bulk actions. Choose a group, **Add Group** or
**Remove Group**, review the named tenants, then apply. Each operation preserves all
other memberships and is one undo step. All targets are validated before any write;
a stale target or limit error leaves the whole batch unchanged. Selection and
filter state belongs to the current model and is kept outside saved files.

Native schema-v1 and existing Basis workbook/JSON group round-trips are unchanged.
The XL4ADW workbook adapter still does not carry custom tenant groups.

See [validation](VALIDATION_0_7_14.md) for measured checks and remaining limits.
