# Open-source release and original interface — October 27, 2026

Basis is close to a public **alpha** from a feature perspective. It is not yet
supported by the evidence needed to describe it as broadly validated underwriting
software. These are different milestones: open source does not require perfect
math or every proposed feature, but users need an honest statement of scope and
known limits. This is an engineering assessment and general U.S. copyright
information, not a determination of legal rights in the original interface.

## What is actually outstanding

| Before a public alpha | Evidence or decision needed |
| --- | --- |
| Right to distribute and an open-source license | The repository has **no project LICENSE**. Identify the rights holders and intended license. MIT or Apache-2.0 are common permissive choices; Apache-2.0 includes an express contributor patent grant and termination provisions. Neither licenses someone else's proprietary material. Publicly visible source without a license is not the same as open-source software. |
| Finish attribution and targeted provenance review | SheetJS and PDF.js versions and license texts are recorded. Complete component notices and check the origin of templates, samples, icons, distinctive report expression, and any directly copied material. Preserve the existing development history. A full legal opinion is not a statutory prerequisite for every open-source project; the recorded competitor references make a focused professional review sensible here. |
| State the supported alpha environment | Chromium on Linux has extensive local test evidence. Native Windows execution, the hosted CI workflow, Firefox and Safari are not verified. Test the intended Windows launcher and browser, publish the tested combinations, and leave unsupported combinations explicit. |
| Clear AI privacy/setup documentation | Selected document content and model context are sent to the chosen provider. API keys are tab-memory only; this does not prove provider-side privacy or protect against every browser script compromise. State recipients, content sent, account requirements/costs, and the requirement to review proposed values before Apply. Keep AI experimental until a live-account smoke test and an analyst-reviewed document benchmark exist. |
| A small reproducible release package | Synthetic examples, installation/export/restore instructions, a versioned download, a clear limitations page, a contribution policy and a private security-reporting route. Confirm which sample data may be published. No public repository, license selection or publication was performed in this pass. |

For planning, this is approximately **one or two focused release-preparation
cycles** if ownership and license decisions are straightforward. That is not a
calendar commitment: source-rights questions, Windows failures or live-provider
issues can change the work. Do not wait for all wishlist features before an alpha.

Before calling the application dependable for investment decisions, expand the
independent analyst-reviewed reference set: complex recoveries, rollover,
partial-month leases, CPI, financing draws, reporting periods and scenarios.
Test representative real leases, rent rolls and P&Ls against approved expected
fields and calculations. A large automated test count is useful evidence of
covered behavior, not proof that all financial paths or AI readings are correct.

## Can the original interface be restored?

Technically, yes. The retained original application at
`/workspace/scratch/original_v7_handoff.html` has SHA-256
`40c16952d92395ac15c8b0a40059fed35a9fc2c4a41e7d974c65b7fe3750b95c`, matching the
recorded original handoff. This review did not revert the working application.

The general point about functional layouts is substantially right, but it needs
a narrower formulation. [17 U.S.C. §102(b)](https://www.law.cornell.edu/uscode/text/17/102)
excludes ideas, procedures, processes, systems, methods of operation, concepts
and principles from copyright. Ordinary sidebar navigation, tabs, tables, form
fields, common labels and CRE formulas are not made exclusive merely because a
commercial competitor uses them. Section 102(a) also protects qualifying original
expression fixed in a tangible medium. Whether a particular arrangement is
original expression, functional, standard or too trivial is a fact-specific
question; the statute does not automatically clear a complete screen.

Original artwork, sufficiently expressive text or screen compositions, and code
can be protected. Trademark/trade-dress and potentially design-patent or contract
issues are separate questions, not a conclusion that any apply to Basis. Giving
the product away or using an open-source license does not remove third-party
rights. Jurisdictions outside the U.S. can apply different rules.

The specific reason for reviewing this project is its own
[development-history record](DEV_HISTORY.md): earlier versions referenced
competitor behavior, documentation, examples and screenshots. That is not proof
of infringement and does not establish which individual elements were copied.
Neither a different color scheme nor a generic-layout argument resolves that
provenance question.

The practical design recommendation is to restore the preferred **navigation and
workspace layout** on top of the corrected application, retaining the current
data protection, calculations, visible import controls, number formatting and
portfolio scoping. Evaluate identifiable expressive details and their sources
individually. An unusual layout is not required just for difference's sake.
Wholesale replacement with the old HTML would also restore known code defects,
so use the old file as a layout reference rather than the new deployable build.

## Evidence in this pass

The latest validation results are in [the release snapshot](VALIDATION_0_7_22.md).
The new extraction checks are described in
[AI extraction and statement reconciliation](AI_EXTRACTION_0_7_22.md).
The text of §102 was read through Cornell's Legal Information Institute on
October 27, 2026. Direct Copyright Office source requests returned HTTP 403, so
this assessment does not claim a fresh review of those circulars or case law.
No competitor product inspection or legal clearance was performed.
