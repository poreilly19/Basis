# Tenant groups — 0.7.14

A tenant can belong to several groups, such as Industrial, Credit Tenants and
Renewal Watch. These are property-specific classifications. They do not allocate
rent, change recoveries or add another lease to the financial calculation.

## Assign groups

1. Open a property, then **Model → Lease Book → Tenant Groups**.
2. Use **+ Add Group** to create and name the groups you need.
3. In **Tenant Assignments**, click the tenant's group button, check all applicable
   groups and select **Apply Groups**. Search filters the choices while retaining
   selections. Cancel or Escape discards pending selections.

The same picker is available from **Rent Roll → Edit** and from **View → Tenant
Classifications** or **All Columns**. The Essentials view remains compact.
No selection means the tenant has no group. Memberships save with the property
using the existing autosave/manual-save preference and participate in undo/redo.

Group names now appear as chips. Click the chips to edit the tenant's memberships.
Use **Search Tenants** or **Filter by Tenant Group** in Tenant Assignments or Rent
Roll to find tenants, including **Ungrouped**. Filtering does not change cash flows
or whole-property totals. Filters and row selections reset when the active model
or portfolio/scenario changes; they are not saved into model files.

For bulk changes, select rows in **Tenant Assignments**, choose a **Bulk Group**,
then **Add Group** or **Remove Group**. Review the named tenants and apply. Other
memberships, including unresolved IDs, are preserved. **Select All Visible Tenants**
selects only the filtered rows. Changing a filter clears the selection. Each
completed batch is one undo step. A missing tenant/group, stale property or changed
memberships blocks the whole batch before any tenant is modified.

Each tenant contributes its entered area once to each assigned group. Areas can
overlap across groups; adding group areas is not a property-area calculation.
Deleting a group removes only that membership. Scenario/property copies retain
independent assignments, and a contract renewal starts with a separate copy of
the original lease's memberships. Group names appear in Tenant Summary and the
basic tenant tables in the Basis Reports download.

## File compatibility

- Native `.basiscre` property and portfolio archives and Basis model JSON preserve
  all group IDs and definitions. This is an optional additive schema-v1 field.
- Editable Basis model XLSX uses `Tenants.groups`, a JSON array of group IDs, and
  a display-only `groups (name)` column. A blank groups cell retains the legacy
  `group` value; `[]` explicitly clears memberships. The display column is ignored
  on import. Dictionary-less workbooks also recognize the `groups` JSON column.
- Older models with only `tenant.group` continue to work and are not rewritten
  simply by opening or viewing them. On an assignment change, `tenant.groups`
  becomes authoritative and `tenant.group` mirrors its first ID (or `""`).
- Older Basis builds understand only the primary group. Avoid editing group
  assignments in those builds: they cannot maintain multiple memberships and an
  old primary edit may disagree with the retained authoritative array.
- Unknown group IDs remain saved and appear as **Missing Group: ID** in the
  picker, where they can be removed deliberately. They are not silently dropped.
- The separate ARGUS/XL4ADW adapter does **not** import or export custom tenant
  classifications. Its preview now states that limitation. Use the native or
  Basis model formats to retain all assignments.

When present, `groups` must be an array of no more than 1,000 unique, nonempty
string IDs, each no longer than 1,000 characters. Invalid shape, duplicate IDs
and oversized lists are rejected on model-file read and write. The bound is a
data-size limit. Definitions need not all be present in a partial model.

The picker checks that its property, tenant, memberships and selected group
definitions are still current before applying. Keyboard focus stays within the
dialog and returns to the group button on close.

See [current validation](VALIDATION_0_7_14.md) and [format validation](VALIDATION_0_7_13.md)
for test coverage and limits.
