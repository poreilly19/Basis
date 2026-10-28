# Third-party runtime notices

Basis Studio's original code is licensed under the [MIT License](../LICENSE).
These notices describe external components used by Basis, which retain their
own licenses. The MIT project license does not replace or relicense those
components. No third-party runtime JavaScript is bundled in this handoff; the
application requests the listed versions when needed.

## SheetJS Community Edition 0.20.3

SheetJS Community Edition — <https://sheetjs.com/>

Copyright (C) 2012-present SheetJS LLC. Licensed under Apache License 2.0.
See the [complete upstream license](third_party/SHEETJS_LICENSE_0_20_3.txt).
The fetched standalone artifact also retains its own copyright header. Basis
does not modify that script.

Upstream's [license and attribution guidance](https://docs.sheetjs.com/docs/miscellany/license/)
identifies this Community Edition license and explains the required disclosures.
SheetJS Pro has separate terms and is not included. Package and distribution
license files fetched for 0.20.3 match the enclosed license byte for byte.

The optional compatibility test executes the previously pinned 0.18.5 writer in
an isolated iframe using original trusted input, then reads its workbook with
0.20.3. That old artifact is pinned only as a test reference. It is not an app
fallback or an accepted preloaded runtime version.

## PDF.js 4.10.38 and fallback 4.4.168

PDF.js is a Mozilla project: <https://mozilla.github.io/pdf.js/>.
The distribution headers identify Apache License 2.0. The handoff encloses the
[upstream 4.10.38 license](third_party/PDFJS_LICENSE_4_10_38.txt); the PDF code is
loaded from the existing versioned CDN modules and is not modified by Basis.

This is a component notice record. A complete transitive-component SBOM,
attribution/provenance review and review of other host-provided services remain
open. See [the dependency inventory](DEPENDENCIES.md) and
[runtime artifact evidence](RUNTIME_DEPENDENCY_TESTS.md).
