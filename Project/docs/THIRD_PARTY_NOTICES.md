# Third-party runtime notices

Basis Studio's original code is licensed under the [MIT License](../LICENSE).
These notices describe external components used by Basis, which retain their
own licenses. The MIT project license does not replace or relicense those
components. The web application requests the listed runtime versions when needed.
The Windows desktop package includes verified copies of the supported SheetJS
and PDF.js runtimes so these features can work offline, with their complete
license files. Desktop build tooling and Rust dependencies are separately
recorded by the desktop package and Cargo lockfiles; this runtime notice is not
a complete transitive-component SBOM.

## Native Windows components

Desktop distributions also include `NATIVE_THIRD_PARTY_NOTICES.txt` and
`native-license-inventory.json`, generated from locked Cargo metadata with
copied upstream license texts. The inventory can include build-time and
other-platform packages; inclusion does not mean each crate is linked into the
Windows executable. It is not a complete SBOM or legal clearance.

Some published crates omit their repository-root license files. The narrowly
scoped [supplement evidence](third_party/native-license-supplements.json) records
the exact crate version, repository, source commit, upstream URL and file hash
for the distribution-supplied originals. Other missing or unknown licenses cause
generation to fail. Legacy slash-separated Cargo license declarations are
recorded unchanged and explicitly normalized as license alternatives.

MPL-2.0 packages receive separate source-availability flags. Exact upstream
`.crate` source archives accompany the desktop distribution under
`native-sources`, with SHA-256 checksums verified against `Cargo.lock`. The
inventory records the corresponding public source download URLs. The
[official MPL-2.0 text](third_party/MPL_2_0.txt) is also included where a published
crate omits the full text. This records the distribution's evidence and source
supplement; it does not settle broader provenance or legal review.

## SheetJS Community Edition 0.20.3

SheetJS Community Edition — <https://sheetjs.com/>

Copyright (C) 2012-present SheetJS LLC. Licensed under Apache License 2.0.
See the [complete upstream license](third_party/SHEETJS_LICENSE_0_20_3.txt).
The fetched standalone artifact also retains its own copyright header. Basis
does not modify that script. The desktop package includes the same pinned
artifact and the accompanying Apache 2.0 license.

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
loaded from versioned CDN modules in the web application and is not modified by
Basis. Desktop packages the verified supported reader and worker locally with
the same upstream license; its runtime inventory identifies the included files.

This is a component notice record. A complete transitive-component SBOM,
attribution/provenance review and review of other host-provided services remain
open. See [the dependency inventory](DEPENDENCIES.md) and
[runtime artifact evidence](RUNTIME_DEPENDENCY_TESTS.md).
