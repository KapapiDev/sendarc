# Dependency and distribution inventory

Audited on 2026-08-29 for the SendArc `0.1.0-beta` release candidate. This
directory records the build graph, browser bundles, vendored source, and
non-source installer payloads that must be checked again at the immutable
release tag.

## Files

- `go-runtime.csv` is the hand-reviewed Windows runtime package report for the
  desktop application and MAPI module.
- `npm-workspace.csv` contains 294 unique packages from the desktop/frontend/test
  workspace lockfile.
- `npm-website.csv` contains 562 unique packages from the website lockfile.
- `installer-payloads.csv` records non-package installer inputs, source or
  distribution terms, and hashes where the input is a checked-in binary.

Both npm inventories are deterministic and contain zero packages with missing
license metadata. They intentionally include development and optional packages
so that build tooling is not silently omitted from the release audit.

## Reproduce

Run the checked-in npm generator from the repository root:

```text
npm run licenses:inventory
```

The security workflow reruns the generator and fails if either checked-in CSV
changes or a lockfile package lacks license metadata.

The Go inventory was produced with the pinned scanner in both module roots:

```text
cd src/app
go run github.com/google/go-licenses/v2@v2.0.1 report .

cd ../../internal/mapi
go run github.com/google/go-licenses/v2@v2.0.1 report .
```

`go-licenses` cannot associate the two local SendArc modules with the repository
root `LICENSE`, so those rows were classified manually as LGPL-3.0-or-later.
The local `go-webview2` replacement was also checked against its committed MIT
and ISC license files. The scanner warns that `fyne.io/systray` contains a
non-Go header; the module-level Apache-2.0 license was therefore checked
manually as well.

## Vendored and generated components

- The modified go-mapi source and SendArc application are covered by the root
  LGPL-3.0-or-later license and preserved upstream history.
- The vendored Wails WebView2 fork retains its MIT license and the loader's ISC
  license.
- `doctest.h` 2.4.11 is test-only: MIT, with embedded Catch2/lest portions under
  Boost-1.0 as stated in the header.
- Nunito is distributed under SIL OFL-1.1 in the frontend font directory.
- NSIS 3.12 produces the installer stub under zlib/libpng terms.
- The Microsoft-signed Evergreen WebView2 bootstrapper is redistributable with
  an application under Microsoft's WebView2 distribution guidance; it is not
  represented as open-source software.
- The previous precompiled NSIS ApplicationID plug-in was removed after the
  audit found no explicit license grant in its source repository. A
  repository-owned PowerShell helper now stamps the same Windows shortcut
  property using documented Windows interfaces.

The installer ships the project license, third-party notice, and these inventory
files in its `licenses` directory. The final release must still confirm the
matching public source tag and compare published artifact hashes with the tag's
build output.
